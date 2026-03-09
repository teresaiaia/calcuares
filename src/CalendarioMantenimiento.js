import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { Plus, Save, X, Trash2, Edit2, Search, RefreshCw, Check, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

const PERIODICIDADES = [
  { key: 'mensual', label: 'Mensual', meses: 1 },
  { key: 'bimestral', label: 'Bimestral', meses: 2 },
  { key: 'trimestral', label: 'Trimestral', meses: 3 },
  { key: 'cuatrimestral', label: 'Cuatrimestral', meses: 4 },
  { key: 'semestral', label: 'Semestral', meses: 6 },
  { key: 'anual', label: 'Anual', meses: 12 }
];

const CalendarioMantenimiento = () => {
  const [mantenimientos, setMantenimientos] = useState([]);
  const [equipos, setEquipos] = useState([]); // equipos únicos de servicio_tecnico
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('proximo1');
  const [sortDir, setSortDir] = useState('asc');
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    cliente: '',
    modelo: '',
    serial_number: '',
    periodicidad: 'semestral',
    ultimo_servicio: '',
    notas: ''
  });

  // Cargar datos
  useEffect(() => {
    fetchMantenimientos();
    fetchEquipos();
  }, []);

  const fetchMantenimientos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('mantenimientos_preventivos')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setMantenimientos(data || []);
    } catch (err) {
      console.error('Error cargando mantenimientos:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEquipos = async () => {
    try {
      const { data, error } = await supabase
        .from('servicio_tecnico')
        .select('cliente, modelo, serial_number')
        .order('cliente');
      if (error) throw error;
      // Equipos únicos por serial_number + cliente
      const uniqueMap = new Map();
      (data || []).forEach(e => {
        const key = `${e.cliente}|${e.modelo}|${e.serial_number}`;
        if (!uniqueMap.has(key) && e.serial_number) {
          uniqueMap.set(key, e);
        }
      });
      setEquipos(Array.from(uniqueMap.values()));
    } catch (err) {
      console.error('Error cargando equipos:', err);
    }
  };

  // Calcular próximos servicios
  const calcularProximos = (ultimoServicio, periodicidad) => {
    if (!ultimoServicio) return [null, null, null];
    const periodo = PERIODICIDADES.find(p => p.key === periodicidad);
    if (!periodo) return [null, null, null];

    const proximos = [];
    for (let i = 1; i <= 3; i++) {
      const fecha = new Date(ultimoServicio);
      fecha.setMonth(fecha.getMonth() + (periodo.meses * i));
      proximos.push(fecha.toISOString().split('T')[0]);
    }
    return proximos;
  };

  // Estado de fecha: vencido, próximo (dentro de 15 días), ok
  const estadoFecha = (fechaStr) => {
    if (!fechaStr) return 'sin-fecha';
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fecha = new Date(fechaStr);
    const diffDias = Math.floor((fecha - hoy) / (1000 * 60 * 60 * 24));
    if (diffDias < 0) return 'vencido';
    if (diffDias <= 15) return 'proximo';
    return 'ok';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Datos enriquecidos con próximos servicios
  const datosEnriquecidos = useMemo(() => {
    return mantenimientos.map(m => {
      const [p1, p2, p3] = calcularProximos(m.ultimo_servicio, m.periodicidad);
      return { ...m, proximo1: p1, proximo2: p2, proximo3: p3 };
    });
  }, [mantenimientos]);

  // Filtrar y ordenar
  const datosFiltrados = useMemo(() => {
    let filtered = [...datosEnriquecidos];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(m =>
        (m.cliente || '').toLowerCase().includes(term) ||
        (m.modelo || '').toLowerCase().includes(term) ||
        (m.serial_number || '').toLowerCase().includes(term)
      );
    }

    filtered.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      valA = (valA || '').toString().toLowerCase();
      valB = (valB || '').toString().toLowerCase();
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [datosEnriquecidos, searchTerm, sortField, sortDir]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronDown size={10} style={{ opacity: 0.3 }} />;
    return sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />;
  };

  // Seleccionar equipo del dropdown
  const handleSelectEquipo = (equipoStr) => {
    if (!equipoStr) return;
    const equipo = equipos.find(e => `${e.cliente} — ${e.modelo} — ${e.serial_number}` === equipoStr);
    if (equipo) {
      setFormData({
        ...formData,
        cliente: equipo.cliente,
        modelo: equipo.modelo,
        serial_number: equipo.serial_number
      });
    }
  };

  const handleNew = () => {
    setEditingItem(null);
    setFormData({
      cliente: '',
      modelo: '',
      serial_number: '',
      periodicidad: 'semestral',
      ultimo_servicio: '',
      notas: ''
    });
    setShowModal(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      cliente: item.cliente || '',
      modelo: item.modelo || '',
      serial_number: item.serial_number || '',
      periodicidad: item.periodicidad || 'semestral',
      ultimo_servicio: item.ultimo_servicio || '',
      notas: item.notas || ''
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.cliente.trim() || !formData.serial_number.trim()) {
      alert('Cliente y Serial Number son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        cliente: formData.cliente.trim(),
        modelo: formData.modelo.trim() || null,
        serial_number: formData.serial_number.trim(),
        periodicidad: formData.periodicidad,
        ultimo_servicio: formData.ultimo_servicio || null,
        notas: formData.notas.trim() || null
      };

      if (editingItem) {
        const { error } = await supabase
          .from('mantenimientos_preventivos')
          .update(payload)
          .eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('mantenimientos_preventivos')
          .insert([payload]);
        if (error) throw error;
      }

      setShowModal(false);
      await fetchMantenimientos();
    } catch (err) {
      alert('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este mantenimiento preventivo?')) return;
    try {
      const { error } = await supabase.from('mantenimientos_preventivos').delete().eq('id', id);
      if (error) throw error;
      await fetchMantenimientos();
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  const handleAutorizar = async (id, numProximo, valor) => {
    const campo = `autorizado_${numProximo}`;
    try {
      const { error } = await supabase
        .from('mantenimientos_preventivos')
        .update({ [campo]: valor })
        .eq('id', id);
      if (error) throw error;
      await fetchMantenimientos();
    } catch (err) {
      alert('Error al actualizar: ' + err.message);
    }
  };

  const handleToggleAtt = async (id, valorActual) => {
    try {
      const { error } = await supabase
        .from('mantenimientos_preventivos')
        .update({ atencion: !valorActual })
        .eq('id', id);
      if (error) throw error;
      await fetchMantenimientos();
    } catch (err) {
      alert('Error al actualizar: ' + err.message);
    }
  };

  const periodoLabel = (key) => {
    const p = PERIODICIDADES.find(pr => pr.key === key);
    return p ? p.label : key;
  };

  const fechaClass = (estado) => {
    if (estado === 'vencido') return 'cm-fecha-vencido';
    if (estado === 'proximo') return 'cm-fecha-proximo';
    return 'cm-fecha-ok';
  };

  // Estadísticas
  const stats = useMemo(() => {
    let vencidos = 0, proximos = 0, alDia = 0;
    datosEnriquecidos.forEach(m => {
      const e1 = estadoFecha(m.proximo1);
      if (e1 === 'vencido') vencidos++;
      else if (e1 === 'proximo') proximos++;
      else alDia++;
    });
    return { total: mantenimientos.length, vencidos, proximos, alDia };
  }, [datosEnriquecidos, mantenimientos.length]);

  return (
    <div className="cm-container">
      <style>{`
        .cm-container { padding: 0; }
        .cm-stats-row { display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap; }
        .cm-stat-card { flex: 1; min-width: 100px; background: white; border-radius: 10px; padding: 0.75rem 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.06); display: flex; flex-direction: column; gap: 0.2rem; }
        .cm-stat-label { font-size: 0.7rem; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .cm-stat-value { font-size: 1.1rem; font-weight: 800; color: #2F4156; }
        .cm-toolbar { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; }
        .cm-search { flex: 1; min-width: 200px; padding: 0.5rem 0.75rem 0.5rem 2rem; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 0.82rem; outline: none; transition: border-color 0.2s; }
        .cm-search:focus { border-color: #567C8D; }
        .cm-search-wrap { position: relative; flex: 1; min-width: 200px; }
        .cm-search-icon { position: absolute; left: 8px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
        .cm-btn-new { display: flex; align-items: center; gap: 0.3rem; padding: 0.5rem 1rem; background: #2F4156; color: white; border: none; border-radius: 8px; font-weight: 700; font-size: 0.82rem; cursor: pointer; white-space: nowrap; }
        .cm-btn-new:hover { background: #3a5269; }
        .cm-table-wrap { background: white; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.06); overflow-x: auto; }
        .cm-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
        .cm-table thead th { background: #2F4156; color: white; padding: 0.6rem 0.5rem; text-align: left; font-weight: 700; font-size: 0.7rem; letter-spacing: 0.3px; white-space: nowrap; cursor: pointer; user-select: none; position: sticky; top: 0; z-index: 1; }
        .cm-table thead th:hover { background: #3a5269; }
        .cm-table tbody tr { border-bottom: 1px solid #f0f0f0; transition: background 0.15s; }
        .cm-table tbody tr:hover { background: #f8fafc; }
        .cm-table td { padding: 0.5rem; vertical-align: middle; }
        .cm-fecha-vencido { background: #fee2e2; color: #991b1b; font-weight: 700; border-radius: 4px; padding: 2px 6px; }
        .cm-fecha-proximo { background: #fef3c7; color: #92400e; font-weight: 700; border-radius: 4px; padding: 2px 6px; }
        .cm-fecha-ok { color: #2F4156; }
        .cm-badge-periodo { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: 700; }
        .cm-badge-mensual { background: #dbeafe; color: #1e40af; }
        .cm-badge-bimestral { background: #e0e7ff; color: #3730a3; }
        .cm-badge-trimestral { background: #d1fae5; color: #065f46; }
        .cm-badge-cuatrimestral { background: #e0f2fe; color: #0369a1; }
        .cm-badge-semestral { background: #fef3c7; color: #92400e; }
        .cm-badge-anual { background: #fce7f3; color: #9d174d; }
        .cm-auth-btn { border: none; border-radius: 4px; padding: 3px 6px; cursor: pointer; font-size: 0.7rem; font-weight: 700; transition: all 0.15s; }
        .cm-auth-si { background: #d1fae5; color: #065f46; }
        .cm-auth-no { background: #f1f5f9; color: #94a3b8; }
        .cm-auth-no:hover { background: #e2e8f0; }
        .cm-att-on { background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5; }
        .cm-att-off { background: #f8fafc; color: #cbd5e1; border: 1px solid transparent; }
        .cm-att-off:hover { color: #f59e0b; }
        .cm-cell-actions { display: flex; gap: 4px; }
        .cm-btn-icon { padding: 4px; border: none; border-radius: 4px; cursor: pointer; background: transparent; color: #64748b; transition: all 0.15s; }
        .cm-btn-icon:hover { background: #f1f5f9; color: #2F4156; }
        .cm-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .cm-modal { background: white; border-radius: 16px; width: 95%; max-width: 550px; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 50px rgba(0,0,0,0.25); }
        .cm-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid #e2e8f0; }
        .cm-modal-header h3 { font-size: 1.1rem; color: #2F4156; margin: 0; }
        .cm-modal-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem; }
        .cm-modal-footer { display: flex; justify-content: flex-end; gap: 0.5rem; padding: 1rem 1.5rem; border-top: 1px solid #e2e8f0; }
        .cm-form-group { display: flex; flex-direction: column; gap: 0.3rem; }
        .cm-form-group label { font-size: 0.8rem; font-weight: 600; color: #475569; }
        .cm-form-group input, .cm-form-group select, .cm-form-group textarea { padding: 0.5rem 0.75rem; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 0.85rem; outline: none; transition: border-color 0.2s; }
        .cm-form-group input:focus, .cm-form-group select:focus, .cm-form-group textarea:focus { border-color: #567C8D; }
        .cm-form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
        .cm-btn-cancel { display: flex; align-items: center; gap: 0.3rem; padding: 0.5rem 1rem; background: #f1f5f9; color: #475569; border: none; border-radius: 8px; font-weight: 600; font-size: 0.82rem; cursor: pointer; }
        .cm-btn-save { display: flex; align-items: center; gap: 0.3rem; padding: 0.5rem 1rem; background: #2F4156; color: white; border: none; border-radius: 8px; font-weight: 700; font-size: 0.82rem; cursor: pointer; }
        .cm-btn-save:hover { background: #3a5269; }
        .cm-loading { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 3rem; color: #94a3b8; }
        .cm-empty { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 3rem; color: #94a3b8; }
        @keyframes cm-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .cm-spin { animation: cm-spin 1s linear infinite; }
      `}</style>

      {/* Stats */}
      <div className="cm-stats-row">
        <div className="cm-stat-card">
          <span className="cm-stat-label">Total Equipos</span>
          <span className="cm-stat-value">{stats.total}</span>
        </div>
        <div className="cm-stat-card" style={{ borderLeft: '3px solid #dc2626' }}>
          <span className="cm-stat-label">Vencidos</span>
          <span className="cm-stat-value" style={{ color: '#dc2626' }}>{stats.vencidos}</span>
        </div>
        <div className="cm-stat-card" style={{ borderLeft: '3px solid #f59e0b' }}>
          <span className="cm-stat-label">Próximos (15 días)</span>
          <span className="cm-stat-value" style={{ color: '#f59e0b' }}>{stats.proximos}</span>
        </div>
        <div className="cm-stat-card" style={{ borderLeft: '3px solid #16a34a' }}>
          <span className="cm-stat-label">Al día</span>
          <span className="cm-stat-value" style={{ color: '#16a34a' }}>{stats.alDia}</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="cm-toolbar">
        <div className="cm-search-wrap">
          <Search size={14} className="cm-search-icon" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente, modelo o serial..."
            className="cm-search"
          />
        </div>
        <button onClick={handleNew} className="cm-btn-new">
          <Plus size={16} /> Nuevo Mantenimiento
        </button>
        <button onClick={fetchMantenimientos} className="cm-btn-icon" title="Recargar">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Tabla */}
      <div className="cm-table-wrap">
        {loading ? (
          <div className="cm-loading">
            <RefreshCw size={24} className="cm-spin" />
            <p>Cargando mantenimientos...</p>
          </div>
        ) : datosFiltrados.length === 0 ? (
          <div className="cm-empty">
            <p>No hay mantenimientos preventivos registrados</p>
            <button onClick={handleNew} className="cm-btn-new"><Plus size={16} /> Agregar primero</button>
          </div>
        ) : (
          <table className="cm-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('cliente')}>CLIENTE <SortIcon field="cliente" /></th>
                <th onClick={() => handleSort('modelo')}>MODELO <SortIcon field="modelo" /></th>
                <th onClick={() => handleSort('serial_number')}>S/N <SortIcon field="serial_number" /></th>
                <th onClick={() => handleSort('periodicidad')}>PERIODO <SortIcon field="periodicidad" /></th>
                <th onClick={() => handleSort('ultimo_servicio')}>ÚLTIMO SERV. <SortIcon field="ultimo_servicio" /></th>
                <th onClick={() => handleSort('proximo1')}>PRÓXIMO 1 <SortIcon field="proximo1" /></th>
                <th>AUT.</th>
                <th onClick={() => handleSort('proximo2')}>PRÓXIMO 2 <SortIcon field="proximo2" /></th>
                <th>AUT.</th>
                <th onClick={() => handleSort('proximo3')}>PRÓXIMO 3 <SortIcon field="proximo3" /></th>
                <th>AUT.</th>
                <th>ACC</th>
                <th>ATT</th>
              </tr>
            </thead>
            <tbody>
              {datosFiltrados.map(m => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{m.cliente}</td>
                  <td>{m.modelo}</td>
                  <td style={{ fontSize: '0.72rem' }}>{m.serial_number}</td>
                  <td>
                    <span className={`cm-badge-periodo cm-badge-${m.periodicidad}`}>
                      {periodoLabel(m.periodicidad)}
                    </span>
                  </td>
                  <td>{formatDate(m.ultimo_servicio)}</td>
                  <td>
                    <span className={fechaClass(estadoFecha(m.proximo1))}>
                      {formatDate(m.proximo1)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className={`cm-auth-btn ${m.autorizado_1 ? 'cm-auth-si' : 'cm-auth-no'}`}
                      onClick={() => handleAutorizar(m.id, 1, !m.autorizado_1)}
                      title={m.autorizado_1 ? 'Autorizado — click para quitar' : 'Click para autorizar'}
                    >
                      {m.autorizado_1 ? <Check size={12} /> : '—'}
                    </button>
                  </td>
                  <td>
                    <span className={fechaClass(estadoFecha(m.proximo2))}>
                      {formatDate(m.proximo2)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className={`cm-auth-btn ${m.autorizado_2 ? 'cm-auth-si' : 'cm-auth-no'}`}
                      onClick={() => handleAutorizar(m.id, 2, !m.autorizado_2)}
                      title={m.autorizado_2 ? 'Autorizado — click para quitar' : 'Click para autorizar'}
                    >
                      {m.autorizado_2 ? <Check size={12} /> : '—'}
                    </button>
                  </td>
                  <td>
                    <span className={fechaClass(estadoFecha(m.proximo3))}>
                      {formatDate(m.proximo3)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className={`cm-auth-btn ${m.autorizado_3 ? 'cm-auth-si' : 'cm-auth-no'}`}
                      onClick={() => handleAutorizar(m.id, 3, !m.autorizado_3)}
                      title={m.autorizado_3 ? 'Autorizado — click para quitar' : 'Click para autorizar'}
                    >
                      {m.autorizado_3 ? <Check size={12} /> : '—'}
                    </button>
                  </td>
                  <td>
                    <div className="cm-cell-actions">
                      <button onClick={() => handleEdit(m)} className="cm-btn-icon" title="Editar">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => handleDelete(m.id)} className="cm-btn-icon" title="Eliminar" style={{ color: '#dc2626' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => handleToggleAtt(m.id, m.atencion)}
                      className={`cm-auth-btn ${m.atencion ? 'cm-att-on' : 'cm-att-off'}`}
                      title={m.atencion ? 'Atención activa — click para quitar' : 'Click para marcar atención'}
                    >
                      <AlertTriangle size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="cm-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="cm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cm-modal-header">
              <h3>📅 {editingItem ? 'Editar' : 'Nuevo'} Mantenimiento Preventivo</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>
            <div className="cm-modal-body">
              {/* Selector de equipo existente */}
              {!editingItem && (
                <div className="cm-form-group">
                  <label>🔍 Seleccionar equipo existente</label>
                  <select
                    onChange={(e) => handleSelectEquipo(e.target.value)}
                    defaultValue=""
                  >
                    <option value="">-- Elegir equipo de la base de datos --</option>
                    {equipos.map((e, i) => (
                      <option key={i} value={`${e.cliente} — ${e.modelo} — ${e.serial_number}`}>
                        {e.cliente} — {e.modelo} — {e.serial_number}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="cm-form-group">
                <label>👤 Cliente *</label>
                <input type="text" value={formData.cliente}
                  onChange={(e) => setFormData({...formData, cliente: e.target.value})}
                  placeholder="Nombre del cliente" />
              </div>

              <div className="cm-form-row-2">
                <div className="cm-form-group">
                  <label>🏷️ Modelo</label>
                  <input type="text" value={formData.modelo}
                    onChange={(e) => setFormData({...formData, modelo: e.target.value})}
                    placeholder="Modelo del equipo" />
                </div>
                <div className="cm-form-group">
                  <label>🔢 Serial Number *</label>
                  <input type="text" value={formData.serial_number}
                    onChange={(e) => setFormData({...formData, serial_number: e.target.value})}
                    placeholder="Número de serie" />
                </div>
              </div>

              <div className="cm-form-row-2">
                <div className="cm-form-group">
                  <label>🔄 Periodicidad</label>
                  <select value={formData.periodicidad}
                    onChange={(e) => setFormData({...formData, periodicidad: e.target.value})}>
                    {PERIODICIDADES.map(p => (
                      <option key={p.key} value={p.key}>{p.label} (cada {p.meses} {p.meses === 1 ? 'mes' : 'meses'})</option>
                    ))}
                  </select>
                </div>
                <div className="cm-form-group">
                  <label>📅 Último Servicio</label>
                  <input type="date" value={formData.ultimo_servicio}
                    onChange={(e) => setFormData({...formData, ultimo_servicio: e.target.value})} />
                </div>
              </div>

              {/* Vista previa próximos */}
              {formData.ultimo_servicio && (
                <div style={{ background: '#f0f4f8', borderRadius: '8px', padding: '10px 12px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Próximos servicios:</span>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '0.82rem' }}>
                    {calcularProximos(formData.ultimo_servicio, formData.periodicidad).map((f, i) => (
                      <span key={i} className={fechaClass(estadoFecha(f))} style={{ padding: '2px 8px', borderRadius: '4px' }}>
                        {i + 1}° {formatDate(f)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="cm-form-group">
                <label>📝 Notas</label>
                <textarea value={formData.notas}
                  onChange={(e) => setFormData({...formData, notas: e.target.value})}
                  rows={2} placeholder="Observaciones opcionales..." />
              </div>
            </div>
            <div className="cm-modal-footer">
              <button onClick={() => setShowModal(false)} className="cm-btn-cancel">
                <X size={16} /> Cancelar
              </button>
              <button onClick={handleSave} className="cm-btn-save" disabled={saving}>
                {saving ? <><RefreshCw size={16} className="cm-spin" /> Guardando...</> : <><Save size={16} /> Guardar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarioMantenimiento;
