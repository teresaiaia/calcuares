import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { Search, Download, Plus, Eye, Trash2, X, Package } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import './ComprasCargas.css';

export default function ComprasCargas() {
  // Estados principales
  const [compras, setCompras] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [estadosCarga, setEstadosCarga] = useState([]);
  const [metodosPago, setMetodosPago] = useState([]);
  const [categorias, setCategorias] = useState([]);
  
  // Estados de UI
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('all');
  const [filterProveedor, setFilterProveedor] = useState('all');
  const [viewMode, setViewMode] = useState('table'); // 'table' o 'cards'
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  // Estados del formulario
  const [formData, setFormData] = useState({
    fecha_orden: '',
    codigo_orden: '',
    proveedor_id: '',
    proveedor_otro: '',
    categoria_id: '',
    descripcion: '',
    metodo_pago_id: '',
    banco_pagador: '',
    costo_transferencia: '',
    datos_transferencia: '',
    origen: '',
    direccion_pickup: '',
    peso: '',
    volumen: '',
    transportista: '',
    despachante: '',
    cotizacion_carga: '',
    costo_carga: '',
    gastos_extras: '',
    costo_despacho: '',
    numero_guia: '',
    estado_carga_id: ''
  });

  // Cargar datos iniciales
  useEffect(() => {
    loadInitialData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchCompras(),
        fetchProveedores(),
        fetchEstadosCarga(),
        fetchMetodosPago(),
        fetchCategorias()
      ]);
    } catch (error) {
      console.error('Error cargando datos:', error);
      alert('Error al cargar los datos iniciales');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompras = async () => {
    const { data, error } = await supabase
      .from('vista_compras_cargas')
      .select('*')
      .order('fecha_orden', { ascending: false });

    if (error) {
      console.error('Error fetching compras:', error);
      return;
    }
    setCompras(data || []);
  };

  const fetchProveedores = async () => {
    const { data, error } = await supabase
      .from('proveedores')
      .select('*')
      .eq('activo', true)
      .order('nombre_comercial');

    if (error) {
      console.error('Error fetching proveedores:', error);
      return;
    }
    setProveedores(data || []);
  };

  const fetchEstadosCarga = async () => {
    const { data, error } = await supabase
      .from('estados_carga')
      .select('*')
      .eq('activo', true)
      .order('orden');

    if (error) {
      console.error('Error fetching estados:', error);
      return;
    }
    setEstadosCarga(data || []);
  };

  const fetchMetodosPago = async () => {
    const { data, error } = await supabase
      .from('metodos_pago')
      .select('*')
      .eq('activo', true);

    if (error) {
      console.error('Error fetching métodos de pago:', error);
      return;
    }
    setMetodosPago(data || []);
  };

  const fetchCategorias = async () => {
    const { data, error } = await supabase
      .from('categorias_compra')
      .select('*')
      .eq('activo', true);

    if (error) {
      console.error('Error fetching categorías:', error);
      return;
    }
    setCategorias(data || []);
  };

  // Búsqueda integral en todos los campos
  const filteredCompras = useMemo(() => {
    let filtered = [...compras];

    // Filtro por búsqueda (busca en TODOS los campos)
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(item => {
        return (
          item.codigo_orden?.toLowerCase().includes(search) ||
          item.proveedor_nombre?.toLowerCase().includes(search) ||
          item.origen?.toLowerCase().includes(search) ||
          item.transportista?.toLowerCase().includes(search) ||
          item.despachante?.toLowerCase().includes(search) ||
          item.numero_guia?.toLowerCase().includes(search) ||
          item.estado?.toLowerCase().includes(search) ||
          item.descripcion?.toLowerCase().includes(search) ||
          item.banco_pagador?.toLowerCase().includes(search) ||
          item.direccion_pickup?.toLowerCase().includes(search) ||
          item.categoria?.toLowerCase().includes(search) ||
          item.metodo_pago?.toLowerCase().includes(search)
        );
      });
    }

    // Filtro por estado
    if (filterEstado !== 'all') {
      filtered = filtered.filter(item => item.estado === filterEstado);
    }

    // Filtro por proveedor
    if (filterProveedor !== 'all') {
      filtered = filtered.filter(item => item.proveedor_nombre === filterProveedor);
    }

    return filtered;
  }, [compras, searchTerm, filterEstado, filterProveedor]);

  // Estadísticas
  const stats = useMemo(() => {
    const total = compras.length;
    const enTransito = compras.filter(c => c.estado === 'En Tránsito').length;
    const pendientes = compras.filter(c => c.estado === 'Pendiente').length;
    
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const totalMes = compras
      .filter(c => {
        const fecha = new Date(c.fecha_orden);
        return fecha.getMonth() === currentMonth && fecha.getFullYear() === currentYear;
      })
      .reduce((sum, c) => sum + (parseFloat(c.costo_total) || 0), 0);

    return {
      total,
      enTransito,
      pendientes,
      totalMes: totalMes.toFixed(2)
    };
  }, [compras]);

  // Manejar cambios en el formulario
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Abrir modal para nueva compra
  const openNewModal = () => {
    setEditingItem(null);
    setFormData({
      fecha_orden: new Date().toISOString().split('T')[0],
      codigo_orden: generateCodigoOrden(),
      proveedor_id: '',
      proveedor_otro: '',
      categoria_id: '',
      descripcion: '',
      metodo_pago_id: '',
      banco_pagador: '',
      costo_transferencia: '',
      datos_transferencia: '',
      origen: '',
      direccion_pickup: '',
      peso: '',
      volumen: '',
      transportista: '',
      despachante: '',
      cotizacion_carga: '',
      costo_carga: '',
      gastos_extras: '',
      costo_despacho: '',
      numero_guia: '',
      estado_carga_id: estadosCarga[0]?.id || ''
    });
    setShowModal(true);
  };

  // Generar código de orden automático
  const generateCodigoOrden = () => {
    const year = new Date().getFullYear();
    const lastCompra = compras[0];
    let nextNumber = 1;

    if (lastCompra && lastCompra.codigo_orden) {
      const match = lastCompra.codigo_orden.match(/CC-(\d{4})-(\d+)/);
      if (match && parseInt(match[1]) === year) {
        nextNumber = parseInt(match[2]) + 1;
      }
    }

    return `CC-${year}-${nextNumber.toString().padStart(3, '0')}`;
  };

  // Abrir modal para editar
  const openEditModal = async (item) => {
    try {
      // Cargar datos completos desde la tabla principal
      const { data, error } = await supabase
        .from('compras_cargas')
        .select('*')
        .eq('id', item.id)
        .single();

      if (error) throw error;

      setEditingItem(data);
      setFormData({
        fecha_orden: data.fecha_orden || '',
        codigo_orden: data.codigo_orden || '',
        proveedor_id: data.proveedor_id || '',
        proveedor_otro: data.proveedor_otro || '',
        categoria_id: data.categoria_id || '',
        descripcion: data.descripcion || '',
        metodo_pago_id: data.metodo_pago_id || '',
        banco_pagador: data.banco_pagador || '',
        costo_transferencia: data.costo_transferencia || '',
        datos_transferencia: data.datos_transferencia || '',
        origen: data.origen || '',
        direccion_pickup: data.direccion_pickup || '',
        peso: data.peso || '',
        volumen: data.volumen || '',
        transportista: data.transportista || '',
        despachante: data.despachante || '',
        cotizacion_carga: data.cotizacion_carga || '',
        costo_carga: data.costo_carga || '',
        gastos_extras: data.gastos_extras || '',
        costo_despacho: data.costo_despacho || '',
        numero_guia: data.numero_guia || '',
        estado_carga_id: data.estado_carga_id || ''
      });
      setShowModal(true);
    } catch (error) {
      console.error('Error loading item:', error);
      alert('Error al cargar los datos del item');
    }
  };

  // Guardar compra (crear o actualizar)
  const handleSave = async () => {
    try {
      // Validaciones básicas
      if (!formData.fecha_orden || !formData.codigo_orden) {
        alert('Por favor completa los campos obligatorios: Fecha y Código de Orden');
        return;
      }

      setSaving(true);

      const dataToSave = {
        fecha_orden: formData.fecha_orden,
        codigo_orden: formData.codigo_orden,
        proveedor_id: formData.proveedor_id || null,
        proveedor_otro: formData.proveedor_otro || null,
        categoria_id: formData.categoria_id || null,
        descripcion: formData.descripcion || null,
        metodo_pago_id: formData.metodo_pago_id || null,
        banco_pagador: formData.banco_pagador || null,
        costo_transferencia: formData.costo_transferencia ? parseFloat(formData.costo_transferencia) : null,
        datos_transferencia: formData.datos_transferencia || null,
        origen: formData.origen || null,
        direccion_pickup: formData.direccion_pickup || null,
        peso: formData.peso ? parseFloat(formData.peso) : null,
        volumen: formData.volumen ? parseFloat(formData.volumen) : null,
        transportista: formData.transportista || null,
        despachante: formData.despachante || null,
        cotizacion_carga: formData.cotizacion_carga ? parseFloat(formData.cotizacion_carga) : null,
        costo_carga: formData.costo_carga ? parseFloat(formData.costo_carga) : null,
        gastos_extras: formData.gastos_extras ? parseFloat(formData.gastos_extras) : null,
        costo_despacho: formData.costo_despacho ? parseFloat(formData.costo_despacho) : null,
        numero_guia: formData.numero_guia || null,
        estado_carga_id: formData.estado_carga_id || null
      };

      let error;
      if (editingItem) {
        // Actualizar
        const result = await supabase
          .from('compras_cargas')
          .update(dataToSave)
          .eq('id', editingItem.id);
        error = result.error;
      } else {
        // Crear nuevo
        const result = await supabase
          .from('compras_cargas')
          .insert([dataToSave]);
        error = result.error;
      }

      if (error) throw error;

      await fetchCompras();
      setShowModal(false);
      alert(editingItem ? 'Compra actualizada exitosamente' : 'Compra creada exitosamente');
    } catch (error) {
      console.error('Error saving:', error);
      alert('Error al guardar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Eliminar compra
  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta compra?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('compras_cargas')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchCompras();
      alert('Compra eliminada exitosamente');
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Error al eliminar: ' + error.message);
    }
  };

  // Exportar a PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Título
    doc.setFontSize(18);
    doc.text('Adminares - Compras y Cargas', 14, 20);
    
    // Fecha de reporte
    doc.setFontSize(10);
    doc.text(`Fecha de reporte: ${new Date().toLocaleDateString('es-ES')}`, 14, 28);
    doc.text(`Total de registros: ${filteredCompras.length}`, 14, 34);

    // Preparar datos para la tabla
    const tableData = filteredCompras.map(item => [
      item.codigo_orden || '-',
      new Date(item.fecha_orden).toLocaleDateString('es-ES'),
      item.proveedor_nombre || '-',
      item.origen || '-',
      item.transportista || '-',
      item.estado || '-',
      item.numero_guia || '-',
      `$${parseFloat(item.costo_total || 0).toFixed(2)}`
    ]);

    // Crear tabla
    doc.autoTable({
      startY: 40,
      head: [['Código', 'Fecha', 'Proveedor', 'Origen', 'Transportista', 'Estado', 'Tracking', 'Costo Total']],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    // Guardar PDF
    doc.save(`compras-cargas-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const formatCurrency = (value) => {
    if (!value) return '0.00';
    return parseFloat(value).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (loading) {
    return (
      <div className="cc-loading">
        <Package size={48} />
        <p>Cargando datos...</p>
      </div>
    );
  }

  return (
    <div className="cc-container">
      {/* Page Header */}
      <div className="cc-page-header">
        <h1 className="cc-page-title">Compras y Cargas</h1>
        <p className="cc-page-subtitle">Gestiona el historial de compras, cargas realizadas y seguimiento de envíos</p>
      </div>

      {/* Stats Cards */}
      <div className="cc-stats-grid">
        <div className="cc-stat-card">
          <div className="cc-stat-label">Total Compras</div>
          <div className="cc-stat-value">{stats.total}</div>
        </div>
        <div className="cc-stat-card">
          <div className="cc-stat-label">En Tránsito</div>
          <div className="cc-stat-value">{stats.enTransito}</div>
        </div>
        <div className="cc-stat-card">
          <div className="cc-stat-label">Pendientes</div>
          <div className="cc-stat-value">{stats.pendientes}</div>
        </div>
        <div className="cc-stat-card">
          <div className="cc-stat-label">Total Gastado (mes)</div>
          <div className="cc-stat-value">${formatCurrency(stats.totalMes)}</div>
        </div>
      </div>

      {/* Search and Actions Bar */}
      <div className="cc-actions-bar">
        <div className="cc-search-container">
          <Search className="cc-search-icon" size={16} />
          <input
            type="text"
            className="cc-search-input"
            placeholder="Buscar en todos los campos: código, proveedor, transportista, guía..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="cc-filter-group">
          <select
            className="cc-filter-select"
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
          >
            <option value="all">Todos los estados</option>
            {estadosCarga.map(estado => (
              <option key={estado.id} value={estado.nombre}>{estado.nombre}</option>
            ))}
          </select>
          <select
            className="cc-filter-select"
            value={filterProveedor}
            onChange={(e) => setFilterProveedor(e.target.value)}
          >
            <option value="all">Todos los proveedores</option>
            {[...new Set(compras.map(c => c.proveedor_nombre).filter(Boolean))].map(proveedor => (
              <option key={proveedor} value={proveedor}>{proveedor}</option>
            ))}
          </select>
        </div>
        <button className="cc-btn cc-btn-secondary" onClick={exportToPDF}>
          <Download size={16} />
          Exportar PDF
        </button>
        <button className="cc-btn cc-btn-primary" onClick={openNewModal}>
          <Plus size={16} />
          Nueva Compra
        </button>
      </div>

      {/* Table Container */}
      <div className="cc-table-container">
        <div className="cc-table-header">
          <div className="cc-table-title">Historial de Compras ({filteredCompras.length})</div>
          <div className="cc-view-toggle">
            <button
              className={`cc-view-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
            >
              Tabla
            </button>
            <button
              className={`cc-view-btn ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
            >
              Cards
            </button>
          </div>
        </div>

        {/* Table View */}
        {viewMode === 'table' && (
          <div className="cc-table-wrapper">
            <table className="cc-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Fecha</th>
                  <th>Proveedor</th>
                  <th>Origen</th>
                  <th>Transportista</th>
                  <th>Estado</th>
                  <th>Tracking</th>
                  <th>Costo Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredCompras.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                      No se encontraron registros
                    </td>
                  </tr>
                ) : (
                  filteredCompras.map(item => (
                    <tr key={item.id}>
                      <td><strong>{item.codigo_orden}</strong></td>
                      <td>{new Date(item.fecha_orden).toLocaleDateString('es-ES')}</td>
                      <td>{item.proveedor_nombre || '-'}</td>
                      <td>{item.origen || '-'}</td>
                      <td>{item.transportista || '-'}</td>
                      <td>
                        <span className={`cc-status cc-status-${item.estado?.toLowerCase().replace(/\s+/g, '-')}`}>
                          {item.estado || '-'}
                        </span>
                      </td>
                      <td>{item.numero_guia || '-'}</td>
                      <td><strong>${formatCurrency(item.costo_total)}</strong></td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="cc-action-btn" onClick={() => openEditModal(item)} title="Ver/Editar">
                            <Eye size={16} />
                          </button>
                          <button className="cc-action-btn" onClick={() => handleDelete(item.id)} title="Eliminar">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Cards View */}
        {viewMode === 'cards' && (
          <div className="cc-cards-grid">
            {filteredCompras.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                No se encontraron registros
              </div>
            ) : (
              filteredCompras.map(item => (
                <div key={item.id} className="cc-item-card">
                  <div className="cc-card-header">
                    <div>
                      <div className="cc-card-code">{item.codigo_orden}</div>
                      <div className="cc-card-date">{new Date(item.fecha_orden).toLocaleDateString('es-ES')}</div>
                    </div>
                    <span className={`cc-status cc-status-${item.estado?.toLowerCase().replace(/\s+/g, '-')}`}>
                      {item.estado || '-'}
                    </span>
                  </div>
                  <div className="cc-card-detail">
                    <div className="cc-card-label">Proveedor</div>
                    <div className="cc-card-value">{item.proveedor_nombre || '-'}</div>
                  </div>
                  <div className="cc-card-detail">
                    <div className="cc-card-label">Origen → Transportista</div>
                    <div className="cc-card-value">{item.origen || '-'} → {item.transportista || '-'}</div>
                  </div>
                  <div className="cc-card-detail">
                    <div className="cc-card-label">Tracking</div>
                    <div className="cc-card-value">{item.numero_guia || '-'}</div>
                  </div>
                  <div className="cc-card-footer">
                    <div className="cc-card-cost">${formatCurrency(item.costo_total)}</div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="cc-action-btn" onClick={() => openEditModal(item)}>
                        <Eye size={20} />
                      </button>
                      <button className="cc-action-btn" onClick={() => handleDelete(item.id)}>
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="cc-modal" onClick={() => setShowModal(false)}>
          <div className="cc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="cc-modal-header">
              <h2 className="cc-modal-title">
                {editingItem ? 'Editar Compra y Carga' : 'Nueva Compra y Carga'}
              </h2>
              <button className="cc-close-btn" onClick={() => setShowModal(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="cc-modal-body">
              {/* Información de Compra */}
              <div className="cc-form-section">
                <h3 className="cc-section-title">Información de Compra</h3>
                <div className="cc-form-grid">
                  <div className="cc-form-group">
                    <label className="cc-form-label">Fecha de Orden *</label>
                    <input
                      type="date"
                      className="cc-form-input"
                      value={formData.fecha_orden}
                      onChange={(e) => handleInputChange('fecha_orden', e.target.value)}
                    />
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Código de Orden *</label>
                    <input
                      type="text"
                      className="cc-form-input"
                      value={formData.codigo_orden}
                      onChange={(e) => handleInputChange('codigo_orden', e.target.value)}
                      placeholder="CC-2025-001"
                    />
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Proveedor</label>
                    <select
                      className="cc-form-input"
                      value={formData.proveedor_id}
                      onChange={(e) => handleInputChange('proveedor_id', e.target.value)}
                    >
                      <option value="">Seleccionar proveedor...</option>
                      {proveedores.map(p => (
                        <option key={p.id} value={p.id}>{p.nombre_comercial}</option>
                      ))}
                      <option value="otro">Otro...</option>
                    </select>
                  </div>
                  {formData.proveedor_id === 'otro' && (
                    <div className="cc-form-group">
                      <label className="cc-form-label">Nombre del Proveedor</label>
                      <input
                        type="text"
                        className="cc-form-input"
                        value={formData.proveedor_otro}
                        onChange={(e) => handleInputChange('proveedor_otro', e.target.value)}
                        placeholder="Nombre del proveedor"
                      />
                    </div>
                  )}
                  <div className="cc-form-group">
                    <label className="cc-form-label">Categoría</label>
                    <select
                      className="cc-form-input"
                      value={formData.categoria_id}
                      onChange={(e) => handleInputChange('categoria_id', e.target.value)}
                    >
                      <option value="">Seleccionar categoría...</option>
                      {categorias.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Método de Pago</label>
                    <select
                      className="cc-form-input"
                      value={formData.metodo_pago_id}
                      onChange={(e) => handleInputChange('metodo_pago_id', e.target.value)}
                    >
                      <option value="">Seleccionar método...</option>
                      {metodosPago.map(m => (
                        <option key={m.id} value={m.id}>{m.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Banco Pagador</label>
                    <input
                      type="text"
                      className="cc-form-input"
                      value={formData.banco_pagador}
                      onChange={(e) => handleInputChange('banco_pagador', e.target.value)}
                      placeholder="Nombre del banco"
                    />
                  </div>
                </div>
                <div className="cc-form-grid" style={{ marginTop: '1rem' }}>
                  <div className="cc-form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="cc-form-label">Descripción</label>
                    <textarea
                      className="cc-form-input"
                      rows="3"
                      value={formData.descripcion}
                      onChange={(e) => handleInputChange('descripcion', e.target.value)}
                      placeholder="Descripción de los productos comprados..."
                    />
                  </div>
                  <div className="cc-form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="cc-form-label">Datos de Transferencia Bancaria</label>
                    <textarea
                      className="cc-form-input"
                      rows="2"
                      value={formData.datos_transferencia}
                      onChange={(e) => handleInputChange('datos_transferencia', e.target.value)}
                      placeholder="Datos de la transferencia bancaria..."
                    />
                  </div>
                </div>
              </div>

              {/* Información de Carga */}
              <div className="cc-form-section">
                <h3 className="cc-section-title">Información de Carga</h3>
                <div className="cc-form-grid">
                  <div className="cc-form-group">
                    <label className="cc-form-label">Origen</label>
                    <input
                      type="text"
                      className="cc-form-input"
                      value={formData.origen}
                      onChange={(e) => handleInputChange('origen', e.target.value)}
                      placeholder="País de origen"
                    />
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Transportista</label>
                    <input
                      type="text"
                      className="cc-form-input"
                      value={formData.transportista}
                      onChange={(e) => handleInputChange('transportista', e.target.value)}
                      placeholder="DHL, FedEx, etc."
                    />
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Despachante</label>
                    <input
                      type="text"
                      className="cc-form-input"
                      value={formData.despachante}
                      onChange={(e) => handleInputChange('despachante', e.target.value)}
                      placeholder="Nombre del despachante"
                    />
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Peso (kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="cc-form-input"
                      value={formData.peso}
                      onChange={(e) => handleInputChange('peso', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Volumen (m³)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="cc-form-input"
                      value={formData.volumen}
                      onChange={(e) => handleInputChange('volumen', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Número de Guía</label>
                    <input
                      type="text"
                      className="cc-form-input"
                      value={formData.numero_guia}
                      onChange={(e) => handleInputChange('numero_guia', e.target.value)}
                      placeholder="Tracking number"
                    />
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Estado</label>
                    <select
                      className="cc-form-input"
                      value={formData.estado_carga_id}
                      onChange={(e) => handleInputChange('estado_carga_id', e.target.value)}
                    >
                      <option value="">Seleccionar estado...</option>
                      {estadosCarga.map(e => (
                        <option key={e.id} value={e.id}>{e.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="cc-form-grid" style={{ marginTop: '1rem' }}>
                  <div className="cc-form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="cc-form-label">Dirección de Pick-up</label>
                    <textarea
                      className="cc-form-input"
                      rows="2"
                      value={formData.direccion_pickup}
                      onChange={(e) => handleInputChange('direccion_pickup', e.target.value)}
                      placeholder="Dirección completa de recogida..."
                    />
                  </div>
                </div>
              </div>

              {/* Costos */}
              <div className="cc-form-section">
                <h3 className="cc-section-title">Costos</h3>
                <div className="cc-form-grid">
                  <div className="cc-form-group">
                    <label className="cc-form-label">Cotización Carga</label>
                    <input
                      type="number"
                      step="0.01"
                      className="cc-form-input"
                      value={formData.cotizacion_carga}
                      onChange={(e) => handleInputChange('cotizacion_carga', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Costo Real Carga</label>
                    <input
                      type="number"
                      step="0.01"
                      className="cc-form-input"
                      value={formData.costo_carga}
                      onChange={(e) => handleInputChange('costo_carga', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Gastos Extras</label>
                    <input
                      type="number"
                      step="0.01"
                      className="cc-form-input"
                      value={formData.gastos_extras}
                      onChange={(e) => handleInputChange('gastos_extras', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Costo Despacho</label>
                    <input
                      type="number"
                      step="0.01"
                      className="cc-form-input"
                      value={formData.costo_despacho}
                      onChange={(e) => handleInputChange('costo_despacho', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Costo Transferencia</label>
                    <input
                      type="number"
                      step="0.01"
                      className="cc-form-input"
                      value={formData.costo_transferencia}
                      onChange={(e) => handleInputChange('costo_transferencia', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="cc-modal-footer">
              <button className="cc-btn cc-btn-secondary" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button className="cc-btn cc-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : (editingItem ? 'Actualizar' : 'Guardar Compra')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
