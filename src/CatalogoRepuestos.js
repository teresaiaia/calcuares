import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Plus, Save, X, Trash2, Edit2, RefreshCw, DollarSign } from 'lucide-react';

const CatalogoRepuestos = () => {
  const [repuestos, setRepuestos] = useState([]);
  const [tipoCambio, setTipoCambio] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editandoTC, setEditandoTC] = useState(false);
  const [tcTemp, setTcTemp] = useState('');

  const [formData, setFormData] = useState({
    nombre: '',
    precio_usd: '',
    categoria: '',
    notas: ''
  });

  useEffect(() => {
    fetchRepuestos();
  }, []);

  const fetchRepuestos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('catalogo_repuestos')
        .select('*')
        .order('nombre');
      if (error) throw error;

      const tc = data?.find(r => r.nombre === '__TIPO_CAMBIO_USD__');
      if (tc) setTipoCambio(tc.precio_usd);
      setRepuestos((data || []).filter(r => r.nombre !== '__TIPO_CAMBIO_USD__'));
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (!num && num !== 0) return '';
    return Math.round(Number(num)).toLocaleString('es-PY');
  };

  const handleNew = () => {
    setEditingItem(null);
    setFormData({ nombre: '', precio_usd: '', categoria: '', notas: '' });
    setShowModal(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      nombre: item.nombre || '',
      precio_usd: item.precio_usd || '',
      categoria: item.categoria || '',
      notas: item.notas || ''
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.nombre.trim() || !formData.precio_usd) {
      alert('Nombre y precio USD son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nombre: formData.nombre.trim(),
        precio_usd: parseFloat(formData.precio_usd) || 0,
        categoria: formData.categoria.trim() || null,
        notas: formData.notas.trim() || null
      };

      if (editingItem) {
        const { error } = await supabase.from('catalogo_repuestos').update(payload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('catalogo_repuestos').insert([payload]);
        if (error) throw error;
      }

      setShowModal(false);
      await fetchRepuestos();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este repuesto del catálogo?')) return;
    try {
      const { error } = await supabase.from('catalogo_repuestos').delete().eq('id', id);
      if (error) throw error;
      await fetchRepuestos();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleGuardarTC = async () => {
    const nuevoTC = parseFloat(tcTemp);
    if (!nuevoTC || nuevoTC <= 0) {
      alert('Ingresá un tipo de cambio válido');
      return;
    }
    try {
      // Buscar si existe
      const { data: existing } = await supabase
        .from('catalogo_repuestos')
        .select('id')
        .eq('nombre', '__TIPO_CAMBIO_USD__')
        .single();

      if (existing) {
        await supabase.from('catalogo_repuestos').update({ precio_usd: nuevoTC }).eq('id', existing.id);
      } else {
        await supabase.from('catalogo_repuestos').insert([{ nombre: '__TIPO_CAMBIO_USD__', precio_usd: nuevoTC }]);
      }

      setTipoCambio(nuevoTC);
      setEditandoTC(false);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div style={{ padding: 0 }}>
      <style>{`
        .cr-tc-bar { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; background: white; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.06); margin-bottom: 1rem; flex-wrap: wrap; }
        .cr-tc-label { font-size: 0.8rem; font-weight: 700; color: #2F4156; }
        .cr-tc-value { font-size: 1.1rem; font-weight: 800; color: #16a34a; }
        .cr-tc-edit-btn { padding: 4px 10px; border: 1px solid #e2e8f0; border-radius: 6px; background: white; cursor: pointer; font-size: 0.78rem; font-weight: 600; color: #64748b; }
        .cr-tc-edit-btn:hover { background: #f1f5f9; }
        .cr-tc-input { padding: 4px 8px; border: 2px solid #16a34a; border-radius: 6px; font-size: 0.9rem; width: 120px; outline: none; }
        .cr-tc-save { padding: 4px 10px; border: none; border-radius: 6px; background: #16a34a; color: white; cursor: pointer; font-weight: 700; font-size: 0.78rem; }
        .cr-toolbar { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 1rem; }
        .cr-btn-new { display: flex; align-items: center; gap: 0.3rem; padding: 0.5rem 1rem; background: #2F4156; color: white; border: none; border-radius: 8px; font-weight: 700; font-size: 0.82rem; cursor: pointer; }
        .cr-btn-new:hover { background: #3a5269; }
        .cr-table-wrap { background: white; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.06); overflow-x: auto; }
        .cr-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
        .cr-table thead th { background: #2F4156; color: white; padding: 0.6rem 0.75rem; text-align: left; font-weight: 700; font-size: 0.75rem; }
        .cr-table tbody tr { border-bottom: 1px solid #f0f0f0; }
        .cr-table tbody tr:hover { background: #f8fafc; }
        .cr-table td { padding: 0.5rem 0.75rem; }
        .cr-actions { display: flex; gap: 4px; }
        .cr-btn-icon { padding: 4px; border: none; border-radius: 4px; cursor: pointer; background: transparent; color: #64748b; }
        .cr-btn-icon:hover { background: #f1f5f9; color: #2F4156; }
        .cr-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .cr-modal { background: white; border-radius: 16px; width: 95%; max-width: 500px; box-shadow: 0 25px 50px rgba(0,0,0,0.25); }
        .cr-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid #e2e8f0; }
        .cr-modal-header h3 { font-size: 1.1rem; color: #2F4156; margin: 0; }
        .cr-modal-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem; }
        .cr-modal-footer { display: flex; justify-content: flex-end; gap: 0.5rem; padding: 1rem 1.5rem; border-top: 1px solid #e2e8f0; }
        .cr-form-group { display: flex; flex-direction: column; gap: 0.3rem; }
        .cr-form-group label { font-size: 0.8rem; font-weight: 600; color: #475569; }
        .cr-form-group input, .cr-form-group textarea { padding: 0.5rem 0.75rem; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 0.85rem; outline: none; }
        .cr-form-group input:focus, .cr-form-group textarea:focus { border-color: #567C8D; }
        .cr-form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
        .cr-btn-cancel { display: flex; align-items: center; gap: 0.3rem; padding: 0.5rem 1rem; background: #f1f5f9; color: #475569; border: none; border-radius: 8px; font-weight: 600; font-size: 0.82rem; cursor: pointer; }
        .cr-btn-save { display: flex; align-items: center; gap: 0.3rem; padding: 0.5rem 1rem; background: #2F4156; color: white; border: none; border-radius: 8px; font-weight: 700; font-size: 0.82rem; cursor: pointer; }
        .cr-loading { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 3rem; color: #94a3b8; }
        @keyframes cr-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .cr-spin { animation: cr-spin 1s linear infinite; }
      `}</style>

      {/* Tipo de Cambio */}
      <div className="cr-tc-bar">
        <DollarSign size={18} style={{ color: '#16a34a' }} />
        <span className="cr-tc-label">Tipo de Cambio USD → ₲:</span>
        {editandoTC ? (
          <>
            <input type="number" value={tcTemp} onChange={(e) => setTcTemp(e.target.value)} className="cr-tc-input" placeholder="Ej: 7500" />
            <button onClick={handleGuardarTC} className="cr-tc-save">Guardar</button>
            <button onClick={() => setEditandoTC(false)} className="cr-tc-edit-btn">Cancelar</button>
          </>
        ) : (
          <>
            <span className="cr-tc-value">₲{formatNumber(tipoCambio)}</span>
            <button onClick={() => { setTcTemp(tipoCambio.toString()); setEditandoTC(true); }} className="cr-tc-edit-btn">
              <Edit2 size={12} /> Editar
            </button>
          </>
        )}
        <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: 'auto' }}>
          {repuestos.length} repuestos en catálogo
        </span>
      </div>

      {/* Toolbar */}
      <div className="cr-toolbar">
        <button onClick={handleNew} className="cr-btn-new">
          <Plus size={16} /> Nuevo Repuesto
        </button>
        <button onClick={fetchRepuestos} className="cr-btn-icon" title="Recargar">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Tabla */}
      <div className="cr-table-wrap">
        {loading ? (
          <div className="cr-loading"><RefreshCw size={24} className="cr-spin" /><p>Cargando catálogo...</p></div>
        ) : (
          <table className="cr-table">
            <thead>
              <tr>
                <th>NOMBRE</th>
                <th>CATEGORÍA</th>
                <th>PRECIO USD</th>
                <th>PRECIO ₲</th>
                <th>NOTAS</th>
                <th>ACC</th>
              </tr>
            </thead>
            <tbody>
              {repuestos.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No hay repuestos en el catálogo</td></tr>
              ) : repuestos.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.nombre}</td>
                  <td>{r.categoria || '-'}</td>
                  <td style={{ fontWeight: 700 }}>USD {r.precio_usd}</td>
                  <td style={{ color: '#16a34a', fontWeight: 600 }}>₲{formatNumber(Math.round(r.precio_usd * tipoCambio))}</td>
                  <td style={{ fontSize: '0.75rem', color: '#64748b' }}>{r.notas || '-'}</td>
                  <td>
                    <div className="cr-actions">
                      <button onClick={() => handleEdit(r)} className="cr-btn-icon" title="Editar"><Edit2 size={13} /></button>
                      <button onClick={() => handleDelete(r.id)} className="cr-btn-icon" title="Eliminar" style={{ color: '#dc2626' }}><Trash2 size={13} /></button>
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
        <div className="cr-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="cr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cr-modal-header">
              <h3>🔩 {editingItem ? 'Editar' : 'Nuevo'} Repuesto</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>
            <div className="cr-modal-body">
              <div className="cr-form-group">
                <label>Nombre del repuesto *</label>
                <input type="text" value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} placeholder="Ej: Filtro Hydrafacial Blue" />
              </div>
              <div className="cr-form-row-2">
                <div className="cr-form-group">
                  <label>Precio USD *</label>
                  <input type="number" step="0.01" value={formData.precio_usd} onChange={(e) => setFormData({...formData, precio_usd: e.target.value})} placeholder="Ej: 45.00" />
                </div>
                <div className="cr-form-group">
                  <label>Precio en ₲ (automático)</label>
                  <div style={{ padding: '0.5rem 0.75rem', background: '#f0f4f8', borderRadius: '8px', fontWeight: 700, color: '#16a34a' }}>
                    ₲{formatNumber(Math.round((parseFloat(formData.precio_usd) || 0) * tipoCambio))}
                  </div>
                </div>
              </div>
              <div className="cr-form-group">
                <label>Categoría</label>
                <input type="text" value={formData.categoria} onChange={(e) => setFormData({...formData, categoria: e.target.value})} placeholder="Ej: Filtros, Consumibles, Piezas" />
              </div>
              <div className="cr-form-group">
                <label>Notas</label>
                <textarea value={formData.notas} onChange={(e) => setFormData({...formData, notas: e.target.value})} rows={2} placeholder="Notas opcionales..." />
              </div>
            </div>
            <div className="cr-modal-footer">
              <button onClick={() => setShowModal(false)} className="cr-btn-cancel"><X size={16} /> Cancelar</button>
              <button onClick={handleSave} className="cr-btn-save" disabled={saving}>
                {saving ? <><RefreshCw size={16} className="cr-spin" /> Guardando...</> : <><Save size={16} /> Guardar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CatalogoRepuestos;
