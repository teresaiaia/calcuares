import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './supabaseClient';
import { Search, Plus, Edit2, Trash2, X, Save, FileText, RefreshCw, Download, ChevronDown, ChevronUp, Upload, ExternalLink } from 'lucide-react';
import { FONDO_ARES_BASE64 } from './fondoAresBase64';
import './ServicioTecnico.css';

const ESTADOS_COBRO = ['En proceso', 'Pendiente', 'Cobrado', 'No se cobró', 'Exonerado'];

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
  const [informeEditado, setInformeEditado] = useState(null); // {descripcion, repuestos, recomendaciones, costo_texto, observaciones}
  const [informePaso, setInformePaso] = useState(1); // 1=pegar, 2=editar, 3=preview
  const [generandoInforme, setGenerandoInforme] = useState(false);
  const [expandedRow] = useState(null);
  const [sortField, setSortField] = useState('fecha');
  const [sortDir, setSortDir] = useState('desc');
  const [filterEstado, setFilterEstado] = useState('todos');
  const [filterGarantia, setFilterGarantia] = useState('todos');
  const [filterFechaDesde, setFilterFechaDesde] = useState('');
  const [filterFechaHasta, setFilterFechaHasta] = useState('');

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
    nro_rt: '',
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
    return Math.round(Number(num)).toLocaleString('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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
      const parseMonto = (val) => {
        if (!val && val !== 0) return 0;
        // Quitar puntos de miles y espacios, dejar solo dígitos
        const limpio = String(val).replace(/\./g, '').replace(/\s/g, '').replace(/,/g, '');
        return Math.round(parseFloat(limpio) || 0);
      };

      const payload = {
        nro_reporte: formData.nro_reporte.trim(),
        nro_rt: formData.nro_rt.trim() || null,
        fecha: formData.fecha || null,
        cliente: formData.cliente.trim(),
        modelo: formData.modelo.trim() || null,
        serial_number: formData.serial_number.trim() || null,
        caso: formData.caso.trim() || null,
        costo_servicio: parseMonto(formData.costo_servicio),
        fecha_fin_garantia: formData.fecha_fin_garantia || null,
        monto_facturado_servicio: parseMonto(formData.monto_facturado_servicio),
        monto_facturado_partes: parseMonto(formData.monto_facturado_partes),
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
      nro_rt: servicio.nro_rt || '',
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
    if (servicio.informe_formateado) {
      // Si ya tiene informe guardado, cargar para editar
      try {
        const saved = JSON.parse(servicio.informe_formateado);
        setInformeEditado(saved);
        setInformeTexto(servicio.informe_texto || '');
        setInformePaso(2);
      } catch {
        setInformeTexto(servicio.informe_texto || '');
        setInformeEditado(null);
        setInformePaso(1);
      }
    } else {
      setInformeTexto('');
      setInformeEditado(null);
      setInformePaso(1);
    }
    setShowInformeModal(true);
  };

  // Paso 1→2: Enviar texto a Claude para reformulación profesional
  const handleProcesarInforme = async () => {
    if (!informeTexto.trim()) {
      alert('Pegá el texto del informe primero');
      return;
    }
    setGenerandoInforme(true);
    try {
      const response = await fetch('/api/reformular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texto: informeTexto,
          cliente: informeServicio?.cliente,
          modelo: informeServicio?.modelo,
          serial: informeServicio?.serial_number,
          caso: informeServicio?.caso
        })
      });

      if (!response.ok) {
        throw new Error('Error al conectar con el servicio de IA');
      }

      const resultado = await response.json();
      if (resultado.error) throw new Error(resultado.error);

      setInformeEditado({
        descripcion: resultado.descripcion || '',
        repuestos: resultado.repuestos || [],
        recomendaciones: resultado.recomendaciones || [],
        costo_texto: informeServicio ? `₲${formatNumber(informeServicio.costo_servicio)}` : '',
        observaciones: resultado.observaciones || ''
      });
      setInformePaso(2);
    } catch (error) {
      console.error('Error procesando informe:', error);
      // Fallback: procesamiento local
      alert('No se pudo conectar con el servicio de IA. Se procesará localmente.');
      const estructurado = procesarTextoLocal(informeTexto);
      setInformeEditado(estructurado);
      setInformePaso(2);
    } finally {
      setGenerandoInforme(false);
    }
  };

  // Fallback: procesamiento local si la API falla
  const procesarTextoLocal = (texto) => {
    const lineas = texto.split('\n').map(l => l.trim()).filter(l => l);
    let descripcionLineas = [];
    let repuestos = [];
    let recomendaciones = [];
    let seccionActual = 'descripcion';

    lineas.forEach(linea => {
      const lower = linea.toLowerCase();
      if (lower.includes('repuesto') || lower.includes('filtro') || lower.includes('se reemplaz') || 
          lower.includes('se cambi') || lower.includes('cambio de')) {
        seccionActual = 'repuestos';
        repuestos.push(linea);
      } else if (lower.includes('recomend') || lower.includes('suger') || lower.includes('a futuro') || 
                 lower.includes('correctiv') || lower.includes('preventiv')) {
        seccionActual = 'recomendaciones';
        recomendaciones.push(linea);
      } else if (seccionActual === 'recomendaciones') {
        recomendaciones.push(linea);
      } else if (seccionActual === 'repuestos') {
        repuestos.push(linea);
      } else {
        descripcionLineas.push(linea);
      }
    });

    return {
      descripcion: descripcionLineas.join('. '),
      repuestos: repuestos,
      recomendaciones: recomendaciones,
      costo_texto: informeServicio ? `₲${formatNumber(informeServicio.costo_servicio)}` : '',
      observaciones: ''
    };
  };

  // Guardar informe estructurado
  const handleGuardarInforme = async () => {
    if (!informeEditado) return;
    setGenerandoInforme(true);
    try {
      const { error } = await supabase
        .from('servicio_tecnico')
        .update({
          tiene_informe: true,
          informe_texto: informeTexto,
          informe_formateado: JSON.stringify(informeEditado)
        })
        .eq('id', informeServicio.id);

      if (error) throw error;
      await fetchServicios();
      alert('Informe guardado correctamente');
    } catch (error) {
      alert('Error al guardar informe: ' + error.message);
    } finally {
      setGenerandoInforme(false);
    }
  };

  // Guardar y exportar PDF
  const handleGuardarYExportarPDF = async () => {
    if (!informeEditado) return;
    setGenerandoInforme(true);
    try {
      const { error } = await supabase
        .from('servicio_tecnico')
        .update({
          tiene_informe: true,
          informe_texto: informeTexto,
          informe_formateado: JSON.stringify(informeEditado)
        })
        .eq('id', informeServicio.id);

      if (error) throw error;
      generarPDFInforme(informeEditado, informeServicio);
      setShowInformeModal(false);
      await fetchServicios();
    } catch (error) {
      alert('Error al guardar informe: ' + error.message);
    } finally {
      setGenerandoInforme(false);
    }
  };

  // Generar PDF del informe estructurado
  const generarPDFInforme = (datos, servicio) => {
    const ventana = window.open('', '_blank');
    const enGar = estaEnGarantia(servicio.fecha_fin_garantia);
    const garantiaTexto = servicio.fecha_fin_garantia 
      ? `${formatDate(servicio.fecha_fin_garantia)} (${enGar ? 'EN GARANTÍA' : 'FUERA DE GARANTÍA'})` 
      : 'No definida';

    // Costo para el informe: si hay montos facturados, usar ₲FAC SERV + ₲FAC PARTES; sino doble de mano de obra
    const facServ = parseFloat(servicio.monto_facturado_servicio) || 0;
    const facPartes = parseFloat(servicio.monto_facturado_partes) || 0;
    const costoBase = parseFloat(servicio.costo_servicio) || 0;
    let costoInforme;
    if (facServ > 0 || facPartes > 0) {
      costoInforme = Math.round(facServ + facPartes);
    } else {
      costoInforme = Math.round(costoBase * 2);
    }
    const costoTexto = `₲${formatNumber(costoInforme)} - IVA incluido`;

    const repuestosHTML = datos.repuestos && datos.repuestos.length > 0 
      ? `<div class="section repuestos">
          <h3>Repuestos / Partes Reemplazadas</h3>
          <ul>${datos.repuestos.map(r => `<li>${r}</li>`).join('')}</ul>
        </div>` 
      : '';

    const recomendacionesHTML = datos.recomendaciones && datos.recomendaciones.length > 0
      ? `<div class="section recomendaciones">
          <h3>Recomendaciones y Acciones Futuras</h3>
          <ul>${datos.recomendaciones.map(r => `<li>${r}</li>`).join('')}</ul>
        </div>`
      : '';

    const observacionesHTML = datos.observaciones && datos.observaciones.trim()
      ? `<div class="section observaciones">
          <h3>Observaciones Adicionales</h3>
          <p>${datos.observaciones.replace(/\n/g, '<br>')}</p>
        </div>`
      : '';

    ventana.document.write(`<!DOCTYPE html><html><head>
      <title>Reporte ServTec ${servicio.nro_reporte} - Ares Paraguay</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: A4; margin: 0; }
        body { 
          font-family: 'Segoe UI', Arial, sans-serif; 
          color: #2F4156; 
          line-height: 1.5;
          width: 210mm;
          min-height: 297mm;
          position: relative;
        }
        .bg-image {
          position: fixed;
          top: 0; left: 0;
          width: 210mm;
          height: 297mm;
          z-index: -1;
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }
        .content-wrapper {
          position: relative;
          z-index: 1;
          padding: 35mm 25mm 30mm 25mm;
          min-height: 297mm;
        }
        .header { text-align: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #1a3352; }
        .header h1 { color: #1a3352; font-size: 18px; margin: 0; letter-spacing: 1px; }
        .header .subtitle { color: #567C8D; font-size: 12px; margin-top: 4px; }
        .info-grid { 
          display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; 
          margin-bottom: 18px; padding: 12px; 
          background: rgba(248,249,250,0.9); border-radius: 6px; 
          border-left: 3px solid #1a3352; font-size: 11.5px; 
        }
        .info-item .label { font-weight: 700; color: #1a3352; }
        .section { margin-bottom: 14px; }
        .section h3 { color: #1a3352; font-size: 12.5px; font-weight: 700; margin-bottom: 6px; padding-bottom: 3px; border-bottom: 1px solid #c0cdd8; }
        .descripcion p { font-size: 12px; text-align: justify; }
        .repuestos { background: rgba(255,247,237,0.9); border: 1px solid #fed7aa; border-radius: 6px; padding: 12px; }
        .repuestos h3 { color: #c2410c; border-bottom-color: #fed7aa; }
        .repuestos ul { padding-left: 18px; font-size: 11.5px; }
        .repuestos li { margin-bottom: 3px; }
        .recomendaciones { background: rgba(254,252,232,0.9); border: 1px solid #fde68a; border-radius: 6px; padding: 12px; }
        .recomendaciones h3 { color: #a16207; border-bottom-color: #fde68a; }
        .recomendaciones ul { padding-left: 18px; font-size: 11.5px; }
        .recomendaciones li { margin-bottom: 3px; }
        .observaciones { background: rgba(240,249,255,0.9); border: 1px solid #bae6fd; border-radius: 6px; padding: 12px; }
        .observaciones h3 { color: #0369a1; border-bottom-color: #bae6fd; }
        .observaciones p { font-size: 11.5px; }
        .costo-box { 
          text-align: center; padding: 10px; 
          background: rgba(26,51,82,0.95); color: white; 
          border-radius: 6px; font-size: 16px; font-weight: 700; 
          margin: 16px 0; letter-spacing: 0.5px;
        }
        .footer { 
          text-align: center; border-top: 2px solid #1a3352; 
          padding-top: 10px; margin-top: 20px; 
          color: #1a3352; font-size: 10px; 
        }
        .footer .whatsapp { margin-top: 4px; font-size: 10px; color: #567C8D; }
        @media print { 
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-image { position: fixed; }
        }
      </style>
    </head><body>
      <img class="bg-image" src="${FONDO_ARES_BASE64}" />
      <div class="content-wrapper">
        <div class="header">
          <h1>Reporte ServTec - Ares Paraguay</h1>
          <div class="subtitle">Informe de Servicio Técnico N° ${servicio.nro_reporte}</div>
        </div>
        <div class="info-grid">
          <div class="info-item"><span class="label">N° Reporte:</span> ${servicio.nro_reporte}</div>
          <div class="info-item"><span class="label">N° RPT:</span> ${servicio.nro_rt || '-'}</div>
          <div class="info-item"><span class="label">Fecha:</span> ${formatDate(servicio.fecha)}</div>
          <div class="info-item"><span class="label">Cliente:</span> ${servicio.cliente}</div>
          <div class="info-item"><span class="label">Modelo:</span> ${servicio.modelo || 'N/A'}</div>
          <div class="info-item"><span class="label">S/N:</span> ${servicio.serial_number || 'N/A'}</div>
          <div class="info-item"><span class="label">Garantía:</span> ${garantiaTexto}</div>
          <div class="info-item"><span class="label">Estado:</span> ${servicio.estado_cobro || '-'}</div>
        </div>
        <div class="section descripcion">
          <h3>Descripción del Servicio Realizado</h3>
          <p>${datos.descripcion}</p>
        </div>
        ${repuestosHTML}
        ${recomendacionesHTML}
        <div class="costo-box">Costo del Servicio: ${costoTexto}</div>
        ${observacionesHTML}
        <div class="footer">
          <p><strong>ARES MEDICAL EQUIPMENT</strong> — Servicio Técnico</p>
          <p class="whatsapp">Para consultas y asistencia comunicarse por WhatsApp al (0981) 000207</p>
          <p style="margin-top:3px; font-size:9px; color:#94a3b8;">Documento generado el ${new Date().toLocaleDateString('es-PY')}</p>
        </div>
      </div>
    </body></html>`);
    ventana.document.close();
    setTimeout(() => ventana.print(), 500);
  };

  // Re-descargar PDF de un informe ya existente
  const handleDescargarInforme = (servicio) => {
    if (!servicio.informe_formateado) {
      alert('Este servicio no tiene informe generado');
      return;
    }
    try {
      const datos = JSON.parse(servicio.informe_formateado);
      generarPDFInforme(datos, servicio);
    } catch {
      // Formato antiguo, abrir con el texto plano
      const ventana = window.open('', '_blank');
      ventana.document.write(`<pre style="font-family:monospace;padding:40px;">${servicio.informe_formateado}</pre>`);
      ventana.document.close();
      setTimeout(() => ventana.print(), 500);
    }
  };

  // Borrar informe existente
  const handleBorrarInforme = async () => {
    if (!informeServicio) return;
    if (!window.confirm('¿Eliminar el informe de este servicio? Esta acción no se puede deshacer.')) return;
    try {
      const { error } = await supabase
        .from('servicio_tecnico')
        .update({
          tiene_informe: false,
          informe_texto: null,
          informe_formateado: null
        })
        .eq('id', informeServicio.id);

      if (error) throw error;
      setShowInformeModal(false);
      setInformeServicio(null);
      setInformeTexto('');
      setInformeEditado(null);
      await fetchServicios();
    } catch (error) {
      alert('Error al borrar informe: ' + error.message);
    }
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

      // Orden fijo: REPO | FECHA | CLIENTE | MOD | SN | CASO | COSTO | FINGTIA | ₲FAC_SERV | ₲FAC_PARTES | NºFAC | DATEFAC | ESTADO | RT
      const parsed = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || r.length === 0 || !r[0]) continue;

        const record = {
          nro_reporte: String(r[0] || '').trim(),
          fecha: parseExcelDate(r[1]),
          cliente: String(r[2] || '').trim(),
          modelo: String(r[3] || '').trim() || null,
          serial_number: String(r[4] || '').trim() || null,
          caso: String(r[5] || '').trim() || null,
          costo_servicio: Math.round(parseCosto(r[6])),
          fecha_fin_garantia: parseExcelDate(r[7]),
          monto_facturado_servicio: Math.round(parseCosto(r[8])),
          monto_facturado_partes: Math.round(parseCosto(r[9])),
          nro_factura: String(r[10] || '').trim() || null,
          fecha_factura: parseExcelDate(r[11]),
          estado_cobro: (() => {
            const val = String(r[12] || '').trim().toLowerCase();
            if (val === 'cobrado') return 'Cobrado';
            if (val === 'no se cobró' || val === 'no se cobro') return 'No se cobró';
            if (val === 'exonerado') return 'Exonerado';
            if (val === 'en proceso') return 'En proceso';
            return 'Pendiente';
          })(),
          nro_rt: String(r[13] || '').trim() || null,
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
    const errorDetails = [];

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
        errorDetails.push({
          nro_reporte: record.nro_reporte,
          cliente: record.cliente,
          motivo: err.message || 'Error desconocido'
        });
      }
    }

    setImportResults({ inserted, updated, skipped, errors, total: importData.length, errorDetails });
    setImportStatus('done');
    await fetchServicios();
  };

  // ============================================
  // EXPORTACIÓN
  // ============================================
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef(null);

  // Cerrar menú al hacer click afuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExportExcel = async () => {
    setShowExportMenu(false);
    try {
      const XLSX = await import('xlsx');
      const exportData = serviciosFiltrados.map(s => ({
        'REPO': s.nro_reporte,
        'RPT': s.nro_rt || '',
        'FECHA': s.fecha || '',
        'CLIENTE': s.cliente,
        'MODELO': s.modelo || '',
        'S/N': s.serial_number || '',
        'CASO': s.caso || '',
        'COSTO': s.costo_servicio || 0,
        'FIN GTÍA': s.fecha_fin_garantia || '',
        'EN GTÍA': estaEnGarantia(s.fecha_fin_garantia) === true ? 'Sí' : estaEnGarantia(s.fecha_fin_garantia) === false ? 'No' : '-',
        '₲FAC SERV': s.monto_facturado_servicio || 0,
        '₲FAC PARTES': s.monto_facturado_partes || 0,
        'N° FAC': s.nro_factura || '',
        'FECHA FAC': s.fecha_factura || '',
        'ESTADO': s.estado_cobro || ''
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const colWidths = [10, 10, 12, 25, 14, 14, 30, 12, 12, 8, 12, 12, 20, 12, 14];
      ws['!cols'] = colWidths.map(w => ({ wch: w }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Servicio Técnico');
      XLSX.writeFile(wb, `ServicioTecnico_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error('Error al exportar Excel:', err);
      alert('Error al exportar: ' + err.message);
    }
  };

  const handleExportPDF = () => {
    setShowExportMenu(false);
    const ventana = window.open('', '_blank');
    const rows = serviciosFiltrados.map(s => {
      const enGar = estaEnGarantia(s.fecha_fin_garantia);
      return `<tr>
        <td>${s.nro_reporte}</td>
        <td>${s.nro_rt || ''}</td>
        <td>${formatDate(s.fecha)}</td>
        <td>${s.cliente}</td>
        <td>${s.modelo || ''}</td>
        <td>${s.serial_number || ''}</td>
        <td class="caso">${s.caso || ''}</td>
        <td class="num">${s.costo_servicio ? '₲' + formatNumber(s.costo_servicio) : ''}</td>
        <td>${formatDate(s.fecha_fin_garantia)}</td>
        <td class="center">${enGar === true ? 'Sí' : enGar === false ? 'No' : '-'}</td>
        <td class="num">${s.monto_facturado_servicio ? '₲' + formatNumber(s.monto_facturado_servicio) : ''}</td>
        <td class="num">${s.monto_facturado_partes ? '₲' + formatNumber(s.monto_facturado_partes) : ''}</td>
        <td>${s.nro_factura || ''}</td>
        <td>${formatDate(s.fecha_factura)}</td>
        <td class="center">${s.estado_cobro || ''}</td>
      </tr>`;
    }).join('');

    ventana.document.write(`<!DOCTYPE html><html><head>
      <title>Servicio Técnico - Exportación</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 20px; color: #2F4156; font-size: 10px; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 3px solid #567C8D; padding-bottom: 15px; }
        .header h1 { font-size: 18px; color: #2F4156; }
        .header p { color: #567C8D; font-size: 11px; margin-top: 4px; }
        .stats { display: flex; justify-content: center; gap: 20px; margin-bottom: 15px; font-size: 11px; }
        .stats span { background: #f0f4f8; padding: 4px 12px; border-radius: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 9px; }
        th { background: #2F4156; color: white; padding: 6px 4px; text-align: left; font-weight: 600; white-space: nowrap; }
        td { padding: 4px; border-bottom: 1px solid #e0e0e0; }
        tr:nth-child(even) { background: #f8fafc; }
        .num { text-align: right; }
        .center { text-align: center; }
        .caso { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .footer { text-align: center; margin-top: 20px; font-size: 9px; color: #94a3b8; border-top: 1px solid #e0e0e0; padding-top: 10px; }
        @media print { body { padding: 10px; } }
        @page { size: landscape; margin: 10mm; }
      </style>
    </head><body>
      <div class="header">
        <h1>ARES MEDICAL EQUIPMENT</h1>
        <p>Reporte de Servicio Técnico</p>
      </div>
      <div class="stats">
        <span><strong>Registros:</strong> ${serviciosFiltrados.length}</span>
        <span><strong>Costo Total:</strong> ₲${formatNumber(totales.costoTotal)}</span>
        <span><strong>Facturado Serv.:</strong> ₲${formatNumber(totales.facturadoServicio)}</span>
        <span><strong>Facturado Partes:</strong> ₲${formatNumber(totales.facturadoPartes)}</span>
      </div>
      <table>
        <thead><tr>
          <th>REPO</th><th>RPT</th><th>FECHA</th><th>CLIENTE</th><th>MOD</th><th>S/N</th><th>CASO</th>
          <th>COSTO</th><th>FIN GTÍA</th><th>GTÍA</th><th>₲FAC SERV</th><th>₲FAC PARTES</th>
          <th>N° FAC</th><th>FECHA FAC</th><th>ESTADO</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">Generado el ${new Date().toLocaleDateString('es-AR')} — ARES MEDICAL EQUIPMENT</div>
    </body></html>`);
    ventana.document.close();
    setTimeout(() => ventana.print(), 500);
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
        (s.nro_rt || '').toLowerCase().includes(term) ||
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

    // Filtro por rango de fechas
    if (filterFechaDesde) {
      filtered = filtered.filter(s => s.fecha && s.fecha >= filterFechaDesde);
    }
    if (filterFechaHasta) {
      filtered = filtered.filter(s => s.fecha && s.fecha <= filterFechaHasta);
    }

    // Ordenamiento
    filtered.sort((a, b) => {
      let valA, valB;
      if (sortField === 'garantia_orden') {
        // SÍ=1, NO=2, -=3
        const g = (s) => { const e = estaEnGarantia(s.fecha_fin_garantia); return e === true ? 1 : e === false ? 2 : 3; };
        valA = g(a);
        valB = g(b);
      } else {
        valA = a[sortField];
        valB = b[sortField];
        const numericFields = ['costo_servicio', 'monto_facturado_servicio', 'monto_facturado_partes'];
        if (numericFields.includes(sortField)) {
          valA = parseFloat(valA) || 0;
          valB = parseFloat(valB) || 0;
        } else {
          valA = (valA || '').toString().toLowerCase();
          valB = (valB || '').toString().toLowerCase();
        }
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [servicios, searchTerm, sortField, sortDir, filterEstado, filterGarantia, filterFechaDesde, filterFechaHasta]);

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
          <span className="st-stat-value">₲{formatNumber(totales.costoTotal)}</span>
        </div>
        <div className="st-stat-card">
          <span className="st-stat-label">Facturado Serv.</span>
          <span className="st-stat-value">₲{formatNumber(totales.facturadoServicio)}</span>
        </div>
        <div className="st-stat-card">
          <span className="st-stat-label">Facturado Partes</span>
          <span className="st-stat-value">₲{formatNumber(totales.facturadoPartes)}</span>
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
          <option value="En proceso">En proceso</option>
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
        <div className="st-date-range">
          <input
            type="date"
            value={filterFechaDesde}
            onChange={(e) => setFilterFechaDesde(e.target.value)}
            className="st-date-input"
            title="Fecha desde"
          />
          <span className="st-date-separator">→</span>
          <input
            type="date"
            value={filterFechaHasta}
            onChange={(e) => setFilterFechaHasta(e.target.value)}
            className="st-date-input"
            title="Fecha hasta"
          />
          {(filterFechaDesde || filterFechaHasta) && (
            <button
              onClick={() => { setFilterFechaDesde(''); setFilterFechaHasta(''); }}
              className="st-date-clear"
              title="Limpiar fechas"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button onClick={fetchServicios} className="st-btn-icon" title="Recargar">
          <RefreshCw size={16} />
        </button>
        <div ref={exportMenuRef} style={{ position: 'relative' }}>
          <button onClick={() => setShowExportMenu(!showExportMenu)} className="st-btn-export" title="Exportar datos">
            <ExternalLink size={16} />
          </button>
          {showExportMenu && (
            <div className="st-export-menu">
              <button onClick={handleExportExcel} className="st-export-option">
                <FileText size={14} /> Exportar a Excel
              </button>
              <button onClick={handleExportPDF} className="st-export-option">
                <Download size={14} /> Exportar a PDF
              </button>
            </div>
          )}
        </div>
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
                <th onClick={() => handleSort('nro_rt')}>RPT <SortIcon field="nro_rt" /></th>
                <th onClick={() => handleSort('fecha')}>FECHA <SortIcon field="fecha" /></th>
                <th onClick={() => handleSort('cliente')}>CLIENTE <SortIcon field="cliente" /></th>
                <th onClick={() => handleSort('modelo')}>MOD <SortIcon field="modelo" /></th>
                <th onClick={() => handleSort('serial_number')}>S/N <SortIcon field="serial_number" /></th>
                <th onClick={() => handleSort('caso')}>CASO <SortIcon field="caso" /></th>
                <th onClick={() => handleSort('costo_servicio')}>COSTO <SortIcon field="costo_servicio" /></th>
                <th onClick={() => handleSort('garantia_orden')}>GTÍA <SortIcon field="garantia_orden" /></th>
                <th onClick={() => handleSort('monto_facturado_servicio')}>₲FAC SERV <SortIcon field="monto_facturado_servicio" /></th>
                <th onClick={() => handleSort('monto_facturado_partes')}>₲FAC PARTES <SortIcon field="monto_facturado_partes" /></th>
                <th onClick={() => handleSort('nro_factura')}>N° FAC <SortIcon field="nro_factura" /></th>
                <th onClick={() => handleSort('fecha_factura')}>FECHA FAC <SortIcon field="fecha_factura" /></th>
                <th onClick={() => handleSort('estado_cobro')}>ESTADO <SortIcon field="estado_cobro" /></th>
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
                    <td>{s.nro_rt}</td>
                    <td>{formatDate(s.fecha)}</td>
                    <td className="st-cell-cliente">{s.cliente}</td>
                    <td>{s.modelo}</td>
                    <td>{s.serial_number}</td>
                    <td className="st-cell-caso" title={s.caso}>{s.caso}</td>
                    <td className="st-cell-number">
                      {s.costo_servicio ? `₲${formatNumber(s.costo_servicio)}` : ''}
                    </td>
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
                      {s.monto_facturado_servicio ? `₲${formatNumber(s.monto_facturado_servicio)}` : ''}
                    </td>
                    <td className="st-cell-number">
                      {s.monto_facturado_partes ? `₲${formatNumber(s.monto_facturado_partes)}` : ''}
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
              {/* Fila 1: Reporte, RPT y Fecha */}
              <div className="st-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div className="st-form-group">
                  <label>📋 N° Reporte *</label>
                  <input type="text" value={formData.nro_reporte}
                    onChange={(e) => setFormData({...formData, nro_reporte: e.target.value})}
                    placeholder="Ej: 1278" />
                </div>
                <div className="st-form-group">
                  <label>🔖 N° RPT</label>
                  <input type="text" value={formData.nro_rt}
                    onChange={(e) => setFormData({...formData, nro_rt: e.target.value})}
                    placeholder="Ej: RPT-0045" />
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
                  <input type="number" step="1" value={formData.costo_servicio}
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
                  <label>₲FAC Servicio</label>
                  <input type="number" step="1" value={formData.monto_facturado_servicio}
                    onChange={(e) => setFormData({...formData, monto_facturado_servicio: e.target.value})}
                    placeholder="0" />
                </div>
                <div className="st-form-group">
                  <label>₲FAC Partes</label>
                  <input type="number" step="1" value={formData.monto_facturado_partes}
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
              {editingServicio && (
                <button onClick={() => { setShowModal(false); handleOpenInforme(editingServicio); }} className="st-btn-import">
                  <FileText size={16} /> Informe
                </button>
              )}
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
          <div className="st-modal st-modal-informe" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '750px' }}>
            <div className="st-modal-header">
              <h3>📄 Informe - Reporte #{informeServicio?.nro_reporte} {informeServicio?.nro_rt ? `(RPT: ${informeServicio.nro_rt})` : ''}</h3>
              <button onClick={() => setShowInformeModal(false)} className="st-modal-close"><X size={20} /></button>
            </div>
            <div className="st-modal-body">
              {/* Info del servicio */}
              <div className="st-informe-info">
                <span><strong>Cliente:</strong> {informeServicio?.cliente}</span>
                <span><strong>Modelo:</strong> {informeServicio?.modelo} — S/N: {informeServicio?.serial_number}</span>
                <span><strong>Caso:</strong> {informeServicio?.caso}</span>
              </div>

              {/* PASO 1: Pegar texto */}
              {informePaso === 1 && (
                <>
                  <div className="st-form-group">
                    <label>📋 Pegá el texto del informe aquí:</label>
                    <textarea
                      value={informeTexto}
                      onChange={(e) => setInformeTexto(e.target.value)}
                      placeholder="Pegá el texto del informe técnico tal como viene. El sistema lo reformulará en un informe profesional, separando descripción, repuestos y recomendaciones."
                      rows={10}
                      className="st-informe-textarea"
                    />
                  </div>
                  <div className="st-informe-hint">
                    🤖 El texto será procesado por inteligencia artificial: reformulará la redacción con lenguaje técnico formal, separará repuestos/partes cambiadas y recomendaciones a futuro. Después podrás editar todo antes de generar el PDF.
                  </div>
                </>
              )}

              {/* PASO 2: Editar informe estructurado */}
              {informePaso === 2 && informeEditado && (
                <div className="st-informe-editor">
                  <div className="st-form-group">
                    <label>📋 Descripción del servicio realizado</label>
                    <textarea
                      value={informeEditado.descripcion}
                      onChange={(e) => setInformeEditado({...informeEditado, descripcion: e.target.value})}
                      rows={5}
                      className="st-informe-textarea"
                    />
                  </div>

                  {/* Repuestos */}
                  <div className="st-informe-section-edit" style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                    <label style={{ color: '#c2410c', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px', display: 'block' }}>🔧 Repuestos / Partes Reemplazadas</label>
                    {informeEditado.repuestos.map((r, i) => (
                      <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '4px', alignItems: 'center' }}>
                        <input type="text" value={r}
                          onChange={(e) => {
                            const arr = [...informeEditado.repuestos];
                            arr[i] = e.target.value;
                            setInformeEditado({...informeEditado, repuestos: arr});
                          }}
                          style={{ flex: 1, padding: '6px 8px', border: '1px solid #fed7aa', borderRadius: '4px', fontSize: '0.82rem' }}
                        />
                        <button onClick={() => {
                          const arr = informeEditado.repuestos.filter((_, idx) => idx !== i);
                          setInformeEditado({...informeEditado, repuestos: arr});
                        }} style={{ background: 'none', border: 'none', color: '#c2410c', cursor: 'pointer', padding: '2px' }}><X size={14} /></button>
                      </div>
                    ))}
                    <button onClick={() => setInformeEditado({...informeEditado, repuestos: [...informeEditado.repuestos, '']})}
                      style={{ background: 'none', border: '1px dashed #fed7aa', color: '#c2410c', padding: '4px 10px', borderRadius: '4px', fontSize: '0.78rem', cursor: 'pointer', marginTop: '4px' }}>
                      <Plus size={12} /> Agregar repuesto
                    </button>
                  </div>

                  {/* Recomendaciones */}
                  <div className="st-informe-section-edit" style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                    <label style={{ color: '#a16207', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px', display: 'block' }}>⚠️ Recomendaciones y Acciones Futuras</label>
                    {informeEditado.recomendaciones.map((r, i) => (
                      <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '4px', alignItems: 'center' }}>
                        <input type="text" value={r}
                          onChange={(e) => {
                            const arr = [...informeEditado.recomendaciones];
                            arr[i] = e.target.value;
                            setInformeEditado({...informeEditado, recomendaciones: arr});
                          }}
                          style={{ flex: 1, padding: '6px 8px', border: '1px solid #fde68a', borderRadius: '4px', fontSize: '0.82rem' }}
                        />
                        <button onClick={() => {
                          const arr = informeEditado.recomendaciones.filter((_, idx) => idx !== i);
                          setInformeEditado({...informeEditado, recomendaciones: arr});
                        }} style={{ background: 'none', border: 'none', color: '#a16207', cursor: 'pointer', padding: '2px' }}><X size={14} /></button>
                      </div>
                    ))}
                    <button onClick={() => setInformeEditado({...informeEditado, recomendaciones: [...informeEditado.recomendaciones, '']})}
                      style={{ background: 'none', border: '1px dashed #fde68a', color: '#a16207', padding: '4px 10px', borderRadius: '4px', fontSize: '0.78rem', cursor: 'pointer', marginTop: '4px' }}>
                      <Plus size={12} /> Agregar recomendación
                    </button>
                  </div>

                  {/* Costo - calculado automáticamente */}
                  <div className="st-form-group">
                    <label>💰 Costo en el PDF (automático: si hay ₲FAC cargados se suman, sino costo × 2) + IVA incluido</label>
                    <div style={{ padding: '8px 12px', background: '#f0f4f8', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 600, color: '#2F4156' }}>
                      {(() => {
                        const fs = parseFloat(informeServicio?.monto_facturado_servicio) || 0;
                        const fp = parseFloat(informeServicio?.monto_facturado_partes) || 0;
                        const cb = parseFloat(informeServicio?.costo_servicio) || 0;
                        const total = (fs > 0 || fp > 0) ? Math.round(fs + fp) : Math.round(cb * 2);
                        const origen = (fs > 0 || fp > 0) 
                          ? `₲FAC Serv: ₲${formatNumber(fs)} + ₲FAC Partes: ₲${formatNumber(fp)}`
                          : `costo base: ₲${formatNumber(cb)} × 2`;
                        return <>
                          ₲{formatNumber(total)} - IVA incluido
                          <span style={{ fontWeight: 400, fontSize: '0.78rem', color: '#94a3b8', marginLeft: '10px' }}>
                            ({origen})
                          </span>
                        </>;
                      })()}
                    </div>
                  </div>

                  {/* Observaciones */}
                  <div className="st-form-group">
                    <label>📝 Observaciones adicionales</label>
                    <textarea
                      value={informeEditado.observaciones}
                      onChange={(e) => setInformeEditado({...informeEditado, observaciones: e.target.value})}
                      rows={3}
                      className="st-informe-textarea"
                      placeholder="Cualquier observación extra que quieras incluir en el informe..."
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="st-modal-footer">
              {informePaso === 1 && (
                <>
                  <button onClick={() => setShowInformeModal(false)} className="st-btn-cancel">
                    <X size={16} /> Cancelar
                  </button>
                  <button onClick={handleProcesarInforme} className="st-btn-save" disabled={generandoInforme}>
                    {generandoInforme ? (
                      <><RefreshCw size={16} className="st-spin" /> Procesando con IA...</>
                    ) : (
                      <><FileText size={16} /> Procesar con IA</>
                    )}
                  </button>
                </>
              )}
              {informePaso === 2 && (
                <>
                  <button onClick={() => setInformePaso(1)} className="st-btn-cancel">
                    ← Volver a pegar texto
                  </button>
                  <button onClick={handleGuardarInforme} className="st-btn-import" disabled={generandoInforme}>
                    <Save size={16} /> {generandoInforme ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button onClick={handleGuardarYExportarPDF} className="st-btn-save" disabled={generandoInforme}>
                    <Download size={16} /> {generandoInforme ? 'Generando...' : 'Guardar y Exportar PDF'}
                  </button>
                </>
              )}
              {informePaso === 2 && informeServicio?.informe_formateado && (
                <>
                  <button onClick={() => { handleDescargarInforme(informeServicio); }} className="st-btn-import" style={{ marginLeft: '0' }}>
                    <Download size={16} /> Ver PDF anterior
                  </button>
                  <button onClick={handleBorrarInforme} className="st-btn-cancel" style={{ marginLeft: '0', color: '#dc2626', borderColor: '#dc2626' }}>
                    <Trash2 size={16} /> Borrar informe
                  </button>
                </>
              )}
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
                              <td style={{ padding: '4px 8px', textAlign: 'right' }}>{r.costo_servicio ? `₲${formatNumber(r.costo_servicio)}` : '-'}</td>
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
                    <strong>Orden de columnas:</strong> REPO | FECHA | CLIENTE | MODELO | S/N | CASO | COSTO | FIN GTÍA | ₲FAC SERV | ₲FAC PARTES | N° FAC | FECHA FAC | ESTADO | RPT
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
                  <div style={{ fontSize: '2rem', marginBottom: '12px' }}>{importResults.errors > 0 ? '⚠️' : '✅'}</div>
                  <h3 style={{ color: '#2F4156', marginBottom: '16px' }}>Importación completada</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', maxWidth: '300px', margin: '0 auto', textAlign: 'left' }}>
                    <span style={{ fontWeight: 600, color: '#16a34a' }}>✓ Insertados:</span><span>{importResults.inserted}</span>
                    {importResults.updated > 0 && <><span style={{ fontWeight: 600, color: '#2563eb' }}>↻ Actualizados:</span><span>{importResults.updated}</span></>}
                    {importResults.skipped > 0 && <><span style={{ fontWeight: 600, color: '#d97706' }}>⊘ Saltados:</span><span>{importResults.skipped}</span></>}
                    {importResults.errors > 0 && <><span style={{ fontWeight: 600, color: '#dc2626' }}>✗ Errores:</span><span>{importResults.errors}</span></>}
                  </div>

                  {/* Detalle de errores */}
                  {importResults.errorDetails && importResults.errorDetails.length > 0 && (
                    <div style={{ marginTop: '20px', textAlign: 'left' }}>
                      <h4 style={{ color: '#dc2626', fontSize: '0.9rem', marginBottom: '8px' }}>Detalle de errores:</h4>
                      <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #fca5a5', borderRadius: '8px', background: '#fef2f2' }}>
                        <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: '#fee2e2' }}>
                              <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>REPO</th>
                              <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>CLIENTE</th>
                              <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>MOTIVO</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importResults.errorDetails.map((err, i) => (
                              <tr key={i} style={{ borderTop: '1px solid #fca5a5' }}>
                                <td style={{ padding: '5px 10px', fontWeight: 600 }}>{err.nro_reporte}</td>
                                <td style={{ padding: '5px 10px' }}>{err.cliente}</td>
                                <td style={{ padding: '5px 10px', color: '#991b1b', fontSize: '0.75rem' }}>{err.motivo}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
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
