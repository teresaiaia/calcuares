import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Search, Plus, Edit2, Trash2, X, Save, Building2, User, Phone, Mail, MapPin, CreditCard } from 'lucide-react';
import './ComprasCargas.css';

export default function Proveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState(null);
  const [activeTab, setActiveTab] = useState('general');

  const [formData, setFormData] = useState({
    nombre_comercial: '',
    nombre_contacto: '',
    email_contacto: '',
    telefono: '',
    telefono_alternativo: '',
    pais: '',
    ciudad: '',
    direccion_pickup: '',
    horario_pickup: '',
    notas_pickup: '',
    cuenta_bancaria: '',
    banco: '',
    swift_code: '',
    iban: '',
    moneda_preferida: 'USD',
    condiciones_pago: '',
    sitio_web: '',
    notas: '',
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
      nombre_contacto: '',
      email_contacto: '',
      telefono: '',
      telefono_alternativo: '',
      pais: '',
      ciudad: '',
      direccion_pickup: '',
      horario_pickup: '',
      notas_pickup: '',
      cuenta_bancaria: '',
      banco: '',
      swift_code: '',
      iban: '',
      moneda_preferida: 'USD',
      condiciones_pago: '',
      sitio_web: '',
      notas: '',
      activo: true
    });
    setEditingProveedor(null);
    setActiveTab('general');
  };

  const openNewModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (proveedor) => {
    setFormData({
      nombre_comercial: proveedor.nombre_comercial || '',
      nombre_contacto: proveedor.nombre_contacto || '',
      email_contacto: proveedor.email_contacto || '',
      telefono: proveedor.telefono || '',
      telefono_alternativo: proveedor.telefono_alternativo || '',
      pais: proveedor.pais || '',
      ciudad: proveedor.ciudad || '',
      direccion_pickup: proveedor.direccion_pickup || '',
      horario_pickup: proveedor.horario_pickup || '',
      notas_pickup: proveedor.notas_pickup || '',
      cuenta_bancaria: proveedor.cuenta_bancaria || '',
      banco: proveedor.banco || '',
      swift_code: proveedor.swift_code || '',
      iban: proveedor.iban || '',
      moneda_preferida: proveedor.moneda_preferida || 'USD',
      condiciones_pago: proveedor.condiciones_pago || '',
      sitio_web: proveedor.sitio_web || '',
      notas: proveedor.notas || '',
      activo: proveedor.activo !== false
    });
    setEditingProveedor(proveedor);
    setActiveTab('general');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.nombre_comercial.trim()) {
      alert('El nombre comercial es obligatorio');
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
      p.nombre_contacto?.toLowerCase().includes(search) ||
      p.pais?.toLowerCase().includes(search) ||
      p.ciudad?.toLowerCase().includes(search) ||
      p.email_contacto?.toLowerCase().includes(search)
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
              Administra la información completa de tus proveedores
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
              placeholder="Buscar por nombre, contacto, país..."
              className="cc-search-input"
            />
          </div>
          <div style={{ color: '#567C8D', fontSize: '0.875rem' }}>
            {filteredProveedores.length} proveedor{filteredProveedores.length !== 1 ? 'es' : ''}
          </div>
        </div>
      </div>

      {/* Lista de Proveedores */}
      <div className="cc-cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))' }}>
        {filteredProveedores.map(proveedor => (
          <div key={proveedor.id} className="cc-card" style={{ opacity: proveedor.activo ? 1 : 0.6 }}>
            <div className="cc-card-header">
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#2F4156' }}>
                  {proveedor.nombre_comercial}
                </h3>
                {proveedor.pais && (
                  <span style={{ fontSize: '0.8rem', color: '#567C8D' }}>
                    📍 {proveedor.ciudad ? `${proveedor.ciudad}, ` : ''}{proveedor.pais}
                  </span>
                )}
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
              {proveedor.nombre_contacto && (
                <div className="cc-info-row">
                  <User size={14} />
                  <span>{proveedor.nombre_contacto}</span>
                </div>
              )}
              {proveedor.telefono && (
                <div className="cc-info-row">
                  <Phone size={14} />
                  <span>{proveedor.telefono}</span>
                </div>
              )}
              {proveedor.email_contacto && (
                <div className="cc-info-row">
                  <Mail size={14} />
                  <span>{proveedor.email_contacto}</span>
                </div>
              )}
              {proveedor.direccion_pickup && (
                <div className="cc-info-row">
                  <MapPin size={14} />
                  <span style={{ fontSize: '0.8rem' }}>{proveedor.direccion_pickup}</span>
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
              {proveedor.moneda_preferida && (
                <span style={{ fontSize: '0.75rem', color: '#567C8D' }}>
                  💰 {proveedor.moneda_preferida}
                </span>
              )}
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
          <div className="cc-modal cc-modal-large" onClick={e => e.stopPropagation()}>
            <div className="cc-modal-header">
              <h2>
                <Building2 size={20} />
                {editingProveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}
              </h2>
              <button onClick={() => setShowModal(false)} className="cc-modal-close">
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="cc-tabs">
              <button 
                className={`cc-tab ${activeTab === 'general' ? 'cc-tab-active' : ''}`}
                onClick={() => setActiveTab('general')}
              >
                <Building2 size={16} />
                General
              </button>
              <button 
                className={`cc-tab ${activeTab === 'contacto' ? 'cc-tab-active' : ''}`}
                onClick={() => setActiveTab('contacto')}
              >
                <User size={16} />
                Contacto
              </button>
              <button 
                className={`cc-tab ${activeTab === 'pickup' ? 'cc-tab-active' : ''}`}
                onClick={() => setActiveTab('pickup')}
              >
                <MapPin size={16} />
                Pickup
              </button>
              <button 
                className={`cc-tab ${activeTab === 'bancario' ? 'cc-tab-active' : ''}`}
                onClick={() => setActiveTab('bancario')}
              >
                <CreditCard size={16} />
                Datos Bancarios
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="cc-modal-body">
                
                {/* Tab General */}
                {activeTab === 'general' && (
                  <div className="cc-form-section">
                    <div className="cc-form-grid">
                      <div className="cc-form-group cc-form-full">
                        <label className="cc-form-label">
                          Nombre Comercial *
                        </label>
                        <input
                          type="text"
                          value={formData.nombre_comercial}
                          onChange={(e) => setFormData({...formData, nombre_comercial: e.target.value})}
                          className="cc-form-input"
                          placeholder="Ej: Lumenis"
                          required
                        />
                      </div>

                      <div className="cc-form-group">
                        <label className="cc-form-label">País</label>
                        <input
                          type="text"
                          value={formData.pais}
                          onChange={(e) => setFormData({...formData, pais: e.target.value})}
                          className="cc-form-input"
                          placeholder="Ej: Israel"
                        />
                      </div>

                      <div className="cc-form-group">
                        <label className="cc-form-label">Ciudad</label>
                        <input
                          type="text"
                          value={formData.ciudad}
                          onChange={(e) => setFormData({...formData, ciudad: e.target.value})}
                          className="cc-form-input"
                          placeholder="Ej: Tel Aviv"
                        />
                      </div>

                      <div className="cc-form-group">
                        <label className="cc-form-label">Sitio Web</label>
                        <input
                          type="url"
                          value={formData.sitio_web}
                          onChange={(e) => setFormData({...formData, sitio_web: e.target.value})}
                          className="cc-form-input"
                          placeholder="https://www.ejemplo.com"
                        />
                      </div>

                      <div className="cc-form-group">
                        <label className="cc-form-label">Moneda Preferida</label>
                        <select
                          value={formData.moneda_preferida}
                          onChange={(e) => setFormData({...formData, moneda_preferida: e.target.value})}
                          className="cc-form-select"
                        >
                          <option value="USD">USD - Dólar</option>
                          <option value="EUR">EUR - Euro</option>
                          <option value="GBP">GBP - Libra</option>
                        </select>
                      </div>

                      <div className="cc-form-group cc-form-full">
                        <label className="cc-form-label">Notas Generales</label>
                        <textarea
                          value={formData.notas}
                          onChange={(e) => setFormData({...formData, notas: e.target.value})}
                          className="cc-form-textarea"
                          rows="3"
                          placeholder="Notas adicionales sobre el proveedor..."
                        />
                      </div>

                      <div className="cc-form-group">
                        <label className="cc-form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                )}

                {/* Tab Contacto */}
                {activeTab === 'contacto' && (
                  <div className="cc-form-section">
                    <div className="cc-form-grid">
                      <div className="cc-form-group cc-form-full">
                        <label className="cc-form-label">
                          <User size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                          Nombre del Contacto
                        </label>
                        <input
                          type="text"
                          value={formData.nombre_contacto}
                          onChange={(e) => setFormData({...formData, nombre_contacto: e.target.value})}
                          className="cc-form-input"
                          placeholder="Ej: John Smith"
                        />
                      </div>

                      <div className="cc-form-group">
                        <label className="cc-form-label">
                          <Mail size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                          Email
                        </label>
                        <input
                          type="email"
                          value={formData.email_contacto}
                          onChange={(e) => setFormData({...formData, email_contacto: e.target.value})}
                          className="cc-form-input"
                          placeholder="contacto@empresa.com"
                        />
                      </div>

                      <div className="cc-form-group">
                        <label className="cc-form-label">
                          <Phone size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                          Teléfono Principal
                        </label>
                        <input
                          type="tel"
                          value={formData.telefono}
                          onChange={(e) => setFormData({...formData, telefono: e.target.value})}
                          className="cc-form-input"
                          placeholder="+1 234 567 8900"
                        />
                      </div>

                      <div className="cc-form-group">
                        <label className="cc-form-label">
                          <Phone size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                          Teléfono Alternativo
                        </label>
                        <input
                          type="tel"
                          value={formData.telefono_alternativo}
                          onChange={(e) => setFormData({...formData, telefono_alternativo: e.target.value})}
                          className="cc-form-input"
                          placeholder="+1 234 567 8901"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab Pickup */}
                {activeTab === 'pickup' && (
                  <div className="cc-form-section">
                    <div className="cc-form-grid">
                      <div className="cc-form-group cc-form-full">
                        <label className="cc-form-label">
                          <MapPin size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                          Dirección de Pickup
                        </label>
                        <textarea
                          value={formData.direccion_pickup}
                          onChange={(e) => setFormData({...formData, direccion_pickup: e.target.value})}
                          className="cc-form-textarea"
                          rows="3"
                          placeholder="Dirección completa para recoger mercadería..."
                        />
                      </div>

                      <div className="cc-form-group cc-form-full">
                        <label className="cc-form-label">Horario de Pickup</label>
                        <input
                          type="text"
                          value={formData.horario_pickup}
                          onChange={(e) => setFormData({...formData, horario_pickup: e.target.value})}
                          className="cc-form-input"
                          placeholder="Ej: Lunes a Viernes 9:00 - 17:00"
                        />
                      </div>

                      <div className="cc-form-group cc-form-full">
                        <label className="cc-form-label">Notas de Pickup</label>
                        <textarea
                          value={formData.notas_pickup}
                          onChange={(e) => setFormData({...formData, notas_pickup: e.target.value})}
                          className="cc-form-textarea"
                          rows="3"
                          placeholder="Instrucciones especiales para el pickup..."
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab Datos Bancarios */}
                {activeTab === 'bancario' && (
                  <div className="cc-form-section">
                    <div className="cc-form-grid">
                      <div className="cc-form-group">
                        <label className="cc-form-label">Banco</label>
                        <input
                          type="text"
                          value={formData.banco}
                          onChange={(e) => setFormData({...formData, banco: e.target.value})}
                          className="cc-form-input"
                          placeholder="Nombre del banco"
                        />
                      </div>

                      <div className="cc-form-group">
                        <label className="cc-form-label">Número de Cuenta</label>
                        <input
                          type="text"
                          value={formData.cuenta_bancaria}
                          onChange={(e) => setFormData({...formData, cuenta_bancaria: e.target.value})}
                          className="cc-form-input"
                          placeholder="Número de cuenta"
                        />
                      </div>

                      <div className="cc-form-group">
                        <label className="cc-form-label">SWIFT/BIC Code</label>
                        <input
                          type="text"
                          value={formData.swift_code}
                          onChange={(e) => setFormData({...formData, swift_code: e.target.value})}
                          className="cc-form-input"
                          placeholder="Ej: BSCHESMMXXX"
                        />
                      </div>

                      <div className="cc-form-group">
                        <label className="cc-form-label">IBAN</label>
                        <input
                          type="text"
                          value={formData.iban}
                          onChange={(e) => setFormData({...formData, iban: e.target.value})}
                          className="cc-form-input"
                          placeholder="Ej: ES91 2100 0418 4502 0005 1332"
                        />
                      </div>

                      <div className="cc-form-group cc-form-full">
                        <label className="cc-form-label">Condiciones de Pago</label>
                        <textarea
                          value={formData.condiciones_pago}
                          onChange={(e) => setFormData({...formData, condiciones_pago: e.target.value})}
                          className="cc-form-textarea"
                          rows="3"
                          placeholder="Ej: 50% adelanto, 50% contra entrega. Net 30 días..."
                        />
                      </div>
                    </div>
                  </div>
                )}

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
