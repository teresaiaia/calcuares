import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { 
  Search, Plus, Edit2, Trash2, X, Save, TrendingUp, TrendingDown,
  DollarSign, ChevronUp, ChevronDown, FileSpreadsheet, FileText,
  Link2, Unlink
} from 'lucide-react';
import * as XLSX from 'xlsx';
import './ComprasCargas.css';

export default function OperacionesComerciales() {
  const [operaciones, setOperaciones] = useState([]);
  const [comprasDisponibles, setComprasDisponibles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const emptyForm = {
    // Datos de la operación
    fecha_operacion: '',
    codigo_operacion: '',
    // Datos del cliente
    cliente_nombre: '',
    numero_factura: '',
    fecha_entrega: '',
    // Descripción
    descripcion_equipo: '',
    // Vinculación a compra
    compra_carga_id: '',
    // Ingresos
    precio_neto_venta: '',
    // Costos del equipo
    costo_compra_equipo: '',
    costo_despacho_aduana: '',
    costo_logistica_flete: '',
    costo_traslado_interno: '',
    // Gastos operativos
    costo_servicio_tecnico: '',
    costo_training: '',
    costo_bonificacion: '',
    costo_comision_vendedor: '',
    costo_comision_otros: '',
    // Otros
    costo_gastos_financieros: '',
    costo_seguros: '',
    costo_otros: '',
    // Notas
    notas: ''
  };

  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    fetchOperaciones();
    fetchComprasDisponibles();
  }, []);

  const fetchOperaciones = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('operaciones_comerciales')
        .select('*')
        .order('fecha_operacion', { ascending: false });

      if (error) throw error;
      setOperaciones(data || []);
    } catch (error) {
      console.error('Error cargando operaciones:', error);
      alert('Error al cargar operaciones');
    } finally {
      setLoading(false);
    }
  };

  const fetchComprasDisponibles = async () => {
    try {
      const { data, error } = await supabase
        .from('vista_compras_cargas')
        .select('id, codigo_orden, descripcion, proveedor_nombre, monto_compra, costo_carga, costo_despacho, costo_total, gastos_extras, costo_transferencia')
        .order('fecha_orden', { ascending: false });

      if (error) throw error;
      setComprasDisponibles(data || []);
    } catch (error) {
      console.error('Error cargando compras:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Calcular IVA (10%)
  const calcIVA = (precioNeto) => {
    const neto = parseFloat(precioNeto) || 0;
    return neto * 0.10;
  };

  // Calcular ingreso total (neto + IVA)
  const calcIngresoTotal = () => {
    const neto = parseFloat(formData.precio_neto_venta) || 0;
    return neto + calcIVA(formData.precio_neto_venta);
  };

  // Calcular total costos
  const calcTotalCostos = () => {
    return (
      (parseFloat(formData.costo_compra_equipo) || 0) +
      (parseFloat(formData.costo_despacho_aduana) || 0) +
      (parseFloat(formData.costo_logistica_flete) || 0) +
      (parseFloat(formData.costo_traslado_interno) || 0) +
      (parseFloat(formData.costo_servicio_tecnico) || 0) +
      (parseFloat(formData.costo_training) || 0) +
      (parseFloat(formData.costo_bonificacion) || 0) +
      (parseFloat(formData.costo_comision_vendedor) || 0) +
      (parseFloat(formData.costo_comision_otros) || 0) +
      (parseFloat(formData.costo_gastos_financieros) || 0) +
      (parseFloat(formData.costo_seguros) || 0) +
      (parseFloat(formData.costo_otros) || 0)
    );
  };

  // Calcular margen
  const calcMargen = () => {
    const neto = parseFloat(formData.precio_neto_venta) || 0;
    const costos = calcTotalCostos();
    return neto - costos;
  };

  const calcMargenPct = () => {
    const neto = parseFloat(formData.precio_neto_venta) || 0;
    if (neto === 0) return 0;
    return ((neto - calcTotalCostos()) / neto) * 100;
  };

  // Calcular margen para items de la lista
  const getMargen = (op) => {
    const neto = parseFloat(op.precio_neto_venta) || 0;
    const costos = (
      (parseFloat(op.costo_compra_equipo) || 0) +
      (parseFloat(op.costo_despacho_aduana) || 0) +
      (parseFloat(op.costo_logistica_flete) || 0) +
      (parseFloat(op.costo_traslado_interno) || 0) +
      (parseFloat(op.costo_servicio_tecnico) || 0) +
      (parseFloat(op.costo_training) || 0) +
      (parseFloat(op.costo_bonificacion) || 0) +
      (parseFloat(op.costo_comision_vendedor) || 0) +
      (parseFloat(op.costo_comision_otros) || 0) +
      (parseFloat(op.costo_gastos_financieros) || 0) +
      (parseFloat(op.costo_seguros) || 0) +
      (parseFloat(op.costo_otros) || 0)
    );
    return { margen: neto - costos, pct: neto > 0 ? ((neto - costos) / neto * 100) : 0 };
  };

  // Vincular compra existente
  const vincularCompra = (compraId) => {
    handleInputChange('compra_carga_id', compraId);
    if (compraId) {
      const compra = comprasDisponibles.find(c => c.id === compraId);
      if (compra) {
        setFormData(prev => ({
          ...prev,
          compra_carga_id: compraId,
          costo_compra_equipo: compra.monto_compra || prev.costo_compra_equipo,
          costo_despacho_aduana: compra.costo_despacho || prev.costo_despacho_aduana,
          costo_logistica_flete: compra.costo_carga || prev.costo_logistica_flete
        }));
      }
    }
  };

  const generateCodigo = () => {
    const year = new Date().getFullYear();
    const lastOp = operaciones[0];
    let nextNumber = 1;
    if (lastOp && lastOp.codigo_operacion) {
      const match = lastOp.codigo_operacion.match(/OP-(\d{4})-(\d+)/);
      if (match && parseInt(match[1]) === year) {
        nextNumber = parseInt(match[2]) + 1;
      }
    }
    return `OP-${year}-${nextNumber.toString().padStart(4, '0')}`;
  };

  const openNewModal = () => {
    setEditingItem(null);
    setFormData({
      ...emptyForm,
      fecha_operacion: new Date().toISOString().split('T')[0],
      codigo_operacion: generateCodigo()
    });
    setShowModal(true);
  };

  const openEditModal = async (op) => {
    setEditingItem(op);
    setFormData({
      fecha_operacion: op.fecha_operacion || '',
      codigo_operacion: op.codigo_operacion || '',
      cliente_nombre: op.cliente_nombre || '',
      numero_factura: op.numero_factura || '',
      fecha_entrega: op.fecha_entrega || '',
      descripcion_equipo: op.descripcion_equipo || '',
      compra_carga_id: op.compra_carga_id || '',
      precio_neto_venta: op.precio_neto_venta || '',
      costo_compra_equipo: op.costo_compra_equipo || '',
      costo_despacho_aduana: op.costo_despacho_aduana || '',
      costo_logistica_flete: op.costo_logistica_flete || '',
      costo_traslado_interno: op.costo_traslado_interno || '',
      costo_servicio_tecnico: op.costo_servicio_tecnico || '',
      costo_training: op.costo_training || '',
      costo_bonificacion: op.costo_bonificacion || '',
      costo_comision_vendedor: op.costo_comision_vendedor || '',
      costo_comision_otros: op.costo_comision_otros || '',
      costo_gastos_financieros: op.costo_gastos_financieros || '',
      costo_seguros: op.costo_seguros || '',
      costo_otros: op.costo_otros || '',
      notas: op.notas || ''
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.fecha_operacion || !formData.codigo_operacion) {
      alert('Fecha y código de operación son obligatorios');
      return;
    }

    try {
      setSaving(true);

      const neto = parseFloat(formData.precio_neto_venta) || 0;
      const iva = neto * 0.10;
      const totalCostos = calcTotalCostos();
      const margen = neto - totalCostos;
      const margenPct = neto > 0 ? ((margen / neto) * 100) : 0;

      const dataToSave = {
        fecha_operacion: formData.fecha_operacion,
        codigo_operacion: formData.codigo_operacion,
        cliente_nombre: formData.cliente_nombre || null,
        numero_factura: formData.numero_factura || null,
        fecha_entrega: formData.fecha_entrega || null,
        descripcion_equipo: formData.descripcion_equipo || null,
        compra_carga_id: formData.compra_carga_id || null,
        precio_neto_venta: neto || null,
        iva_venta: iva || null,
        precio_total_venta: neto + iva || null,
        costo_compra_equipo: parseFloat(formData.costo_compra_equipo) || null,
        costo_despacho_aduana: parseFloat(formData.costo_despacho_aduana) || null,
        costo_logistica_flete: parseFloat(formData.costo_logistica_flete) || null,
        costo_traslado_interno: parseFloat(formData.costo_traslado_interno) || null,
        costo_servicio_tecnico: parseFloat(formData.costo_servicio_tecnico) || null,
        costo_training: parseFloat(formData.costo_training) || null,
        costo_bonificacion: parseFloat(formData.costo_bonificacion) || null,
        costo_comision_vendedor: parseFloat(formData.costo_comision_vendedor) || null,
        costo_comision_otros: parseFloat(formData.costo_comision_otros) || null,
        costo_gastos_financieros: parseFloat(formData.costo_gastos_financieros) || null,
        costo_seguros: parseFloat(formData.costo_seguros) || null,
        costo_otros: parseFloat(formData.costo_otros) || null,
        total_costos: totalCostos || null,
        margen: margen || null,
        margen_porcentaje: margenPct || null,
        notas: formData.notas || null
      };

      let error;
      if (editingItem) {
        const result = await supabase
          .from('operaciones_comerciales')
          .update(dataToSave)
          .eq('id', editingItem.id);
        error = result.error;
      } else {
        const result = await supabase
          .from('operaciones_comerciales')
          .insert([dataToSave]);
        error = result.error;
      }

      if (error) throw error;

      await fetchOperaciones();
      setShowModal(false);
    } catch (error) {
      console.error('Error guardando:', error);
      alert('Error al guardar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteOperacion = async (id, codigo) => {
    if (!window.confirm(`¿Eliminar operación "${codigo}"?`)) return;
    try {
      const { error } = await supabase.from('operaciones_comerciales').delete().eq('id', id);
      if (error) throw error;
      await fetchOperaciones();
    } catch (error) {
      alert('Error al eliminar: ' + error.message);
    }
  };

  // Formato de fecha
  const formatFecha = (fechaStr) => {
    if (!fechaStr) return '-';
    const fecha = new Date(fechaStr);
    const dia = fecha.getDate().toString().padStart(2, '0');
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const año = fecha.getFullYear().toString().slice(-2);
    return `${dia}/${mes}/${año}`;
  };

  const formatMoney = (val) => {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('es-PY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Sorting
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return <ChevronUp size={14} style={{ opacity: 0.3 }} />;
    }
    return sortConfig.direction === 'asc' 
      ? <ChevronUp size={14} style={{ color: '#567C8D' }} /> 
      : <ChevronDown size={14} style={{ color: '#567C8D' }} />;
  };

  // Filtro y sort
  const filteredOperaciones = useMemo(() => {
    let result = operaciones;

    if (searchTerm) {
      const terms = searchTerm.toLowerCase().split(' ').filter(t => t.length > 0);
      const includeTerms = terms.filter(t => !t.startsWith('-'));
      const excludeTerms = terms.filter(t => t.startsWith('-')).map(t => t.substring(1)).filter(t => t.length > 0);

      result = result.filter(op => {
        const text = [
          op.codigo_operacion, op.cliente_nombre, op.descripcion_equipo,
          op.numero_factura, op.notas
        ].filter(Boolean).join(' ').toLowerCase();

        const includesAll = includeTerms.length === 0 || includeTerms.every(t => text.includes(t));
        const excludesAll = excludeTerms.length === 0 || excludeTerms.every(t => !text.includes(t));
        return includesAll && excludesAll;
      });
    }

    if (sortConfig.key) {
      result = [...result].sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        if (sortConfig.key.includes('fecha')) {
          aVal = aVal ? new Date(aVal).getTime() : 0;
          bVal = bVal ? new Date(bVal).getTime() : 0;
        } else if (sortConfig.key.includes('costo') || sortConfig.key.includes('precio') || sortConfig.key === 'margen' || sortConfig.key === 'margen_porcentaje') {
          aVal = parseFloat(aVal) || 0;
          bVal = parseFloat(bVal) || 0;
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
  }, [operaciones, searchTerm, sortConfig]);

  // Estadísticas
  const stats = useMemo(() => {
    const total = operaciones.length;
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const opsMes = operaciones.filter(op => {
      const fecha = new Date(op.fecha_operacion);
      return fecha.getMonth() === currentMonth && fecha.getFullYear() === currentYear;
    });

    const ventasMes = opsMes.reduce((sum, op) => sum + (parseFloat(op.precio_neto_venta) || 0), 0);
    const margenPromedio = operaciones.length > 0
      ? operaciones.reduce((sum, op) => sum + (parseFloat(op.margen_porcentaje) || 0), 0) / operaciones.length
      : 0;

    const totalMargen = operaciones.reduce((sum, op) => sum + (parseFloat(op.margen) || 0), 0);

    return { total, ventasMes, margenPromedio, totalMargen };
  }, [operaciones]);

  // Exportar Excel
  const exportToExcel = () => {
    const excelData = filteredOperaciones.map(op => ({
      'Código': op.codigo_operacion,
      'Fecha': formatFecha(op.fecha_operacion),
      'Cliente': op.cliente_nombre || '',
      'Factura': op.numero_factura || '',
      'Fecha Entrega': op.fecha_entrega ? formatFecha(op.fecha_entrega) : '',
      'Equipo': op.descripcion_equipo || '',
      'Precio Neto': op.precio_neto_venta || 0,
      'IVA': op.iva_venta || 0,
      'Precio Total': op.precio_total_venta || 0,
      'Costo Compra': op.costo_compra_equipo || 0,
      'Despacho/Aduana': op.costo_despacho_aduana || 0,
      'Logística/Flete': op.costo_logistica_flete || 0,
      'Traslado Interno': op.costo_traslado_interno || 0,
      'Servicio Técnico': op.costo_servicio_tecnico || 0,
      'Training': op.costo_training || 0,
      'Bonificación': op.costo_bonificacion || 0,
      'Comisión Vendedor': op.costo_comision_vendedor || 0,
      'Comisión Otros': op.costo_comision_otros || 0,
      'Gastos Financieros': op.costo_gastos_financieros || 0,
      'Seguros': op.costo_seguros || 0,
      'Otros': op.costo_otros || 0,
      'TOTAL COSTOS': op.total_costos || 0,
      'MARGEN $': op.margen || 0,
      'MARGEN %': op.margen_porcentaje ? `${parseFloat(op.margen_porcentaje).toFixed(1)}%` : '0%',
      'Notas': op.notas || ''
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    ws['!cols'] = excelData.length > 0 ? Object.keys(excelData[0]).map(() => ({ wch: 16 })) : [];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Operaciones');
    XLSX.writeFile(wb, `operaciones-comerciales-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) {
    return (
      <div className="cc-loading">
        <div className="cc-spinner"></div>
        <p>Cargando operaciones...</p>
      </div>
    );
  }

  return (
    <div className="cc-container">
      {/* Header */}
      <div className="cc-header">
        <div>
          <h1 className="cc-title"><TrendingUp size={28} /> Operaciones Comerciales</h1>
          <p className="cc-subtitle">P&L por operación de venta</p>
        </div>
      </div>

      {/* Stats */}
      <div className="cc-stats-grid">
        <div className="cc-stat-card">
          <span className="cc-stat-number">{stats.total}</span>
          <span className="cc-stat-label">Total Operaciones</span>
        </div>
        <div className="cc-stat-card">
          <span className="cc-stat-number">$ {formatMoney(stats.ventasMes)}</span>
          <span className="cc-stat-label">Ventas del Mes</span>
        </div>
        <div className="cc-stat-card">
          <span className="cc-stat-number" style={{ color: stats.totalMargen >= 0 ? '#16a34a' : '#dc2626' }}>
            $ {formatMoney(stats.totalMargen)}
          </span>
          <span className="cc-stat-label">Margen Total</span>
        </div>
        <div className="cc-stat-card">
          <span className="cc-stat-number" style={{ color: stats.margenPromedio >= 0 ? '#16a34a' : '#dc2626' }}>
            {stats.margenPromedio.toFixed(1)}%
          </span>
          <span className="cc-stat-label">Margen Promedio</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="cc-toolbar">
        <div className="cc-search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar operación... (usa - para excluir)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={exportToExcel} className="cc-btn cc-btn-secondary" title="Exportar Excel">
            <FileSpreadsheet size={18} /> Excel
          </button>
          <button onClick={openNewModal} className="cc-btn cc-btn-primary">
            <Plus size={18} /> Nueva Operación
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="cc-table-container">
        <table className="cc-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('codigo_operacion')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Código <SortIcon columnKey="codigo_operacion" />
              </th>
              <th onClick={() => handleSort('fecha_operacion')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Fecha <SortIcon columnKey="fecha_operacion" />
              </th>
              <th onClick={() => handleSort('cliente_nombre')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Cliente <SortIcon columnKey="cliente_nombre" />
              </th>
              <th onClick={() => handleSort('descripcion_equipo')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Equipo <SortIcon columnKey="descripcion_equipo" />
              </th>
              <th onClick={() => handleSort('precio_neto_venta')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                Venta Neta <SortIcon columnKey="precio_neto_venta" />
              </th>
              <th onClick={() => handleSort('total_costos')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                Costos <SortIcon columnKey="total_costos" />
              </th>
              <th onClick={() => handleSort('margen')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                Margen <SortIcon columnKey="margen" />
              </th>
              <th style={{ width: '80px' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredOperaciones.map(op => {
              const { margen, pct } = getMargen(op);
              return (
                <tr key={op.id}>
                  <td style={{ fontWeight: '600' }}>{op.codigo_operacion}</td>
                  <td>{formatFecha(op.fecha_operacion)}</td>
                  <td>{op.cliente_nombre || '-'}</td>
                  <td>{op.descripcion_equipo || '-'}</td>
                  <td style={{ textAlign: 'right', fontWeight: '500' }}>$ {formatMoney(op.precio_neto_venta)}</td>
                  <td style={{ textAlign: 'right', color: '#dc2626' }}>$ {formatMoney(op.total_costos)}</td>
                  <td style={{ 
                    textAlign: 'right', 
                    fontWeight: '700', 
                    color: margen >= 0 ? '#16a34a' : '#dc2626'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                      {margen >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      $ {formatMoney(margen)} ({pct.toFixed(1)}%)
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button onClick={() => openEditModal(op)} className="cc-btn-icon" title="Editar">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => deleteOperacion(op.id, op.codigo_operacion)} className="cc-btn-icon cc-btn-danger" title="Eliminar">
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

      {filteredOperaciones.length === 0 && (
        <div className="cc-empty-state">
          <TrendingUp size={48} strokeWidth={1} />
          <h3>No hay operaciones</h3>
          <p>{searchTerm ? 'No se encontraron resultados' : 'Registra tu primera operación comercial'}</p>
          {!searchTerm && (
            <button onClick={openNewModal} className="cc-btn cc-btn-primary">
              <Plus size={18} /> Nueva Operación
            </button>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="cc-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="cc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '750px' }}>
            <div className="cc-modal-header">
              <h2>
                <TrendingUp size={20} />
                {editingItem ? 'Editar Operación' : 'Nueva Operación'}
              </h2>
              <button onClick={() => setShowModal(false)} className="cc-modal-close">
                <X size={20} />
              </button>
            </div>

            <div className="cc-modal-body">
              {/* Datos de la Operación */}
              <div className="cc-form-section">
                <h3 className="cc-section-title">Datos de la Operación</h3>
                <div className="cc-form-grid">
                  <div className="cc-form-group">
                    <label className="cc-form-label">Fecha *</label>
                    <input type="date" className="cc-form-input" value={formData.fecha_operacion}
                      onChange={(e) => handleInputChange('fecha_operacion', e.target.value)} required />
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Código *</label>
                    <input type="text" className="cc-form-input" value={formData.codigo_operacion}
                      onChange={(e) => handleInputChange('codigo_operacion', e.target.value)} required />
                  </div>
                  <div className="cc-form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="cc-form-label">Descripción del Equipo</label>
                    <input type="text" className="cc-form-input" value={formData.descripcion_equipo}
                      onChange={(e) => handleInputChange('descripcion_equipo', e.target.value)}
                      placeholder="Equipo, modelo, accesorios..." />
                  </div>
                </div>
              </div>

              {/* Datos del Cliente */}
              <div className="cc-form-section">
                <h3 className="cc-section-title">Datos del Cliente</h3>
                <div className="cc-form-grid">
                  <div className="cc-form-group">
                    <label className="cc-form-label">Profesional / Clínica</label>
                    <input type="text" className="cc-form-input" value={formData.cliente_nombre}
                      onChange={(e) => handleInputChange('cliente_nombre', e.target.value)}
                      placeholder="Nombre del profesional o clínica" />
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Nº Factura</label>
                    <input type="text" className="cc-form-input" value={formData.numero_factura}
                      onChange={(e) => handleInputChange('numero_factura', e.target.value)}
                      placeholder="Número de factura" />
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Fecha de Entrega</label>
                    <input type="date" className="cc-form-input" value={formData.fecha_entrega}
                      onChange={(e) => handleInputChange('fecha_entrega', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Vincular a Compra */}
              <div className="cc-form-section">
                <h3 className="cc-section-title">
                  <Link2 size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                  Vincular a Compra Existente
                </h3>
                <div className="cc-form-grid">
                  <div className="cc-form-group" style={{ gridColumn: 'span 2' }}>
                    <select className="cc-form-input" value={formData.compra_carga_id}
                      onChange={(e) => vincularCompra(e.target.value)}>
                      <option value="">Sin vincular (ingresar costos manualmente)</option>
                      {comprasDisponibles.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.codigo_orden} — {c.proveedor_nombre || 'Sin prov.'} — {c.descripcion || 'Sin desc.'} (${formatMoney(c.monto_compra)})
                        </option>
                      ))}
                    </select>
                    {formData.compra_carga_id && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#567C8D', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Link2 size={12} /> Costos importados de la compra. Podés modificarlos manualmente.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Ingresos */}
              <div className="cc-form-section">
                <h3 className="cc-section-title">Ingresos</h3>
                <div className="cc-form-grid">
                  <div className="cc-form-group">
                    <label className="cc-form-label">Precio Neto de Venta</label>
                    <input type="number" step="0.01" className="cc-form-input" value={formData.precio_neto_venta}
                      onChange={(e) => handleInputChange('precio_neto_venta', e.target.value)}
                      placeholder="0.00" style={{ fontSize: '1.1rem', fontWeight: '600' }} />
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">IVA 10% (automático)</label>
                    <div className="cc-form-input" style={{ background: '#f1f5f9', display: 'flex', alignItems: 'center', color: '#64748b' }}>
                      $ {formatMoney(calcIVA(formData.precio_neto_venta))}
                    </div>
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Total con IVA</label>
                    <div className="cc-form-input" style={{ background: '#f1f5f9', display: 'flex', alignItems: 'center', fontWeight: '600', color: '#2F4156' }}>
                      $ {formatMoney(calcIngresoTotal())}
                    </div>
                  </div>
                </div>
              </div>

              {/* Costos del Equipo */}
              <div className="cc-form-section">
                <h3 className="cc-section-title">Costos del Equipo</h3>
                <div className="cc-form-grid">
                  <div className="cc-form-group">
                    <label className="cc-form-label">Compra del Equipo</label>
                    <input type="number" step="0.01" className="cc-form-input" value={formData.costo_compra_equipo}
                      onChange={(e) => handleInputChange('costo_compra_equipo', e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Despacho / Aduana</label>
                    <input type="number" step="0.01" className="cc-form-input" value={formData.costo_despacho_aduana}
                      onChange={(e) => handleInputChange('costo_despacho_aduana', e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Logística / Flete</label>
                    <input type="number" step="0.01" className="cc-form-input" value={formData.costo_logistica_flete}
                      onChange={(e) => handleInputChange('costo_logistica_flete', e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Traslado Interno</label>
                    <input type="number" step="0.01" className="cc-form-input" value={formData.costo_traslado_interno}
                      onChange={(e) => handleInputChange('costo_traslado_interno', e.target.value)} placeholder="0.00" />
                  </div>
                </div>
              </div>

              {/* Gastos Operativos */}
              <div className="cc-form-section">
                <h3 className="cc-section-title">Gastos Operativos</h3>
                <div className="cc-form-grid">
                  <div className="cc-form-group">
                    <label className="cc-form-label">Servicio Técnico</label>
                    <input type="number" step="0.01" className="cc-form-input" value={formData.costo_servicio_tecnico}
                      onChange={(e) => handleInputChange('costo_servicio_tecnico', e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Training / Capacitación</label>
                    <input type="number" step="0.01" className="cc-form-input" value={formData.costo_training}
                      onChange={(e) => handleInputChange('costo_training', e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Bonificación / Regalos</label>
                    <input type="number" step="0.01" className="cc-form-input" value={formData.costo_bonificacion}
                      onChange={(e) => handleInputChange('costo_bonificacion', e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Comisión Vendedor</label>
                    <input type="number" step="0.01" className="cc-form-input" value={formData.costo_comision_vendedor}
                      onChange={(e) => handleInputChange('costo_comision_vendedor', e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Comisión Otros</label>
                    <input type="number" step="0.01" className="cc-form-input" value={formData.costo_comision_otros}
                      onChange={(e) => handleInputChange('costo_comision_otros', e.target.value)} placeholder="0.00" />
                  </div>
                </div>
              </div>

              {/* Otros Gastos */}
              <div className="cc-form-section">
                <h3 className="cc-section-title">Otros Gastos</h3>
                <div className="cc-form-grid">
                  <div className="cc-form-group">
                    <label className="cc-form-label">Gastos Financieros</label>
                    <input type="number" step="0.01" className="cc-form-input" value={formData.costo_gastos_financieros}
                      onChange={(e) => handleInputChange('costo_gastos_financieros', e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Seguros</label>
                    <input type="number" step="0.01" className="cc-form-input" value={formData.costo_seguros}
                      onChange={(e) => handleInputChange('costo_seguros', e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="cc-form-group">
                    <label className="cc-form-label">Otros</label>
                    <input type="number" step="0.01" className="cc-form-input" value={formData.costo_otros}
                      onChange={(e) => handleInputChange('costo_otros', e.target.value)} placeholder="0.00" />
                  </div>
                </div>
              </div>

              {/* Notas */}
              <div className="cc-form-section">
                <div className="cc-form-group">
                  <label className="cc-form-label">Notas</label>
                  <textarea className="cc-form-input" rows="2" value={formData.notas}
                    onChange={(e) => handleInputChange('notas', e.target.value)}
                    placeholder="Observaciones de la operación..." />
                </div>
              </div>

              {/* Resumen P&L */}
              <div style={{ 
                background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', 
                padding: '1.25rem', 
                borderRadius: '8px', 
                border: '1px solid #e2e8f0',
                marginTop: '0.5rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={{ color: '#64748b', fontWeight: '500' }}>Precio Neto de Venta</span>
                  <span style={{ color: '#2F4156', fontWeight: '600' }}>$ {formatMoney(formData.precio_neto_venta)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={{ color: '#dc2626', fontWeight: '500' }}>Total Costos</span>
                  <span style={{ color: '#dc2626', fontWeight: '600' }}>- $ {formatMoney(calcTotalCostos())}</span>
                </div>
                <div style={{ borderTop: '2px solid #cbd5e1', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: '700', fontSize: '1.1rem', color: '#2F4156' }}>
                    MARGEN DE LA OPERACIÓN
                  </span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ 
                      fontWeight: '800', 
                      fontSize: '1.5rem', 
                      color: calcMargen() >= 0 ? '#16a34a' : '#dc2626',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      {calcMargen() >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                      $ {formatMoney(calcMargen())}
                    </span>
                    <span style={{ 
                      fontSize: '0.9rem', 
                      fontWeight: '600',
                      color: calcMargenPct() >= 0 ? '#16a34a' : '#dc2626'
                    }}>
                      ({calcMargenPct().toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>

            </div>

            <div className="cc-modal-footer">
              <button className="cc-btn cc-btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="cc-btn cc-btn-primary" onClick={handleSave} disabled={saving}>
                <Save size={18} />
                {saving ? 'Guardando...' : (editingItem ? 'Actualizar' : 'Guardar Operación')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
