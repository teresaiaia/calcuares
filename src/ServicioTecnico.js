import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './supabaseClient';
import { Search, Plus, Edit2, Trash2, X, Save, FileText, RefreshCw, Download, ChevronDown, ChevronUp, Upload } from 'lucide-react';
import './ServicioTecnico.css';

const ESTADOS_COBRO = ['Pendiente', 'Cobrado', 'No se cobró', 'Exonerado'];

// ============================================
// ComboBox: dropdown con autocompletado + opción de escribir nuevo
// ============================================
function ComboBox({ value, onChange, options, placeholder, icon }) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // Cerrar al hacer click afuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
        setFilter('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    if (!filter) return options;
    const lower = filter.toLowerCase();
    return options.filter(o => o.toLowerCase().includes(lower));
  }, [options, filter]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setFilter(val);
    onChange(val);
    if (!isOpen) setIsOpen(true);
  };

  const handleSelect = (option) => {
    onChange(option);
    setFilter('');
    setIsOpen(false);
  };

  const handleFocus = () => {
    setIsOpen(true);
    setFilter('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setFilter('');
    }
    if (e.key === 'Enter' && filtered.length === 1) {
      handleSelect(filtered[0]);
    }
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'center',
        border: '2px solid ' + (isOpen ? '#567C8D' : '#C8D9E6'),
        borderRadius: '8px', transition: 'border-color 0.2s', background: 'white'
      }}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={{
            flex: 1, border: 'none', outline: 'none', padding: '0.55rem 0.75rem',
            fontSize: '0.85rem', color: '#2F4156', background: 'transparent',
            borderRadius: '8px'
          }}
        />
        <button
          type="button"
          onClick={() => { setIsOpen(!isOpen); if (!isOpen) inputRef.current?.focus(); }}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            padding: '0.4rem 0.5rem', color: '#567C8D', display: 'flex'
          }}
        >
          <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
      </div>
      {isOpen && options.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: 'white', border: '2px solid #C8D9E6', borderTop: 'none',
          borderRadius: '0 0 8px 8px', maxHeight: '180px', overflowY: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: '#9ca3af', fontStyle: 'italic' }}>
              Nuevo valor: "{value}"
            </div>
          ) : (
            filtered.map((opt, i) => (
              <div
                key={i}
                onClick={() => handleSelect(opt)}
                style={{
                  padding: '0.45rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem',
                  color: '#2F4156', borderBottom: i < filtered.length - 1 ? '1px solid #f0f0f0' : 'none',
                  background: opt === value ? '#f0f7ff' : 'transparent'
                }}
                onMouseEnter={(e) => e.target.style.background = '#f0f7ff'}
                onMouseLeave={(e) => e.target.style.background = opt === value ? '#f0f7ff' : 'transparent'}
              >
                {opt}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function ServicioTecnico() {
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showInformeModal, setShowInformeModal] = useState(false);
  const [editingServicio, setEditingServicio] = useState(null);
  const [informeServicio, setInformeServicio] = useState(null);
  const [informeTexto, setInformeTexto] = useState('');
  const [generandoInforme, setGenerandoInforme] = useState(false);
  const [expandedRow] = useState(null);
  const [sortField, setSortField] = useState('fecha');
  const [sortDir, setSortDir] = useState('desc');
  const [filterEstado, setFilterEstado] = useState('todos');
  const [filterGarantia, setFilterGarantia] = useState('todos');

  // Estados de importación
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState([]);
  const [importDuplicates, setImportDuplicates] = useState([]);
  const [importStatus, setImportStatus] = useState(''); // '', 'preview', 'importing', 'done'
  const [importResults, setImportResults] = useState(null);
  const [duplicateAction, setDuplicateAction] = useState('skip'); // 'skip' | 'overwrite'
  const importFileRef = useRef(null);

  const formInit = {
    nro_reporte: '',
    fecha: new Date().toISOString().split('T')[0],
    cliente: '',
    modelo: '',
    serial_number: '',
    caso: '',
    costo_servicio: '',
    fecha_fin_garantia: '',
    monto_facturado_servicio: '',
    monto_facturado_partes: '',
    nro_factura: '',
    fecha_factura: '',
    estado_cobro: 'Pendiente',
    tiene_informe: false,
    informe_texto: '',
    informe_formateado: ''
  };

  const [formData, setFormData] = useState(formInit);

  useEffect(() => {
    fetchServicios();
  }, []);

  const fetchServicios = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('servicio_tecnico')
        .select('*')
        .order('fecha', { ascending: false });
      if (error) throw error;
      setServicios(data || []);
    } catch (error) {
      console.error('Error cargando servicios:', error);
      alert('Error al cargar servicios técnicos');
    } finally {
      setLoading(false);
    }
  };

  // Calcular si está en garantía
  const estaEnGarantia = (fechaFin) => {
    if (!fechaFin) return null; // No definido
    const hoy = new Date();
    const fin = new Date(fechaFin);
    return fin >= hoy;
  };

  // Formatear número con separador de miles
  const formatNumber = (num) => {
    if (!num && num !== 0) return '';
    return Number(num).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  // Formatear fecha para mostrar
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  // Guardar servicio (crear o editar)
  const handleSave = async () => {
    if (!formData.nro_reporte.trim() || !formData.cliente.trim()) {
      alert('El N° de Reporte y el Cliente son obligatorios');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nro_reporte: formData.nro_reporte.trim(),
        fecha: formData.fecha || null,
        cliente: formData.cliente.trim(),
        modelo: formData.modelo.trim() || null,
        serial_number: formData.serial_number.trim() || null,
        caso: formData.caso.trim() || null,
        costo_servicio: parseFloat(formData.costo_servicio) || 0,
        fecha_fin_garantia: formData.fecha_fin_garantia || null,
        monto_facturado_servicio: parseFloat(formData.monto_facturado_servicio) || 0,
        monto_facturado_partes: parseFloat(formData.monto_facturado_partes) || 0,
        nro_factura: formData.nro_factura.trim() || null,
        fecha_factura: formData.fecha_factura || null,
        estado_cobro: formData.estado_cobro,
        tiene_informe: formData.tiene_informe,
        informe_texto: formData.informe_texto || null,
        informe_formateado: formData.informe_formateado || null
      };

      if (editingServicio) {
        const { error } = await supabase
          .from('servicio_tecnico')
          .update(payload)
          .eq('id', editingServicio.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('servicio_tecnico')
          .insert([payload]);
        if (error) throw error;
      }

      setShowModal(false);
      setEditingServicio(null);
      setFormData(formInit);
      await fetchServicios();
    } catch (error) {
      console.error('Error al guardar:', error);
      alert('Error al guardar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Eliminar servicio
  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este registro de servicio técnico?')) return;
    try {
      const { error } = await supabase.from('servicio_tecnico').delete().eq('id', id);
      if (error) throw error;
      await fetchServicios();
    } catch (error) {
      alert('Error al eliminar: ' + error.message);
    }
  };

  // Abrir modal de edición
  const handleEdit = (servicio) => {
    setEditingServicio(servicio);
    setFormData({
      nro_reporte: servicio.nro_reporte || '',
      fecha: servicio.fecha || '',
      cliente: servicio.cliente || '',
      modelo: servicio.modelo || '',
      serial_number: servicio.serial_number || '',
      caso: servicio.caso || '',
      costo_servicio: servicio.costo_servicio || '',
      fecha_fin_garantia: servicio.fecha_fin_garantia || '',
      monto_facturado_servicio: servicio.monto_facturado_servicio || '',
      monto_facturado_partes: servicio.monto_facturado_partes || '',
      nro_factura: servicio.nro_factura || '',
      fecha_factura: servicio.fecha_factura || '',
      estado_cobro: servicio.estado_cobro || 'Pendiente',
      tiene_informe: servicio.tiene_informe || false,
      informe_texto: servicio.informe_texto || '',
      informe_formateado: servicio.informe_formateado || ''
    });
    setShowModal(true);
  };

  // Abrir modal de nuevo
  const handleNew = () => {
    setEditingServicio(null);
    setFormData(formInit);
    setShowModal(true);
  };

  // Abrir modal de informe
  const handleOpenInforme = (servicio) => {
    setInformeServicio(servicio);
    setInformeTexto(servicio.informe_texto || '');
    setShowInformeModal(true);
  };

  // Guardar informe y generar PDF formateado
  const handleGuardarInforme = async () => {
    if (!informeTexto.trim()) {
      alert('Pegá el texto del informe primero');
      return;
    }

    setGenerandoInforme(true);
    try {
      // Guardar el texto original y generar versión formateada
      const textoFormateado = formatearInforme(informeTexto, informeServicio);
      
      const { error } = await supabase
        .from('servicio_tecnico')
        .update({
          tiene_informe: true,
          informe_texto: informeTexto,
          informe_formateado: textoFormateado
        })
        .eq('id', informeServicio.id);

      if (error) throw error;

      // Generar y descargar PDF
      generarPDF(textoFormateado, informeServicio);

      setShowInformeModal(false);
      setInformeServicio(null);
      setInformeTexto('');
      await fetchServicios();
    } catch (error) {
      alert('Error al guardar informe: ' + error.message);
    } finally {
      setGenerandoInforme(false);
    }
  };

  // Formatear el informe crudo en texto estructurado
  const formatearInforme = (textoOriginal, servicio) => {
    const lineas = textoOriginal.split('\n').map(l => l.trim()).filter(l => l);
    
    let formateado = `INFORME DE SERVICIO TÉCNICO\n`;
    formateado += `${'═'.repeat(50)}\n\n`;
    formateado += `N° Reporte: ${servicio.nro_reporte}\n`;
    formateado += `Fecha: ${formatDate(servicio.fecha)}\n`;
    formateado += `Cliente: ${servicio.cliente}\n`;
    formateado += `Modelo: ${servicio.modelo || 'N/A'}\n`;
    formateado += `S/N: ${servicio.serial_number || 'N/A'}\n`;
    formateado += `${'─'.repeat(50)}\n\n`;
    formateado += `DESCRIPCIÓN DEL SERVICIO:\n\n`;
    
    lineas.forEach(linea => {
      formateado += `  ${linea}\n`;
    });

    formateado += `\n${'─'.repeat(50)}\n`;
    formateado += `Costo del servicio: $${formatNumber(servicio.costo_servicio)}\n`;
    
    if (servicio.fecha_fin_garantia) {
      const enGarantia = estaEnGarantia(servicio.fecha_fin_garantia);
      formateado += `Garantía hasta: ${formatDate(servicio.fecha_fin_garantia)} (${enGarantia ? 'EN GARANTÍA' : 'FUERA DE GARANTÍA'})\n`;
    }
    
    formateado += `${'═'.repeat(50)}\n`;
    formateado += `ARES MEDICAL EQUIPMENT\n`;

    return formateado;
  };

  // Generar PDF simple usando una ventana de impresión
  const generarPDF = (textoFormateado, servicio) => {
    const ventana = window.open('', '_blank');
    ventana.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Informe ST - ${servicio.nro_reporte}</title>
        <style>
          body { 
            font-family: 'Courier New', monospace; 
            padding: 40px; 
            max-width: 800px; 
            margin: 0 auto;
            color: #2F4156;
            line-height: 1.6;
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #567C8D;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #2F4156;
            font-size: 22px;
            margin: 0;
          }
          .header p {
            color: #567C8D;
            margin: 5px 0 0;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-bottom: 25px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
          }
          .info-item { font-size: 13px; }
          .info-label { font-weight: bold; color: #2F4156; }
          .content {
            padding: 20px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            margin-bottom: 25px;
            white-space: pre-wrap;
            font-size: 13px;
          }
          .footer {
            text-align: center;
            border-top: 2px solid #567C8D;
            padding-top: 15px;
            color: #567C8D;
            font-size: 12px;
          }
          @media print {
            body { padding: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>ARES MEDICAL EQUIPMENT</h1>
          <p>Informe de Servicio Técnico</p>
        </div>
        <div class="info-grid">
          <div class="info-item"><span class="info-label">N° Reporte:</span> ${servicio.nro_reporte}</div>
          <div class="info-item"><span class="info-label">Fecha:</span> ${formatDate(servicio.fecha)}</div>
          <div class="info-item"><span class="info-label">Cliente:</span> ${servicio.cliente}</div>
          <div class="info-item"><span class="info-label">Modelo:</span> ${servicio.modelo || 'N/A'}</div>
          <div class="info-item"><span class="info-label">S/N:</span> ${servicio.serial_number || 'N/A'}</div>
          <div class="info-item"><span class="info-label">Costo:</span> $${formatNumber(servicio.costo_servicio)}</div>
        </div>
        <h3 style="color: #2F4156; margin-bottom: 10px;">Descripción del Servicio</h3>
        <div class="content">${textoFormateado.replace(/\n/g, '<br>')}</div>
        <div class="footer">
          <p>ARES MEDICAL EQUIPMENT - Servicio Técnico</p>
          <p>Documento generado el ${new Date().toLocaleDateString('es-AR')}</p>
        </div>
      </body>
      </html>
    `);
    ventana.document.close();
    setTimeout(() => ventana.print(), 500);
  };

  // Solo re-descargar PDF de un informe ya existente
  const handleDescargarInforme = (servicio) => {
    if (!servicio.informe_formateado) {
      alert('Este servicio no tiene informe generado');
      return;
    }
    generarPDF(servicio.informe_formateado, servicio);
  };

  // ============================================
  // IMPORTACIÓN MASIVA
  // ============================================
  const parseExcelDate = (val) => {
    if (!val) return null;
    // Si es número (serial de Excel)
    if (typeof val === 'number') {
      const d = new Date((val - 25569) * 86400000);
      return d.toISOString().split('T')[0];
    }
    // Si es string con formato dd/mm/yyyy o similar
    const str = String(val).trim();
    const parts = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (parts) {
      const year = parts[3].length === 2 ? '20' + parts[3] : parts[3];
      return `${year}-${parts[2].padStart(2,'0')}-${parts[1].padStart(2,'0')}`;
    }
    // Intentar parse directo
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return null;
  };

  const parseCosto = (val) => {
    if (!val) return 0;
    const str = String(val).replace(/[^0-9.,-]/g, '').replace(/\./g, '').replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
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

      if (rows.length < 2) {
        alert('El archivo no tiene datos (solo encabezado o está vacío)');
        return;
      }

      // Orden fijo: REPO | DATE | CLIENTE | MOD | SN | CASO | K-ING | FINGTIA | $FAC_SERV | $FAC_PARTES | NºFAC | DATEFAC
      const parsed = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || r.length === 0 || !r[0]) continue; // Saltar filas vacías

        const record = {
          nro_reporte: String(r[0] || '').trim(),
          fecha: parseExcelDate(r[1]),
          cliente: String(r[2] || '').trim(),
          modelo: String(r[3] || '').trim() || null,
          serial_number: String(r[4] || '').trim() || null,
          caso: String(r[5] || '').trim() || null,
          costo_servicio: parseCosto(r[6]),
          fecha_fin_garantia: parseExcelDate(r[7]),
          monto_facturado_servicio: parseCosto(r[8]),
          monto_facturado_partes: parseCosto(r[9]),
          nro_factura: String(r[10] || '').trim() || null,
          fecha_factura: parseExcelDate(r[11]),
          estado_cobro: (() => {
            const val = String(r[12] || '').trim().toLowerCase();
            if (val === 'cobrado') return 'Cobrado';
            if (val === 'no se cobró' || val === 'no se cobro') return 'No se cobró';
            if (val === 'exonerado') return 'Exonerado';
            return 'Pendiente';
          })(),
          tiene_informe: false,
          informe_texto: null,
          informe_formateado: null
        };

        if (record.nro_reporte && record.cliente) {
          parsed.push(record);
        }
      }

      if (parsed.length === 0) {
        alert('No se encontraron registros válidos en el archivo');
        return;
      }

      // Detectar duplicados
      const existingReportes = new Set(servicios.map(s => s.nro_reporte));
      const dupes = parsed.filter(p => existingReportes.has(p.nro_reporte));
      
      setImportData(parsed);
      setImportDuplicates(dupes);
      setImportStatus('preview');
      setImportResults(null);
      setDuplicateAction('skip');
      setShowImportModal(true);
    } catch (err) {
      console.error('Error al leer archivo:', err);
      alert('Error al leer el archivo. Asegurate de que sea un Excel (.xlsx) o CSV válido.');
    }
  };

  const handleImportConfirm = async () => {
    setImportStatus('importing');
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    const existingMap = {};
    servicios.forEach(s => { existingMap[s.nro_reporte] = s.id; });

    for (const record of importData) {
      const isDuplicate = existingMap[record.nro_reporte];
      
      try {
        if (isDuplicate) {
          if (duplicateAction === 'skip') {
            skipped++;
            continue;
          }
          // Overwrite
          const { error } = await supabase
            .from('servicio_tecnico')
            .update(record)
            .eq('id', isDuplicate);
          if (error) throw error;
          updated++;
        } else {
          const { error } = await supabase
            .from('servicio_tecnico')
            .insert([record]);
          if (error) throw error;
          inserted++;
        }
      } catch (err) {
        console.error('Error importando registro:', record.nro_reporte, err);
        errors++;
      }
    }

    setImportResults({ inserted, updated, skipped, errors, total: importData.length });
    setImportStatus('done');
    await fetchServicios();
  };

  // Ordenamiento
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // Filtrado y ordenamiento
  const serviciosFiltrados = useMemo(() => {
    let filtered = [...servicios];

    // Búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(s =>
        (s.nro_reporte || '').toLowerCase().includes(term) ||
        (s.cliente || '').toLowerCase().includes(term) ||
        (s.modelo || '').toLowerCase().includes(term) ||
        (s.serial_number || '').toLowerCase().includes(term) ||
        (s.caso || '').toLowerCase().includes(term) ||
        (s.nro_factura || '').toLowerCase().includes(term)
      );
    }

    // Filtro estado cobro
    if (filterEstado !== 'todos') {
      filtered = filtered.filter(s => s.estado_cobro === filterEstado);
    }

    // Filtro garantía
    if (filterGarantia !== 'todos') {
      filtered = filtered.filter(s => {
        const enGar = estaEnGarantia(s.fecha_fin_garantia);
        if (filterGarantia === 'si') return enGar === true;
        if (filterGarantia === 'no') return enGar === false;
        if (filterGarantia === 'sin') return enGar === null;
        return true;
      });
    }

    // Ordenamiento
    filtered.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (sortField === 'costo_servicio' || sortField === 'monto_facturado_servicio') {
        valA = parseFloat(valA) || 0;
        valB = parseFloat(valB) || 0;
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [servicios, searchTerm, sortField, sortDir, filterEstado, filterGarantia]);

  // Totales
  const totales = useMemo(() => {
    return serviciosFiltrados.reduce((acc, s) => ({
      costoTotal: acc.costoTotal + (parseFloat(s.costo_servicio) || 0),
      facturadoServicio: acc.facturadoServicio + (parseFloat(s.monto_facturado_servicio) || 0),
      facturadoPartes: acc.facturadoPartes + (parseFloat(s.monto_facturado_partes) || 0),
      enGarantia: acc.enGarantia + (estaEnGarantia(s.fecha_fin_garantia) === true ? 1 : 0),
      pendientes: acc.pendientes + (s.estado_cobro === 'Pendiente' ? 1 : 0),
      conInforme: acc.conInforme + (s.tiene_informe ? 1 : 0)
    }), { costoTotal: 0, facturadoServicio: 0, facturadoPartes: 0, enGarantia: 0, pendientes: 0, conInforme: 0 });
  }, [serviciosFiltrados]);

  // Opciones para dropdowns con cascada
  const clientesUnicos = useMemo(() => {
    const set = new Set(servicios.map(s => s.cliente).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [servicios]);

  const modelosFiltrados = useMemo(() => {
    const source = formData.cliente
      ? servicios.filter(s => s.cliente === formData.cliente)
      : servicios;
    const set = new Set(source.map(s => s.modelo).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [servicios, formData.cliente]);

  const serialesFiltrados = useMemo(() => {
    let source = servicios;
    if (formData.cliente) source = source.filter(s => s.cliente === formData.cliente);
    if (formData.modelo) source = source.filter(s => s.modelo === formData.modelo);
    const set = new Set(source.map(s => s.serial_number).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [servicios, formData.cliente, formData.modelo]);

  // Render icono de ordenamiento
  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronDown size={12} style={{ opacity: 0.3 }} />;
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  return (
    <div className="st-container">
      {/* Header con stats */}
      <div className="st-stats-row">
        <div className="st-stat-card">
          <span className="st-stat-label">Registros</span>
          <span className="st-stat-value">{serviciosFiltrados.length}</span>
        </div>
        <div className="st-stat-card">
          <span className="st-stat-label">Costo Total</span>
          <span className="st-stat-value">${formatNumber(totales.costoTotal)}</span>
        </div>
        <div className="st-stat-card">
          <span className="st-stat-label">Facturado Serv.</span>
          <span className="st-stat-value">${formatNumber(totales.facturadoServicio)}</span>
        </div>
        <div className="st-stat-card">
          <span className="st-stat-label">Facturado Partes</span>
          <span className="st-stat-value">${formatNumber(totales.facturadoPartes)}</span>
        </div>
        <div className="st-stat-card st-stat-warning">
          <span className="st-stat-label">Pendientes</span>
          <span className="st-stat-value">{totales.pendientes}</span>
        </div>
        <div className="st-stat-card st-stat-info">
          <span className="st-stat-label">En Garantía</span>
          <span className="st-stat-value">{totales.enGarantia}</span>
        </div>
      </div>

      {/* Barra de búsqueda y acciones */}
      <div className="st-toolbar">
        <div className="st-search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar por reporte, cliente, modelo, S/N, caso, factura..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          value={filterEstado}
          onChange={(e) => setFilterEstado(e.target.value)}
          className="st-filter-select"
        >
          <option value="todos">Todos los estados</option>
          <option value="Pendiente">Pendiente</option>
          <option value="Cobrado">Cobrado</option>
          <option value="No se cobró">No se cobró</option>
          <option value="Exonerado">Exonerado</option>
        </select>
        <select
          value={filterGarantia}
          onChange={(e) => setFilterGarantia(e.target.value)}
          className="st-filter-select"
        >
          <option value="todos">Todas las garantías</option>
          <option value="si">En garantía</option>
          <option value="no">Fuera de garantía</option>
          <option value="sin">Sin definir</option>
        </select>
        <button onClick={fetchServicios} className="st-btn-icon" title="Recargar">
          <RefreshCw size={16} />
        </button>
        <input
          type="file"
          ref={importFileRef}
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={handleImportFile}
        />
        <button onClick={() => importFileRef.current?.click()} className="st-btn-import" title="Importar desde Excel/CSV">
          <Upload size={16} /> Importar
        </button>
        <button onClick={handleNew} className="st-btn-new">
          <Plus size={16} /> Nuevo Servicio
        </button>
      </div>

      {/* Tabla principal */}
      <div className="st-table-wrapper">
        {loading ? (
          <div className="st-loading">
            <RefreshCw size={24} className="st-spin" />
            <p>Cargando servicios técnicos...</p>
          </div>
        ) : serviciosFiltrados.length === 0 ? (
          <div className="st-empty">
            <FileText size={48} />
            <p>No hay registros de servicio técnico</p>
            <button onClick={handleNew} className="st-btn-new">
              <Plus size={16} /> Crear primer registro
            </button>
          </div>
        ) : (
          <table className="st-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('nro_reporte')}>REPO <SortIcon field="nro_reporte" /></th>
                <th onClick={() => handleSort('fecha')}>FECHA <SortIcon field="fecha" /></th>
                <th onClick={() => handleSort('cliente')}>CLIENTE <SortIcon field="cliente" /></th>
                <th onClick={() => handleSort('modelo')}>MOD <SortIcon field="modelo" /></th>
                <th>S/N</th>
                <th>CASO</th>
                <th onClick={() => handleSort('costo_servicio')}>COSTO <SortIcon field="costo_servicio" /></th>
                <th>GTÍA FIN</th>
                <th>EN GTÍA</th>
                <th>$FAC SERV</th>
                <th>$FAC PARTES</th>
                <th>N° FAC</th>
                <th>FECHA FAC</th>
                <th>ESTADO</th>
                <th>INF</th>
                <th>ACC</th>
              </tr>
            </thead>
            <tbody>
              {serviciosFiltrados.map(s => {
                const enGarantia = estaEnGarantia(s.fecha_fin_garantia);
                return (
                  <tr key={s.id} className={expandedRow === s.id ? 'st-row-expanded' : ''}>
                    <td className="st-cell-repo">{s.nro_reporte}</td>
                    <td>{formatDate(s.fecha)}</td>
                    <td className="st-cell-cliente">{s.cliente}</td>
                    <td>{s.modelo}</td>
                    <td>{s.serial_number}</td>
                    <td className="st-cell-caso" title={s.caso}>{s.caso}</td>
                    <td className="st-cell-number">
                      {s.costo_servicio ? `$${formatNumber(s.costo_servicio)}` : ''}
                    </td>
                    <td>{formatDate(s.fecha_fin_garantia)}</td>
                    <td className="st-cell-center">
                      {enGarantia === null ? (
                        <span className="st-badge-neutral">-</span>
                      ) : enGarantia ? (
                        <span className="st-badge-garantia-si">SÍ</span>
                      ) : (
                        <span className="st-badge-garantia-no">NO</span>
                      )}
                    </td>
                    <td className="st-cell-number">
                      {s.monto_facturado_servicio ? `$${formatNumber(s.monto_facturado_servicio)}` : ''}
                    </td>
                    <td className="st-cell-number">
                      {s.monto_facturado_partes ? `$${formatNumber(s.monto_facturado_partes)}` : ''}
                    </td>
                    <td>{s.nro_factura}</td>
                    <td>{formatDate(s.fecha_factura)}</td>
                    <td className="st-cell-center">
                      <span className={`st-badge-estado st-estado-${s.estado_cobro?.toLowerCase().replace(/\s+/g, '-')}`}>
                        {s.estado_cobro}
                      </span>
                    </td>
                    <td className="st-cell-center">
                      {s.tiene_informe ? (
                        <button
                          onClick={() => handleDescargarInforme(s)}
                          className="st-btn-informe-si"
                          title="Descargar informe"
                        >
                          <FileText size={14} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenInforme(s)}
                          className="st-btn-informe-no"
                          title="Agregar informe"
                        >
                          <Plus size={12} />
                        </button>
                      )}
                    </td>
                    <td className="st-cell-actions">
                      <button onClick={() => handleEdit(s)} className="st-btn-edit" title="Editar">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => handleDelete(s.id)} className="st-btn-delete" title="Eliminar">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de Crear/Editar Servicio */}
      {showModal && (
        <div className="st-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="st-modal" onClick={(e) => e.stopPropagation()}>
            <div className="st-modal-header">
              <h3>🔧 {editingServicio ? 'Editar Servicio' : 'Nuevo Servicio Técnico'}</h3>
              <button onClick={() => setShowModal(false)} className="st-modal-close"><X size={20} /></button>
            </div>
            <div className="st-modal-body">
              {/* Fila 1: Reporte y Fecha */}
              <div className="st-form-row st-form-row-2">
                <div className="st-form-group">
                  <label>📋 N° Reporte *</label>
                  <input type="text" value={formData.nro_reporte}
                    onChange={(e) => setFormData({...formData, nro_reporte: e.target.value})}
                    placeholder="Ej: 1278" />
                </div>
                <div className="st-form-group">
                  <label>📅 Fecha *</label>
                  <input type="date" value={formData.fecha}
                    onChange={(e) => setFormData({...formData, fecha: e.target.value})} />
                </div>
              </div>

              {/* Fila 2: Cliente */}
              <div className="st-form-group">
                <label>👤 Cliente *</label>
                <ComboBox
                  value={formData.cliente}
                  onChange={(val) => setFormData({...formData, cliente: val, modelo: '', serial_number: ''})}
                  options={clientesUnicos}
                  placeholder="Seleccionar o escribir cliente"
                />
              </div>

              {/* Fila 3: Modelo y S/N */}
              <div className="st-form-row st-form-row-2">
                <div className="st-form-group">
                  <label>🏷️ Modelo</label>
                  <ComboBox
                    value={formData.modelo}
                    onChange={(val) => setFormData({...formData, modelo: val, serial_number: ''})}
                    options={modelosFiltrados}
                    placeholder="Seleccionar o escribir modelo"
                  />
                </div>
                <div className="st-form-group">
                  <label>🔢 Serial Number</label>
                  <ComboBox
                    value={formData.serial_number}
                    onChange={(val) => setFormData({...formData, serial_number: val})}
                    options={serialesFiltrados}
                    placeholder="Seleccionar o escribir S/N"
                  />
                </div>
              </div>

              {/* Fila 4: Caso */}
              <div className="st-form-group">
                <label>📝 Caso / Descripción</label>
                <textarea value={formData.caso}
                  onChange={(e) => setFormData({...formData, caso: e.target.value})}
                  placeholder="Descripción del caso o problema reportado"
                  rows={2} />
              </div>

              {/* Separador: Costos y Garantía */}
              <div className="st-form-separator">💰 Costos y Garantía</div>

              {/* Fila 5: Costo y Garantía */}
              <div className="st-form-row st-form-row-3">
                <div className="st-form-group">
                  <label>💵 Costo Servicio</label>
                  <input type="number" step="0.01" value={formData.costo_servicio}
                    onChange={(e) => setFormData({...formData, costo_servicio: e.target.value})}
                    placeholder="0" />
                </div>
                <div className="st-form-group">
                  <label>🛡️ Fin de Garantía</label>
                  <input type="date" value={formData.fecha_fin_garantia}
                    onChange={(e) => setFormData({...formData, fecha_fin_garantia: e.target.value})} />
                </div>
                <div className="st-form-group">
                  <label>Estado Garantía</label>
                  <div className={`st-garantia-badge ${
                    !formData.fecha_fin_garantia ? 'st-gar-na' :
                    estaEnGarantia(formData.fecha_fin_garantia) ? 'st-gar-si' : 'st-gar-no'
                  }`}>
                    {!formData.fecha_fin_garantia ? 'No definido' :
                     estaEnGarantia(formData.fecha_fin_garantia) ? '✓ EN GARANTÍA' : '✗ FUERA DE GARANTÍA'}
                  </div>
                </div>
              </div>

              {/* Separador: Facturación */}
              <div className="st-form-separator">🧾 Facturación</div>

              {/* Fila 6: Montos facturados */}
              <div className="st-form-row st-form-row-2">
                <div className="st-form-group">
                  <label>$FAC Servicio</label>
                  <input type="number" step="0.01" value={formData.monto_facturado_servicio}
                    onChange={(e) => setFormData({...formData, monto_facturado_servicio: e.target.value})}
                    placeholder="0" />
                </div>
                <div className="st-form-group">
                  <label>$FAC Partes</label>
                  <input type="number" step="0.01" value={formData.monto_facturado_partes}
                    onChange={(e) => setFormData({...formData, monto_facturado_partes: e.target.value})}
                    placeholder="0" />
                </div>
              </div>

              {/* Fila 7: Nro factura, fecha, estado */}
              <div className="st-form-row st-form-row-3">
                <div className="st-form-group">
                  <label>N° Factura</label>
                  <input type="text" value={formData.nro_factura}
                    onChange={(e) => setFormData({...formData, nro_factura: e.target.value})}
                    placeholder="Ej: 001-001-0002075" />
                </div>
                <div className="st-form-group">
                  <label>Fecha Factura</label>
                  <input type="date" value={formData.fecha_factura}
                    onChange={(e) => setFormData({...formData, fecha_factura: e.target.value})} />
                </div>
                <div className="st-form-group">
                  <label>Estado Cobro</label>
                  <select value={formData.estado_cobro}
                    onChange={(e) => setFormData({...formData, estado_cobro: e.target.value})}>
                    {ESTADOS_COBRO.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="st-modal-footer">
              <button onClick={() => setShowModal(false)} className="st-btn-cancel">
                <X size={16} /> Cancelar
              </button>
              <button onClick={handleSave} className="st-btn-save" disabled={saving}>
                {saving ? <><RefreshCw size={16} className="st-spin" /> Guardando...</> : <><Save size={16} /> Guardar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Informe */}
      {showInformeModal && (
        <div className="st-modal-overlay" onClick={() => setShowInformeModal(false)}>
          <div className="st-modal st-modal-informe" onClick={(e) => e.stopPropagation()}>
            <div className="st-modal-header">
              <h3>📄 Informe - Reporte #{informeServicio?.nro_reporte}</h3>
              <button onClick={() => setShowInformeModal(false)} className="st-modal-close"><X size={20} /></button>
            </div>
            <div className="st-modal-body">
              <div className="st-informe-info">
                <span><strong>Cliente:</strong> {informeServicio?.cliente}</span>
                <span><strong>Modelo:</strong> {informeServicio?.modelo}</span>
                <span><strong>Caso:</strong> {informeServicio?.caso}</span>
              </div>
              <div className="st-form-group">
                <label>📋 Pegá el texto del informe aquí:</label>
                <textarea
                  value={informeTexto}
                  onChange={(e) => setInformeTexto(e.target.value)}
                  placeholder="Pegá el texto del informe de la planilla aquí. El sistema lo reformulará y generará un PDF formateado con el encabezado de Ares Medical Equipment."
                  rows={12}
                  className="st-informe-textarea"
                />
              </div>
              <div className="st-informe-hint">
                💡 El texto será reformateado automáticamente con el encabezado de la empresa y los datos del servicio. Se abrirá una ventana para imprimir/guardar como PDF.
              </div>
            </div>
            <div className="st-modal-footer">
              <button onClick={() => setShowInformeModal(false)} className="st-btn-cancel">
                <X size={16} /> Cancelar
              </button>
              <button onClick={handleGuardarInforme} className="st-btn-save" disabled={generandoInforme}>
                {generandoInforme ? (
                  <><RefreshCw size={16} className="st-spin" /> Generando...</>
                ) : (
                  <><Download size={16} /> Guardar y Generar PDF</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Importación */}
      {showImportModal && (
        <div className="st-modal-overlay" onClick={() => { if (importStatus !== 'importing') { setShowImportModal(false); setImportStatus(''); } }}>
          <div className="st-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="st-modal-header">
              <h3>📥 Importar Servicios</h3>
              <button onClick={() => { if (importStatus !== 'importing') { setShowImportModal(false); setImportStatus(''); } }} className="st-modal-close"><X size={20} /></button>
            </div>
            <div className="st-modal-body">
              {importStatus === 'preview' && (
                <>
                  <div style={{ background: '#f0f7ff', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
                    <strong>📊 Resumen del archivo:</strong> {importData.length} registros encontrados
                    {importDuplicates.length > 0 && (
                      <span style={{ color: '#d97706', display: 'block', marginTop: '4px' }}>
                        ⚠️ {importDuplicates.length} reportes ya existen en la base de datos
                      </span>
                    )}
                  </div>

                  {/* Tabla preview */}
                  <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: '8px', marginBottom: '16px' }}>
                    <table className="st-table" style={{ fontSize: '0.75rem' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '6px 8px' }}>REPO</th>
                          <th style={{ padding: '6px 8px' }}>FECHA</th>
                          <th style={{ padding: '6px 8px' }}>CLIENTE</th>
                          <th style={{ padding: '6px 8px' }}>MOD</th>
                          <th style={{ padding: '6px 8px' }}>S/N</th>
                          <th style={{ padding: '6px 8px' }}>COSTO</th>
                          <th style={{ padding: '6px 8px' }}>ESTADO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importData.slice(0, 50).map((r, i) => {
                          const isDupe = importDuplicates.some(d => d.nro_reporte === r.nro_reporte);
                          return (
                            <tr key={i} style={{ background: isDupe ? '#fef3c7' : 'transparent' }}>
                              <td style={{ padding: '4px 8px', fontWeight: 600 }}>{r.nro_reporte}</td>
                              <td style={{ padding: '4px 8px' }}>{r.fecha || '-'}</td>
                              <td style={{ padding: '4px 8px' }}>{r.cliente}</td>
                              <td style={{ padding: '4px 8px' }}>{r.modelo || '-'}</td>
                              <td style={{ padding: '4px 8px' }}>{r.serial_number || '-'}</td>
                              <td style={{ padding: '4px 8px', textAlign: 'right' }}>{r.costo_servicio ? `$${formatNumber(r.costo_servicio)}` : '-'}</td>
                              <td style={{ padding: '4px 8px' }}>
                                {isDupe ? <span style={{ color: '#d97706', fontWeight: 600 }}>⚠ DUP</span> : '✓ Nuevo'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {importData.length > 50 && (
                      <div style={{ padding: '8px', textAlign: 'center', color: '#6b7280', fontSize: '0.8rem' }}>
                        ...y {importData.length - 50} registros más
                      </div>
                    )}
                  </div>

                  {/* Manejo de duplicados */}
                  {importDuplicates.length > 0 && (
                    <div style={{ background: '#fffbeb', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px' }}>
                      <strong style={{ color: '#92400e' }}>¿Qué hacer con los {importDuplicates.length} duplicados?</strong>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                          <input type="radio" name="dupeAction" value="skip" checked={duplicateAction === 'skip'} onChange={() => setDuplicateAction('skip')} />
                          Saltar duplicados
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                          <input type="radio" name="dupeAction" value="overwrite" checked={duplicateAction === 'overwrite'} onChange={() => setDuplicateAction('overwrite')} />
                          Sobreescribir con datos del archivo
                        </label>
                      </div>
                    </div>
                  )}

                  <div style={{ background: '#f8f8f8', padding: '10px 14px', borderRadius: '8px', fontSize: '0.78rem', color: '#6b7280' }}>
                    <strong>Orden de columnas:</strong> REPO | FECHA | CLIENTE | MODELO | S/N | CASO | COSTO | FIN GTÍA | $FAC SERV | $FAC PARTES | N° FAC | FECHA FAC | ESTADO
                  </div>
                </>
              )}

              {importStatus === 'importing' && (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <RefreshCw size={32} className="st-spin" style={{ color: '#567C8D', marginBottom: '16px' }} />
                  <p style={{ color: '#2F4156', fontSize: '0.95rem' }}>Importando {importData.length} registros...</p>
                </div>
              )}

              {importStatus === 'done' && importResults && (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '12px' }}>✅</div>
                  <h3 style={{ color: '#2F4156', marginBottom: '16px' }}>Importación completada</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', maxWidth: '300px', margin: '0 auto', textAlign: 'left' }}>
                    <span style={{ fontWeight: 600, color: '#16a34a' }}>✓ Insertados:</span><span>{importResults.inserted}</span>
                    {importResults.updated > 0 && <><span style={{ fontWeight: 600, color: '#2563eb' }}>↻ Actualizados:</span><span>{importResults.updated}</span></>}
                    {importResults.skipped > 0 && <><span style={{ fontWeight: 600, color: '#d97706' }}>⊘ Saltados:</span><span>{importResults.skipped}</span></>}
                    {importResults.errors > 0 && <><span style={{ fontWeight: 600, color: '#dc2626' }}>✗ Errores:</span><span>{importResults.errors}</span></>}
                  </div>
                </div>
              )}
            </div>

            <div className="st-modal-footer">
              {importStatus === 'preview' && (
                <>
                  <button onClick={() => { setShowImportModal(false); setImportStatus(''); }} className="st-btn-cancel">
                    <X size={16} /> Cancelar
                  </button>
                  <button onClick={handleImportConfirm} className="st-btn-save">
                    <Upload size={16} /> Importar {importData.length} registros
                  </button>
                </>
              )}
              {importStatus === 'done' && (
                <button onClick={() => { setShowImportModal(false); setImportStatus(''); }} className="st-btn-save">
                  Cerrar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
