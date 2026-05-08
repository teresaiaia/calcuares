import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './supabaseClient';
import {
  Search, Plus, Edit2, Trash2, X, Save, Download,
  RefreshCw, ChevronUp, ChevronDown, Upload, FileText, Link, Eye
} from 'lucide-react';
import './DocumentosContables.css';

// ============================================
// CONSTANTES
// ============================================
// RUBROS se carga dinámicamente desde Supabase (estado: rubros)

const MONEDAS = ['₲', 'USD'];
const MODALIDADES = ['Contado', 'Crédito', 'Anulada', 'Bonificación'];
const TIPOS_RECIBO = ['RO', 'RNO'];

const ESTADOS_FAC_OS = (modalidad) => {
  if (modalidad === 'Anulada') return ['Anulada'];
  if (modalidad === 'Bonificación') return ['Bonificación'];
  if (modalidad === 'Contado') return ['Pagado', 'Anulada'];
  return ['Pendiente', 'Parcialmente cobrado', 'Pagado', 'Anulada'];
};

// ============================================
// HELPERS
// ============================================
const formatNumber = (num, moneda) => {
  if (!num && num !== 0) return '';
  if (moneda === 'USD') {
    return Number(num).toLocaleString('es-PY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return Math.round(Number(num)).toLocaleString('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const parseMonto = (val, moneda) => {
  if (val === '' || val === null || val === undefined) return 0;
  // Si ya es número (viene de Excel como celda numérica), usarlo directo
  if (typeof val === 'number') {
    return moneda === 'USD' ? Math.round(val * 100) / 100 : Math.round(val);
  }
  // Si es string (ingresado manualmente en formato es-PY: punto=miles, coma=decimal)
  const limpio = String(val).replace(/\./g, '').replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const num = parseFloat(limpio) || 0;
  return moneda === 'USD' ? Math.round(num * 100) / 100 : Math.round(num);
};

const estadoBadgeClass = (estado) => {
  if (!estado) return '';
  const e = estado.toLowerCase();
  if (e.includes('pagado')) return 'pagado';
  if (e.includes('pendiente')) return 'pendiente';
  if (e.includes('parcial')) return 'parcial';
  if (e.includes('anulad')) return 'anulado';
  if (e.includes('contado')) return 'contado';
  if (e.includes('bonificaci')) return 'bonificacion';
  return '';
};

// ============================================
// EXPORT PDF HELPER
// ============================================
const exportarPDF = (titulo, columnas, filas, totalesHTML = '') => {
  const ventana = window.open('', '_blank');
  const rows = filas.map(f =>
    `<tr>${f.map(c => `<td class="${c.cls || ''}">${c.val ?? ''}</td>`).join('')}</tr>`
  ).join('');
  ventana.document.write(`<!DOCTYPE html><html><head>
    <title>${titulo}</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:Arial,sans-serif; padding:20px; color:#2F4156; font-size:10px; }
      .header { text-align:center; margin-bottom:18px; border-bottom:3px solid #567C8D; padding-bottom:12px; }
      .header h1 { font-size:17px; color:#2F4156; }
      .header p { color:#567C8D; font-size:11px; margin-top:3px; }
      .totales { display:flex; gap:16px; justify-content:center; margin-bottom:12px; font-size:10px; flex-wrap:wrap; }
      .totales span { background:#f0f4f8; padding:3px 10px; border-radius:4px; }
      table { width:100%; border-collapse:collapse; font-size:9px; }
      th { background:#2F4156; color:white; padding:6px 5px; text-align:left; font-weight:600; white-space:nowrap; }
      td { padding:4px 5px; border-bottom:1px solid #e0e0e0; }
      tr:nth-child(even) { background:#f8fafc; }
      .num { text-align:right; }
      .center { text-align:center; }
      .footer { text-align:center; margin-top:18px; font-size:9px; color:#94a3b8; border-top:1px solid #e0e0e0; padding-top:8px; }
      @media print { body { padding:8px; } }
      @page { size:landscape; margin:10mm; }
    </style>
  </head><body>
    <div class="header"><h1>Ares Paraguay SRL</h1><p>${titulo}</p></div>
    ${totalesHTML ? `<div class="totales">${totalesHTML}</div>` : ''}
    <table>
      <thead><tr>${columnas.map(c => `<th>${c}</th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">Generado el ${new Date().toLocaleDateString('es-PY')} — Ares Paraguay SRL</div>
  </body></html>`);
  ventana.document.close();
  setTimeout(() => ventana.print(), 500);
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function DocumentosContables() {
  const [activeTab, setActiveTab] = useState('facturas');
  const [loading, setLoading] = useState(false);

  // Datos
  const [facturas, setFacturas] = useState([]);
  const [ordenesServicio, setOrdenesServicio] = useState([]);
  const [recibos, setRecibos] = useState([]);
  const [remisiones, setRemisiones] = useState([]);
  const [rubros, setRubros] = useState([]);
  const [reciboDocumentos, setReciboDocumentos] = useState([]);

  // Filtros compartidos
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('todos');
  const [filterMoneda, setFilterMoneda] = useState('todas');
  const [filterFechaDesde, setFilterFechaDesde] = useState('');
  const [filterFechaHasta, setFilterFechaHasta] = useState('');
  const [sortField, setSortField] = useState('fecha');
  const [sortDir, setSortDir] = useState('desc');

  // Modales
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);

  // Import
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState([]);
  const [importStatus, setImportStatus] = useState('');
  const [importResults, setImportResults] = useState(null);
  const [duplicateAction, setDuplicateAction] = useState('skip');
  const [importDuplicates, setImportDuplicates] = useState([]);
  const importFileRef = useRef(null);

  // Selección múltiple
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Export menu
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [tipoCambio, setTipoCambio] = useState(() => {
    const saved = localStorage.getItem('dc_tipoCambio');
    return saved ? parseFloat(saved) : 7800;
  });
  const exportMenuRef = useRef(null);

  // Form
  const formInit = {
    // facturas / OS
    nro_factura: '', nro_os: '',
    fecha: new Date().toISOString().split('T')[0],
    cliente: '', cat: 'FAC', modalidad: 'Contado', moneda: '₲',
    concepto: '', rubro: '', monto: '', estado: '', observaciones: '',
    nro_remision: '',
    // recibos
    nro_recibo: '', tipo: 'RO', detalle: '',
    vinculos: [],
    // remisiones
    rem: '', factura: '', os: '',
  };

  const [formData, setFormData] = useState(formInit);

  // ---- FETCH ----
  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [fRes, osRes, rRes, remRes, rdRes, rubRes] = await Promise.all([
        supabase.from('facturas').select('*').order('fecha', { ascending: false }).limit(10000),
        supabase.from('ordenes_servicio').select('*').order('fecha', { ascending: false }).limit(10000),
        supabase.from('recibos').select('*').order('fecha', { ascending: false }).limit(10000),
        supabase.from('remisiones').select('*').order('fecha', { ascending: false }).limit(10000),
        supabase.from('recibo_documentos').select('*').limit(10000),
        supabase.from('rubros').select('*').order('nombre'),
      ]);
      setFacturas(fRes.data || []);
      setOrdenesServicio(osRes.data || []);
      setRecibos(rRes.data || []);
      setRemisiones(remRes.data || []);
      setReciboDocumentos(rdRes.data || []);
      setRubros(rubRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ---- DATOS ACTIVOS ----
  const dataActiva = useMemo(() => {
    const map = {
      facturas: facturas,
      ordenes_servicio: ordenesServicio,
      recibos: recibos,
      remisiones: remisiones,
    };
    return map[activeTab] || [];
  }, [activeTab, facturas, ordenesServicio, recibos, remisiones]);

  // ---- FILTRADO ----
  const datosFiltrados = useMemo(() => {
    let data = [...dataActiva];

    if (searchTerm) {
      const exactMatch = searchTerm.match(/^"(.+)"$/);
      if (exactMatch) {
        const exact = exactMatch[1].toLowerCase();
        data = data.filter(item =>
          Object.values(item).some(v => v && String(v).toLowerCase() === exact)
        );
      } else {
        const palabras = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
        data = data.filter(item => {
          const texto = Object.values(item).filter(Boolean).map(v => String(v).toLowerCase()).join(' ');
          return palabras.every(p => texto.includes(p));
        });
      }
    }

    if (filterEstado !== 'todos' && activeTab !== 'remisiones') {
      data = data.filter(item => item.estado === filterEstado || item.tipo === filterEstado);
    }
    if (filterMoneda !== 'todas' && activeTab !== 'remisiones') {
      data = data.filter(item => item.moneda === filterMoneda);
    }
    if (filterFechaDesde) {
      data = data.filter(item => item.fecha >= filterFechaDesde);
    }
    if (filterFechaHasta) {
      data = data.filter(item => item.fecha <= filterFechaHasta);
    }

    data.sort((a, b) => {
      let va = a[sortField] ?? '';
      let vb = b[sortField] ?? '';
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return data;
  }, [dataActiva, activeTab, searchTerm, filterEstado, filterMoneda, filterFechaDesde, filterFechaHasta, sortField, sortDir]);

  const totales = useMemo(() => {
    let guaranies = 0;
    let dolares = 0;
    datosFiltrados.forEach(item => {
      const monto = parseFloat(item.monto) || 0;
      if (item.moneda === 'USD') dolares += monto;
      else if (item.moneda === '₲') guaranies += monto;
    });
    const tc = parseFloat(tipoCambio) || 1;
    const totalUSD = dolares + (guaranies / tc);
    return { guaranies, dolares, totalUSD };
  }, [datosFiltrados, tipoCambio]);

  // ---- SORT TOGGLE ----
  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />;
  };

  // ---- MODAL NUEVO / EDITAR ----
  const handleNew = () => {
    setEditingItem(null);
    const init = { ...formInit };
    if (activeTab === 'facturas' || activeTab === 'ordenes_servicio') init.estado = 'Pagado';
    if (activeTab === 'recibos') init.tipo = 'RO';
    setFormData(init);
    setShowModal(true);
  };

  const handleView = (item) => {
    setViewItem(item);
    setShowViewModal(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    const base = {
      ...formInit,
      ...item,
      estado: item.estado || formInit.estado,
      modalidad: item.modalidad || formInit.modalidad,
      monto: item.monto ?? '',
      vinculos: [],
    };
    if (activeTab === 'recibos') {
      const vins = reciboDocumentos
        .filter(rd => rd.recibo_id === item.id)
        .map(rd => ({
          tipo_documento: rd.tipo_documento,
          documento_id: rd.documento_id,
          monto_aplicado: rd.monto_aplicado,
          nro_doc: rd.tipo_documento === 'factura'
            ? (facturas.find(f => f.id === rd.documento_id)?.nro_factura || '')
            : (ordenesServicio.find(o => o.id === rd.documento_id)?.nro_os || '')
        }));
      base.vinculos = vins;
    }
    setFormData(base);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este registro?')) return;
    const table = activeTab === 'ordenes_servicio' ? 'ordenes_servicio' : activeTab;
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      await fetchAll();
    } catch (e) {
      alert('Error al eliminar: ' + e.message);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`¿Eliminar ${selectedIds.size} registro${selectedIds.size > 1 ? 's' : ''}? Esta acción no se puede deshacer.`)) return;
    const table = activeTab === 'ordenes_servicio' ? 'ordenes_servicio' : activeTab;
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from(table).delete().in('id', ids);
      if (error) throw error;
      setSelectedIds(new Set());
      await fetchAll();
    } catch (e) {
      alert('Error al eliminar: ' + e.message);
    }
  };

  // ---- GUARDAR ----
  const handleSave = async () => {
    setSaving(true);
    try {
      if (activeTab === 'facturas') {
        if (!formData.nro_factura?.trim() || !formData.cliente?.trim()) {
          alert('N° de Factura y Cliente son obligatorios');
          return;
        }
        const payload = {
          nro_factura: formData.nro_factura.trim(),
          fecha: formData.fecha,
          cliente: formData.cliente.trim(),
          cat: formData.cat || 'FAC',
          modalidad: formData.modalidad,
          moneda: formData.moneda,
          concepto: formData.concepto?.trim() || null,
          rubro: formData.rubro || null,
          monto: parseMonto(formData.monto, formData.moneda),
          estado: formData.modalidad === 'Contado' ? 'Pagado' : formData.estado,
          observaciones: formData.observaciones?.trim() || null,
          nro_remision: formData.nro_remision?.trim() || null,
        };
        const { error } = editingItem
          ? await supabase.from('facturas').update(payload).eq('id', editingItem.id)
          : await supabase.from('facturas').insert([payload]);
        if (error) throw error;

      } else if (activeTab === 'ordenes_servicio') {
        if (!formData.nro_os?.trim() || !formData.cliente?.trim()) {
          alert('N° de OS y Cliente son obligatorios');
          return;
        }
        const payload = {
          nro_os: formData.nro_os.trim(),
          fecha: formData.fecha,
          cliente: formData.cliente.trim(),
          modalidad: formData.modalidad,
          moneda: formData.moneda,
          concepto: formData.concepto?.trim() || null,
          rubro: formData.rubro || null,
          monto: parseMonto(formData.monto, formData.moneda),
          estado: formData.modalidad === 'Contado' ? 'Pagado' : formData.estado,
          observaciones: formData.observaciones?.trim() || null,
        };
        const { error } = editingItem
          ? await supabase.from('ordenes_servicio').update(payload).eq('id', editingItem.id)
          : await supabase.from('ordenes_servicio').insert([payload]);
        if (error) throw error;

      } else if (activeTab === 'recibos') {
        if (!formData.nro_recibo?.trim() || !formData.cliente?.trim()) {
          alert('N° de Recibo y Cliente son obligatorios');
          return;
        }
        const payload = {
          nro_recibo: formData.nro_recibo.trim(),
          tipo: formData.tipo,
          fecha: formData.fecha,
          cliente: formData.cliente.trim(),
          moneda: formData.moneda,
          monto: parseMonto(formData.monto, formData.moneda),
          detalle: formData.detalle?.trim() || null,
        };
        let reciboId = editingItem?.id;
        if (editingItem) {
          const { error } = await supabase.from('recibos').update(payload).eq('id', editingItem.id);
          if (error) throw error;
          await supabase.from('recibo_documentos').delete().eq('recibo_id', editingItem.id);
        } else {
          const { data, error } = await supabase.from('recibos').insert([payload]).select().single();
          if (error) throw error;
          reciboId = data.id;
        }
        if (formData.vinculos?.length > 0) {
          const vinculosPayload = formData.vinculos
            .filter(v => v.documento_id)
            .map(v => ({
              recibo_id: reciboId,
              tipo_documento: v.tipo_documento,
              documento_id: parseInt(v.documento_id),
              monto_aplicado: parseMonto(v.monto_aplicado),
            }));
          if (vinculosPayload.length > 0) {
            const { error } = await supabase.from('recibo_documentos').insert(vinculosPayload);
            if (error) throw error;
          }
        }

      } else if (activeTab === 'remisiones') {
        if (!formData.rem?.toString().trim() || !formData.cliente?.trim()) {
          alert('N° REM y Cliente son obligatorios');
          return;
        }
        const payload = {
          rem: parseInt(formData.rem),
          fecha: formData.fecha,
          cliente: formData.cliente.trim(),
          factura: formData.factura?.trim() || null,
          os: formData.os?.trim() || null,
          rubro: formData.rubro || null,
          detalle: formData.detalle?.trim() || null,
        };
        const { error } = editingItem
          ? await supabase.from('remisiones').update(payload).eq('id', editingItem.id)
          : await supabase.from('remisiones').insert([payload]);
        if (error) throw error;
      }

      setShowModal(false);
      setEditingItem(null);
      setFormData(formInit);
      await fetchAll();
    } catch (e) {
      console.error(e);
      alert('Error al guardar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // ---- CAMBIO DE TAB ----
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchTerm('');
    setFilterEstado('todos');
    setFilterMoneda('todas');
    setFilterFechaDesde('');
    setFilterFechaHasta('');
    setSortField('fecha');
    setSortDir('desc');
    setSelectedIds(new Set());
  };

  // ---- IMPORT ----
  const parseExcelDate = (val) => {
    if (!val) return null;
    if (typeof val === 'number') {
      const d = new Date((val - 25569) * 86400000);
      return d.toISOString().split('T')[0];
    }
    const str = String(val).trim();
    const parts = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (parts) {
      const year = parts[3].length === 2 ? '20' + parts[3] : parts[3];
      return `${year}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return null;
  };

  const handleImportFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    try {
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (rows.length < 2) { alert('Archivo sin datos'); return; }

      const parsed = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[0]) continue;
        let record = {};

        if (activeTab === 'facturas') {
          // NRO_FAC | FECHA | CLIENTE | CAT | MODALIDAD | MONEDA | CONCEPTO | RUBRO | MONTO | ESTADO | OBS | NRO_REMISION
          record = {
            nro_factura: String(r[0] || '').trim(),
            fecha: parseExcelDate(r[1]),
            cliente: String(r[2] || '').trim(),
            cat: String(r[3] || 'FAC').trim() || 'FAC',
            modalidad: String(r[4] || 'Contado').trim(),
            moneda: String(r[5] || '₲').trim(),
            concepto: String(r[6] || '').trim() || null,
            rubro: String(r[7] || '').trim() || null,
            monto: parseMonto(r[8], String(r[5] || '₲').trim()),
            estado: String(r[9] || 'Pendiente').trim(),
            observaciones: String(r[10] || '').trim() || null,
            nro_remision: String(r[11] || '').trim() || null,
          };
          if (!record.nro_factura || !record.cliente) continue;

        } else if (activeTab === 'ordenes_servicio') {
          // NRO_OS | FECHA | CLIENTE | MODALIDAD | MONEDA | CONCEPTO | RUBRO | MONTO | ESTADO | OBS
          record = {
            nro_os: String(r[0] || '').trim(),
            fecha: parseExcelDate(r[1]),
            cliente: String(r[2] || '').trim(),
            modalidad: String(r[3] || 'Contado').trim(),
            moneda: String(r[4] || '₲').trim(),
            concepto: String(r[5] || '').trim() || null,
            rubro: String(r[6] || '').trim() || null,
            monto: parseMonto(r[7]),
            estado: String(r[8] || 'Pendiente').trim(),
            observaciones: String(r[9] || '').trim() || null,
          };
          if (!record.nro_os || !record.cliente) continue;

        } else if (activeTab === 'recibos') {
          // NRO_RECIBO | TIPO | FECHA | CLIENTE | MONEDA | MONTO | DETALLE | FACT N°
          record = {
            nro_recibo: String(r[0] || '').trim(),
            tipo: String(r[1] || 'RO').trim(),
            fecha: parseExcelDate(r[2]),
            cliente: String(r[3] || '').trim(),
            moneda: String(r[4] || '₲').trim(),
            monto: parseMonto(r[5], String(r[4] || '').trim()),
            detalle: String(r[6] || '').trim() || null,
            _fact_nro: String(r[7] || '').trim() || null,
          };
          if (!record.nro_recibo || !record.cliente) continue;

        } else if (activeTab === 'remisiones') {
          // REM | FECHA | CLIENTE | FACTURA | OS | RUBRO | DETALLE
          const remVal = String(r[0] || '').trim();
          const clienteVal = String(r[2] || '').trim();
          if (!remVal || !clienteVal) continue;

          record = {
            rem: parseInt(remVal),
            fecha: parseExcelDate(r[1]),
            cliente: clienteVal,
            factura: String(r[3] || '').trim() || null,
            os: String(r[4] || '').trim() || null,
            rubro: String(r[5] || '').trim() || null,
            detalle: String(r[6] || '').trim() || null,
          };
        }

        parsed.push(record);
      }

      if (parsed.length === 0) { alert('No se encontraron registros válidos'); return; }

      const nroField = activeTab === 'facturas' ? 'nro_factura'
        : activeTab === 'ordenes_servicio' ? 'nro_os'
        : activeTab === 'recibos' ? 'nro_recibo'
        : 'rem';

      const existingSet = new Set(dataActiva.map(d => String(d[nroField])));
      const dupes = parsed.filter(p => existingSet.has(String(p[nroField])));

      setImportData(parsed);
      setImportDuplicates(dupes);
      setImportStatus('preview');
      setImportResults(null);
      setDuplicateAction('skip');
      setShowImportModal(true);
    } catch (err) {
      alert('Error al leer el archivo: ' + err.message);
    }
  };

  const handleImportConfirm = async () => {
    setImportStatus('importing');
    const table = activeTab === 'ordenes_servicio' ? 'ordenes_servicio' : activeTab;
    const nroField = activeTab === 'facturas' ? 'nro_factura'
      : activeTab === 'ordenes_servicio' ? 'nro_os'
      : activeTab === 'recibos' ? 'nro_recibo'
      : 'rem';

    const existingMap = {};
    dataActiva.forEach(d => { existingMap[String(d[nroField])] = d.id; });

    const facturasMap = {};
    facturas.forEach(f => { facturasMap[f.nro_factura] = f.id; });
    const osMap = {};
    ordenesServicio.forEach(o => { osMap[o.nro_os] = o.id; });

    let inserted = 0, updated = 0, skipped = 0, errors = 0;
    const errorDetails = [];

    for (const record of importData) {
      const isDupe = existingMap[String(record[nroField])];
      const factNro = record._fact_nro || null;
      const { _fact_nro, ...recordLimpio } = record;

      try {
        let reciboId = null;
        if (isDupe) {
          if (duplicateAction === 'skip') { skipped++; continue; }
          const { error } = await supabase.from(table).update(recordLimpio).eq('id', isDupe);
          if (error) throw error;
          reciboId = isDupe;
          updated++;
        } else {
          const { data, error } = await supabase.from(table).insert([recordLimpio]).select().single();
          if (error) throw error;
          reciboId = data.id;
          inserted++;
        }

        if (reciboId && factNro && activeTab === 'recibos') {
          const factId = facturasMap[factNro];
          const osId = osMap[factNro];
          if (factId) {
            await supabase.from('recibo_documentos').insert([{
              recibo_id: reciboId,
              tipo_documento: 'factura',
              documento_id: factId,
              monto_aplicado: recordLimpio.monto || 0,
            }]);
          } else if (osId) {
            await supabase.from('recibo_documentos').insert([{
              recibo_id: reciboId,
              tipo_documento: 'orden_servicio',
              documento_id: osId,
              monto_aplicado: recordLimpio.monto || 0,
            }]);
          }
        }
      } catch (err) {
        errors++;
        errorDetails.push({ nro: record[nroField], motivo: err.message });
      }
    }

    setImportResults({ inserted, updated, skipped, errors, total: importData.length, errorDetails });
    setImportStatus('done');
    await fetchAll();
  };

  // ---- EXPORT EXCEL ----
  const handleExportExcel = async () => {
    setShowExportMenu(false);
    try {
      const XLSX = await import('xlsx');
      let exportData = [];
      if (activeTab === 'facturas') {
        exportData = datosFiltrados.map(f => ({
          'FECHA': f.fecha, 'CLIENTE': f.cliente, 'CAT': f.cat || 'FAC',
          'N° FAC': f.nro_factura, 'REM N°': f.nro_remision || '',
          'COND': f.modalidad,
          'TOT USD': f.moneda === 'USD' ? f.monto : '',
          'TOT GS': f.moneda === '₲' ? f.monto : '',
          'RUBRO': f.rubro || '', 'ESTADO': f.estado || '',
          'CONCEPTO': f.concepto || '', 'OBS': f.observaciones || ''
        }));
      } else if (activeTab === 'ordenes_servicio') {
        exportData = datosFiltrados.map(o => ({
          'N° OS': o.nro_os, 'FECHA': o.fecha, 'CLIENTE': o.cliente,
          'MODALIDAD': o.modalidad, 'MONEDA': o.moneda,
          'CONCEPTO': o.concepto || '', 'RUBRO': o.rubro || '', 'MONTO': o.monto,
          'ESTADO': o.estado || '', 'OBS': o.observaciones || ''
        }));
      } else if (activeTab === 'recibos') {
        exportData = datosFiltrados.map(r => ({
          'N° RECIBO': r.nro_recibo, 'TIPO': r.tipo, 'FECHA': r.fecha,
          'CLIENTE': r.cliente, 'MONEDA': r.moneda, 'MONTO': r.monto,
          'DETALLE': r.detalle || ''
        }));
      } else if (activeTab === 'remisiones') {
        exportData = datosFiltrados.map(r => ({
          'REM': r.rem, 'FECHA': r.fecha, 'CLIENTE': r.cliente,
          'FACTURA': r.factura || '', 'OS': r.os || '',
          'RUBRO': r.rubro || '',
          'DETALLE': r.detalle || ''
        }));
      }
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, activeTab);
      XLSX.writeFile(wb, `${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      alert('Error al exportar: ' + err.message);
    }
  };

  // ---- EXPORT PDF ----
  const handleExportPDF = () => {
    setShowExportMenu(false);
    const totHTML = `<span><strong>Registros:</strong> ${datosFiltrados.length}</span>${totales.guaranies > 0 ? `<span><strong>₲:</strong> ₲${formatNumber(totales.guaranies)}</span>` : ''}${totales.dolares > 0 ? `<span><strong>USD:</strong> US$ ${formatNumber(totales.dolares, 'USD')}</span>` : ''}<span><strong>Total USD:</strong> US$ ${formatNumber(totales.totalUSD, 'USD')}</span>`;

    if (activeTab === 'facturas') {
      exportarPDF('Facturas', ['N° FAC', 'FECHA', 'CLIENTE', 'MODALIDAD', 'MONEDA', 'CONCEPTO', 'RUBRO', 'MONTO', 'ESTADO', 'OBS'],
        datosFiltrados.map(f => [
          { val: f.nro_factura }, { val: formatDate(f.fecha) }, { val: f.cliente },
          { val: f.modalidad }, { val: f.moneda }, { val: f.concepto || '' },
          { val: f.rubro || '' }, { val: f.monto ? formatNumber(f.monto, f.moneda) : '', cls: 'num' },
          { val: f.estado || '', cls: 'center' }, { val: f.observaciones || '' }
        ]), totHTML);
    } else if (activeTab === 'ordenes_servicio') {
      exportarPDF('Órdenes de Servicio', ['N° OS', 'FECHA', 'CLIENTE', 'MODALIDAD', 'MONEDA', 'CONCEPTO', 'RUBRO', 'MONTO', 'ESTADO', 'OBS'],
        datosFiltrados.map(o => [
          { val: o.nro_os }, { val: formatDate(o.fecha) }, { val: o.cliente },
          { val: o.modalidad }, { val: o.moneda }, { val: o.concepto || '' },
          { val: o.rubro || '' }, { val: o.monto ? formatNumber(o.monto, o.moneda) : '', cls: 'num' },
          { val: o.estado || '', cls: 'center' }, { val: o.observaciones || '' }
        ]), totHTML);
    } else if (activeTab === 'recibos') {
      exportarPDF('Recibos', ['N° RECIBO', 'TIPO', 'FECHA', 'CLIENTE', 'MONEDA', 'MONTO', 'DETALLE'],
        datosFiltrados.map(r => [
          { val: r.nro_recibo }, { val: r.tipo, cls: 'center' }, { val: formatDate(r.fecha) },
          { val: r.cliente }, { val: r.moneda }, { val: r.monto ? formatNumber(r.monto, r.moneda) : '', cls: 'num' },
          { val: r.detalle || '' }
        ]), totHTML);
    } else if (activeTab === 'remisiones') {
      exportarPDF('Remisiones', ['N° REM', 'FECHA', 'CLIENTE', 'FACTURA', 'OS', 'RUBRO', 'DETALLE'],
        datosFiltrados.map(r => [
          { val: r.rem }, { val: formatDate(r.fecha) }, { val: r.cliente },
          { val: r.factura || '—' }, { val: r.os || '—' },
          { val: r.rubro || '—' },
          { val: r.detalle || '' }
        ]), totHTML);
    }
  };

  // Cerrar export menu al click afuera
  useEffect(() => {
    const fn = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) setShowExportMenu(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  // ============================================
  // RENDER TABLA
  // ============================================
  const renderTabla = () => {
    if (loading) return (
      <div className="dc-empty">
        <RefreshCw size={28} className="dc-spin" style={{ color: '#567C8D' }} />
        <p>Cargando...</p>
      </div>
    );
    if (datosFiltrados.length === 0) return (
      <div className="dc-empty">
        <FileText size={32} style={{ color: '#C8D9E6' }} />
        <p>No hay registros</p>
      </div>
    );

    if (activeTab === 'facturas') return (
      <table className="dc-table">
        <thead><tr>
          <th className="no-sort dc-th-check">
            <input type="checkbox"
              checked={datosFiltrados.length > 0 && datosFiltrados.every(f => selectedIds.has(f.id))}
              onChange={e => {
                if (e.target.checked) setSelectedIds(new Set(datosFiltrados.map(f => f.id)));
                else setSelectedIds(new Set());
              }}
            />
          </th>
          <th onClick={() => handleSort('fecha')}>FECHA <SortIcon field="fecha" /></th>
          <th onClick={() => handleSort('cliente')}>CLIENTE <SortIcon field="cliente" /></th>
          <th onClick={() => handleSort('cat')} className="center">CAT <SortIcon field="cat" /></th>
          <th onClick={() => handleSort('nro_factura')}>N° FAC <SortIcon field="nro_factura" /></th>
          <th onClick={() => handleSort('nro_remision')}>REM N° <SortIcon field="nro_remision" /></th>
          <th onClick={() => handleSort('modalidad')}>COND <SortIcon field="modalidad" /></th>
          <th onClick={() => handleSort('monto')} className="num">TOT USD <SortIcon field="monto" /></th>
          <th onClick={() => handleSort('monto')} className="num">TOT GS <SortIcon field="monto" /></th>
          <th onClick={() => handleSort('rubro')}>RUBRO <SortIcon field="rubro" /></th>
          <th onClick={() => handleSort('estado')}>ESTADO <SortIcon field="estado" /></th>
          <th className="no-sort">RECIBO N°</th>
          <th className="no-sort" style={{ textAlign: 'center' }}>ACCIONES</th>
        </tr></thead>
        <tbody>
          {datosFiltrados.map(f => {
            const anulada = f.modalidad === 'Anulada' || f.estado === 'Anulada';
            const bonif = f.modalidad === 'Bonificación';
            return (
              <tr key={f.id} className={selectedIds.has(f.id) ? 'dc-row-selected' : ''}>
                <td className="dc-td-check">
                  <input type="checkbox" checked={selectedIds.has(f.id)}
                    onChange={e => {
                      const s = new Set(selectedIds);
                      e.target.checked ? s.add(f.id) : s.delete(f.id);
                      setSelectedIds(s);
                    }}
                  />
                </td>
                <td>{formatDate(f.fecha)}</td>
                <td>{f.cliente}</td>
                <td style={{ textAlign: 'center' }}><span className="dc-badge-cat">{f.cat || 'FAC'}</span></td>
                <td style={{ fontWeight: 700 }}>{f.nro_factura}</td>
                <td style={{ color: '#567C8D' }}>{f.nro_remision || <span className="muted">—</span>}</td>
                <td>
                  {anulada
                    ? <span className="muted">—</span>
                    : <span className={`dc-badge ${bonif ? 'bonificacion' : f.modalidad === 'Contado' ? 'contado' : 'credito'}`}>{f.modalidad}</span>
                  }
                </td>
                <td className="num">
                  {!anulada && !bonif && f.moneda === 'USD' && f.monto
                    ? <span className="dc-monto-usd">US$ {formatNumber(f.monto, 'USD')}</span>
                    : <span className="muted">—</span>}
                </td>
                <td className="num">
                  {!anulada && !bonif && f.moneda === '₲' && f.monto
                    ? <span className="dc-monto-gs">₲ {formatNumber(f.monto)}</span>
                    : <span className="muted">—</span>}
                </td>
                <td>{f.rubro || <span className="muted">-</span>}</td>
                <td><span className={`dc-badge ${estadoBadgeClass(f.estado)}`}>{f.estado}</span></td>
                <td style={{ fontSize: '0.75rem', color: '#567C8D' }}>
                  {(() => {
                    const vins = reciboDocumentos.filter(rd => rd.tipo_documento === 'factura' && rd.documento_id === f.id);
                    const nros = vins.map(v => recibos.find(r => r.id === v.recibo_id)?.nro_recibo).filter(Boolean);
                    return nros.length ? nros.join(', ') : <span className="muted">—</span>;
                  })()}
                </td>
                <td><div className="dc-table-actions">
                  <button className="dc-btn-icon" title="Ver" onClick={() => handleView(f)}><Eye size={14} /></button>
                  <button className="dc-btn-icon" title="Editar" onClick={() => handleEdit(f)}><Edit2 size={14} /></button>
                  <button className="dc-btn-icon danger" onClick={() => handleDelete(f.id)}><Trash2 size={14} /></button>
                </div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );

    if (activeTab === 'ordenes_servicio') return (
      <table className="dc-table">
        <thead><tr>
          <th className="no-sort dc-th-check">
            <input type="checkbox"
              checked={datosFiltrados.length > 0 && datosFiltrados.every(o => selectedIds.has(o.id))}
              onChange={e => {
                if (e.target.checked) setSelectedIds(new Set(datosFiltrados.map(o => o.id)));
                else setSelectedIds(new Set());
              }}
            />
          </th>
          <th onClick={() => handleSort('nro_os')}>N° OS <SortIcon field="nro_os" /></th>
          <th onClick={() => handleSort('fecha')}>FECHA <SortIcon field="fecha" /></th>
          <th onClick={() => handleSort('cliente')}>CLIENTE <SortIcon field="cliente" /></th>
          <th onClick={() => handleSort('modalidad')}>MODALIDAD <SortIcon field="modalidad" /></th>
          <th className="no-sort">MONEDA</th>
          <th onClick={() => handleSort('monto')}>MONTO <SortIcon field="monto" /></th>
          <th onClick={() => handleSort('rubro')}>RUBRO <SortIcon field="rubro" /></th>
          <th onClick={() => handleSort('estado')}>ESTADO <SortIcon field="estado" /></th>
          <th className="no-sort" style={{ textAlign: 'center' }}>ACCIONES</th>
        </tr></thead>
        <tbody>
          {datosFiltrados.map(o => (
            <tr key={o.id} className={selectedIds.has(o.id) ? 'dc-row-selected' : ''}>
              <td className="dc-td-check">
                <input type="checkbox" checked={selectedIds.has(o.id)}
                  onChange={e => {
                    const s = new Set(selectedIds);
                    e.target.checked ? s.add(o.id) : s.delete(o.id);
                    setSelectedIds(s);
                  }}
                />
              </td>
              <td style={{ fontWeight: 700 }}>{o.nro_os}</td>
              <td>{formatDate(o.fecha)}</td>
              <td>{o.cliente}</td>
              <td>{(o.modalidad === 'Anulada' || o.estado === 'Anulada') ? <span className="muted">—</span> : <span className={`dc-badge ${o.modalidad === 'Contado' ? 'contado' : o.modalidad === 'Bonificación' ? 'bonificacion' : 'credito'}`}>{o.modalidad}</span>}</td>
              <td>{(o.modalidad === 'Anulada' || o.estado === 'Anulada' || o.modalidad === 'Bonificación') ? <span className="muted">—</span> : <span className="dc-badge-moneda">{o.moneda}</span>}</td>
              <td className="num">{o.monto ? (o.moneda === 'USD' ? 'US$ ' : '₲') + formatNumber(o.monto, o.moneda) : ''}</td>
              <td>{o.rubro || <span className="muted">-</span>}</td>
              <td><span className={`dc-badge ${estadoBadgeClass(o.estado)}`}>{o.estado}</span></td>
              <td><div className="dc-table-actions">
                <button className="dc-btn-icon" title="Ver" onClick={() => handleView(o)}><Eye size={14} /></button>
                <button className="dc-btn-icon" title="Editar" onClick={() => handleEdit(o)}><Edit2 size={14} /></button>
                <button className="dc-btn-icon danger" onClick={() => handleDelete(o.id)}><Trash2 size={14} /></button>
              </div></td>
            </tr>
          ))}
        </tbody>
      </table>
    );

    if (activeTab === 'recibos') return (
      <table className="dc-table">
        <thead><tr>
          <th className="no-sort dc-th-check">
            <input type="checkbox"
              checked={datosFiltrados.length > 0 && datosFiltrados.every(r => selectedIds.has(r.id))}
              onChange={e => {
                if (e.target.checked) setSelectedIds(new Set(datosFiltrados.map(r => r.id)));
                else setSelectedIds(new Set());
              }}
            />
          </th>
          <th onClick={() => handleSort('nro_recibo')}>N° RECIBO <SortIcon field="nro_recibo" /></th>
          <th onClick={() => handleSort('tipo')}>TIPO <SortIcon field="tipo" /></th>
          <th onClick={() => handleSort('fecha')}>FECHA <SortIcon field="fecha" /></th>
          <th onClick={() => handleSort('cliente')}>CLIENTE <SortIcon field="cliente" /></th>
          <th className="no-sort">MONEDA</th>
          <th onClick={() => handleSort('monto')}>MONTO <SortIcon field="monto" /></th>
          <th className="no-sort">APLICA A</th>
          <th className="no-sort">DETALLE</th>
          <th className="no-sort" style={{ textAlign: 'center' }}>ACCIONES</th>
        </tr></thead>
        <tbody>
          {datosFiltrados.map(r => {
            const vins = reciboDocumentos.filter(rd => rd.recibo_id === r.id);
            const aplicaTexto = vins.map(v => {
              if (v.tipo_documento === 'factura') {
                const f = facturas.find(f => f.id === v.documento_id);
                return f ? `FAC ${f.nro_factura}` : '';
              } else {
                const o = ordenesServicio.find(o => o.id === v.documento_id);
                return o ? `OS ${o.nro_os}` : '';
              }
            }).filter(Boolean).join(', ');
            return (
              <tr key={r.id} className={selectedIds.has(r.id) ? 'dc-row-selected' : ''}>
                <td className="dc-td-check">
                  <input type="checkbox" checked={selectedIds.has(r.id)}
                    onChange={e => {
                      const s = new Set(selectedIds);
                      e.target.checked ? s.add(r.id) : s.delete(r.id);
                      setSelectedIds(s);
                    }}
                  />
                </td>
                <td style={{ fontWeight: 700 }}>{r.nro_recibo}</td>
                <td><span className={`dc-badge ${r.tipo === 'RO' ? 'ro' : 'rno'}`}>{r.tipo}</span></td>
                <td>{formatDate(r.fecha)}</td>
                <td>{r.cliente}</td>
                <td><span className="dc-badge-moneda">{r.moneda}</span></td>
                <td className="num">{r.monto ? (r.moneda === 'USD' ? 'US$ ' : '₲') + formatNumber(r.monto, r.moneda) : ''}</td>
                <td style={{ fontSize: '0.75rem', color: '#567C8D' }}>{aplicaTexto || <span className="muted">-</span>}</td>
                <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.detalle || <span className="muted">-</span>}</td>
                <td><div className="dc-table-actions">
                  <button className="dc-btn-icon" title="Ver" onClick={() => handleView(r)}><Eye size={14} /></button>
                  <button className="dc-btn-icon" title="Editar" onClick={() => handleEdit(r)}><Edit2 size={14} /></button>
                  <button className="dc-btn-icon danger" onClick={() => handleDelete(r.id)}><Trash2 size={14} /></button>
                </div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );

    if (activeTab === 'remisiones') return (
      <table className="dc-table">
        <thead><tr>
          <th className="no-sort dc-th-check">
            <input type="checkbox"
              checked={datosFiltrados.length > 0 && datosFiltrados.every(r => selectedIds.has(r.id))}
              onChange={e => {
                if (e.target.checked) setSelectedIds(new Set(datosFiltrados.map(r => r.id)));
                else setSelectedIds(new Set());
              }}
            />
          </th>
          <th onClick={() => handleSort('rem')}>N° REM <SortIcon field="rem" /></th>
          <th onClick={() => handleSort('fecha')}>FECHA <SortIcon field="fecha" /></th>
          <th onClick={() => handleSort('cliente')}>CLIENTE <SortIcon field="cliente" /></th>
          <th onClick={() => handleSort('factura')}>FACTURA <SortIcon field="factura" /></th>
          <th onClick={() => handleSort('os')}>OS <SortIcon field="os" /></th>
          <th onClick={() => handleSort('rubro')}>RUBRO <SortIcon field="rubro" /></th>
          <th onClick={() => handleSort('detalle')}>DETALLE <SortIcon field="detalle" /></th>
          <th className="no-sort" style={{ textAlign: 'center' }}>ACCIONES</th>
        </tr></thead>
        <tbody>
          {datosFiltrados.map(r => (
            <tr key={r.id} className={selectedIds.has(r.id) ? 'dc-row-selected' : ''}>
              <td className="dc-td-check">
                <input type="checkbox" checked={selectedIds.has(r.id)}
                  onChange={e => {
                    const s = new Set(selectedIds);
                    e.target.checked ? s.add(r.id) : s.delete(r.id);
                    setSelectedIds(s);
                  }}
                />
              </td>
              <td style={{ fontWeight: 700 }}>REM {r.rem}</td>
              <td>{formatDate(r.fecha)}</td>
              <td>{r.cliente}</td>
              <td>{r.factura || <span className="muted">—</span>}</td>
              <td>{r.os || <span className="muted">—</span>}</td>
              <td>{r.rubro || <span className="muted">—</span>}</td>
              <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.detalle || <span className="muted">—</span>}
              </td>
              <td><div className="dc-table-actions">
                <button className="dc-btn-icon" title="Ver" onClick={() => handleView(r)}><Eye size={14} /></button>
                <button className="dc-btn-icon" title="Editar" onClick={() => handleEdit(r)}><Edit2 size={14} /></button>
                <button className="dc-btn-icon danger" onClick={() => handleDelete(r.id)}><Trash2 size={14} /></button>
              </div></td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  // ============================================
  // RENDER FORM MODAL
  // ============================================
  const renderForm = () => {
    const isFacturaOS = activeTab === 'facturas' || activeTab === 'ordenes_servicio';
    const nroLabel = activeTab === 'facturas' ? 'N° Factura'
      : activeTab === 'ordenes_servicio' ? 'N° OS'
      : activeTab === 'recibos' ? 'N° Recibo'
      : 'N° REM';
    const nroField = activeTab === 'facturas' ? 'nro_factura'
      : activeTab === 'ordenes_servicio' ? 'nro_os'
      : activeTab === 'recibos' ? 'nro_recibo'
      : 'rem';

    return (
      <div className="dc-form-grid">
        <div className="dc-form-group">
          <label>{nroLabel} *</label>
          <input value={formData[nroField] || ''} onChange={e => setFormData({ ...formData, [nroField]: e.target.value })} placeholder={nroLabel} />
        </div>

        <div className="dc-form-group">
          <label>Fecha *</label>
          <input type="date" value={formData.fecha} onChange={e => setFormData({ ...formData, fecha: e.target.value })} />
        </div>

        <div className="dc-form-group span2">
          <label>Cliente *</label>
          <input value={formData.cliente} onChange={e => setFormData({ ...formData, cliente: e.target.value })} placeholder="Nombre del cliente" />
        </div>

        {activeTab === 'facturas' && (
          <div className="dc-form-group">
            <label>CAT</label>
            <select value={formData.cat || 'FAC'} onChange={e => setFormData({ ...formData, cat: e.target.value })}>
              {['FAC', 'FAE', 'T2'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        )}

        {isFacturaOS && (<>
          <div className="dc-form-group">
            <label>Modalidad</label>
            <select value={formData.modalidad} onChange={e => {
              const mod = e.target.value;
              setFormData({
                ...formData,
                modalidad: mod,
                estado: mod === 'Contado' ? 'Pagado' : mod === 'Anulada' ? 'Anulada' : mod === 'Bonificación' ? 'Bonificación' : 'Pendiente',
                monto: mod === 'Bonificación' ? '0' : formData.monto,
              });
            }}>
              {MODALIDADES.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>

          {formData.modalidad !== 'Anulada' && (
            <div className="dc-form-group">
              <label>Moneda</label>
              <select value={formData.moneda} onChange={e => setFormData({ ...formData, moneda: e.target.value })}>
                {MONEDAS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          )}

          <div className="dc-form-group span2">
            <label>Concepto</label>
            <input value={formData.concepto} onChange={e => setFormData({ ...formData, concepto: e.target.value })} placeholder="Descripción del documento" />
          </div>

          <div className="dc-form-group">
            <label>Rubro</label>
            <select value={formData.rubro} onChange={e => setFormData({ ...formData, rubro: e.target.value })}>
              <option value="">— Sin rubro —</option>
              {rubros.map(r => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
            </select>
          </div>

          {formData.modalidad !== 'Anulada' && formData.modalidad !== 'Bonificación' && (
            <div className="dc-form-group">
              <label>Monto</label>
              <input value={formData.monto} onChange={e => setFormData({ ...formData, monto: e.target.value })} placeholder="0" />
            </div>
          )}

          {formData.modalidad !== 'Contado' && formData.modalidad !== 'Bonificación' && (
            <div className="dc-form-group">
              <label>Estado</label>
              <select value={formData.estado} onChange={e => setFormData({ ...formData, estado: e.target.value })}>
                {ESTADOS_FAC_OS(formData.modalidad).map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          )}

          {activeTab === 'facturas' && (
            <div className="dc-form-group">
              <label>REM N°</label>
              <input value={formData.nro_remision || ''} onChange={e => setFormData({ ...formData, nro_remision: e.target.value })} placeholder="N° de remisión asociada" />
            </div>
          )}

          <div className="dc-form-group span2">
            <label>Observaciones</label>
            <input value={formData.observaciones || ''} onChange={e => setFormData({ ...formData, observaciones: e.target.value })} placeholder="Notas adicionales" />
          </div>
        </>)}

        {activeTab === 'recibos' && (<>
          <div className="dc-form-group">
            <label>Tipo</label>
            <select value={formData.tipo} onChange={e => setFormData({ ...formData, tipo: e.target.value })}>
              {TIPOS_RECIBO.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div className="dc-form-group">
            <label>Moneda</label>
            <select value={formData.moneda} onChange={e => setFormData({ ...formData, moneda: e.target.value })}>
              {MONEDAS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>

          <div className="dc-form-group">
            <label>Monto</label>
            <input value={formData.monto} onChange={e => setFormData({ ...formData, monto: e.target.value })} placeholder="0" />
          </div>

          <div className="dc-form-group span2">
            <label>Detalle</label>
            <input value={formData.detalle || ''} onChange={e => setFormData({ ...formData, detalle: e.target.value })} placeholder="Descripción del recibo" />
          </div>

          <div className="dc-form-group span2">
            <label>Aplica a (Facturas / OS)</label>
            {formData.vinculos.map((v, idx) => (
              <div key={idx} className="dc-vinculo-row">
                <select value={v.tipo_documento} onChange={e => {
                  const vins = [...formData.vinculos];
                  vins[idx] = { ...vins[idx], tipo_documento: e.target.value, documento_id: '', nro_doc: '' };
                  setFormData({ ...formData, vinculos: vins });
                }}>
                  <option value="factura">Factura</option>
                  <option value="orden_servicio">Orden de Servicio</option>
                </select>
                <select value={v.documento_id} onChange={e => {
                  const vins = [...formData.vinculos];
                  const selId = parseInt(e.target.value);
                  const nroDoc = v.tipo_documento === 'factura'
                    ? (facturas.find(f => f.id === selId)?.nro_factura || '')
                    : (ordenesServicio.find(o => o.id === selId)?.nro_os || '');
                  vins[idx] = { ...vins[idx], documento_id: selId, nro_doc: nroDoc };
                  setFormData({ ...formData, vinculos: vins });
                }}>
                  <option value="">— Seleccionar —</option>
                  {(v.tipo_documento === 'factura' ? facturas : ordenesServicio).map(doc => (
                    <option key={doc.id} value={doc.id}>
                      {v.tipo_documento === 'factura' ? doc.nro_factura : doc.nro_os} — {doc.cliente}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Monto aplicado"
                  value={v.monto_aplicado || ''}
                  onChange={e => {
                    const vins = [...formData.vinculos];
                    vins[idx] = { ...vins[idx], monto_aplicado: e.target.value };
                    setFormData({ ...formData, vinculos: vins });
                  }}
                />
                <button className="dc-btn-icon danger" onClick={() => {
                  const vins = formData.vinculos.filter((_, i) => i !== idx);
                  setFormData({ ...formData, vinculos: vins });
                }}><X size={13} /></button>
              </div>
            ))}
            <button className="dc-btn-add-vinculo" onClick={() => {
              setFormData({ ...formData, vinculos: [...formData.vinculos, { tipo_documento: 'factura', documento_id: '', nro_doc: '', monto_aplicado: '' }] });
            }}>
              <Link size={13} /> Agregar vínculo
            </button>
          </div>
        </>)}

        {activeTab === 'remisiones' && (<>
          <div className="dc-form-group">
            <label>Factura asociada</label>
            <input value={formData.factura || ''} onChange={e => setFormData({ ...formData, factura: e.target.value })} placeholder="N° de factura (o S/F)" />
          </div>

          <div className="dc-form-group">
            <label>OS asociada</label>
            <input value={formData.os || ''} onChange={e => setFormData({ ...formData, os: e.target.value })} placeholder="N° de OS (o S/O)" />
          </div>

          <div className="dc-form-group span2">
            <label>Rubro</label>
            <select value={formData.rubro || ''} onChange={e => setFormData({ ...formData, rubro: e.target.value })}>
              <option value="">— Sin rubro —</option>
              {rubros.map(r => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
            </select>
          </div>

          <div className="dc-form-group span2">
            <label>Detalle</label>
            <textarea
              value={formData.detalle || ''}
              onChange={e => setFormData({ ...formData, detalle: e.target.value })}
              placeholder="Descripción de los artículos remitidos"
              rows={3}
              style={{ resize: 'vertical' }}
            />
          </div>
        </>)}
      </div>
    );
  };

  // ============================================
  // RENDER VIEW MODAL
  // ============================================
  const renderViewModal = () => {
    if (!viewItem) return null;

    const fieldDefs = {
      facturas: [
        { key: 'fecha', label: 'Fecha' },
        { key: 'cliente', label: 'Cliente' },
        { key: 'cat', label: 'CAT' },
        { key: 'nro_factura', label: 'N° Factura' },
        { key: 'nro_remision', label: 'REM N°' },
        { key: 'modalidad', label: 'Condición' },
        { key: 'moneda', label: 'Moneda' },
        { key: 'monto', label: 'Monto' },
        { key: 'rubro', label: 'Rubro' },
        { key: 'estado', label: 'Estado' },
        { key: 'concepto', label: 'Concepto' },
        { key: 'observaciones', label: 'Observaciones' },
      ],
      ordenes_servicio: [
        { key: 'nro_os', label: 'N° Orden' },
        { key: 'fecha', label: 'Fecha' },
        { key: 'cliente', label: 'Cliente' },
        { key: 'modalidad', label: 'Modalidad' },
        { key: 'moneda', label: 'Moneda' },
        { key: 'monto', label: 'Monto' },
        { key: 'rubro', label: 'Rubro' },
        { key: 'estado', label: 'Estado' },
        { key: 'concepto', label: 'Concepto' },
        { key: 'observaciones', label: 'Observaciones' },
      ],
      recibos: [
        { key: 'nro_recibo', label: 'N° Recibo' },
        { key: 'fecha', label: 'Fecha' },
        { key: 'cliente', label: 'Cliente' },
        { key: 'tipo', label: 'Tipo' },
        { key: 'moneda', label: 'Moneda' },
        { key: 'monto', label: 'Monto' },
        { key: 'concepto', label: 'Concepto' },
        { key: 'observaciones', label: 'Observaciones' },
      ],
      remisiones: [
        { key: 'rem', label: 'N° REM' },
        { key: 'fecha', label: 'Fecha' },
        { key: 'cliente', label: 'Cliente' },
        { key: 'factura', label: 'Factura' },
        { key: 'os', label: 'Orden de Servicio' },
        { key: 'rubro', label: 'Rubro' },
        { key: 'detalle', label: 'Detalle' },
      ],
    };

    const fields = fieldDefs[activeTab] || [];

    return (
      <div className="dc-view-grid">
        {fields.map(({ key, label }) => {
          const val = viewItem[key];
          let displayVal;
          if (key === 'fecha') displayVal = formatDate(val);
          else if ((key === 'monto' || key === 'usd') && val) displayVal = formatNumber(val, 'USD');
          else if (key === 'gs' && val) displayVal = formatNumber(val, '₲');
          else if (val === null || val === undefined || val === '') displayVal = '—';
          else displayVal = String(val);
          return (
            <div key={key} className="dc-view-field">
              <span className="dc-view-label">{label}</span>
              <span className="dc-view-value">{displayVal}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // ============================================
  // RENDER PRINCIPAL
  // ============================================
  return (
    <div className="dc-container">
      <div className="dc-tabs">
        {[
          { key: 'facturas', label: 'Facturas' },
          { key: 'ordenes_servicio', label: 'Órd. Servicio' },
          { key: 'recibos', label: 'Recibos' },
          { key: 'remisiones', label: 'Remisiones' },
        ].map(t => (
          <button
            key={t.key}
            className={`dc-tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => handleTabChange(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="dc-toolbar">
        <div className="dc-search-wrap">
          <Search size={15} className="dc-search-icon" />
          <input
            className="dc-search"
            placeholder='Buscar... (use "comillas" para exacto)'
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="dc-filters">
          <input type="date" className="dc-filter-date" value={filterFechaDesde} onChange={e => setFilterFechaDesde(e.target.value)} title="Desde" />
          <input type="date" className="dc-filter-date" value={filterFechaHasta} onChange={e => setFilterFechaHasta(e.target.value)} title="Hasta" />

          {activeTab !== 'remisiones' && (
            <>
              <select className="dc-filter-select" value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
                <option value="todos">Todos los estados</option>
                {activeTab === 'recibos'
                  ? TIPOS_RECIBO.map(t => <option key={t} value={t}>{t}</option>)
                  : ['Pagado', 'Pendiente', 'Parcialmente cobrado', 'Anulada'].map(s => <option key={s} value={s}>{s}</option>)
                }
              </select>
              <select className="dc-filter-select" value={filterMoneda} onChange={e => setFilterMoneda(e.target.value)}>
                <option value="todas">Todas las monedas</option>
                {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </>
          )}
        </div>

        <div className="dc-actions">
          {selectedIds.size > 0 && (
            <button className="dc-btn danger" onClick={handleDeleteSelected}>
              <Trash2 size={14} /> Eliminar ({selectedIds.size})
            </button>
          )}
          <div className="dc-tc-wrap" title="Tipo de cambio USD/₲">
            <span className="dc-tc-label">TC:</span>
            <input
              className="dc-tc-input"
              type="number"
              value={tipoCambio}
              onChange={e => {
                setTipoCambio(e.target.value);
                localStorage.setItem('dc_tipoCambio', e.target.value);
              }}
            />
          </div>

          <button className="dc-btn secondary" onClick={() => importFileRef.current?.click()}>
            <Upload size={14} /> Importar
          </button>
          <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleImportFile} />

          <div className="dc-export-wrap" ref={exportMenuRef}>
            <button className="dc-btn secondary" onClick={() => setShowExportMenu(v => !v)}>
              <Download size={14} /> Exportar
            </button>
            {showExportMenu && (
              <div className="dc-export-menu">
                <button onClick={handleExportExcel}>Excel (.xlsx)</button>
                <button onClick={handleExportPDF}>PDF</button>
              </div>
            )}
          </div>

          <button className="dc-btn primary" onClick={handleNew}>
            <Plus size={14} /> Nuevo
          </button>

          <button className="dc-btn-icon" onClick={fetchAll} title="Actualizar">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {activeTab !== 'remisiones' && (
        <div className="dc-totales">
          <span>Registros: <strong>{datosFiltrados.length}</strong></span>
          {totales.guaranies > 0 && <span>TOT GS: <strong className="dc-monto-gs">₲ {formatNumber(totales.guaranies)}</strong></span>}
          {totales.dolares > 0 && <span>TOT USD: <strong className="dc-monto-usd">US$ {formatNumber(totales.dolares, 'USD')}</strong></span>}
          <span>Total USD equiv.: <strong>US$ {formatNumber(totales.totalUSD, 'USD')}</strong></span>
        </div>
      )}
      {activeTab === 'remisiones' && (
        <div className="dc-totales">
          <span>Registros: <strong>{datosFiltrados.length}</strong></span>
        </div>
      )}

      <div className="dc-table-wrap">
        {renderTabla()}
      </div>

      {showModal && (
        <div className="dc-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="dc-modal">
            <div className="dc-modal-header">
              <h3>{editingItem ? 'Editar' : 'Nuevo'} {activeTab === 'facturas' ? 'Factura' : activeTab === 'ordenes_servicio' ? 'Orden de Servicio' : activeTab === 'recibos' ? 'Recibo' : 'Remisión'}</h3>
              <button className="dc-btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="dc-modal-body">
              {renderForm()}
            </div>
            <div className="dc-modal-footer">
              <button className="dc-btn secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="dc-btn primary" onClick={handleSave} disabled={saving}>
                <Save size={14} /> {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showViewModal && viewItem && (
        <div className="dc-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowViewModal(false); }}>
          <div className="dc-modal">
            <div className="dc-modal-header">
              <h3>Detalle</h3>
              <button className="dc-btn-icon" onClick={() => setShowViewModal(false)}><X size={18} /></button>
            </div>
            <div className="dc-modal-body">
              {renderViewModal()}
            </div>
            <div className="dc-modal-footer">
              <button className="dc-btn secondary" onClick={() => setShowViewModal(false)}>Cerrar</button>
              <button className="dc-btn primary" onClick={() => { setShowViewModal(false); handleEdit(viewItem); }}>
                <Edit2 size={14} /> Editar
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="dc-modal-overlay">
          <div className="dc-modal dc-modal-import">
            <div className="dc-modal-header">
              <h3>Importar {activeTab}</h3>
              <button className="dc-btn-icon" onClick={() => setShowImportModal(false)}><X size={18} /></button>
            </div>
            <div className="dc-modal-body">
              {importStatus === 'preview' && (
                <>
                  <p className="dc-import-summary">
                    <strong>{importData.length}</strong> registros encontrados.
                    {importDuplicates.length > 0 && <span className="dc-import-warn"> {importDuplicates.length} duplicados detectados.</span>}
                  </p>

                  {importDuplicates.length > 0 && (
                    <div className="dc-import-dupes">
                      <label>¿Qué hacer con los duplicados?</label>
                      <select value={duplicateAction} onChange={e => setDuplicateAction(e.target.value)}>
                        <option value="skip">Ignorar (mantener existente)</option>
                        <option value="overwrite">Sobreescribir con nuevo</option>
                      </select>
                    </div>
                  )}

                  <div className="dc-import-preview">
                    <table className="dc-table" style={{ fontSize: '0.75rem' }}>
                      <thead><tr>
                        {Object.keys(importData[0] || {}).filter(k => !k.startsWith('_')).map(k => <th key={k}>{k}</th>)}
                      </tr></thead>
                      <tbody>
                        {importData.slice(0, 10).map((row, i) => (
                          <tr key={i} className={importDuplicates.some(d => d === row) ? 'dc-import-dupe-row' : ''}>
                            {Object.entries(row).filter(([k]) => !k.startsWith('_')).map(([k, v]) => (
                              <td key={k}>{v !== null && v !== undefined ? String(v) : '—'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importData.length > 10 && <p className="dc-import-more">... y {importData.length - 10} más</p>}
                  </div>
                </>
              )}

              {importStatus === 'importing' && (
                <div className="dc-empty">
                  <RefreshCw size={28} className="dc-spin" style={{ color: '#567C8D' }} />
                  <p>Importando...</p>
                </div>
              )}

              {importStatus === 'done' && importResults && (
                <div className="dc-import-results">
                  <div className="dc-import-result-row ok">✅ Insertados: <strong>{importResults.inserted}</strong></div>
                  {importResults.updated > 0 && <div className="dc-import-result-row ok">🔄 Actualizados: <strong>{importResults.updated}</strong></div>}
                  {importResults.skipped > 0 && <div className="dc-import-result-row warn">⏭ Ignorados: <strong>{importResults.skipped}</strong></div>}
                  {importResults.errors > 0 && (
                    <>
                      <div className="dc-import-result-row err">❌ Errores: <strong>{importResults.errors}</strong></div>
                      <div className="dc-import-error-list">
                        {importResults.errorDetails.map((e, i) => (
                          <div key={i} className="dc-import-error-item">• {e.nro}: {e.motivo}</div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="dc-modal-footer">
              <button className="dc-btn secondary" onClick={() => setShowImportModal(false)}>
                {importStatus === 'done' ? 'Cerrar' : 'Cancelar'}
              </button>
              {importStatus === 'preview' && (
                <button className="dc-btn primary" onClick={handleImportConfirm}>
                  <Upload size={14} /> Confirmar importación
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
