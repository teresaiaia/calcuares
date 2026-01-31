import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Search, Plus, Edit2, Trash2, X, Save, Building2 } from 'lucide-react';
import './ComprasCargas.css';

export default function Proveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState(null);

  const [formData, setFormData] = useState({
    nombre_comercial: '',
    datos_contacto: '',
    datos_bancarios: '',
    direccion_pickup: '',
    activo: true
  });

  useEffect(() => {
    fetchProveedores();
  }, []);

  const fetchProveedores = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('proveedores')
        .select('*')
        .order('nombre_comercial');

      if (error) throw error;
      setProveedores(data || []);
    } catch (error) {
      console.error('Error cargando proveedores:', error);
      alert('Error al cargar proveedores');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      nombre_comercial: '',
      datos_contacto: '',
      datos_bancarios: '',
      direccion_pickup: '',
      activo: true
    });
    setEditingProveedor(null);
  };

  const openNewModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (proveedor) => {
    setFormData({
      nombre_comercial: proveedor.nombre_comercial || '',
      datos_contacto: proveedor.datos_contacto || '',
      datos_bancarios: proveedor.datos_bancarios || '',
      direccion_pickup: proveedor.direccion_pickup || '',
      activo: proveedor.activo !== false
    });
    setEditingProveedor(proveedor);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.nombre_comercial.trim()) {
      alert('El nombre de la empresa es obligatorio');
      return;
    }

    try {
      setSaving(true);

      if (editingProveedor) {
        const { error } = await supabase
          .from('proveedores')
          .update(formData)
          .eq('id', editingProveedor.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('proveedores')
          .insert([formData]);

        if (error) throw error;
      }

      await fetchProveedores();
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Error guardando proveedor:', error);
      alert('Error al guardar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteProveedor = async (id, nombre) => {
    if (!window.confirm(`¿Estás seguro de eliminar el proveedor "${nombre}"?`)) return;

    try {
      const { error } = await supabase
        .from('proveedores')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchProveedores();
    } catch (error) {
      console.error('Error eliminando proveedor:', error);
      alert('Error al eliminar: ' + error.message);
    }
  };

  const toggleActivo = async (proveedor) => {
    try {
      const { error } = await supabase
        .from('proveedores')
        .update({ activo: !proveedor.activo })
        .eq('id', proveedor.id);

      if (error) throw error;
      await fetchProveedores();
    } catch (error) {
      console.error('Error actualizando estado:', error);
    }
  };

  const filteredProveedores = proveedores.filter(p => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      p.nombre_comercial?.toLowerCase().includes(search) ||
      p.datos_contacto?.toLowerCase().includes(search) ||
      p.direccion_pickup?.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <div className="cc-loading">
        <div className="cc-spinner"></div>
        <p>Cargando proveedores...</p>
      </div>
    );
  }

  return (
    <div className="cc-container">
      {/* Header */}
      <div className="cc-header-section">
        <div className="cc-header-top">
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#2F4156', marginBottom: '0.25rem' }}>
              <Building2 size={24} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
              Gestión de Proveedores
            </h2>
            <p style={{ color: '#567C8D', fontSize: '0.9rem' }}>
              Administra la información de tus proveedores
            </p>
          </div>
          <button onClick={openNewModal} className="cc-btn cc-btn-primary">
            <Plus size={18} />
            Nuevo Proveedor
          </button>
        </div>

        {/* Buscador */}
        <div className="cc-filters">
          <div className="cc-search-box">
            <Search size={18} className="cc-search-icon" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar proveedores..."
              className="cc-search-input"
            />
          </div>
          <div style={{ color: '#567C8D', fontSize: '0.875rem' }}>
            {filteredProveedores.length} proveedor{filteredProveedores.length !== 1 ? 'es' : ''}
          </div>
        </div>
      </div>

      {/* Lista de Proveedores */}
      <div className="cc-cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {filteredProveedores.map(proveedor => (
          <div key={proveedor.id} className="cc-card" style={{ opacity: proveedor.activo ? 1 : 0.6 }}>
            <div className="cc-card-header">
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#2F4156' }}>
                  {proveedor.nombre_comercial}
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={() => openEditModal(proveedor)} 
                  className="cc-btn-icon"
                  title="Editar"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  onClick={() => deleteProveedor(proveedor.id, proveedor.nombre_comercial)} 
                  className="cc-btn-icon cc-btn-danger"
                  title="Eliminar"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="cc-card-body">
              {proveedor.datos_contacto && (
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem', whiteSpace: 'pre-line' }}>
                  {proveedor.datos_contacto.length > 100 
                    ? proveedor.datos_contacto.substring(0, 100) + '...' 
                    : proveedor.datos_contacto}
                </div>
              )}
              {proveedor.direccion_pickup && (
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  📍 {proveedor.direccion_pickup.length > 50 
                    ? proveedor.direccion_pickup.substring(0, 50) + '...' 
                    : proveedor.direccion_pickup}
                </div>
              )}
            </div>

            <div className="cc-card-footer">
              <button
                onClick={() => toggleActivo(proveedor)}
                className={`cc-status-badge ${proveedor.activo ? 'cc-status-active' : 'cc-status-inactive'}`}
              >
                {proveedor.activo ? '✓ Activo' : '○ Inactivo'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredProveedores.length === 0 && (
        <div className="cc-empty-state">
          <Building2 size={48} strokeWidth={1} />
          <h3>No hay proveedores</h3>
          <p>{searchTerm ? 'No se encontraron resultados' : 'Agrega tu primer proveedor'}</p>
          {!searchTerm && (
            <button onClick={openNewModal} className="cc-btn cc-btn-primary">
              <Plus size={18} />
              Nuevo Proveedor
            </button>
          )}
        </div>
      )}

      {/* Modal de Proveedor */}
      {showModal && (
        <div className="cc-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="cc-modal" onClick={e => e.stopPropagation()}>
            <div className="cc-modal-header">
              <h2>
                <Building2 size={20} />
                {editingProveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}
              </h2>
              <button onClick={() => setShowModal(false)} className="cc-modal-close">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="cc-modal-body">
                <div className="cc-form-section">
                  
                  {/* Empresa */}
                  <div className="cc-form-group" style={{ marginBottom: '1.25rem' }}>
                    <label className="cc-form-label">Empresa *</label>
                    <input
                      type="text"
                      value={formData.nombre_comercial}
                      onChange={(e) => setFormData({...formData, nombre_comercial: e.target.value})}
                      className="cc-form-input"
                      placeholder="Nombre de la empresa"
                      required
                    />
                  </div>

                  {/* Datos de Contacto */}
                  <div className="cc-form-group" style={{ marginBottom: '1.25rem' }}>
                    <label className="cc-form-label">Datos de Contacto</label>
                    <textarea
                      value={formData.datos_contacto}
                      onChange={(e) => setFormData({...formData, datos_contacto: e.target.value})}
                      className="cc-form-textarea"
                      rows="4"
                      placeholder="Nombre del contacto, email, WhatsApp, teléfono..."
                    />
                  </div>

                  {/* Datos Bancarios */}
                  <div className="cc-form-group" style={{ marginBottom: '1.25rem' }}>
                    <label className="cc-form-label">Datos Bancarios</label>
                    <textarea
                      value={formData.datos_bancarios}
                      onChange={(e) => setFormData({...formData, datos_bancarios: e.target.value})}
                      className="cc-form-textarea"
                      rows="4"
                      placeholder="Banco, cuenta, IBAN, SWIFT, moneda, VAT, condiciones de pago..."
                    />
                  </div>

                  {/* Dirección de Pickup */}
                  <div className="cc-form-group" style={{ marginBottom: '1.25rem' }}>
                    <label className="cc-form-label">Dirección de Pickup</label>
                    <textarea
                      value={formData.direccion_pickup}
                      onChange={(e) => setFormData({...formData, direccion_pickup: e.target.value})}
                      className="cc-form-textarea"
                      rows="3"
                      placeholder="Dirección completa para recoger mercadería, horarios, instrucciones..."
                    />
                  </div>

                  {/* Proveedor Activo */}
                  <div className="cc-form-group">
                    <label className="cc-form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formData.activo}
                        onChange={(e) => setFormData({...formData, activo: e.target.checked})}
                        style={{ width: '18px', height: '18px' }}
                      />
                      Proveedor Activo
                    </label>
                  </div>

                </div>
              </div>

              <div className="cc-modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="cc-btn cc-btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="cc-btn cc-btn-primary" disabled={saving}>
                  {saving ? (
                    <>
                      <span className="cc-spinner-small"></span>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      {editingProveedor ? 'Actualizar' : 'Guardar'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
