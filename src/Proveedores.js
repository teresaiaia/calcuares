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
    contacto_comercial: '',
    contacto_logistico: '',
    contacto_administrativo: '',
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
      contacto_comercial: '',
      contacto_logistico: '',
      contacto_administrativo: '',
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
      contacto_comercial: proveedor.contacto_comercial || '',
      contacto_logistico: proveedor.contacto_logistico || '',
      contacto_administrativo: proveedor.contacto_administrativo || '',
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
      console.error('Error guardando:', error);
      alert('Error al guardar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteProveedor = async (id, nombre) => {
    if (!window.confirm(`¿Eliminar proveedor "${nombre}"?`)) return;

    try {
      const { error } = await supabase
        .from('proveedores')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchProveedores();
    } catch (error) {
      console.error('Error eliminando:', error);
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

  const filteredProveedores = proveedores.filter(p =>
    p.nombre_comercial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.contacto_comercial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.contacto_logistico?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.contacto_administrativo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.direccion_pickup?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Función para obtener resumen de contactos
  const getContactoResumen = (proveedor) => {
    const contactos = [];
    if (proveedor.contacto_comercial) contactos.push('Comercial');
    if (proveedor.contacto_logistico) contactos.push('Logístico');
    if (proveedor.contacto_administrativo) contactos.push('Administrativo');
    return contactos.length > 0 ? contactos.join(' • ') : 'Sin contactos';
  };

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
      <div className="cc-header">
        <div>
          <h1 className="cc-title">
            <Building2 size={28} />
            Proveedores
          </h1>
          <p className="cc-subtitle">Gestiona tu directorio de proveedores</p>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ 
        background: 'white', 
        borderRadius: '12px', 
        padding: '0.75rem 1rem', 
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'center',
        marginBottom: '1rem'
      }}>
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem',
          background: '#f1f5f9',
          borderRadius: '8px',
          padding: '0.6rem 1rem',
          border: '2px solid #e2e8f0'
        }}>
          <Search size={18} style={{ color: '#567C8D', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Buscar proveedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ 
              border: 'none', 
              background: 'transparent', 
              width: '100%', 
              outline: 'none',
              fontSize: '0.95rem',
              color: '#2F4156'
            }}
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#94a3b8' }}
            >
              <X size={16} />
            </button>
          )}
        </div>
        <span style={{ fontSize: '0.8rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
          {filteredProveedores.length} {filteredProveedores.length === 1 ? 'proveedor' : 'proveedores'}
        </span>
        <button onClick={openNewModal} className="cc-btn cc-btn-primary">
          <Plus size={18} />
          Nuevo Proveedor
        </button>
      </div>

      {/* Grid de Proveedores - Compacto */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', 
        gap: '0.75rem' 
      }}>
        {filteredProveedores.map(proveedor => (
          <div key={proveedor.id} style={{ 
            background: 'white', 
            borderRadius: '10px', 
            padding: '0.75rem 1rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            border: '1px solid #e2e8f0',
            opacity: proveedor.activo ? 1 : 0.5,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#2F4156', margin: 0 }}>
                {proveedor.nombre_comercial}
              </h3>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button onClick={() => openEditModal(proveedor)} className="cc-btn-icon" title="Editar" style={{ padding: '3px' }}>
                  <Edit2 size={13} />
                </button>
                <button onClick={() => deleteProveedor(proveedor.id, proveedor.nombre_comercial)} className="cc-btn-icon cc-btn-danger" title="Eliminar" style={{ padding: '3px' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {getContactoResumen(proveedor)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.15rem' }}>
              <button
                onClick={() => toggleActivo(proveedor)}
                style={{ 
                  fontSize: '0.7rem', 
                  padding: '2px 8px', 
                  borderRadius: '10px', 
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '600',
                  background: proveedor.activo ? '#dcfce7' : '#f1f5f9',
                  color: proveedor.activo ? '#16a34a' : '#94a3b8'
                }}
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
                  <div className="cc-form-group" style={{ marginBottom: '1.5rem' }}>
                    <label className="cc-form-label" style={{ fontSize: '1rem', fontWeight: '600' }}>
                      Empresa *
                    </label>
                    <input
                      type="text"
                      value={formData.nombre_comercial}
                      onChange={(e) => setFormData({...formData, nombre_comercial: e.target.value})}
                      className="cc-form-input"
                      placeholder="Nombre de la empresa"
                      required
                      style={{ fontSize: '1.1rem', padding: '0.75rem' }}
                    />
                  </div>

                  {/* Sección de Contactos */}
                  <div style={{ 
                    background: '#f8fafc', 
                    padding: '1rem', 
                    borderRadius: '8px', 
                    marginBottom: '1.5rem',
                    border: '1px solid #e2e8f0'
                  }}>
                    <h3 style={{ 
                      fontSize: '0.9rem', 
                      fontWeight: '600', 
                      color: '#2F4156', 
                      marginBottom: '1rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Información de Contactos
                    </h3>

                    {/* Contacto Comercial */}
                    <div className="cc-form-group" style={{ marginBottom: '1rem' }}>
                      <label className="cc-form-label" style={{ color: '#567C8D', fontWeight: '600' }}>
                        🏢 Contacto Comercial
                      </label>
                      <textarea
                        value={formData.contacto_comercial}
                        onChange={(e) => setFormData({...formData, contacto_comercial: e.target.value})}
                        className="cc-form-input"
                        rows="2"
                        placeholder="Nombre, Teléfono, Email"
                        style={{ resize: 'vertical', minHeight: '60px' }}
                      />
                    </div>

                    {/* Contacto Logístico */}
                    <div className="cc-form-group" style={{ marginBottom: '1rem' }}>
                      <label className="cc-form-label" style={{ color: '#567C8D', fontWeight: '600' }}>
                        🚚 Contacto Logístico
                      </label>
                      <textarea
                        value={formData.contacto_logistico}
                        onChange={(e) => setFormData({...formData, contacto_logistico: e.target.value})}
                        className="cc-form-input"
                        rows="2"
                        placeholder="Nombre, Teléfono, Email"
                        style={{ resize: 'vertical', minHeight: '60px' }}
                      />
                    </div>

                    {/* Contacto Administrativo */}
                    <div className="cc-form-group">
                      <label className="cc-form-label" style={{ color: '#567C8D', fontWeight: '600' }}>
                        📋 Contacto Administrativo
                      </label>
                      <textarea
                        value={formData.contacto_administrativo}
                        onChange={(e) => setFormData({...formData, contacto_administrativo: e.target.value})}
                        className="cc-form-input"
                        rows="2"
                        placeholder="Nombre, Teléfono, Email"
                        style={{ resize: 'vertical', minHeight: '60px' }}
                      />
                    </div>
                  </div>

                  {/* Datos Bancarios */}
                  <div className="cc-form-group" style={{ marginBottom: '1.25rem' }}>
                    <label className="cc-form-label">
                      🏦 Datos Bancarios
                    </label>
                    <textarea
                      value={formData.datos_bancarios}
                      onChange={(e) => setFormData({...formData, datos_bancarios: e.target.value})}
                      className="cc-form-input"
                      rows="3"
                      placeholder="Banco, cuenta, IBAN, SWIFT, moneda, VAT, condiciones de pago..."
                    />
                  </div>

                  {/* Dirección de Pickup */}
                  <div className="cc-form-group" style={{ marginBottom: '1.25rem' }}>
                    <label className="cc-form-label">
                      📍 Dirección de Pickup
                    </label>
                    <textarea
                      value={formData.direccion_pickup}
                      onChange={(e) => setFormData({...formData, direccion_pickup: e.target.value})}
                      className="cc-form-input"
                      rows="2"
                      placeholder="Dirección completa, horarios, instrucciones..."
                    />
                  </div>

                  {/* Activo */}
                  <div className="cc-form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formData.activo}
                        onChange={(e) => setFormData({...formData, activo: e.target.checked})}
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                      />
                      <span className="cc-form-label" style={{ marginBottom: 0 }}>
                        Proveedor Activo
                      </span>
                    </label>
                  </div>

                </div>
              </div>

              <div className="cc-modal-footer">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="cc-btn cc-btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="cc-btn cc-btn-primary"
                  disabled={saving}
                >
                  <Save size={18} />
                  {saving ? 'Guardando...' : (editingProveedor ? 'Actualizar' : 'Guardar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
