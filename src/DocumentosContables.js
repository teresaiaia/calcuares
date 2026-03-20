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
const RUBROS = [
  'Aldenor', 'Anulada', 'Aqua', 'Ares', 'Body Health', 'Candela',
  'Centenario', 'Classys', 'Cocoon', 'Daeyang', 'Dermlite', 'Ecleris',
  'Endymed', 'Fine', 'Forma-Tk', 'Fotona', 'Hydra', 'Insumos', 'Intermedic',
  'Laseroptek', 'Lumenis', 'Mascaras', 'MtoS', 'ServTec', 'Sothys',
  'Venus', 'Viora'
];

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
    cliente: '', modalidad: 'Contado', moneda: '₲',
    concepto: '', rubro: '', monto: '', estado: 'Pagado', observaciones: '',
    // recibos
    nro_recibo: '', tipo: 'RO', detalle: '',
    vinculos: [], // [{tipo_documento, documento_id, nro_doc, monto_aplicado}]
    // remisiones
    nro_remision: '', tipo_vinculo: '', vinculo_id: ''
  };
  const [formData, setFormData] = useState(formInit);

  // ---- FETCH ----
  useEffect(() => {
    fetchAll();

  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [fRes, osRes, rRes, remRes, rdRes] = await Promise.all([
        supabase.from('facturas').select('*').order('fecha', { ascending: false }),
        supabase.from('ordenes_servicio').select('*').order('fecha', { ascending: false }),
        supabase.from('recibos').select('*').order('fecha', { ascending: false }),
        supabase.from('remisiones').select('*').order('fecha', { ascending: false }),
        supabase.from('recibo_documentos').select('*'),
      ]);
      setFacturas(fRes.data || []);
      setOrdenesServicio(osRes.data || []);
      setRecibos(rRes.data || []);
      setRemisiones(remRes.data || []);
      setReciboDocumentos(rdRes.data || []);
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
        // Búsqueda exacta con comillas: algún campo debe ser exactamente igual
        const exact = exactMatch[1].toLowerCase();
        data = data.filter(item =>
          Object.values(item).some(v => v && String(v).toLowerCase() === exact)
        );
      } else {
        // Búsqueda multi-palabra: el registro debe contener TODAS las palabras
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

    // Sort
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
    // Setear estado por defecto según tab
    if (activeTab === 'facturas' || activeTab === 'ordenes_servicio') init.estado = 'Pagado';
    if (activeTab === 'recibos') init.tipo = activeTab === 'recibos' ? 'RO' : 'RNO';
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
          modalidad: formData.modalidad,
          moneda: formData.moneda,
          concepto: formData.concepto?.trim() || null,
          rubro: formData.rubro || null,
          monto: parseMonto(formData.monto, formData.moneda),
          estado: formData.modalidad === 'Contado' ? 'Pagado' : formData.estado,
          observaciones: formData.observaciones?.trim() || null,
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
        // Guardar vínculos
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
        if (!formData.nro_remision?.trim() || !formData.cliente?.trim()) {
          alert('N° de Remisión y Cliente son obligatorios');
          return;
        }
        const payload = {
          nro_remision: formData.nro_remision.trim(),
          fecha: formData.fecha,
          cliente: formData.cliente.trim(),
          concepto: formData.concepto?.trim() || null,
          tipo_vinculo: formData.tipo_vinculo || null,
          vinculo_id: formData.vinculo_id ? parseInt(formData.vinculo_id) : null,
          observaciones: formData.observaciones?.trim() || null,
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
          // REPO: NRO_FAC | FECHA | CLIENTE | MODALIDAD | MONEDA | CONCEPTO | RUBRO | MONTO | ESTADO | OBS
          record = {
            nro_factura: String(r[0] || '').trim(),
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
            _fact_nro: String(r[7] || '').trim() || null, // campo auxiliar para vínculo
          };
          if (!record.nro_recibo || !record.cliente) continue;
        } else if (activeTab === 'remisiones') {
          // NRO_REM | FECHA | CLIENTE | CONCEPTO | OBS
          record = {
            nro_remision: String(r[0] || '').trim(),
            fecha: parseExcelDate(r[1]),
            cliente: String(r[2] || '').trim(),
            concepto: String(r[3] || '').trim() || null,
            observaciones: String(r[4] || '').trim() || null,
            tipo_vinculo: null,
            vinculo_id: null,
          };
          if (!record.nro_remision || !record.cliente) continue;
        }
        parsed.push(record);
      }

      if (parsed.length === 0) { alert('No se encontraron registros válidos'); return; }

      // Detectar duplicados
      const nroField = activeTab === 'facturas' ? 'nro_factura'
        : activeTab === 'ordenes_servicio' ? 'nro_os'
        : activeTab === 'recibos' ? 'nro_recibo'
        : 'nro_remision';
      const existingSet = new Set(dataActiva.map(d => d[nroField]));
      const dupes = parsed.filter(p => existingSet.has(p[nroField]));

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
      : 'nro_remision';

    const existingMap = {};
    dataActiva.forEach(d => { existingMap[d[nroField]] = d.id; });

    // Mapa de facturas y OS por número para vincular recibos
    const facturasMap = {};
    facturas.forEach(f => { facturasMap[f.nro_factura] = f.id; });
    const osMap = {};
    ordenesServicio.forEach(o => { osMap[o.nro_os] = o.id; });

    let inserted = 0, updated = 0, skipped = 0, errors = 0;
    const errorDetails = [];

    for (const record of importData) {
      const isDupe = existingMap[record[nroField]];
      // Extraer campo auxiliar antes de insertar
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

        // Crear vínculo automático si hay FACT N°
        if (reciboId && factNro && activeTab === 'recibos') {
          // Buscar si es factura o OS
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
          'N° FAC': f.nro_factura, 'FECHA': f.fecha, 'CLIENTE': f.cliente,
          'MODALIDAD': f.modalidad, 'MONEDA': f.moneda, 'MONTO': f.monto,
          'CONCEPTO': f.concepto || '', 'RUBRO': f.rubro || '',
          'ESTADO': f.estado || '', 'OBS': f.observaciones || ''
        }));
      } else if (activeTab === 'ordenes_servicio') {
        exportData = datosFiltrados.map(o => ({
          'N° OS': o.nro_os, 'FECHA': o.fecha, 'CLIENTE': o.cliente,
          'MODALIDAD': o.modalidad, 'MONEDA': o.moneda, 'MONTO': o.monto,
          'CONCEPTO': o.concepto || '', 'RUBRO': o.rubro || '',
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
          'N° REMISION': r.nro_remision, 'FECHA': r.fecha, 'CLIENTE': r.cliente,
          'CONCEPTO': r.concepto || '', 'TIPO VINCULO': r.tipo_vinculo || '',
          'OBS': r.observaciones || ''
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
      exportarPDF('Facturas', ['N° FAC', 'FECHA', 'CLIENTE', 'MODALIDAD', 'MONEDA', 'MONTO', 'RUBRO', 'ESTADO'],
        datosFiltrados.map(f => [
          { val: f.nro_factura }, { val: formatDate(f.fecha) }, { val: f.cliente },
          { val: f.modalidad }, { val: f.moneda }, { val: f.monto ? formatNumber(f.monto, f.moneda) : '', cls: 'num' },
          { val: f.rubro || '' }, { val: f.estado || '', cls: 'center' }
        ]), totHTML);
    } else if (activeTab === 'ordenes_servicio') {
      exportarPDF('Órdenes de Servicio', ['N° OS', 'FECHA', 'CLIENTE', 'MODALIDAD', 'MONEDA', 'MONTO', 'RUBRO', 'ESTADO'],
        datosFiltrados.map(o => [
          { val: o.nro_os }, { val: formatDate(o.fecha) }, { val: o.cliente },
          { val: o.modalidad }, { val: o.moneda }, { val: o.monto ? formatNumber(o.monto, o.moneda) : '', cls: 'num' },
          { val: o.rubro || '' }, { val: o.estado || '', cls: 'center' }
        ]), totHTML);
    } else if (activeTab === 'recibos') {
      exportarPDF('Recibos', ['N° RECIBO', 'TIPO', 'FECHA', 'CLIENTE', 'MONEDA', 'MONTO', 'DETALLE'],
        datosFiltrados.map(r => [
          { val: r.nro_recibo }, { val: r.tipo, cls: 'center' }, { val: formatDate(r.fecha) },
          { val: r.cliente }, { val: r.moneda }, { val: r.monto ? formatNumber(r.monto, r.moneda) : '', cls: 'num' },
          { val: r.detalle || '' }
        ]), totHTML);
    } else if (activeTab === 'remisiones') {
      exportarPDF('Remisiones', ['N° REMISION', 'FECHA', 'CLIENTE', 'CONCEPTO', 'VÍNCULO'],
        datosFiltrados.map(r => [
          { val: r.nro_remision }, { val: formatDate(r.fecha) }, { val: r.cliente },
          { val: r.concepto || '' }, { val: r.tipo_vinculo || '-', cls: 'center' }
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
        <thead>
          <tr>
            <th onClick={() => handleSort('nro_factura')}>N° FAC <SortIcon field="nro_factura" /></th>
            <th onClick={() => handleSort('fecha')}>FECHA <SortIcon field="fecha" /></th>
            <th onClick={() => handleSort('cliente')}>CLIENTE <SortIcon field="cliente" /></th>
            <th onClick={() => handleSort('modalidad')}>MODALIDAD <SortIcon field="modalidad" /></th>
            <th className="no-sort">MONEDA</th>
            <th onClick={() => handleSort('monto')}>MONTO <SortIcon field="monto" /></th>
            <th onClick={() => handleSort('rubro')}>RUBRO <SortIcon field="rubro" /></th>
            <th onClick={() => handleSort('estado')}>ESTADO <SortIcon field="estado" /></th>
            <th className="no-sort" style={{ textAlign: 'center' }}>ACCIONES</th>
          </tr>
        </thead>
        <tbody>
          {datosFiltrados.map(f => (
            <tr key={f.id}>
              <td style={{ fontWeight: 700 }}>{f.nro_factura}</td>
              <td>{formatDate(f.fecha)}</td>
              <td>{f.cliente}</td>
              <td>{(f.modalidad === 'Anulada' || f.estado === 'Anulada') ? <span className="muted">—</span> : <span className={`dc-badge ${f.modalidad === 'Contado' ? 'contado' : f.modalidad === 'Bonificación' ? 'bonificacion' : 'credito'}`}>{f.modalidad}</span>}</td>
              <td>{(f.modalidad === 'Anulada' || f.estado === 'Anulada' || f.modalidad === 'Bonificación') ? <span className="muted">—</span> : <span className="dc-badge-moneda">{f.moneda}</span>}</td>
              <td className="num">{f.monto ? (f.moneda === 'USD' ? 'US$ ' : '₲') + formatNumber(f.monto, f.moneda) : ''}</td>
              <td>{f.rubro || <span className="muted">-</span>}</td>
              <td><span className={`dc-badge ${estadoBadgeClass(f.estado)}`}>{f.estado}</span></td>
              <td>
                <div className="dc-table-actions">
                  <button className="dc-btn-icon" title="Ver" onClick={() => handleView(f)}><Eye size={14} /></button>
                  <button className="dc-btn-icon" title="Editar" onClick={() => handleEdit(f)}><Edit2 size={14} /></button>
                  <button className="dc-btn-icon danger" onClick={() => handleDelete(f.id)}><Trash2 size={14} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );

    if (activeTab === 'ordenes_servicio') return (
      <table className="dc-table">
        <thead>
          <tr>
            <th onClick={() => handleSort('nro_os')}>N° OS <SortIcon field="nro_os" /></th>
            <th onClick={() => handleSort('fecha')}>FECHA <SortIcon field="fecha" /></th>
            <th onClick={() => handleSort('cliente')}>CLIENTE <SortIcon field="cliente" /></th>
            <th onClick={() => handleSort('modalidad')}>MODALIDAD <SortIcon field="modalidad" /></th>
            <th className="no-sort">MONEDA</th>
            <th onClick={() => handleSort('monto')}>MONTO <SortIcon field="monto" /></th>
            <th onClick={() => handleSort('rubro')}>RUBRO <SortIcon field="rubro" /></th>
            <th onClick={() => handleSort('estado')}>ESTADO <SortIcon field="estado" /></th>
            <th className="no-sort" style={{ textAlign: 'center' }}>ACCIONES</th>
          </tr>
        </thead>
        <tbody>
          {datosFiltrados.map(o => (
            <tr key={o.id}>
              <td style={{ fontWeight: 700 }}>{o.nro_os}</td>
              <td>{formatDate(o.fecha)}</td>
              <td>{o.cliente}</td>
              <td>{(o.modalidad === 'Anulada' || o.estado === 'Anulada') ? <span className="muted">—</span> : <span className={`dc-badge ${o.modalidad === 'Contado' ? 'contado' : o.modalidad === 'Bonificación' ? 'bonificacion' : 'credito'}`}>{o.modalidad}</span>}</td>
              <td>{(o.modalidad === 'Anulada' || o.estado === 'Anulada' || o.modalidad === 'Bonificación') ? <span className="muted">—</span> : <span className="dc-badge-moneda">{o.moneda}</span>}</td>
              <td className="num">{o.monto ? (o.moneda === 'USD' ? 'US$ ' : '₲') + formatNumber(o.monto, o.moneda) : ''}</td>
              <td>{o.rubro || <span className="muted">-</span>}</td>
              <td><span className={`dc-badge ${estadoBadgeClass(o.estado)}`}>{o.estado}</span></td>
              <td>
                <div className="dc-table-actions">
                  <button className="dc-btn-icon" title="Ver" onClick={() => handleView(o)}><Eye size={14} /></button>
                  <button className="dc-btn-icon" title="Editar" onClick={() => handleEdit(o)}><Edit2 size={14} /></button>
                  <button className="dc-btn-icon danger" onClick={() => handleDelete(o.id)}><Trash2 size={14} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );

    if (activeTab === 'recibos') return (
      <table className="dc-table">
        <thead>
          <tr>
            <th onClick={() => handleSort('nro_recibo')}>N° RECIBO <SortIcon field="nro_recibo" /></th>
            <th onClick={() => handleSort('tipo')}>TIPO <SortIcon field="tipo" /></th>
            <th onClick={() => handleSort('fecha')}>FECHA <SortIcon field="fecha" /></th>
            <th onClick={() => handleSort('cliente')}>CLIENTE <SortIcon field="cliente" /></th>
            <th className="no-sort">MONEDA</th>
            <th onClick={() => handleSort('monto')}>MONTO <SortIcon field="monto" /></th>
            <th className="no-sort">APLICA A</th>
            <th className="no-sort">DETALLE</th>
            <th className="no-sort" style={{ textAlign: 'center' }}>ACCIONES</th>
          </tr>
        </thead>
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
              <tr key={r.id}>
                <td style={{ fontWeight: 700 }}>{r.nro_recibo}</td>
                <td><span className={`dc-badge ${r.tipo === 'RO' ? 'ro' : 'rno'}`}>{r.tipo}</span></td>
                <td>{formatDate(r.fecha)}</td>
                <td>{r.cliente}</td>
                <td><span className="dc-badge-moneda">{r.moneda}</span></td>
                <td className="num">{r.monto ? (r.moneda === 'USD' ? 'US$ ' : '₲') + formatNumber(r.monto, r.moneda) : ''}</td>
                <td style={{ fontSize: '0.75rem', color: '#567C8D' }}>{aplicaTexto || <span className="muted">-</span>}</td>
                <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.detalle || <span className="muted">-</span>}</td>
                <td>
                  <div className="dc-table-actions">
                    <button className="dc-btn-icon" title="Ver" onClick={() => handleView(r)}><Eye size={14} /></button>
                    <button className="dc-btn-icon" title="Editar" onClick={() => handleEdit(r)}><Edit2 size={14} /></button>
                    <button className="dc-btn-icon danger" onClick={() => handleDelete(r.id)}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );

    if (activeTab === 'remisiones') return (
      <table className="dc-table">
        <thead>
          <tr>
            <th onClick={() => handleSort('nro_remision')}>N° REMISION <SortIcon field="nro_remision" /></th>
            <th onClick={() => handleSort('fecha')}>FECHA <SortIcon field="fecha" /></th>
            <th onClick={() => handleSort('cliente')}>CLIENTE <SortIcon field="cliente" /></th>
            <th className="no-sort">CONCEPTO</th>
            <th className="no-sort">VÍNCULO</th>
            <th className="no-sort" style={{ textAlign: 'center' }}>ACCIONES</th>
          </tr>
        </thead>
        <tbody>
          {datosFiltrados.map(r => {
            let vinculoTexto = '-';
            if (r.tipo_vinculo === 'factura' && r.vinculo_id) {
              const f = facturas.find(f => f.id === r.vinculo_id);
              vinculoTexto = f ? `FAC ${f.nro_factura}` : `FAC #${r.vinculo_id}`;
            } else if (r.tipo_vinculo === 'orden_servicio' && r.vinculo_id) {
              const o = ordenesServicio.find(o => o.id === r.vinculo_id);
              vinculoTexto = o ? `OS ${o.nro_os}` : `OS #${r.vinculo_id}`;
            }
            return (
              <tr key={r.id}>
                <td style={{ fontWeight: 700 }}>{r.nro_remision}</td>
                <td>{formatDate(r.fecha)}</td>
                <td>{r.cliente}</td>
                <td>{r.concepto || <span className="muted">-</span>}</td>
                <td style={{ fontSize: '0.75rem', color: '#567C8D' }}>{vinculoTexto}</td>
                <td>
                  <div className="dc-table-actions">
                    <button className="dc-btn-icon" title="Ver" onClick={() => handleView(r)}><Eye size={14} /></button>
                    <button className="dc-btn-icon" title="Editar" onClick={() => handleEdit(r)}><Edit2 size={14} /></button>
                    <button className="dc-btn-icon danger" onClick={() => handleDelete(r.id)}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  // ============================================
  // RENDER FORM MODAL
  // ============================================
  const renderForm = () => {
    const isFacturaOS = activeTab === 'facturas' || activeTab === 'ordenes_servicio';
    const nroLabel = activeTab === 'facturas' ? 'N° Factura' : activeTab === 'ordenes_servicio' ? 'N° OS' : activeTab === 'recibos' ? 'N° Recibo' : 'N° Remisión';
    const nroField = activeTab === 'facturas' ? 'nro_factura' : activeTab === 'ordenes_servicio' ? 'nro_os' : activeTab === 'recibos' ? 'nro_recibo' : 'nro_remision';

    return (
      <div className="dc-form-grid">
        {/* N° documento */}
        <div className="dc-form-group">
          <label>{nroLabel} *</label>
          <input value={formData[nroField] || ''} onChange={e => setFormData({ ...formData, [nroField]: e.target.value })} placeholder={nroLabel} />
        </div>

        {/* Fecha */}
        <div className="dc-form-group">
          <label>Fecha *</label>
          <input type="date" value={formData.fecha} onChange={e => setFormData({ ...formData, fecha: e.target.value })} />
        </div>

        {/* Cliente */}
        <div className="dc-form-group span2">
          <label>Cliente *</label>
          <input value={formData.cliente} onChange={e => setFormData({ ...formData, cliente: e.target.value })} placeholder="Nombre del cliente" />
        </div>

        {/* Campos específicos Factura / OS */}
        {isFacturaOS && (
          <>
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
                <option value="Anulada">Anulada</option>
                {RUBROS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="dc-form-group">
              <label>Monto</label>
              <input value={formData.monto} onChange={e => setFormData({ ...formData, monto: e.target.value })} placeholder="0" />
            </div>

            {(formData.modalidad === 'Crédito' || formData.modalidad === 'Anulada') && (
              <div className="dc-form-group">
                <label>Estado</label>
                <select value={formData.estado} onChange={e => setFormData({ ...formData, estado: e.target.value })}>
                  {ESTADOS_FAC_OS(formData.modalidad).map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            )}

            <div className="dc-form-group span2">
              <label>Observaciones</label>
              <textarea value={formData.observaciones} onChange={e => setFormData({ ...formData, observaciones: e.target.value })} placeholder="Opcional" />
            </div>
          </>
        )}

        {/* Campos específicos Recibos */}
        {activeTab === 'recibos' && (
          <>
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

            <div className="dc-form-group span2">
              <label>Monto</label>
              <input value={formData.monto} onChange={e => setFormData({ ...formData, monto: e.target.value })} placeholder="0" />
            </div>

            <div className="dc-form-group span2">
              <label>Detalle / Observaciones</label>
              <textarea value={formData.detalle} onChange={e => setFormData({ ...formData, detalle: e.target.value })} placeholder="Opcional" />
            </div>

            {/* Vínculos */}
            <div className="dc-form-group span2">
              <label>Aplica a (Facturas / OS)</label>
              <div className="dc-vinculo-list">
                {(formData.vinculos || []).map((v, i) => (
                  <div key={i} className="dc-vinculo-item">
                    <select value={v.tipo_documento} onChange={e => {
                      const vins = [...formData.vinculos];
                      vins[i] = { ...vins[i], tipo_documento: e.target.value, documento_id: '' };
                      setFormData({ ...formData, vinculos: vins });
                    }}>
                      <option value="factura">Factura</option>
                      <option value="orden_servicio">OS</option>
                    </select>
                    <select value={v.documento_id || ''} onChange={e => {
                      const vins = [...formData.vinculos];
                      vins[i] = { ...vins[i], documento_id: e.target.value };
                      setFormData({ ...formData, vinculos: vins });
                    }}>
                      <option value="">— Seleccionar —</option>
                      {(v.tipo_documento === 'factura' ? facturas : ordenesServicio).map(d => (
                        <option key={d.id} value={d.id}>
                          {v.tipo_documento === 'factura' ? d.nro_factura : d.nro_os} — {d.cliente}
                        </option>
                      ))}
                    </select>
                    <input
                      placeholder="Monto aplicado"
                      value={v.monto_aplicado || ''}
                      onChange={e => {
                        const vins = [...formData.vinculos];
                        vins[i] = { ...vins[i], monto_aplicado: e.target.value };
                        setFormData({ ...formData, vinculos: vins });
                      }}
                    />
                    <button className="dc-btn-icon danger" onClick={() => {
                      const vins = formData.vinculos.filter((_, j) => j !== i);
                      setFormData({ ...formData, vinculos: vins });
                    }}><X size={13} /></button>
                  </div>
                ))}
                <button className="dc-btn-secondary" style={{ fontSize: '0.78rem', padding: '0.3rem 0.8rem' }}
                  onClick={() => setFormData({ ...formData, vinculos: [...(formData.vinculos || []), { tipo_documento: 'factura', documento_id: '', monto_aplicado: '' }] })}>
                  <Link size={13} /> Agregar vínculo
                </button>
              </div>
            </div>
          </>
        )}

        {/* Campos específicos Remisiones */}
        {activeTab === 'remisiones' && (
          <>
            <div className="dc-form-group span2">
              <label>Concepto</label>
              <input value={formData.concepto} onChange={e => setFormData({ ...formData, concepto: e.target.value })} placeholder="Descripción de la remisión" />
            </div>

            <div className="dc-form-group">
              <label>Vínculo (opcional)</label>
              <select value={formData.tipo_vinculo || ''} onChange={e => setFormData({ ...formData, tipo_vinculo: e.target.value, vinculo_id: '' })}>
                <option value="">— Sin vínculo —</option>
                <option value="factura">Factura</option>
                <option value="orden_servicio">Orden de Servicio</option>
              </select>
            </div>

            {formData.tipo_vinculo && (
              <div className="dc-form-group">
                <label>{formData.tipo_vinculo === 'factura' ? 'Factura' : 'OS'}</label>
                <select value={formData.vinculo_id || ''} onChange={e => setFormData({ ...formData, vinculo_id: e.target.value })}>
                  <option value="">— Seleccionar —</option>
                  {(formData.tipo_vinculo === 'factura' ? facturas : ordenesServicio).map(d => (
                    <option key={d.id} value={d.id}>
                      {formData.tipo_vinculo === 'factura' ? d.nro_factura : d.nro_os} — {d.cliente}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="dc-form-group span2">
              <label>Observaciones</label>
              <textarea value={formData.observaciones} onChange={e => setFormData({ ...formData, observaciones: e.target.value })} placeholder="Opcional" />
            </div>
          </>
        )}
      </div>
    );
  };

  const tabLabels = {
    facturas: 'Facturas',
    ordenes_servicio: 'Órdenes de Servicio',
    recibos: 'Recibos',
    remisiones: 'Remisiones',
  };

  const modalTitle = editingItem
    ? `Editar ${tabLabels[activeTab].slice(0, -1) || tabLabels[activeTab]}`
    : `Nuevo/a ${tabLabels[activeTab].slice(0, -1) || tabLabels[activeTab]}`;

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="dc-container">
      {/* Header */}
      <div className="dc-header">
        <h2>📂 Documentos Contables</h2>
        <div className="dc-header-actions">
          <button className="dc-btn-secondary" onClick={() => fetchAll()}>
            <RefreshCw size={14} className={loading ? 'dc-spin' : ''} /> Actualizar
          </button>
          <button className="dc-btn-secondary" onClick={() => importFileRef.current?.click()}>
            <Upload size={14} /> Importar
          </button>
          <input ref={importFileRef} type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={handleImportFile} />

          <div className="dc-export-wrapper" ref={exportMenuRef}>
            <button className="dc-btn-secondary" onClick={() => setShowExportMenu(v => !v)}>
              <Download size={14} /> Exportar <ChevronDown size={12} />
            </button>
            {showExportMenu && (
              <div className="dc-export-menu">
                <button onClick={handleExportExcel}><FileText size={14} /> Exportar a Excel</button>
                <button onClick={handleExportPDF}><Download size={14} /> Exportar a PDF</button>
              </div>
            )}
          </div>

          <button className="dc-btn-primary" onClick={handleNew}>
            <Plus size={14} /> Nuevo
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="dc-tabs">
        {Object.entries(tabLabels).map(([key, label]) => (
          <button key={key} className={`dc-tab${activeTab === key ? ' active' : ''}`} onClick={() => handleTabChange(key)}>
            {label}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="dc-filters">
        <div className="dc-search-box">
          <Search size={14} style={{ color: '#9ca3af', flexShrink: 0 }} />
          <input placeholder='Buscar... varias palabras o "exacto"' value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>

        {activeTab !== 'remisiones' && (
          <>
            <select className="dc-filter-select" value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
              <option value="todos">Todos los estados</option>
              {activeTab === 'recibos'
                ? TIPOS_RECIBO.map(t => <option key={t}>{t}</option>)
                : [...ESTADOS_FAC_OS('Contado'), ...ESTADOS_FAC_OS('Crédito'), 'Anulada'].filter((v, i, a) => a.indexOf(v) === i).map(s => <option key={s}>{s}</option>)
              }
            </select>
            <select className="dc-filter-select" value={filterMoneda} onChange={e => setFilterMoneda(e.target.value)}>
              <option value="todas">Todas las monedas</option>
              {MONEDAS.map(m => <option key={m}>{m}</option>)}
            </select>
          </>
        )}

        <input type="date" className="dc-filter-date" value={filterFechaDesde} onChange={e => setFilterFechaDesde(e.target.value)} title="Desde" />
        <input type="date" className="dc-filter-date" value={filterFechaHasta} onChange={e => setFilterFechaHasta(e.target.value)} title="Hasta" />
        {(searchTerm || filterEstado !== 'todos' || filterMoneda !== 'todas' || filterFechaDesde || filterFechaHasta) && (
          <button className="dc-btn-icon" onClick={() => { setSearchTerm(''); setFilterEstado('todos'); setFilterMoneda('todas'); setFilterFechaDesde(''); setFilterFechaHasta(''); }} title="Limpiar filtros">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Tipo de cambio + Totales */}
      {activeTab !== 'remisiones' && datosFiltrados.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {/* Tipo de cambio */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', border: '1px solid #dde6ee', borderRadius: '9px', padding: '0.45rem 0.85rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#567C8D' }}>TC ₲/US$</span>
            <input
              type="number"
              value={tipoCambio}
              onChange={e => {
                setTipoCambio(e.target.value);
                localStorage.setItem('dc_tipoCambio', e.target.value);
              }}
              style={{ width: '90px', border: '1px solid #C8D9E6', borderRadius: '6px', padding: '0.2rem 0.5rem', fontSize: '0.85rem', color: '#2F4156', outline: 'none', fontWeight: 600 }}
            />
          </div>
          {/* Totales */}
          <div className="dc-total-card">Registros: <span>{datosFiltrados.length}</span></div>
          {totales.guaranies > 0 && (
            <div className="dc-total-card">₲: <span>₲{formatNumber(totales.guaranies)}</span></div>
          )}
          {totales.dolares > 0 && (
            <div className="dc-total-card">USD: <span>US$ {formatNumber(totales.dolares, 'USD')}</span></div>
          )}
          <div className="dc-total-card" style={{ borderLeft: '3px solid #567C8D', fontWeight: 700 }}>
            Total USD: <span>US$ {formatNumber(totales.totalUSD, 'USD')}</span>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="dc-table-wrapper">
        {renderTabla()}
      </div>

      {/* Modal de vista (solo lectura) */}
      {showViewModal && viewItem && (
        <div className="dc-modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="dc-modal" onClick={e => e.stopPropagation()}>
            <div className="dc-modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Eye size={16} style={{ color: '#567C8D' }} />
                {activeTab === 'facturas' ? `Factura ${viewItem.nro_factura}`
                  : activeTab === 'ordenes_servicio' ? `OS ${viewItem.nro_os}`
                  : activeTab === 'recibos' ? `Recibo ${viewItem.nro_recibo}`
                  : `Remisión ${viewItem.nro_remision}`}
              </h3>
              <button className="dc-modal-close" onClick={() => setShowViewModal(false)}><X size={18} /></button>
            </div>
            <div className="dc-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.5rem' }}>
                {[
                  activeTab === 'facturas' && { label: 'N° Factura', value: viewItem.nro_factura },
                  activeTab === 'ordenes_servicio' && { label: 'N° OS', value: viewItem.nro_os },
                  activeTab === 'recibos' && { label: 'N° Recibo', value: viewItem.nro_recibo },
                  activeTab === 'remisiones' && { label: 'N° Remisión', value: viewItem.nro_remision },
                  { label: 'Fecha', value: formatDate(viewItem.fecha) },
                  { label: 'Cliente', value: viewItem.cliente, span: true },
                  viewItem.modalidad && viewItem.modalidad !== 'Anulada' && { label: 'Modalidad', value: viewItem.modalidad },
                  viewItem.moneda && viewItem.modalidad !== 'Anulada' && { label: 'Moneda', value: viewItem.moneda },
                  viewItem.monto !== undefined && viewItem.monto !== null && {
                    label: 'Monto',
                    value: (viewItem.moneda === 'USD' ? 'US$ ' : '₲') + formatNumber(viewItem.monto, viewItem.moneda)
                  },
                  viewItem.estado && { label: 'Estado', value: viewItem.estado },
                  viewItem.rubro && { label: 'Rubro', value: viewItem.rubro },
                  viewItem.tipo && { label: 'Tipo', value: viewItem.tipo },
                  viewItem.concepto && { label: 'Concepto', value: viewItem.concepto, span: true },
                  viewItem.detalle && { label: 'Detalle', value: viewItem.detalle, span: true },
                  viewItem.tipo_vinculo && { label: 'Vínculo', value: viewItem.tipo_vinculo === 'factura'
                    ? `Factura: ${facturas.find(f => f.id === viewItem.vinculo_id)?.nro_factura || '-'}`
                    : `OS: ${ordenesServicio.find(o => o.id === viewItem.vinculo_id)?.nro_os || '-'}` },
                  viewItem.observaciones && { label: 'Observaciones', value: viewItem.observaciones, span: true },
                ].filter(Boolean).map((field, i) => (
                  <div key={i} style={{ gridColumn: field.span ? '1 / -1' : 'auto' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#567C8D', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '3px' }}>
                      {field.label}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#2F4156', background: '#f5f8fb', borderRadius: '7px', padding: '0.45rem 0.75rem', border: '1px solid #e0e8f0' }}>
                      {field.value || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>—</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Recibos vinculados — solo para facturas y OS */}
              {(activeTab === 'facturas' || activeTab === 'ordenes_servicio') && (() => {
                const recibosVinculados = reciboDocumentos
                  .filter(rd => rd.documento_id === viewItem.id && rd.tipo_documento === (activeTab === 'facturas' ? 'factura' : 'orden_servicio'))
                  .map(rd => {
                    const recibo = recibos.find(r => r.id === rd.recibo_id);
                    return recibo ? { ...recibo, monto_aplicado: rd.monto_aplicado } : null;
                  })
                  .filter(Boolean);

                if (recibosVinculados.length === 0) return null;

                const totalCobrado = recibosVinculados.reduce((acc, r) => acc + (parseFloat(r.monto_aplicado) || parseFloat(r.monto) || 0), 0);

                return (
                  <div style={{ marginTop: '1.2rem', borderTop: '2px solid #e8eef3', paddingTop: '1rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#567C8D', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.6rem' }}>
                      Recibos asociados ({recibosVinculados.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {recibosVinculados.map((r, i) => (
                        <div key={i} style={{
                          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto',
                          gap: '0.5rem', alignItems: 'center',
                          background: '#f5f8fb', borderRadius: '7px',
                          padding: '0.45rem 0.75rem', border: '1px solid #e0e8f0',
                          fontSize: '0.83rem', color: '#2F4156'
                        }}>
                          <span style={{ fontWeight: 700 }}>{r.tipo === 'RO' ? '🟣' : '🔴'} {r.nro_recibo}</span>
                          <span>{formatDate(r.fecha)}</span>
                          <span style={{ fontWeight: 600, textAlign: 'right' }}>
                            {r.moneda === 'USD' ? 'US$ ' : '₲'}{formatNumber(r.monto_aplicado || r.monto, r.moneda)}
                          </span>
                          <span className={`dc-badge ${r.tipo === 'RO' ? 'ro' : 'rno'}`}>{r.tipo}</span>
                        </div>
                      ))}
                      <div style={{
                        display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
                        gap: '0.5rem', padding: '0.4rem 0.75rem',
                        fontSize: '0.83rem', fontWeight: 700, color: '#2F4156'
                      }}>
                        <span style={{ color: '#567C8D', fontWeight: 400 }}>Total cobrado:</span>
                        {recibosVinculados[0]?.moneda === 'USD' ? 'US$ ' : '₲'}{formatNumber(totalCobrado, recibosVinculados[0]?.moneda)}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="dc-modal-footer">
              <button className="dc-btn-save" onClick={() => setShowViewModal(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nuevo/editar */}
      {showModal && (
        <div className="dc-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="dc-modal" onClick={e => e.stopPropagation()}>
            <div className="dc-modal-header">
              <h3>{modalTitle}</h3>
              <button className="dc-modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="dc-modal-body">{renderForm()}</div>
            <div className="dc-modal-footer">
              <button className="dc-btn-cancel" onClick={() => setShowModal(false)}><X size={14} /> Cancelar</button>
              <button className="dc-btn-save" onClick={handleSave} disabled={saving}>
                {saving ? <RefreshCw size={14} className="dc-spin" /> : <Save size={14} />} Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal importación */}
      {showImportModal && (
        <div className="dc-modal-overlay" onClick={() => { if (importStatus !== 'importing') { setShowImportModal(false); setImportStatus(''); } }}>
          <div className="dc-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 680 }}>
            <div className="dc-modal-header">
              <h3>📥 Importar {tabLabels[activeTab]}</h3>
              <button className="dc-modal-close" onClick={() => { setShowImportModal(false); setImportStatus(''); }}><X size={18} /></button>
            </div>
            <div className="dc-modal-body">
              {importStatus === 'preview' && (
                <>
                  <div style={{ background: '#f0f7ff', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.83rem' }}>
                    <strong>📊 {importData.length} registros encontrados</strong>
                    {importDuplicates.length > 0 && <span style={{ color: '#d97706', display: 'block', marginTop: 3 }}>⚠️ {importDuplicates.length} duplicados detectados</span>}
                  </div>
                  <div className="dc-import-preview">
                    <table className="dc-table" style={{ fontSize: '0.75rem' }}>
                      <thead><tr>
                        <th style={{ padding: '5px 8px' }}>N°</th>
                        <th style={{ padding: '5px 8px' }}>FECHA</th>
                        <th style={{ padding: '5px 8px' }}>CLIENTE</th>
                        {activeTab !== 'remisiones' && <th style={{ padding: '5px 8px' }}>MONTO</th>}
                        <th style={{ padding: '5px 8px' }}>ESTADO</th>
                      </tr></thead>
                      <tbody>
                        {importData.slice(0, 50).map((r, i) => {
                          const nro = r.nro_factura || r.nro_os || r.nro_recibo || r.nro_remision;
                          const isDupe = importDuplicates.some(d => (d.nro_factura || d.nro_os || d.nro_recibo || d.nro_remision) === nro);
                          return (
                            <tr key={i} style={{ background: isDupe ? '#fef3c7' : 'transparent' }}>
                              <td style={{ padding: '4px 8px', fontWeight: 700 }}>{nro}</td>
                              <td style={{ padding: '4px 8px' }}>{r.fecha || '-'}</td>
                              <td style={{ padding: '4px 8px' }}>{r.cliente}</td>
                              {activeTab !== 'remisiones' && <td style={{ padding: '4px 8px', textAlign: 'right' }}>{r.monto ? formatNumber(r.monto, r.moneda) : '-'}</td>}
                              <td style={{ padding: '4px 8px' }}>{isDupe ? <span style={{ color: '#d97706', fontWeight: 700 }}>⚠ DUP</span> : '✓ Nuevo'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {importDuplicates.length > 0 && (
                    <div style={{ background: '#fffbeb', padding: '10px 14px', borderRadius: 8, marginBottom: 12 }}>
                      <strong style={{ color: '#92400e', fontSize: '0.83rem' }}>¿Qué hacer con los duplicados?</strong>
                      <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                        {['skip', 'overwrite'].map(opt => (
                          <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: '0.82rem' }}>
                            <input type="radio" name="dupeAct" value={opt} checked={duplicateAction === opt} onChange={() => setDuplicateAction(opt)} />
                            {opt === 'skip' ? 'Saltar duplicados' : 'Sobreescribir'}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ background: '#f8f8f8', padding: '8px 12px', borderRadius: 8, fontSize: '0.76rem', color: '#6b7280' }}>
                    <strong>Orden de columnas ({tabLabels[activeTab]}):</strong>{' '}
                    {activeTab === 'facturas' && 'N° FAC | FECHA | CLIENTE | MODALIDAD | MONEDA | CONCEPTO | RUBRO | MONTO | ESTADO | OBS'}
                    {activeTab === 'ordenes_servicio' && 'N° OS | FECHA | CLIENTE | MODALIDAD | MONEDA | CONCEPTO | RUBRO | MONTO | ESTADO | OBS'}
                    {activeTab === 'recibos' && 'N° RECIBO | TIPO | FECHA | CLIENTE | MONEDA | MONTO | DETALLE | FACT N°'}
                    {activeTab === 'remisiones' && 'N° REMISION | FECHA | CLIENTE | CONCEPTO | OBS'}
                  </div>
                </>
              )}
              {importStatus === 'importing' && (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <RefreshCw size={30} className="dc-spin" style={{ color: '#567C8D', marginBottom: 12 }} />
                  <p style={{ fontSize: '0.9rem' }}>Importando {importData.length} registros...</p>
                </div>
              )}
              {importStatus === 'done' && importResults && (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: '2rem', marginBottom: 10 }}>{importResults.errors > 0 ? '⚠️' : '✅'}</div>
                  <h3 style={{ marginBottom: 14, color: '#2F4156' }}>Importación completada</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, maxWidth: 260, margin: '0 auto', textAlign: 'left', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 700, color: '#16a34a' }}>✓ Insertados:</span><span>{importResults.inserted}</span>
                    {importResults.updated > 0 && <><span style={{ fontWeight: 700, color: '#2563eb' }}>↻ Actualizados:</span><span>{importResults.updated}</span></>}
                    {importResults.skipped > 0 && <><span style={{ fontWeight: 700, color: '#d97706' }}>⊘ Saltados:</span><span>{importResults.skipped}</span></>}
                    {importResults.errors > 0 && <><span style={{ fontWeight: 700, color: '#dc2626' }}>✗ Errores:</span><span>{importResults.errors}</span></>}
                  </div>
                </div>
              )}
            </div>
            <div className="dc-modal-footer">
              {importStatus === 'preview' && (
                <>
                  <button className="dc-btn-cancel" onClick={() => { setShowImportModal(false); setImportStatus(''); }}><X size={14} /> Cancelar</button>
                  <button className="dc-btn-save" onClick={handleImportConfirm}><Upload size={14} /> Importar {importData.length} registros</button>
                </>
              )}
              {importStatus === 'done' && (
                <button className="dc-btn-save" onClick={() => { setShowImportModal(false); setImportStatus(''); }}>Cerrar</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
