import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { Search, Download, Plus, Eye, Trash2, X, Package, ChevronUp, ChevronDown, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import './ComprasCargas.css';

// Función helper para formatear fecha a DD/MM/YY
const formatFecha = (fechaStr) => {
  if (!fechaStr) return '-';
  const fecha = new Date(fechaStr);
  const dia = fecha.getDate().toString().padStart(2, '0');
  const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
  const año = fecha.getFullYear().toString().slice(-2);
  return `${dia}/${mes}/${año}`;
};

export default function ComprasCargas() {
  // Estados principales
  const [compras, setCompras] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [estadosCarga, setEstadosCarga] = useState([]);
  const [metodosPago, setMetodosPago] = useState([]);
  const [categorias, setCategorias] = useState([]);
  
  // Estado para ordenamiento de columnas
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  
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
    banco_pagador_otro: '',
    costo_transferencia: '',
    datos_transferencia: '',
    responsable: 'Ares',
    direccion_pickup: '',
    peso: '',
    volumen: '',
    transportista: '',
    transportista_otro: '',
    despachante: '',
    monto_compra: '',
    cotizacion_carga: '',
    costo_carga: '',
    gastos_extras: '',
    gastos_extras_detalle: '',
    costo_despacho: '',
    numero_guia: '',
    estado_carga_id: '',
    notas_carga: '',
    fecha_ingreso: '',
    fecha_llegada: ''
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

    // Ordenamiento por columna
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];
        
        // Manejo especial para fechas
        if (sortConfig.key === 'fecha_orden') {
          aVal = new Date(aVal || 0);
          bVal = new Date(bVal || 0);
        }
        // Manejo especial para números
        else if (sortConfig.key === 'costo_total') {
          aVal = parseFloat(aVal) || 0;
          bVal = parseFloat(bVal) || 0;
        }
        // Manejo para strings
        else {
          aVal = (aVal || '').toString().toLowerCase();
          bVal = (bVal || '').toString().toLowerCase();
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [compras, searchTerm, filterEstado, filterProveedor, sortConfig]);

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
      banco_pagador_otro: '',
      costo_transferencia: '',
      datos_transferencia: '',
      responsable: 'Ares',
      direccion_pickup: '',
      peso: '',
      volumen: '',
      transportista: '',
      transportista_otro: '',
      despachante: 'PROCARGO',
      monto_compra: '',
      cotizacion_carga: '',
      costo_carga: '',
      gastos_extras: '',
      gastos_extras_detalle: '',
      costo_despacho: '',
      numero_guia: '',
      estado_carga_id: estadosCarga[0]?.id || '',
      notas_carga: '',
      fecha_ingreso: '',
      fecha_llegada: ''
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

      // Determinar si los valores son de la lista o "Otros"
      const transportistasLista = ['DHL', 'PGBX', 'FEDEX', 'UNBOX', 'HV'];
      const bancosLista = ['Itaú', 'Atlas', 'Citi', 'MXCB'];
      
      const transportistaValue = data.transportista || '';
      const esTransportistaOtro = transportistaValue && !transportistasLista.includes(transportistaValue);
      
      const bancoValue = data.banco_pagador || '';
      const esBancoOtro = bancoValue && !bancosLista.includes(bancoValue);

      setEditingItem(data);
      setFormData({
        fecha_orden: data.fecha_orden || '',
        codigo_orden: data.codigo_orden || '',
        proveedor_id: data.proveedor_id || '',
        proveedor_otro: data.proveedor_otro || '',
        categoria_id: data.categoria_id || '',
        descripcion: data.descripcion || '',
        metodo_pago_id: data.metodo_pago_id || '',
        banco_pagador: esBancoOtro ? 'Otros' : bancoValue,
        banco_pagador_otro: esBancoOtro ? bancoValue : '',
        costo_transferencia: data.costo_transferencia || '',
        datos_transferencia: data.datos_transferencia || '',
        responsable: data.responsable || 'Ares',
        direccion_pickup: data.direccion_pickup || '',
        peso: data.peso || '',
        volumen: data.volumen || '',
        transportista: esTransportistaOtro ? 'Otros' : transportistaValue,
        transportista_otro: esTransportistaOtro ? transportistaValue : '',
        despachante: data.despachante || '',
        monto_compra: data.monto_compra || '',
        cotizacion_carga: data.cotizacion_carga || '',
        costo_carga: data.costo_carga || '',
        gastos_extras: data.gastos_extras || '',
        gastos_extras_detalle: data.gastos_extras_detalle || '',
        costo_despacho: data.costo_despacho || '',
        numero_guia: data.numero_guia || '',
        estado_carga_id: data.estado_carga_id || '',
        notas_carga: data.notas_carga || '',
        fecha_ingreso: data.fecha_ingreso || '',
        fecha_llegada: data.fecha_llegada || ''
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

      // Determinar valores finales (si es "Otros", usar el campo _otro)
      const transportistaFinal = formData.transportista === 'Otros' ? formData.transportista_otro : formData.transportista;
      const bancoPagadorFinal = formData.banco_pagador === 'Otros' ? formData.banco_pagador_otro : formData.banco_pagador;

      const dataToSave = {
        fecha_orden: formData.fecha_orden,
        codigo_orden: formData.codigo_orden,
        proveedor_id: formData.proveedor_id || null,
        proveedor_otro: formData.proveedor_otro || null,
        categoria_id: formData.categoria_id || null,
        descripcion: formData.descripcion || null,
        metodo_pago_id: formData.metodo_pago_id || null,
        banco_pagador: bancoPagadorFinal || null,
        costo_transferencia: formData.costo_transferencia ? parseFloat(formData.costo_transferencia) : null,
        datos_transferencia: formData.datos_transferencia || null,
        responsable: formData.responsable || 'Ares',
        direccion_pickup: formData.direccion_pickup || null,
        peso: formData.peso ? parseFloat(formData.peso) : null,
        volumen: formData.volumen ? parseFloat(formData.volumen) : null,
        transportista: transportistaFinal || null,
        despachante: formData.despachante || null,
        monto_compra: formData.monto_compra ? parseFloat(formData.monto_compra) : null,
        cotizacion_carga: formData.cotizacion_carga ? parseFloat(formData.cotizacion_carga) : null,
        costo_carga: formData.costo_carga ? parseFloat(formData.costo_carga) : null,
        gastos_extras: formData.gastos_extras ? parseFloat(formData.gastos_extras) : null,
        gastos_extras_detalle: formData.gastos_extras_detalle || null,
        costo_despacho: formData.costo_despacho ? parseFloat(formData.costo_despacho) : null,
        numero_guia: formData.numero_guia || null,
        estado_carga_id: formData.estado_carga_id || null,
        notas_carga: formData.notas_carga || null,
        fecha_ingreso: formData.fecha_ingreso || null,
        fecha_llegada: formData.fecha_llegada || null
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

  // Función para ordenar columnas
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Componente de icono de ordenamiento
  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return <ChevronUp size={14} style={{ opacity: 0.3 }} />;
    }
    return sortConfig.direction === 'asc' 
      ? <ChevronUp size={14} style={{ color: '#567C8D' }} />
      : <ChevronDown size={14} style={{ color: '#567C8D' }} />;
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
      new Date(item.fecha_orden).toLocaleDateString('es-PY'),
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

  // Exportar a Excel
  const exportToExcel = () => {
    const excelData = filteredCompras.map(item => ({
      'Código': item.codigo_orden || '',
      'Fecha': formatFecha(item.fecha_orden),
      'Proveedor': item.proveedor_nombre || '',
      'Categoría': item.categoria_nombre || '',
      'Descripción': item.descripcion || '',
      'Método Pago': item.metodo_pago_nombre || '',
      'Banco Pagador': item.banco_pagador || '',
      'Responsable': item.responsable || 'Ares',
      'Transportista': item.transportista || '',
      'Despachante': item.despachante || '',
      'Peso (kg)': item.peso || '',
      'Volumen (m³)': item.volumen || '',
      'Número de Guía': item.numero_guia || '',
      'Estado': item.estado || '',
      'Notas de Carga': item.notas_carga || '',
      'Monto Compra': item.monto_compra || 0,
      'Cotización Carga': item.cotizacion_carga || 0,
      'Costo Real Carga': item.costo_carga || 0,
      'Gastos Extras': item.gastos_extras || 0,
      'Detalle Gastos Extras': item.gastos_extras_detalle || '',
      'Costo Despacho': item.costo_despacho || 0,
      'Costo Transferencia': item.costo_transferencia || 0,
      'Fecha Ingreso': item.fecha_ingreso ? formatFecha(item.fecha_ingreso) : '',
      'COSTO TOTAL': item.costo_total || 0
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Compras y Cargas');
    
    // Ajustar ancho de columnas
    const colWidths = [
      { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 30 },
      { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 20 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 15 }, { wch: 12 }
    ];
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, `compras-cargas-${new Date().toISOString().split('T')[0]}.xlsx`);
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
          <div className="cc-stat-label">Compras Programadas (mes)</div>
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
          PDF
        </button>
        <button className="cc-btn cc-btn-secondary" onClick={exportToExcel}>
          <FileSpreadsheet size={16} />
          Excel
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
                  <th onClick={() => handleSort('codigo_orden')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Código <SortIcon columnKey="codigo_orden" />
                    </div>
                  </th>
                  <th onClick={() => handleSort('fecha_orden')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Fecha <SortIcon columnKey="fecha_orden" />
                    </div>
                  </th>
                  <th onClick={() => handleSort('proveedor_nombre')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Proveedor <SortIcon columnKey="proveedor_nombre" />
                    </div>
                  </th>
                  <th onClick={() => handleSort('responsable')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Responsable <SortIcon columnKey="responsable" />
                    </div>
                  </th>
                  <th onClick={() => handleSort('transportista')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Transportista <SortIcon columnKey="transportista" />
                    </div>
                  </th>
                  <th onClick={() => handleSort('estado')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Estado <SortIcon columnKey="estado" />
                    </div>
                  </th>
                  <th onClick={() => handleSort('fecha_ingreso')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Fecha Ingreso <SortIcon columnKey="fecha_ingreso" />
                    </div>
                  </th>
                  <th onClick={() => handleSort('costo_total')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Costo Total <SortIcon columnKey="costo_total" />
                    </div>
                  </th>
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
                      <td>{formatFecha(item.fecha_orden)}</td>
                      <td>{item.proveedor_nombre || '-'}</td>
                      <td>
                        {(item.estado === 'Finalizada' || item.estado === 'Cancelada') ? (
                          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>—</span>
                        ) : (
                          <span style={{
                            padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600',
                            background: item.responsable === 'Proveedor' ? '#fef3c7' : '#dbeafe',
                            color: item.responsable === 'Proveedor' ? '#92400e' : '#1e40af'
                          }}>
                            {item.responsable || 'Ares'}
                          </span>
                        )}
                      </td>
                      <td>{item.transportista || '-'}</td>
                      <td>
                        <span className={`cc-status cc-status-${item.estado?.toLowerCase().replace(/\s+/g, '-')}`}>
                          {item.estado || '-'}
                        </span>
                      </td>
                      <td>{formatFecha(item.fecha_ingreso)}</td>
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
                      <div className="cc-card-date">{formatFecha(item.fecha_orden)}</div>
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
                    <div className="cc-card-label">Responsable</div>
                    <div className="cc-card-value">
                      {(item.estado === 'Finalizada' || item.estado === 'Cancelada') ? (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      ) : (
                        <>
                          <span style={{
                            padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600',
                            background: item.responsable === 'Proveedor' ? '#fef3c7' : '#dbeafe',
                            color: item.responsable === 'Proveedor' ? '#92400e' : '#1e40af'
                          }}>
                            {item.responsable || 'Ares'}
                          </span>
                          {item.transportista && <span style={{ marginLeft: '0.5rem' }}>→ {item.transportista}</span>}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="cc-card-detail">
                    <div className="cc-card-label">Fecha Ingreso</div>
                    <div className="cc-card-value">{formatFecha(item.fecha_ingreso)}</div>
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
                    <select
                      className="cc-form-input"
                      value={formData.banco_pagador}
                      onChange={(e) => handleInputChange('banco_pagador', e.target.value)}
                    >
                      <option value="">Seleccionar banco...</option>
                      <option value="Itaú">Itaú</option>
                      <option value="Atlas">Atlas</option>
                      <option value="Citi">Citi</option>
                      <option value="MXCB">MXCB</option>
                      <option value="Otros">Otros</option>
                    </select>
                  </div>
                  {formData.banco_pagador === 'Otros' && (
                    <div className="cc-form-group">
                      <label className="cc-form-label">Especificar Banco</label>
                      <input
                        type="text"
                        className="cc-form-input"
                        value={formData.banco_pagador_otro}
                        onChange={(e) => handleInputChange('banco_pagador_otro', e.target.value)}
                        placeholder="Nombre del banco"
                      />
                    </div>
                  )}
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
                    <label className="cc-form-label">Información de la Transferencia Bancaria</label>
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
                    <label className="cc-form-label">Responsable</label>
                    <select
                      className="cc-form-input"
                      value={formData.responsable}
                      onChange={(e) => handleInputChange('responsable', e.target.value)}
                      style={{
                        background: formData.responsable === 'Proveedor' ? '#fef3c7' : '#dbeafe',
                        fontWeight: '600'
                      }}
                    >
                      <option value="Ares">Ares</option>
                      <option value="Proveedor">Proveedor</option>
                    </select>
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Transportista</label>
                    <select
                      className="cc-form-input"
                      value={formData.transportista}
                      onChange={(e) => handleInputChange('transportista', e.target.value)}
                    >
                      <option value="">Seleccionar transportista...</option>
                      <option value="DHL">DHL</option>
                      <option value="PGBX">PGBX</option>
                      <option value="FEDEX">FEDEX</option>
                      <option value="UNBOX">UNBOX</option>
                      <option value="HV">HV</option>
                      <option value="Otros">Otros</option>
                    </select>
                  </div>
                  {formData.transportista === 'Otros' && (
                    <div className="cc-form-group">
                      <label className="cc-form-label">Especificar Transportista</label>
                      <input
                        type="text"
                        className="cc-form-input"
                        value={formData.transportista_otro}
                        onChange={(e) => handleInputChange('transportista_otro', e.target.value)}
                        placeholder="Nombre del transportista"
                      />
                    </div>
                  )}
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
                  <div className="cc-form-group">
                    <label className="cc-form-label">Fecha de Ingreso</label>
                    <input
                      type="date"
                      className="cc-form-input"
                      value={formData.fecha_ingreso}
                      onChange={(e) => handleInputChange('fecha_ingreso', e.target.value)}
                    />
                  </div>
                  <div className="cc-form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="cc-form-label">Notas de Carga</label>
                    <textarea
                      className="cc-form-input"
                      value={formData.notas_carga}
                      onChange={(e) => handleInputChange('notas_carga', e.target.value)}
                      placeholder="Notas adicionales sobre la carga..."
                      rows="3"
                      style={{ resize: 'vertical' }}
                    />
                  </div>
                </div>
              </div>

              {/* Costos */}
              <div className="cc-form-section">
                <h3 className="cc-section-title">Costos</h3>
                <div className="cc-form-grid">
                  <div className="cc-form-group">
                    <label className="cc-form-label">Monto de la Compra</label>
                    <input
                      type="number"
                      step="0.01"
                      className="cc-form-input"
                      value={formData.monto_compra}
                      onChange={(e) => handleInputChange('monto_compra', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Cotización Carga</label>
                    <input
                      type="number"
                      step="0.01"
                      className="cc-form-input"
                      value={formData.cotizacion_carga}
                      onChange={(e) => handleInputChange('cotizacion_carga', e.target.value)}
                      placeholder="0.00"
                      style={{ background: '#f8fafc' }}
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
                    <input
                      type="text"
                      className="cc-form-input"
                      value={formData.gastos_extras_detalle}
                      onChange={(e) => handleInputChange('gastos_extras_detalle', e.target.value)}
                      placeholder="Detalle de gastos extras..."
                      style={{ marginTop: '0.35rem', fontSize: '0.8rem' }}
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
                
                {/* Total */}
                <div style={{ 
                  marginTop: '1.5rem', 
                  padding: '1rem 1.5rem', 
                  background: 'linear-gradient(135deg, #567C8D 0%, #2F4156 100%)', 
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ color: 'white', fontWeight: '600', fontSize: '1rem' }}>
                    TOTAL (sin cotización de carga)
                  </span>
                  <span style={{ color: 'white', fontWeight: '700', fontSize: '1.5rem' }}>
                    $ {(
                      (parseFloat(formData.monto_compra) || 0) +
                      (parseFloat(formData.costo_carga) || 0) +
                      (parseFloat(formData.gastos_extras) || 0) +
                      (parseFloat(formData.costo_despacho) || 0) +
                      (parseFloat(formData.costo_transferencia) || 0)
                    ).toLocaleString('es-PY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
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
