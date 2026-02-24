import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { Search, Plus, Edit2, Trash2, X, Save, Package, RefreshCw, AlertTriangle } from 'lucide-react';
import './ComprasCargas.css';

const CATEGORIAS = ['Equipos', 'Insumos', 'Partes', 'Herramientas', 'Propios', 'Estructura', 'Otros'];
const UNIDADES = ['Litro', 'Caja', 'Unitario', 'Botella'];

export default function Articulos() {
  const [articulos, setArticulos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingArticulo, setEditingArticulo] = useState(null);

  const formInit = {
    codigo: '',
    proveedor_id: '',
    proveedor_otro: '',
    categoria: 'Equipos',
    descripcion: '',
    unidad_medida: 'Unitario',
    stock_minimo: '',
    stock_actual: '',
    valor_usd: ''
  };

  const [formData, setFormData] = useState(formInit);

  useEffect(() => {
    fetchArticulos();
    fetchProveedores();
  }, []);

  const fetchArticulos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('articulos')
        .select('*')
        .order('codigo');
      if (error) throw error;
      setArticulos(data || []);
    } catch (error) {
      console.error('Error cargando artículos:', error);
      alert('Error al cargar artículos');
    } finally {
      setLoading(false);
    }
  };

  const fetchProveedores = async () => {
    try {
      const { data, error } = await supabase
        .from('proveedores')
        .select('id, nombre_comercial')
        .eq('activo', true)
        .order('nombre_comercial');
      if (error) throw error;
      setProveedores(data || []);
    } catch (error) {
      console.error('Error cargando proveedores:', error);
    }
  };

  const resetForm = () => {
    setFormData(formInit);
    setEditingArticulo(null);
  };

  const openNew = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (art) => {
    setFormData({
      codigo: art.codigo || '',
      proveedor_id: art.proveedor_id || '',
      proveedor_otro: art.proveedor_otro || '',
      categoria: art.categoria || 'Equipos',
      descripcion: art.descripcion || '',
      unidad_medida: art.unidad_medida || 'Unitario',
      stock_minimo: art.stock_minimo ?? '',
      stock_actual: art.stock_actual ?? '',
      valor_usd: art.valor_usd ?? ''
    });
    setEditingArticulo(art);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.descripcion.trim()) {
      alert('La descripción es obligatoria');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        codigo: formData.codigo.trim(),
        proveedor_id: formData.proveedor_id || null,
        proveedor_otro: formData.proveedor_id === 'otro' ? formData.proveedor_otro.trim() : null,
        categoria: formData.categoria,
        descripcion: formData.descripcion.trim(),
        unidad_medida: formData.unidad_medida,
        stock_minimo: formData.stock_minimo === '' ? null : parseFloat(formData.stock_minimo),
        stock_actual: formData.stock_actual === '' ? null : parseFloat(formData.stock_actual),
        valor_usd: formData.valor_usd === '' ? null : parseFloat(formData.valor_usd)
      };

      if (editingArticulo) {
        const { error } = await supabase.from('articulos').update(payload).eq('id', editingArticulo.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('articulos').insert([payload]);
        if (error) throw error;
      }
      await fetchArticulos();
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Error guardando artículo:', error);
      alert('Error al guardar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este artículo?')) return;
    try {
      const { error } = await supabase.from('articulos').delete().eq('id', id);
      if (error) throw error;
      setArticulos(prev => prev.filter(a => a.id !== id));
    } catch (error) {
      alert('Error al eliminar: ' + error.message);
    }
  };

  const getNombreProveedor = (art) => {
    if (art.proveedor_id === 'otro' || !art.proveedor_id) {
      return art.proveedor_otro || '—';
    }
    const prov = proveedores.find(p => p.id === art.proveedor_id);
    return prov ? prov.nombre_comercial : '—';
  };

  const valorEnStock = (art) => {
    const s = parseFloat(art.stock_actual);
    const v = parseFloat(art.valor_usd);
    if (isNaN(s) || isNaN(v)) return null;
    return s * v;
  };

  const filtrados = useMemo(() => {
    if (!searchTerm.trim()) return articulos;
    const term = searchTerm.toLowerCase();
    return articulos.filter(a =>
      (a.codigo || '').toLowerCase().includes(term) ||
      (a.descripcion || '').toLowerCase().includes(term) ||
      (a.categoria || '').toLowerCase().includes(term) ||
      (a.unidad_medida || '').toLowerCase().includes(term) ||
      (a.proveedor_otro || '').toLowerCase().includes(term) ||
      proveedores.find(p => p.id === a.proveedor_id)?.nombre_comercial?.toLowerCase().includes(term)
    );
  }, [articulos, searchTerm, proveedores]);

  const totalValorStock = useMemo(() => {
    return filtrados.reduce((acc, art) => {
      const v = valorEnStock(art);
      return acc + (v !== null ? v : 0);
    }, 0);
  }, [filtrados]);

  const formatUSD = (val) => {
    if (val === null || val === undefined || val === '') return '—';
    return new Intl.NumberFormat('es-PY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  };

  const stockBajo = (art) => {
    const min = parseFloat(art.stock_minimo);
    const act = parseFloat(art.stock_actual);
    if (isNaN(min) || isNaN(act)) return false;
    return act < min;
  };

  const categoriaBadgeColor = (cat) => {
    const map = {
      'Equipos': '#2F4156',
      'Insumos': '#0e7490',
      'Partes': '#7c3aed',
      'Herramientas': '#b45309',
      'Propios': '#065f46',
      'Estructura': '#9f1239',
      'Otros': '#64748b'
    };
    return map[cat] || '#64748b';
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem', gap: '0.75rem', color: '#567C8D' }}>
        <RefreshCw className="animate-spin" size={24} />
        <span style={{ fontWeight: '600' }}>Cargando artículos...</span>
      </div>
    );
  }

  return (
    <div>
      {/* Barra superior */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por código, descripción, categoría, proveedor..."
              className="input search-input"
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
          <button onClick={openNew} className="btn btn-success" style={{ whiteSpace: 'nowrap' }}>
            <Plus size={18} /> Nuevo Artículo
          </button>
          <button onClick={fetchArticulos} className="btn btn-secondary" title="Recargar">
            <RefreshCw size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ color: '#64748b', fontSize: '0.875rem' }}>
            📦 {filtrados.length} {filtrados.length === 1 ? 'artículo' : 'artículos'}{searchTerm ? ' encontrados' : ' registrados'}
          </span>
          <div style={{ 
            background: 'linear-gradient(135deg, #2F4156 0%, #567C8D 100%)',
            color: 'white', padding: '0.4rem 1rem', borderRadius: '8px',
            fontSize: '0.875rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem'
          }}>
            <span style={{ opacity: 0.8, fontSize: '0.75rem' }}>VALOR TOTAL EN STOCK:</span>
            <span style={{ fontSize: '1rem' }}>${formatUSD(totalValorStock)}</span>
          </div>
        </div>
      </div>

      {/* Tabla */}
      {filtrados.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Package size={48} style={{ color: '#cbd5e1', margin: '0 auto 1rem' }} />
          <p style={{ color: '#64748b', fontSize: '1.1rem', marginBottom: '1rem' }}>
            {articulos.length === 0 ? 'No hay artículos registrados' : 'No se encontraron artículos'}
          </p>
          {articulos.length === 0 && (
            <button onClick={openNew} className="btn btn-primary">
              <Plus size={18} /> Agregar primer artículo
            </button>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'linear-gradient(135deg, #2F4156 0%, #567C8D 100%)', color: 'white' }}>
                  {['Código', 'Proveedor', 'Categoría', 'Descripción', 'Unidad', 'Stock Mín.', 'Stock Actual', 'Valor USD', 'Valor en Stock', ''].map(h => (
                    <th key={h} style={{ 
                      padding: '0.75rem 1rem', textAlign: h === '' ? 'center' : 'left', 
                      fontWeight: '700', fontSize: '0.75rem', textTransform: 'uppercase',
                      letterSpacing: '0.5px', whiteSpace: 'nowrap'
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((art, idx) => {
                  const vs = valorEnStock(art);
                  const bajo = stockBajo(art);
                  return (
                    <tr key={art.id} style={{ 
                      background: idx % 2 === 0 ? 'white' : '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f0f6fa'}
                    onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'white' : '#f8fafc'}
                    >
                      <td style={{ padding: '0.65rem 1rem', fontWeight: '600', color: '#1e293b', whiteSpace: 'nowrap' }}>
                        {art.codigo || <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                      <td style={{ padding: '0.65rem 1rem', color: '#475569', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {getNombreProveedor(art)}
                      </td>
                      <td style={{ padding: '0.65rem 1rem' }}>
                        <span style={{
                          background: categoriaBadgeColor(art.categoria),
                          color: 'white', fontSize: '0.7rem', fontWeight: '700',
                          padding: '0.2rem 0.6rem', borderRadius: '20px', whiteSpace: 'nowrap'
                        }}>
                          {art.categoria || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 1rem', color: '#1e293b', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {art.descripcion}
                      </td>
                      <td style={{ padding: '0.65rem 1rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {art.unidad_medida || '—'}
                      </td>
                      <td style={{ padding: '0.65rem 1rem', textAlign: 'right', whiteSpace: 'nowrap', color: '#64748b' }}>
                        {art.stock_minimo ?? '—'}
                      </td>
                      <td style={{ padding: '0.65rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <span style={{ 
                          fontWeight: '700',
                          color: bajo ? '#dc2626' : '#1e293b',
                          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem'
                        }}>
                          {bajo && <AlertTriangle size={13} style={{ color: '#dc2626' }} />}
                          {art.stock_actual ?? '—'}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 1rem', textAlign: 'right', whiteSpace: 'nowrap', color: '#475569' }}>
                        {art.valor_usd != null ? `$${formatUSD(art.valor_usd)}` : '—'}
                      </td>
                      <td style={{ padding: '0.65rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {vs !== null ? (
                          <span style={{ fontWeight: '700', color: '#2F4156' }}>${formatUSD(vs)}</span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                          <button onClick={() => openEdit(art)} className="btn btn-secondary" style={{ padding: '0.3rem 0.5rem' }} title="Editar">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDelete(art.id)} className="btn btn-danger" style={{ padding: '0.3rem 0.5rem' }} title="Eliminar">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Fila de total */}
              <tfoot>
                <tr style={{ background: 'linear-gradient(135deg, #2F4156 0%, #567C8D 100%)', color: 'white' }}>
                  <td colSpan={8} style={{ padding: '0.75rem 1rem', fontWeight: '700', fontSize: '0.85rem', textAlign: 'right' }}>
                    VALOR TOTAL EN STOCK:
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    ${formatUSD(totalValorStock)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1rem'
        }}>
          <div style={{
            background: 'white', borderRadius: '12px', padding: '2rem',
            width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Package size={22} style={{ color: '#567C8D' }} />
                {editingArticulo ? 'Editar Artículo' : 'Nuevo Artículo'}
              </h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0.25rem' }}>
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Fila 1: Código + Categoría */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label className="input-label">📝 Código</label>
                  <input type="text" value={formData.codigo}
                    onChange={e => setFormData(p => ({ ...p, codigo: e.target.value }))}
                    className="input" placeholder="Ej: ART-001" />
                </div>
                <div>
                  <label className="input-label">🏷️ Categoría</label>
                  <select value={formData.categoria}
                    onChange={e => setFormData(p => ({ ...p, categoria: e.target.value }))}
                    className="input">
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Proveedor */}
              <div style={{ marginBottom: '1rem' }}>
                <label className="input-label">🏢 Proveedor</label>
                <select value={formData.proveedor_id}
                  onChange={e => setFormData(p => ({ ...p, proveedor_id: e.target.value, proveedor_otro: '' }))}
                  className="input">
                  <option value="">— Seleccionar proveedor —</option>
                  {proveedores.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre_comercial}</option>
                  ))}
                  <option value="otro">Otro (especificar)</option>
                </select>
              </div>

              {/* Campo texto si proveedor = otro */}
              {formData.proveedor_id === 'otro' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label className="input-label">✏️ Nombre del proveedor</label>
                  <input type="text" value={formData.proveedor_otro}
                    onChange={e => setFormData(p => ({ ...p, proveedor_otro: e.target.value }))}
                    className="input" placeholder="Nombre del proveedor" />
                </div>
              )}

              {/* Descripción */}
              <div style={{ marginBottom: '1rem' }}>
                <label className="input-label">📦 Descripción <span style={{ color: '#dc2626' }}>*</span></label>
                <input type="text" value={formData.descripcion}
                  onChange={e => setFormData(p => ({ ...p, descripcion: e.target.value }))}
                  className="input" placeholder="Descripción del artículo" required />
              </div>

              {/* Unidad de medida */}
              <div style={{ marginBottom: '1rem' }}>
                <label className="input-label">📏 Unidad de Medida</label>
                <select value={formData.unidad_medida}
                  onChange={e => setFormData(p => ({ ...p, unidad_medida: e.target.value }))}
                  className="input">
                  {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>

              {/* Fila: Stock mínimo + Stock actual + Valor */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label className="input-label">⚠️ Stock Mínimo</label>
                  <input type="number" min="0" step="0.01" value={formData.stock_minimo}
                    onChange={e => setFormData(p => ({ ...p, stock_minimo: e.target.value }))}
                    className="input" placeholder="0" />
                </div>
                <div>
                  <label className="input-label">📊 Stock Actual</label>
                  <input type="number" min="0" step="0.01" value={formData.stock_actual}
                    onChange={e => setFormData(p => ({ ...p, stock_actual: e.target.value }))}
                    className="input" placeholder="0" />
                </div>
                <div>
                  <label className="input-label">💵 Valor (USD)</label>
                  <input type="number" min="0" step="0.01" value={formData.valor_usd}
                    onChange={e => setFormData(p => ({ ...p, valor_usd: e.target.value }))}
                    className="input" placeholder="0.00" />
                </div>
              </div>

              {/* Previsualización valor en stock */}
              {formData.stock_actual !== '' && formData.valor_usd !== '' && (
                <div style={{ 
                  background: '#C8D9E6', border: '1px solid #567C8D', borderRadius: '8px',
                  padding: '0.75rem 1rem', marginBottom: '1.5rem',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <span style={{ fontSize: '0.85rem', color: '#2F4156', fontWeight: '600' }}>Valor en Stock:</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: '800', color: '#2F4156' }}>
                    ${formatUSD(parseFloat(formData.stock_actual || 0) * parseFloat(formData.valor_usd || 0))}
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="btn btn-secondary">
                  <X size={16} /> Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn btn-success">
                  {saving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
