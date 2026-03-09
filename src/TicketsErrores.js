import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { Plus, Save, X, Trash2, Edit2, Search, RefreshCw, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

const PRIORIDADES = ['Alta', 'Media', 'Baja'];
const ESTADOS_TICKET = ['Abierto', 'En proceso', 'Resuelto', 'Cerrado'];

const TicketsErrores = () => {
  const [tickets, setTickets] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('todos');
  const [filterPrioridad, setFilterPrioridad] = useState('todos');
  const [sortField, setSortField] = useState('fecha_reporte');
  const [sortDir, setSortDir] = useState('desc');
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    cliente: '',
    modelo: '',
    serial_number: '',
    fecha_reporte: new Date().toISOString().split('T')[0],
    descripcion: '',
    prioridad: 'Media',
    estado: 'Abierto',
    notas: ''
  });

  useEffect(() => {
    fetchTickets();
    fetchEquipos();
  }, []);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tickets_errores')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTickets(data || []);
    } catch (err) {
      console.error('Error cargando tickets:', err);
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

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Filtrar y ordenar
  const ticketsFiltrados = useMemo(() => {
    let filtered = [...tickets];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        (t.cliente || '').toLowerCase().includes(term) ||
        (t.modelo || '').toLowerCase().includes(term) ||
        (t.serial_number || '').toLowerCase().includes(term) ||
        (t.descripcion || '').toLowerCase().includes(term)
      );
    }

    if (filterEstado !== 'todos') {
      filtered = filtered.filter(t => t.estado === filterEstado);
    }

    if (filterPrioridad !== 'todos') {
      filtered = filtered.filter(t => t.prioridad === filterPrioridad);
    }

    filtered.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      // Prioridad: orden especial
      if (sortField === 'prioridad') {
        const orden = { 'Alta': 1, 'Media': 2, 'Baja': 3 };
        valA = orden[valA] || 9;
        valB = orden[valB] || 9;
      } else {
        valA = (valA || '').toString().toLowerCase();
        valB = (valB || '').toString().toLowerCase();
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [tickets, searchTerm, filterEstado, filterPrioridad, sortField, sortDir]);

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
      fecha_reporte: new Date().toISOString().split('T')[0],
      descripcion: '',
      prioridad: 'Media',
      estado: 'Abierto',
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
      fecha_reporte: item.fecha_reporte || '',
      descripcion: item.descripcion || '',
      prioridad: item.prioridad || 'Media',
      estado: item.estado || 'Abierto',
      notas: item.notas || ''
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.cliente.trim() || !formData.descripcion.trim()) {
      alert('Cliente y Descripción son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        cliente: formData.cliente.trim(),
        modelo: formData.modelo.trim() || null,
        serial_number: formData.serial_number.trim() || null,
        fecha_reporte: formData.fecha_reporte || null,
        descripcion: formData.descripcion.trim(),
        prioridad: formData.prioridad,
        estado: formData.estado,
        notas: formData.notas.trim() || null
      };

      if (editingItem) {
        const { error } = await supabase
          .from('tickets_errores')
          .update(payload)
          .eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tickets_errores')
          .insert([payload]);
        if (error) throw error;
      }

      setShowModal(false);
      await fetchTickets();
    } catch (err) {
      alert('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este ticket?')) return;
    try {
      const { error } = await supabase.from('tickets_errores').delete().eq('id', id);
      if (error) throw error;
      await fetchTickets();
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  // Cambio rápido de estado desde la tabla
  const handleCambioEstado = async (id, nuevoEstado) => {
    try {
      const { error } = await supabase
        .from('tickets_errores')
        .update({ estado: nuevoEstado })
        .eq('id', id);
      if (error) throw error;
      await fetchTickets();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const abiertos = tickets.filter(t => t.estado === 'Abierto').length;
    const enProceso = tickets.filter(t => t.estado === 'En proceso').length;
    const resueltos = tickets.filter(t => t.estado === 'Resuelto').length;
    const alta = tickets.filter(t => t.prioridad === 'Alta' && t.estado !== 'Cerrado' && t.estado !== 'Resuelto').length;
    return { total: tickets.length, abiertos, enProceso, resueltos, alta };
  }, [tickets]);

  return (
    <div className="tk-container">
      <style>{`
        .tk-container { padding: 0; }
        .tk-stats-row { display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap; }
        .tk-stat-card { flex: 1; min-width: 100px; background: white; border-radius: 10px; padding: 0.75rem 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.06); display: flex; flex-direction: column; gap: 0.2rem; }
        .tk-stat-label { font-size: 0.7rem; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .tk-stat-value { font-size: 1.1rem; font-weight: 800; color: #2F4156; }
        .tk-toolbar { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; }
        .tk-search-wrap { position: relative; flex: 1; min-width: 180px; }
        .tk-search-icon { position: absolute; left: 8px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
        .tk-search { width: 100%; padding: 0.5rem 0.75rem 0.5rem 2rem; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 0.82rem; outline: none; }
        .tk-search:focus { border-color: #567C8D; }
        .tk-filter { padding: 0.5rem; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 0.78rem; outline: none; background: white; }
        .tk-btn-new { display: flex; align-items: center; gap: 0.3rem; padding: 0.5rem 1rem; background: #2F4156; color: white; border: none; border-radius: 8px; font-weight: 700; font-size: 0.82rem; cursor: pointer; white-space: nowrap; }
        .tk-btn-new:hover { background: #3a5269; }
        .tk-table-wrap { background: white; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.06); overflow-x: auto; }
        .tk-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
        .tk-table thead th { background: #2F4156; color: white; padding: 0.6rem 0.5rem; text-align: left; font-weight: 700; font-size: 0.7rem; letter-spacing: 0.3px; white-space: nowrap; cursor: pointer; user-select: none; position: sticky; top: 0; z-index: 1; }
        .tk-table thead th:hover { background: #3a5269; }
        .tk-table tbody tr { border-bottom: 1px solid #f0f0f0; transition: background 0.15s; }
        .tk-table tbody tr:hover { background: #f8fafc; }
        .tk-table td { padding: 0.5rem; vertical-align: middle; }
        .tk-cell-desc { max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .tk-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: 700; }
        .tk-prio-alta { background: #fee2e2; color: #991b1b; }
        .tk-prio-media { background: #fef3c7; color: #92400e; }
        .tk-prio-baja { background: #d1fae5; color: #065f46; }
        .tk-estado-abierto { background: #fee2e2; color: #991b1b; }
        .tk-estado-en-proceso { background: #fef3c7; color: #92400e; }
        .tk-estado-resuelto { background: #d1fae5; color: #065f46; }
        .tk-estado-cerrado { background: #f1f5f9; color: #64748b; }
        .tk-estado-select { padding: 2px 4px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.72rem; font-weight: 600; cursor: pointer; outline: none; background: white; }
        .tk-cell-actions { display: flex; gap: 4px; }
        .tk-btn-icon { padding: 4px; border: none; border-radius: 4px; cursor: pointer; background: transparent; color: #64748b; transition: all 0.15s; }
        .tk-btn-icon:hover { background: #f1f5f9; color: #2F4156; }
        .tk-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .tk-modal { background: white; border-radius: 16px; width: 95%; max-width: 600px; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 50px rgba(0,0,0,0.25); }
        .tk-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid #e2e8f0; }
        .tk-modal-header h3 { font-size: 1.1rem; color: #2F4156; margin: 0; }
        .tk-modal-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem; }
        .tk-modal-footer { display: flex; justify-content: flex-end; gap: 0.5rem; padding: 1rem 1.5rem; border-top: 1px solid #e2e8f0; }
        .tk-form-group { display: flex; flex-direction: column; gap: 0.3rem; }
        .tk-form-group label { font-size: 0.8rem; font-weight: 600; color: #475569; }
        .tk-form-group input, .tk-form-group select, .tk-form-group textarea { padding: 0.5rem 0.75rem; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 0.85rem; outline: none; transition: border-color 0.2s; }
        .tk-form-group input:focus, .tk-form-group select:focus, .tk-form-group textarea:focus { border-color: #567C8D; }
        .tk-form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
        .tk-form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; }
        .tk-btn-cancel { display: flex; align-items: center; gap: 0.3rem; padding: 0.5rem 1rem; background: #f1f5f9; color: #475569; border: none; border-radius: 8px; font-weight: 600; font-size: 0.82rem; cursor: pointer; }
        .tk-btn-save { display: flex; align-items: center; gap: 0.3rem; padding: 0.5rem 1rem; background: #2F4156; color: white; border: none; border-radius: 8px; font-weight: 700; font-size: 0.82rem; cursor: pointer; }
        .tk-btn-save:hover { background: #3a5269; }
        .tk-loading { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 3rem; color: #94a3b8; }
        .tk-empty { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 3rem; color: #94a3b8; }
        @keyframes tk-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .tk-spin { animation: tk-spin 1s linear infinite; }
        .tk-row-alta { border-left: 3px solid #dc2626; }
      `}</style>

      {/* Stats */}
      <div className="tk-stats-row">
        <div className="tk-stat-card">
          <span className="tk-stat-label">Total Tickets</span>
          <span className="tk-stat-value">{stats.total}</span>
        </div>
        <div className="tk-stat-card" style={{ borderLeft: '3px solid #dc2626' }}>
          <span className="tk-stat-label">Abiertos</span>
          <span className="tk-stat-value" style={{ color: '#dc2626' }}>{stats.abiertos}</span>
        </div>
        <div className="tk-stat-card" style={{ borderLeft: '3px solid #f59e0b' }}>
          <span className="tk-stat-label">En Proceso</span>
          <span className="tk-stat-value" style={{ color: '#f59e0b' }}>{stats.enProceso}</span>
        </div>
        <div className="tk-stat-card" style={{ borderLeft: '3px solid #16a34a' }}>
          <span className="tk-stat-label">Resueltos</span>
          <span className="tk-stat-value" style={{ color: '#16a34a' }}>{stats.resueltos}</span>
        </div>
        <div className="tk-stat-card" style={{ borderLeft: '3px solid #7c3aed' }}>
          <span className="tk-stat-label">Prioridad Alta</span>
          <span className="tk-stat-value" style={{ color: '#7c3aed' }}>{stats.alta}</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="tk-toolbar">
        <div className="tk-search-wrap">
          <Search size={14} className="tk-search-icon" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente, modelo, serial o descripción..."
            className="tk-search"
          />
        </div>
        <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)} className="tk-filter">
          <option value="todos">Todos los estados</option>
          {ESTADOS_TICKET.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select value={filterPrioridad} onChange={(e) => setFilterPrioridad(e.target.value)} className="tk-filter">
          <option value="todos">Todas las prioridades</option>
          {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={handleNew} className="tk-btn-new">
          <Plus size={16} /> Nuevo Ticket
        </button>
        <button onClick={fetchTickets} className="tk-btn-icon" title="Recargar">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Tabla */}
      <div className="tk-table-wrap">
        {loading ? (
          <div className="tk-loading">
            <RefreshCw size={24} className="tk-spin" />
            <p>Cargando tickets...</p>
          </div>
        ) : ticketsFiltrados.length === 0 ? (
          <div className="tk-empty">
            <AlertCircle size={48} />
            <p>No hay tickets registrados</p>
            <button onClick={handleNew} className="tk-btn-new"><Plus size={16} /> Crear primer ticket</button>
          </div>
        ) : (
          <table className="tk-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('fecha_reporte')}>FECHA <SortIcon field="fecha_reporte" /></th>
                <th onClick={() => handleSort('cliente')}>CLIENTE <SortIcon field="cliente" /></th>
                <th onClick={() => handleSort('modelo')}>MODELO <SortIcon field="modelo" /></th>
                <th onClick={() => handleSort('serial_number')}>S/N <SortIcon field="serial_number" /></th>
                <th onClick={() => handleSort('descripcion')}>DESCRIPCIÓN <SortIcon field="descripcion" /></th>
                <th onClick={() => handleSort('prioridad')}>PRIORIDAD <SortIcon field="prioridad" /></th>
                <th onClick={() => handleSort('estado')}>ESTADO <SortIcon field="estado" /></th>
                <th>ACC</th>
              </tr>
            </thead>
            <tbody>
              {ticketsFiltrados.map(t => (
                <tr key={t.id} className={t.prioridad === 'Alta' && t.estado !== 'Cerrado' && t.estado !== 'Resuelto' ? 'tk-row-alta' : ''}>
                  <td>{formatDate(t.fecha_reporte)}</td>
                  <td style={{ fontWeight: 600 }}>{t.cliente}</td>
                  <td>{t.modelo}</td>
                  <td style={{ fontSize: '0.72rem' }}>{t.serial_number}</td>
                  <td className="tk-cell-desc" title={t.descripcion}>{t.descripcion}</td>
                  <td>
                    {t.estado === 'Cerrado' ? (
                      <span className="tk-badge" style={{ background: '#f1f5f9', color: '#94a3b8' }}>—</span>
                    ) : (
                      <span className={`tk-badge tk-prio-${t.prioridad?.toLowerCase()}`}>
                        {t.prioridad}
                      </span>
                    )}
                  </td>
                  <td>
                    <select
                      value={t.estado}
                      onChange={(e) => handleCambioEstado(t.id, e.target.value)}
                      className="tk-estado-select"
                      style={{
                        color: t.estado === 'Abierto' ? '#991b1b' : t.estado === 'En proceso' ? '#92400e' : t.estado === 'Resuelto' ? '#065f46' : '#64748b',
                        background: t.estado === 'Abierto' ? '#fee2e2' : t.estado === 'En proceso' ? '#fef3c7' : t.estado === 'Resuelto' ? '#d1fae5' : '#f1f5f9'
                      }}
                    >
                      {ESTADOS_TICKET.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </td>
                  <td>
                    <div className="tk-cell-actions">
                      <button onClick={() => handleEdit(t)} className="tk-btn-icon" title="Editar">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => handleDelete(t.id)} className="tk-btn-icon" title="Eliminar" style={{ color: '#dc2626' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="tk-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="tk-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tk-modal-header">
              <h3>🎫 {editingItem ? 'Editar' : 'Nuevo'} Ticket de Error</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>
            <div className="tk-modal-body">
              {/* Selector de equipo */}
              {!editingItem && (
                <div className="tk-form-group">
                  <label>🔍 Seleccionar equipo existente</label>
                  <select onChange={(e) => handleSelectEquipo(e.target.value)} defaultValue="">
                    <option value="">-- Elegir equipo de la base de datos --</option>
                    {equipos.map((e, i) => (
                      <option key={i} value={`${e.cliente} — ${e.modelo} — ${e.serial_number}`}>
                        {e.cliente} — {e.modelo} — {e.serial_number}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="tk-form-group">
                <label>👤 Cliente *</label>
                <input type="text" value={formData.cliente}
                  onChange={(e) => setFormData({...formData, cliente: e.target.value})}
                  placeholder="Nombre del cliente" />
              </div>

              <div className="tk-form-row-2">
                <div className="tk-form-group">
                  <label>🏷️ Modelo</label>
                  <input type="text" value={formData.modelo}
                    onChange={(e) => setFormData({...formData, modelo: e.target.value})}
                    placeholder="Modelo del equipo" />
                </div>
                <div className="tk-form-group">
                  <label>🔢 Serial Number</label>
                  <input type="text" value={formData.serial_number}
                    onChange={(e) => setFormData({...formData, serial_number: e.target.value})}
                    placeholder="Número de serie" />
                </div>
              </div>

              <div className="tk-form-group">
                <label>⚠️ Descripción del error/falla *</label>
                <textarea value={formData.descripcion}
                  onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                  rows={4} placeholder="Describir la falla reportada..." />
              </div>

              <div className="tk-form-row-3">
                <div className="tk-form-group">
                  <label>📅 Fecha del Reporte</label>
                  <input type="date" value={formData.fecha_reporte}
                    onChange={(e) => setFormData({...formData, fecha_reporte: e.target.value})} />
                </div>
                <div className="tk-form-group">
                  <label>🔴 Prioridad</label>
                  <select value={formData.prioridad}
                    onChange={(e) => setFormData({...formData, prioridad: e.target.value})}>
                    {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="tk-form-group">
                  <label>📌 Estado</label>
                  <select value={formData.estado}
                    onChange={(e) => setFormData({...formData, estado: e.target.value})}>
                    {ESTADOS_TICKET.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>

              <div className="tk-form-group">
                <label>📝 Notas adicionales</label>
                <textarea value={formData.notas}
                  onChange={(e) => setFormData({...formData, notas: e.target.value})}
                  rows={2} placeholder="Observaciones opcionales..." />
              </div>
            </div>
            <div className="tk-modal-footer">
              <button onClick={() => setShowModal(false)} className="tk-btn-cancel">
                <X size={16} /> Cancelar
              </button>
              <button onClick={handleSave} className="tk-btn-save" disabled={saving}>
                {saving ? <><RefreshCw size={16} className="tk-spin" /> Guardando...</> : <><Save size={16} /> Guardar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketsErrores;
