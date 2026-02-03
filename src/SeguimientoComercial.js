import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { 
  Search, Plus, Edit2, Trash2, X, Save, Users, Phone, Mail, MessageCircle,
  ChevronUp, ChevronDown, FileSpreadsheet, Clock, MapPin, Settings
} from 'lucide-react';
import * as XLSX from 'xlsx';
import './ComprasCargas.css';

// Valores por defecto de alertas
const ALERTA_DEFAULTS = {
  'WhatsApp': 3,
  'Email': 5,
  'Teléfono': 4,
  'Presencial': 7,
  'Otro': 5
};

// Estados semáforo
const ESTADOS = {
  rojo: { label: 'Seguimiento Activo', color: '#dc2626', bg: '#fef2f2', icon: '🔴' },
  amarillo: { label: 'Con Interés', color: '#d97706', bg: '#fffbeb', icon: '🟡' },
  verde: { label: 'No Interesado', color: '#16a34a', bg: '#f0fdf4', icon: '🟢' }
};

export default function SeguimientoComercial({ isAdmin = false }) {
  const [contactos, setContactos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'dias_sin_contacto', direction: 'desc' });
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [soloAlertas, setSoloAlertas] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // Config de alertas (persiste en localStorage)
  const storageKey = isAdmin ? 'alertas_admin' : 'alertas_vendedor';
  const [alertaDias, setAlertaDias] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    // Vendedor hereda config admin si existe
    if (!isAdmin) {
      const adminConfig = localStorage.getItem('alertas_admin');
      if (adminConfig) {
        try { return JSON.parse(adminConfig); } catch (e) { /* ignore */ }
      }
    }
    return { ...ALERTA_DEFAULTS };
  });

  const guardarConfig = (canal, dias) => {
    const nuevo = { ...alertaDias, [canal]: parseInt(dias) || 1 };
    setAlertaDias(nuevo);
    localStorage.setItem(storageKey, JSON.stringify(nuevo));
  };

  // Historial
  const [showHistorial, setShowHistorial] = useState(false);
  const [historialContacto, setHistorialContacto] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [nuevoRegistro, setNuevoRegistro] = useState({ canal: 'WhatsApp', nota: '', fecha: '' });

  const emptyForm = {
    nombre_cliente: '',
    empresa_clinica: '',
    telefono: '',
    email: '',
    equipo_interes: '',
    propuesta_enviada: '',
    estado: 'amarillo',
    canal_preferido: 'WhatsApp',
    ultimo_contacto: '',
    notas: '',
    vendedor: ''
  };

  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    fetchContactos();
  }, []);

  const fetchContactos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('seguimiento_comercial')
        .select('*')
        .order('ultimo_contacto', { ascending: true });

      if (error) throw error;
      setContactos(data || []);
    } catch (error) {
      console.error('Error cargando contactos:', error);
      alert('Error al cargar contactos');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistorial = async (contactoId) => {
    try {
      const { data, error } = await supabase
        .from('historial_contactos')
        .select('*')
        .eq('seguimiento_id', contactoId)
        .order('fecha', { ascending: false });

      if (error) throw error;
      setHistorial(data || []);
    } catch (error) {
      console.error('Error cargando historial:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Calcular días sin contacto
  const diasSinContacto = (ultimoContacto) => {
    if (!ultimoContacto) return 999;
    const ultimo = new Date(ultimoContacto);
    const hoy = new Date();
    const diff = Math.floor((hoy - ultimo) / (1000 * 60 * 60 * 24));
    return diff;
  };

  // Verificar si necesita alerta
  const necesitaAlerta = (contacto) => {
    if (contacto.estado === 'verde') return false;
    const dias = diasSinContacto(contacto.ultimo_contacto);
    const limite = alertaDias[contacto.canal_preferido] || 5;
    return dias >= limite;
  };

  const generateCodigo = () => {
    const year = new Date().getFullYear();
    const last = contactos.length > 0 ? contactos[0] : null;
    let nextNumber = 1;
    if (last && last.codigo) {
      const match = last.codigo.match(/SC-(\d{4})-(\d+)/);
      if (match && parseInt(match[1]) === year) {
        nextNumber = parseInt(match[2]) + 1;
      }
    }
    return `SC-${year}-${nextNumber.toString().padStart(4, '0')}`;
  };

  const openNewModal = () => {
    setEditingItem(null);
    setFormData({
      ...emptyForm,
      ultimo_contacto: new Date().toISOString().split('T')[0]
    });
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      nombre_cliente: item.nombre_cliente || '',
      empresa_clinica: item.empresa_clinica || '',
      telefono: item.telefono || '',
      email: item.email || '',
      equipo_interes: item.equipo_interes || '',
      propuesta_enviada: item.propuesta_enviada || '',
      estado: item.estado || 'amarillo',
      canal_preferido: item.canal_preferido || 'WhatsApp',
      ultimo_contacto: item.ultimo_contacto || '',
      notas: item.notas || '',
      vendedor: item.vendedor || ''
    });
    setShowModal(true);
  };

  const openHistorialModal = async (contacto) => {
    setHistorialContacto(contacto);
    setNuevoRegistro({ 
      canal: contacto.canal_preferido || 'WhatsApp', 
      nota: '', 
      fecha: new Date().toISOString().split('T')[0] 
    });
    await fetchHistorial(contacto.id);
    setShowHistorial(true);
  };

  const agregarRegistroHistorial = async () => {
    if (!nuevoRegistro.nota.trim()) {
      alert('Ingresa una nota sobre el contacto');
      return;
    }

    try {
      // Guardar en historial
      const { error: histError } = await supabase
        .from('historial_contactos')
        .insert([{
          seguimiento_id: historialContacto.id,
          fecha: nuevoRegistro.fecha || new Date().toISOString().split('T')[0],
          canal: nuevoRegistro.canal,
          nota: nuevoRegistro.nota
        }]);

      if (histError) throw histError;

      // Actualizar último contacto en seguimiento
      const { error: updateError } = await supabase
        .from('seguimiento_comercial')
        .update({ 
          ultimo_contacto: nuevoRegistro.fecha || new Date().toISOString().split('T')[0],
          canal_preferido: nuevoRegistro.canal
        })
        .eq('id', historialContacto.id);

      if (updateError) throw updateError;

      // Refrescar datos
      setNuevoRegistro({ canal: nuevoRegistro.canal, nota: '', fecha: new Date().toISOString().split('T')[0] });
      await fetchHistorial(historialContacto.id);
      await fetchContactos();
    } catch (error) {
      alert('Error al guardar: ' + error.message);
    }
  };

  const handleSave = async () => {
    if (!formData.nombre_cliente.trim()) {
      alert('El nombre del cliente es obligatorio');
      return;
    }

    try {
      setSaving(true);

      const dataToSave = {
        nombre_cliente: formData.nombre_cliente,
        empresa_clinica: formData.empresa_clinica || null,
        telefono: formData.telefono || null,
        email: formData.email || null,
        equipo_interes: formData.equipo_interes || null,
        propuesta_enviada: formData.propuesta_enviada || null,
        estado: formData.estado,
        canal_preferido: formData.canal_preferido,
        ultimo_contacto: formData.ultimo_contacto || null,
        notas: formData.notas || null,
        vendedor: formData.vendedor || null
      };

      let error;
      if (editingItem) {
        const result = await supabase
          .from('seguimiento_comercial')
          .update(dataToSave)
          .eq('id', editingItem.id);
        error = result.error;
      } else {
        dataToSave.codigo = generateCodigo();
        const result = await supabase
          .from('seguimiento_comercial')
          .insert([dataToSave]);
        error = result.error;
      }

      if (error) throw error;

      await fetchContactos();
      setShowModal(false);
    } catch (error) {
      alert('Error al guardar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteContacto = async (id, nombre) => {
    if (!window.confirm(`¿Eliminar contacto "${nombre}"?`)) return;
    try {
      const { error } = await supabase.from('seguimiento_comercial').delete().eq('id', id);
      if (error) throw error;
      await fetchContactos();
    } catch (error) {
      alert('Error al eliminar: ' + error.message);
    }
  };

  const cambiarEstadoRapido = async (contacto, nuevoEstado) => {
    try {
      const { error } = await supabase
        .from('seguimiento_comercial')
        .update({ estado: nuevoEstado })
        .eq('id', contacto.id);
      if (error) throw error;
      await fetchContactos();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  // Formatos
  const formatFecha = (fechaStr) => {
    if (!fechaStr) return '-';
    const fecha = new Date(fechaStr);
    return `${fecha.getDate().toString().padStart(2, '0')}/${(fecha.getMonth() + 1).toString().padStart(2, '0')}/${fecha.getFullYear().toString().slice(-2)}`;
  };

  const canalIcon = (canal) => {
    switch (canal) {
      case 'WhatsApp': return <MessageCircle size={14} />;
      case 'Email': return <Mail size={14} />;
      case 'Teléfono': return <Phone size={14} />;
      case 'Presencial': return <MapPin size={14} />;
      default: return <MessageCircle size={14} />;
    }
  };

  // Sorting
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <ChevronUp size={14} style={{ opacity: 0.3 }} />;
    return sortConfig.direction === 'asc' 
      ? <ChevronUp size={14} style={{ color: '#567C8D' }} /> 
      : <ChevronDown size={14} style={{ color: '#567C8D' }} />;
  };

  // Filtro y sort
  const filteredContactos = useMemo(() => {
    let result = contactos.map(c => ({
      ...c,
      dias_sin_contacto: diasSinContacto(c.ultimo_contacto),
      tiene_alerta: necesitaAlerta(c)
    }));

    // Filtro por estado
    if (filtroEstado !== 'todos') {
      result = result.filter(c => c.estado === filtroEstado);
    }

    // Solo alertas
    if (soloAlertas) {
      result = result.filter(c => c.tiene_alerta);
    }

    // Búsqueda
    if (searchTerm) {
      const terms = searchTerm.toLowerCase().split(' ').filter(t => t.length > 0);
      const includeTerms = terms.filter(t => !t.startsWith('-'));
      const excludeTerms = terms.filter(t => t.startsWith('-')).map(t => t.substring(1)).filter(t => t.length > 0);

      result = result.filter(c => {
        const text = [
          c.nombre_cliente, c.empresa_clinica, c.equipo_interes,
          c.propuesta_enviada, c.notas, c.vendedor
        ].filter(Boolean).join(' ').toLowerCase();

        const includesAll = includeTerms.length === 0 || includeTerms.every(t => text.includes(t));
        const excludesAll = excludeTerms.length === 0 || excludeTerms.every(t => !text.includes(t));
        return includesAll && excludesAll;
      });
    }

    // Sort
    if (sortConfig.key) {
      result = [...result].sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        if (sortConfig.key === 'dias_sin_contacto') {
          aVal = a.dias_sin_contacto;
          bVal = b.dias_sin_contacto;
        } else if (sortConfig.key.includes('fecha') || sortConfig.key === 'ultimo_contacto') {
          aVal = aVal ? new Date(aVal).getTime() : 0;
          bVal = bVal ? new Date(bVal).getTime() : 0;
        } else {
          aVal = (aVal || '').toString().toLowerCase();
          bVal = (bVal || '').toString().toLowerCase();
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactos, searchTerm, sortConfig, filtroEstado, soloAlertas]);

  // Stats
  const stats = useMemo(() => {
    const total = contactos.length;
    const conAlerta = contactos.filter(c => necesitaAlerta(c)).length;
    const rojos = contactos.filter(c => c.estado === 'rojo').length;
    const amarillos = contactos.filter(c => c.estado === 'amarillo').length;
    const verdes = contactos.filter(c => c.estado === 'verde').length;
    return { total, conAlerta, rojos, amarillos, verdes };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactos]);

  // Export
  const exportToExcel = () => {
    const data = filteredContactos.map(c => ({
      'Cliente': c.nombre_cliente,
      'Empresa/Clínica': c.empresa_clinica || '',
      'Teléfono': c.telefono || '',
      'Email': c.email || '',
      'Equipo Interés': c.equipo_interes || '',
      'Propuesta': c.propuesta_enviada || '',
      'Estado': ESTADOS[c.estado]?.label || c.estado,
      'Canal': c.canal_preferido || '',
      'Último Contacto': c.ultimo_contacto ? formatFecha(c.ultimo_contacto) : '',
      'Días sin contacto': c.dias_sin_contacto,
      'Alerta': c.tiene_alerta ? 'SÍ' : '',
      'Vendedor': c.vendedor || '',
      'Notas': c.notas || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = data.length > 0 ? Object.keys(data[0]).map(() => ({ wch: 18 })) : [];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Seguimiento');
    XLSX.writeFile(wb, `seguimiento-comercial-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) {
    return (
      <div className="cc-loading">
        <div className="cc-spinner"></div>
        <p>Cargando seguimiento...</p>
      </div>
    );
  }

  return (
    <div className="cc-container">
      {/* Header */}
      <div className="cc-header">
        <div>
          <h1 className="cc-title"><Users size={28} /> Seguimiento Comercial</h1>
          <p className="cc-subtitle">CRM de contactos y pipeline de ventas</p>
        </div>
      </div>

      {/* Stats */}
      <div className="cc-stats-grid">
        <div className="cc-stat-card" style={{ textAlign: 'center', padding: '1rem' }}>
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b', marginBottom: '0.5rem', fontWeight: '600' }}>Contactos</div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#2F4156', lineHeight: '1' }}>{stats.total}</div>
        </div>
        <div className="cc-stat-card" style={{ textAlign: 'center', padding: '1rem', cursor: 'pointer', border: soloAlertas ? '2px solid #dc2626' : undefined }} onClick={() => setSoloAlertas(!soloAlertas)}>
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#dc2626', marginBottom: '0.5rem', fontWeight: '600' }}>
            ⚠️ Requieren Atención
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#dc2626', lineHeight: '1' }}>{stats.conAlerta}</div>
        </div>
        <div className="cc-stat-card" style={{ textAlign: 'center', padding: '1rem' }}>
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b', marginBottom: '0.5rem', fontWeight: '600' }}>Por Estado</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', fontSize: '1.1rem', fontWeight: '700' }}>
            <span style={{ color: '#dc2626' }}>🔴 {stats.rojos}</span>
            <span style={{ color: '#d97706' }}>🟡 {stats.amarillos}</span>
            <span style={{ color: '#16a34a' }}>🟢 {stats.verdes}</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ 
        background: 'white', borderRadius: '12px', padding: '1rem 1.25rem', 
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem'
      }}>
        {/* Fila 1: Búsqueda + Botones */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ 
            flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: '#f1f5f9', borderRadius: '8px', padding: '0.6rem 1rem', border: '2px solid #e2e8f0'
          }}>
            <Search size={18} style={{ color: '#567C8D', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Buscar por cliente, equipo, vendedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ border: 'none', background: 'transparent', width: '100%', outline: 'none', fontSize: '0.95rem', color: '#2F4156' }}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#94a3b8' }}>
                <X size={16} />
              </button>
            )}
          </div>
          <button onClick={exportToExcel} className="cc-btn cc-btn-secondary" title="Excel">
            <FileSpreadsheet size={18} /> Excel
          </button>
          <button onClick={() => setShowConfig(!showConfig)} className="cc-btn cc-btn-secondary" title="Configurar alertas"
            style={{ background: showConfig ? '#567C8D' : undefined, color: showConfig ? 'white' : undefined }}>
            <Settings size={18} />
          </button>
          <button onClick={openNewModal} className="cc-btn cc-btn-primary">
            <Plus size={18} /> Nuevo Contacto
          </button>
        </div>

        {/* Panel de configuración de alertas */}
        {showConfig && (
          <div style={{ 
            background: '#f8fafc', padding: '1rem', borderRadius: '8px', 
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#2F4156', margin: 0 }}>
                ⚙️ Alertas de seguimiento {isAdmin ? '(Config. por defecto)' : '(Mi configuración)'}
              </h4>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                Días sin contacto antes de generar alerta
              </span>
            </div>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {Object.keys(alertaDias).map(canal => (
                <div key={canal} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '500', minWidth: '75px' }}>{canal}:</span>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={alertaDias[canal]}
                    onChange={(e) => guardarConfig(canal, e.target.value)}
                    style={{ 
                      width: '50px', padding: '0.3rem 0.4rem', borderRadius: '6px', 
                      border: '1px solid #e2e8f0', fontSize: '0.85rem', textAlign: 'center'
                    }}
                  />
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>días</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fila 2: Filtros */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>Filtrar:</span>
          {['todos', 'rojo', 'amarillo', 'verde'].map(est => (
            <button
              key={est}
              onClick={() => setFiltroEstado(est)}
              style={{
                padding: '0.3rem 0.75rem', borderRadius: '20px', border: '1px solid #e2e8f0',
                fontSize: '0.8rem', cursor: 'pointer', fontWeight: '600',
                background: filtroEstado === est ? (est === 'todos' ? '#2F4156' : ESTADOS[est]?.bg || '#f1f5f9') : 'white',
                color: filtroEstado === est ? (est === 'todos' ? 'white' : ESTADOS[est]?.color || '#64748b') : '#64748b'
              }}
            >
              {est === 'todos' ? 'Todos' : `${ESTADOS[est]?.icon} ${ESTADOS[est]?.label}`}
            </button>
          ))}
          <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginLeft: 'auto' }}>
            {filteredContactos.length} {filteredContactos.length === 1 ? 'resultado' : 'resultados'}
          </span>
        </div>
      </div>

      {/* Tabla */}
      <div className="cc-table-container">
        <table className="cc-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>Estado</th>
              <th onClick={() => handleSort('nombre_cliente')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Cliente <SortIcon columnKey="nombre_cliente" />
              </th>
              <th onClick={() => handleSort('equipo_interes')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Equipo / Interés <SortIcon columnKey="equipo_interes" />
              </th>
              <th onClick={() => handleSort('canal_preferido')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Canal <SortIcon columnKey="canal_preferido" />
              </th>
              <th onClick={() => handleSort('ultimo_contacto')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Último Contacto <SortIcon columnKey="ultimo_contacto" />
              </th>
              <th onClick={() => handleSort('dias_sin_contacto')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'center' }}>
                Días <SortIcon columnKey="dias_sin_contacto" />
              </th>
              <th onClick={() => handleSort('vendedor')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Vendedor <SortIcon columnKey="vendedor" />
              </th>
              <th style={{ width: '120px' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredContactos.map(c => {
              return (
                <tr key={c.id} style={{ background: c.tiene_alerta ? '#fff7ed' : undefined }}>
                  <td>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      {['rojo', 'amarillo', 'verde'].map(e => (
                        <button
                          key={e}
                          onClick={() => cambiarEstadoRapido(c, e)}
                          title={ESTADOS[e].label}
                          style={{
                            width: '18px', height: '18px', borderRadius: '50%', border: '2px solid',
                            borderColor: c.estado === e ? ESTADOS[e].color : '#e2e8f0',
                            background: c.estado === e ? ESTADOS[e].color : 'transparent',
                            cursor: 'pointer', padding: 0
                          }}
                        />
                      ))}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: '600', color: '#2F4156' }}>{c.nombre_cliente}</div>
                    {c.empresa_clinica && (
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{c.empresa_clinica}</div>
                    )}
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{c.equipo_interes || '-'}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem', color: '#64748b' }}>
                      {canalIcon(c.canal_preferido)} {c.canal_preferido}
                    </div>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{formatFecha(c.ultimo_contacto)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '700',
                      background: c.tiene_alerta ? '#fef2f2' : '#f1f5f9',
                      color: c.tiene_alerta ? '#dc2626' : '#64748b'
                    }}>
                      {c.dias_sin_contacto === 999 ? '-' : c.dias_sin_contacto}d
                      {c.tiene_alerta && ' ⚠️'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{c.vendedor || '-'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button onClick={() => openHistorialModal(c)} className="cc-btn-icon" title="Registrar contacto" style={{ background: '#f0fdf4' }}>
                        <Clock size={14} />
                      </button>
                      <button onClick={() => openEditModal(c)} className="cc-btn-icon" title="Editar">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => deleteContacto(c.id, c.nombre_cliente)} className="cc-btn-icon cc-btn-danger" title="Eliminar">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredContactos.length === 0 && (
        <div className="cc-empty-state">
          <Users size={48} strokeWidth={1} />
          <h3>No hay contactos</h3>
          <p>{searchTerm ? 'No se encontraron resultados' : 'Agrega tu primer contacto comercial'}</p>
          {!searchTerm && (
            <button onClick={openNewModal} className="cc-btn cc-btn-primary">
              <Plus size={18} /> Nuevo Contacto
            </button>
          )}
        </div>
      )}

      {/* Modal Nuevo/Editar */}
      {showModal && (
        <div className="cc-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="cc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px' }}>
            <div className="cc-modal-header">
              <h2><Users size={20} /> {editingItem ? 'Editar Contacto' : 'Nuevo Contacto'}</h2>
              <button onClick={() => setShowModal(false)} className="cc-modal-close"><X size={20} /></button>
            </div>

            <div className="cc-modal-body">
              {/* Datos del Cliente */}
              <div className="cc-form-section">
                <h3 className="cc-section-title">Datos del Cliente</h3>
                <div className="cc-form-grid">
                  <div className="cc-form-group">
                    <label className="cc-form-label">Nombre *</label>
                    <input type="text" className="cc-form-input" value={formData.nombre_cliente}
                      onChange={(e) => handleInputChange('nombre_cliente', e.target.value)}
                      placeholder="Dra. Paz, Dr. López..." required />
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Empresa / Clínica</label>
                    <input type="text" className="cc-form-input" value={formData.empresa_clinica}
                      onChange={(e) => handleInputChange('empresa_clinica', e.target.value)}
                      placeholder="Nombre de la clínica..." />
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Teléfono</label>
                    <input type="text" className="cc-form-input" value={formData.telefono}
                      onChange={(e) => handleInputChange('telefono', e.target.value)}
                      placeholder="+595 ..." />
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Email</label>
                    <input type="email" className="cc-form-input" value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="correo@..." />
                  </div>
                </div>
              </div>

              {/* Interés Comercial */}
              <div className="cc-form-section">
                <h3 className="cc-section-title">Interés Comercial</h3>
                <div className="cc-form-grid">
                  <div className="cc-form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="cc-form-label">Equipo / Producto de Interés</label>
                    <input type="text" className="cc-form-input" value={formData.equipo_interes}
                      onChange={(e) => handleInputChange('equipo_interes', e.target.value)}
                      placeholder="Ultraformer, Aquapure, radiofrecuencia..." />
                  </div>
                  <div className="cc-form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="cc-form-label">Propuesta Enviada</label>
                    <textarea className="cc-form-input" rows="2" value={formData.propuesta_enviada}
                      onChange={(e) => handleInputChange('propuesta_enviada', e.target.value)}
                      placeholder="Precios, financiación, condiciones..." />
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Vendedor</label>
                    <input type="text" className="cc-form-input" value={formData.vendedor}
                      onChange={(e) => handleInputChange('vendedor', e.target.value)}
                      placeholder="Nombre del vendedor" />
                  </div>
                </div>
              </div>

              {/* Estado y Seguimiento */}
              <div className="cc-form-section">
                <h3 className="cc-section-title">Estado y Seguimiento</h3>
                <div className="cc-form-grid">
                  <div className="cc-form-group">
                    <label className="cc-form-label">Estado</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {Object.entries(ESTADOS).map(([key, val]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => handleInputChange('estado', key)}
                          style={{
                            flex: 1, padding: '0.5rem', borderRadius: '8px', cursor: 'pointer',
                            border: formData.estado === key ? `2px solid ${val.color}` : '2px solid #e2e8f0',
                            background: formData.estado === key ? val.bg : 'white',
                            color: formData.estado === key ? val.color : '#94a3b8',
                            fontWeight: '600', fontSize: '0.8rem', textAlign: 'center'
                          }}
                        >
                          {val.icon} {val.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Canal Preferido</label>
                    <select className="cc-form-input" value={formData.canal_preferido}
                      onChange={(e) => handleInputChange('canal_preferido', e.target.value)}>
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Email">Email</option>
                      <option value="Teléfono">Teléfono</option>
                      <option value="Presencial">Presencial</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Último Contacto</label>
                    <input type="date" className="cc-form-input" value={formData.ultimo_contacto}
                      onChange={(e) => handleInputChange('ultimo_contacto', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Notas */}
              <div className="cc-form-section">
                <div className="cc-form-group">
                  <label className="cc-form-label">Notas Generales</label>
                  <textarea className="cc-form-input" rows="2" value={formData.notas}
                    onChange={(e) => handleInputChange('notas', e.target.value)}
                    placeholder="Observaciones..." />
                </div>
              </div>
            </div>

            <div className="cc-modal-footer">
              <button className="cc-btn cc-btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="cc-btn cc-btn-primary" onClick={handleSave} disabled={saving}>
                <Save size={18} /> {saving ? 'Guardando...' : (editingItem ? 'Actualizar' : 'Guardar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Historial */}
      {showHistorial && historialContacto && (
        <div className="cc-modal-overlay" onClick={() => setShowHistorial(false)}>
          <div className="cc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <div className="cc-modal-header">
              <h2><Clock size={20} /> Historial - {historialContacto.nombre_cliente}</h2>
              <button onClick={() => setShowHistorial(false)} className="cc-modal-close"><X size={20} /></button>
            </div>

            <div className="cc-modal-body">
              {/* Nuevo registro rápido */}
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #e2e8f0' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: '600', color: '#2F4156', marginBottom: '0.75rem' }}>
                  Registrar Nuevo Contacto
                </h4>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input type="date" value={nuevoRegistro.fecha}
                    onChange={(e) => setNuevoRegistro(prev => ({ ...prev, fecha: e.target.value }))}
                    style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }} />
                  <select value={nuevoRegistro.canal}
                    onChange={(e) => setNuevoRegistro(prev => ({ ...prev, canal: e.target.value }))}
                    style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                    <option>WhatsApp</option>
                    <option>Email</option>
                    <option>Teléfono</option>
                    <option>Presencial</option>
                    <option>Otro</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="text" placeholder="¿Qué se habló?" value={nuevoRegistro.nota}
                    onChange={(e) => setNuevoRegistro(prev => ({ ...prev, nota: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && agregarRegistroHistorial()}
                    style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }} />
                  <button onClick={agregarRegistroHistorial} className="cc-btn cc-btn-primary" style={{ padding: '0.5rem 1rem' }}>
                    <Plus size={16} /> Agregar
                  </button>
                </div>
              </div>

              {/* Lista de historial */}
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {historial.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem 0' }}>Sin registros de contacto</p>
                ) : (
                  historial.map(h => (
                    <div key={h.id} style={{ 
                      padding: '0.75rem', borderBottom: '1px solid #f1f5f9',
                      display: 'flex', gap: '0.75rem', alignItems: 'flex-start'
                    }}>
                      <div style={{ 
                        background: '#f1f5f9', borderRadius: '50%', width: '32px', height: '32px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        {canalIcon(h.canal)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ fontWeight: '600', fontSize: '0.8rem', color: '#567C8D' }}>{h.canal}</span>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{formatFecha(h.fecha)}</span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#2F4156' }}>{h.nota}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
