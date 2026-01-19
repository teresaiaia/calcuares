import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { Trash2, Plus, Upload, Search, Download, RefreshCw, Eye, DollarSign } from 'lucide-react';
import * as XLSX from 'xlsx';
import './App.css';

export default function Calcuares() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(1.10);
  const [globalInterest, setGlobalInterest] = useState(12);
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState('admin'); // 'admin' o 'ventas'

  const categories = ['UC', 'HP', 'ACC', 'CONS', 'SRVP'];

  // Cargar productos desde Supabase al iniciar
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
      alert('Error al cargar productos desde Supabase.');
    } finally {
      setLoading(false);
    }
  };

  // Guardar/actualizar producto en Supabase
  const saveProduct = async (product) => {
    try {
      setSaving(true);
      
      const productData = {
        cod: product.cod || '',
        brand: product.brand || '',
        ori: product.ori || '',
        prod: product.prod || '',
        cat: product.cat || 'UC',
        pp: parseFloat(product.pp || 0),
        frt: parseFloat(product.frt || 0),
        bnk: parseFloat(product.bnk || 0),
        adu: parseFloat(product.adu || 0),
        serv: parseFloat(product.serv || 0),
        trng: parseFloat(product.trng || 0),
        extr: parseFloat(product.extr || 0),
        margin: parseFloat(product.margin || 0),
        fixed_price: parseFloat(product.fixed_price || 0),
        price_in_eur: product.price_in_eur || false
      };
      
      if (product.id && product.id > 0) {
        // Actualizar producto existente
        const { error } = await supabase
          .from('productos')
          .update(productData)
          .eq('id', product.id);
        
        if (error) throw error;
      } else {
        // Crear nuevo producto
        const { data, error } = await supabase
          .from('productos')
          .insert([productData])
          .select();
        
        if (error) throw error;
        
        // Reemplazar el producto temporal con el real
        setProducts(prev => prev.map(p => 
          p.id === product.id ? data[0] : p
        ));
      }
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Error al guardar producto: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Eliminar producto
  const deleteProduct = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este producto?')) return;
    
    try {
      // Si es un producto temporal (id negativo), solo eliminarlo del estado
      if (id < 0) {
        setProducts(prev => prev.filter(p => p.id !== id));
        return;
      }

      const { error } = await supabase
        .from('productos')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Error al eliminar producto: ' + error.message);
    }
  };

  // Agregar nuevo producto (con ID temporal negativo)
  const addProduct = () => {
    const tempId = -Date.now(); // ID temporal negativo
    const newProduct = {
      id: tempId,
      cod: '',
      brand: '',
      ori: '',
      prod: '',
      cat: 'UC',
      pp: 0,
      frt: 0,
      bnk: 0,
      adu: 0,
      serv: 0,
      trng: 0,
      extr: 0,
      margin: 0,
      fixed_price: 0,
      price_in_eur: false
    };
    
    setProducts(prev => [newProduct, ...prev]);
  };

  // Actualizar campo y guardar automáticamente
  const handleInputChange = useCallback((id, field, value) => {
    setProducts(prev => {
      const updated = prev.map(p => 
        p.id === id ? { ...p, [field]: value } : p
      );
      
      // Guardar automáticamente después de 1 segundo
      const product = updated.find(p => p.id === id);
      if (product) {
        setTimeout(() => saveProduct(product), 1000);
      }
      
      return updated;
    });
  }, []);

  // Cálculos de backend
  const calculateBackend = useCallback((product) => {
    const ppOriginal = parseFloat(product.pp || 0);
    const rate = parseFloat(exchangeRate);
    const ppInUSD = product.price_in_eur ? ppOriginal * rate : ppOriginal;
    
    const fob = ppInUSD + parseFloat(product.frt || 0);
    const gtia = fob * 0.03;
    const desp = fob * (parseFloat(product.adu || 0) / 100);
    const kst = fob + parseFloat(product.bnk || 0) + desp + parseFloat(product.serv || 0) + gtia + parseFloat(product.trng || 0) + parseFloat(product.extr || 0);
    
    return { fob, gtia, desp, kst, ppOriginal, ppInUSD, isEUR: product.price_in_eur };
  }, [exchangeRate]);

  // Cálculos de venta
  const calculateSales = useCallback((kst, margin, interest, fixedPrice = null) => {
    const cashNet = fixedPrice && parseFloat(fixedPrice) > 0 
      ? parseFloat(fixedPrice) 
      : kst * (1 + margin / 100);
    
    const cashIva = cashNet * 1.10;
    const initialPayment = cashIva * 0.50;
    const financedAmount = cashIva * 0.50;
    
    const monthlyRate = interest / 100 / 12;
    const months = 12;
    let cuot = 0;
    
    if (interest > 0) {
      cuot = financedAmount * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
    } else {
      cuot = financedAmount / months;
    }
    
    const finIva = initialPayment + (cuot * months);
    
    return { 
      cashNet, 
      cashIva, 
      finIva, 
      cuot, 
      initialPayment, 
      isFixedPrice: fixedPrice && parseFloat(fixedPrice) > 0 
    };
  }, []);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-PY', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Importar archivo Excel/CSV
  const handleFileImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      let data = [];
      
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        // Importar Excel
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet);
      } else {
        // Importar CSV
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        data = lines.slice(1).map(line => {
          const values = line.split(',');
          const obj = {};
          headers.forEach((header, i) => {
            obj[header] = values[i]?.trim() || '';
          });
          return obj;
        });
      }

      // Convertir datos importados a formato de productos
      const newProducts = data.map(row => ({
        cod: row.cod || row.codigo || '',
        brand: row.brand || row.marca || '',
        ori: row.ori || row.origen || '',
        prod: row.prod || row.producto || '',
        cat: (row.cat || row.categoria || 'UC').toUpperCase(),
        pp: parseFloat(row.pp || row.precio || 0),
        frt: parseFloat(row.frt || row.flete || 0),
        bnk: parseFloat(row.bnk || row.banco || 0),
        adu: parseFloat(row.adu || row.aduana || 0),
        serv: parseFloat(row.serv || row.servicio || 0),
        trng: parseFloat(row.trng || row.capacitacion || 0),
        extr: parseFloat(row.extr || row.imprevistos || 0),
        margin: parseFloat(row.margin || row.margen || 0),
        fixed_price: parseFloat(row.fixedprice || row.precio_fijo || 0),
        price_in_eur: (row.priceineur || row.eur || '').toLowerCase() === 'true'
      }));

      // Guardar cada producto en Supabase
      for (const product of newProducts) {
        const { error } = await supabase
          .from('productos')
          .insert([product]);
        
        if (error) console.error('Error importing product:', error);
      }
      
      // Recargar productos
      await fetchProducts();
      alert(`✅ ${newProducts.length} productos importados exitosamente`);
    } catch (error) {
      console.error('Error importing file:', error);
      alert('Error al importar archivo: ' + error.message);
    }
    
    e.target.value = '';
  };

  // Exportar datos a CSV
  const exportData = () => {
    let csv = 'COD,BRAND,ORI,PROD,CAT,PP,FRT,BNK,ADU,SERV,TRNG,EXTR,MARGIN,FIXEDPRICE,PRICEINEUR\n';
    products.forEach(p => {
      csv += `${p.cod},${p.brand},${p.ori},${p.prod},${p.cat},${p.pp},${p.frt},${p.bnk},${p.adu},${p.serv},${p.trng},${p.extr},${p.margin},${p.fixed_price || 0},${p.price_in_eur ? 'true' : 'false'}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `productos_ares_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtrar productos por búsqueda
  const filteredProducts = products.filter(p => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      p.cod?.toLowerCase().includes(search) ||
      p.brand?.toLowerCase().includes(search) ||
      p.ori?.toLowerCase().includes(search) ||
      p.prod?.toLowerCase().includes(search) ||
      p.cat?.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <div className="loading">
        <RefreshCw className="animate-spin" size={32} />
        <span style={{ marginLeft: '1rem' }}>Cargando productos...</span>
      </div>
    );
  }

  // ==================== VISTA DE VENTAS ====================
  const VentasView = () => (
    <div className="app-container">
      {/* Header Vista Ventas */}
      <div className="card header-card" style={{ background: '#567C8D' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>
              💰 Lista de Precios - Ares
            </h1>
            <p style={{ color: 'white', fontSize: '1.1rem' }}>Catálogo de Productos y Cotizaciones</p>
          </div>
          <button
            onClick={() => setView('admin')}
            className="btn btn-success"
            style={{ background: 'white', color: '#567C8D' }}
          >
            <DollarSign size={20} />
            Panel Admin
          </button>
        </div>

        {/* Info global */}
        <div style={{ background: 'rgba(255,255,255,0.2)', padding: '1rem', borderRadius: '10px', color: 'white' }}>
          <div style={{ display: 'flex', gap: '2rem', fontSize: '0.9rem' }}>
            <div>
              <strong>💵 Interés Anual:</strong> {globalInterest}%
            </div>
            <div>
              <strong>💱 Tipo de Cambio EUR→USD:</strong> {exchangeRate}
            </div>
            <div>
              <strong>📊 Total Productos:</strong> {products.length}
            </div>
          </div>
        </div>
      </div>

      {/* Búsqueda */}
      <div className="card">
        <div className="search-container" style={{ margin: 0 }}>
          <Search className="search-icon" size={20} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="🔍 Buscar por código, marca, origen, producto o categoría..."
            className="input search-input"
          />
        </div>
        <div style={{ marginTop: '0.75rem', color: '#64748b', fontSize: '0.875rem' }}>
          📊 {filteredProducts.length} {filteredProducts.length === 1 ? 'producto' : 'productos'} {searchTerm ? 'encontrados' : 'disponibles'}
        </div>
      </div>

      {/* Lista de Productos - Vista de Ventas */}
      {filteredProducts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: '#64748b', fontSize: '1.1rem' }}>
            {products.length === 0 ? '📦 No hay productos disponibles' : '🔍 No se encontraron productos'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
          {filteredProducts.map(product => {
            const calc = calculateBackend(product);
            const sales = calculateSales(calc.kst, parseFloat(product.margin || 0), parseFloat(globalInterest || 0), product.fixed_price);
            
            return (
              <div key={product.id} className="card" style={{ border: '2px solid #e2e8f0', padding: '1.5rem' }}>
                {/* Header del producto */}
                <div style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
                    {product.cod}
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.5rem' }}>
                    {product.prod || 'Sin nombre'}
                  </h3>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span className="badge badge-blue">{product.brand}</span>
                    <span className="badge badge-purple">{product.ori}</span>
                    <span className="badge badge-green">{product.cat}</span>
                  </div>
                </div>

                {/* Precios de Venta */}
                <div style={{ background: '#d1fae5', borderRadius: '10px', padding: '1rem', border: '2px solid #10b981' }}>
                  <h4 style={{ color: '#065f46', fontSize: '1rem', fontWeight: '700', marginBottom: '0.75rem' }}>
                    💵 Precios de Venta
                    {sales.isFixedPrice && (
                      <span className="badge badge-orange" style={{ marginLeft: '0.5rem', fontSize: '0.65rem' }}>
                        PRECIO ESPECIAL
                      </span>
                    )}
                  </h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#065f46' }}>💳 Contado (Neto):</span>
                      <span style={{ fontWeight: '600' }}>${formatCurrency(sales.cashNet)}</span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#065f46' }}>💳 Contado + IVA (10%):</span>
                      <span style={{ fontWeight: '700' }}>${formatCurrency(sales.cashIva)}</span>
                    </div>
                    
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      paddingTop: '0.5rem', 
                      borderTop: '2px solid #10b981',
                      marginTop: '0.25rem'
                    }}>
                      <span style={{ color: '#047857', fontWeight: '700' }}>💰 Financiado + IVA:</span>
                      <span style={{ color: '#047857', fontWeight: '700', fontSize: '1rem' }}>
                        ${formatCurrency(sales.finIva)}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#065f46' }}>📅 Cuota Mensual (12 meses):</span>
                      <span style={{ fontWeight: '600', color: '#059669' }}>${formatCurrency(sales.cuot)}</span>
                    </div>
                  </div>
                </div>

                {/* Info adicional */}
                <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#64748b', textAlign: 'center', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0' }}>
                  Interés: {globalInterest}% anual | Pago inicial: 50%
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ==================== VISTA ADMIN ====================
  const AdminView = () => (
    <div className="app-container">
      {/* Header */}
      <div className="card header-card" style={{ background: '#567C8D' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>
              💰 Calcuares
            </h1>
            <p style={{ color: 'white', fontSize: '1.1rem' }}>Calculadora de Precios - Ares Medical Equipment</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {saving && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', fontWeight: '600', background: 'white', padding: '0.5rem 1rem', borderRadius: '8px' }}>
                <RefreshCw className="animate-spin" size={20} />
                <span>Guardando...</span>
              </div>
            )}
            <button
              onClick={() => setView('ventas')}
              className="btn btn-success"
              style={{ background: 'white', color: '#567C8D' }}
            >
              <Eye size={20} />
              Vista de Ventas
            </button>
          </div>
        </div>

        {/* Configuración Global */}
        <div className="grid grid-3">
          <div>
            <label className="input-label" style={{ color: 'white' }}>💵 Interés Anual Global (%)</label>
            <input
              type="number"
              step="0.01"
              value={globalInterest}
              onChange={(e) => setGlobalInterest(e.target.value)}
              className="input"
              placeholder="Ej: 12"
            />
          </div>

          <div>
            <label className="input-label" style={{ color: 'white' }}>💱 Tipo de Cambio EUR → USD</label>
            <input
              type="number"
              step="0.01"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
              className="input"
              placeholder="Ej: 1.10"
            />
          </div>

          <div>
            <label className="input-label" style={{ color: 'white' }}>📁 Importar / Exportar</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <label className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', cursor: 'pointer' }}>
                <Upload size={18} />
                Importar
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileImport}
                  style={{ display: 'none' }}
                />
              </label>
              <button onClick={exportData} className="btn btn-secondary">
                <Download size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Búsqueda y Agregar */}
      <div className="card">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div className="search-container" style={{ flex: 1, margin: 0 }}>
            <Search className="search-icon" size={20} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="🔍 Buscar por código, marca, origen, producto o categoría..."
              className="input search-input"
            />
          </div>
          <button onClick={addProduct} className="btn btn-success">
            <Plus size={20} />
            Agregar Producto
          </button>
          <button onClick={fetchProducts} className="btn btn-secondary" title="Recargar productos">
            <RefreshCw size={20} />
          </button>
        </div>
        <div style={{ marginTop: '0.75rem', color: '#64748b', fontSize: '0.875rem' }}>
          📊 {filteredProducts.length} {filteredProducts.length === 1 ? 'producto' : 'productos'} {searchTerm ? 'encontrados' : 'totales'}
        </div>
      </div>

      {/* Lista de Productos */}
      {filteredProducts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: '#64748b', marginBottom: '1rem', fontSize: '1.1rem' }}>
            {products.length === 0 ? '📦 No hay productos registrados' : '🔍 No se encontraron productos'}
          </p>
          {products.length === 0 && (
            <button onClick={addProduct} className="btn btn-primary">
              <Plus size={20} />
              Agregar Primer Producto
            </button>
          )}
        </div>
      ) : (
        filteredProducts.map(product => {
          const calc = calculateBackend(product);
          const sales = calculateSales(calc.kst, parseFloat(product.margin || 0), parseFloat(globalInterest || 0), product.fixed_price);
          
          return (
            <div key={product.id} className="card product-card">
              <div className="product-header">
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1e293b' }}>
                    {product.cod || `🆕 Producto Nuevo`}
                  </h2>
                  <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                    {product.prod || 'Sin modelo definido'}
                  </p>
                </div>
                <button
                  onClick={() => deleteProduct(product.id)}
                  className="btn btn-danger"
                  style={{ padding: '0.5rem 1rem' }}
                >
                  <Trash2 size={18} />
                  Eliminar
                </button>
              </div>

              {/* Campos del Producto */}
              <div className="grid grid-4">
                <div>
                  <label className="input-label">📝 Código (COD)</label>
                  <input
                    type="text"
                    defaultValue={product.cod}
                    onBlur={(e) => handleInputChange(product.id, 'cod', e.target.value)}
                    className="input"
                    placeholder="Ej: VOL-001"
                  />
                </div>

                <div>
                  <label className="input-label">🏢 Marca (BRAND)</label>
                  <input
                    type="text"
                    defaultValue={product.brand}
                    onBlur={(e) => handleInputChange(product.id, 'brand', e.target.value)}
                    className="input"
                    placeholder="Ej: Classys"
                  />
                </div>

                <div>
                  <label className="input-label">🌍 Origen (ORI)</label>
                  <input
                    type="text"
                    defaultValue={product.ori}
                    onBlur={(e) => handleInputChange(product.id, 'ori', e.target.value)}
                    className="input"
                    placeholder="Ej: Corea"
                  />
                </div>

                <div>
                  <label className="input-label">📦 Producto/Modelo (PROD)</label>
                  <input
                    type="text"
                    defaultValue={product.prod}
                    onBlur={(e) => handleInputChange(product.id, 'prod', e.target.value)}
                    className="input"
                    placeholder="Ej: Ultraformer III"
                  />
                </div>

                <div>
                  <label className="input-label">🏷️ Categoría (CAT)</label>
                  <select
                    defaultValue={product.cat}
                    onChange={(e) => handleInputChange(product.id, 'cat', e.target.value)}
                    className="input"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="input-label">
                    💰 Precio (PP) {product.price_in_eur && <span className="badge badge-green">EUR</span>}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={product.pp}
                    onBlur={(e) => handleInputChange(product.id, 'pp', e.target.value)}
                    className="input"
                    placeholder="0.00"
                  />
                  {product.price_in_eur && calc.ppInUSD > 0 && (
                    <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.25rem' }}>
                      ≈ ${formatCurrency(calc.ppInUSD)} USD
                    </div>
                  )}
                </div>

                <div>
                  <label className="input-label">💶 ¿Precio en EUR?</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={product.price_in_eur}
                      onChange={(e) => handleInputChange(product.id, 'price_in_eur', e.target.checked)}
                      style={{ width: '1.25rem', height: '1.25rem' }}
                    />
                    <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>
                      {product.price_in_eur ? '✅ Sí' : '❌ No'}
                    </span>
                  </label>
                </div>

                <div>
                  <label className="input-label">🚚 Flete (FRT)</label>
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={product.frt}
                    onBlur={(e) => handleInputChange(product.id, 'frt', e.target.value)}
                    className="input"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="input-label">🏦 Banco (BNK)</label>
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={product.bnk}
                    onBlur={(e) => handleInputChange(product.id, 'bnk', e.target.value)}
                    className="input"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="input-label">📋 Aduana % (ADU)</label>
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={product.adu}
                    onBlur={(e) => handleInputChange(product.id, 'adu', e.target.value)}
                    className="input"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="input-label">🔧 Servicio (SERV)</label>
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={product.serv}
                    onBlur={(e) => handleInputChange(product.id, 'serv', e.target.value)}
                    className="input"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="input-label">👨‍🏫 Capacitación (TRNG)</label>
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={product.trng}
                    onBlur={(e) => handleInputChange(product.id, 'trng', e.target.value)}
                    className="input"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="input-label">⚠️ Imprevistos (EXTR)</label>
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={product.extr}
                    onBlur={(e) => handleInputChange(product.id, 'extr', e.target.value)}
                    className="input"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="input-label">📊 Margen % (MARGIN)</label>
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={product.margin}
                    onBlur={(e) => handleInputChange(product.id, 'margin', e.target.value)}
                    className="input"
                    placeholder="0.00"
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label className="input-label">🎯 Precio Fijo Manual (Opcional)</label>
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={product.fixed_price || ''}
                    onBlur={(e) => handleInputChange(product.id, 'fixed_price', e.target.value)}
                    placeholder="Dejar en 0 para usar cálculo automático"
                    className="input"
                    style={{ background: '#fff7ed', borderColor: '#fb923c' }}
                  />
                  <p style={{ fontSize: '0.75rem', color: '#9a3412', marginTop: '0.25rem' }}>
                    💡 Si ingresas un precio fijo, se usará en lugar del cálculo automático
                  </p>
                </div>
              </div>

              {/* Resultados de Cálculos */}
              <div className="grid grid-2" style={{ marginTop: '2rem' }}>
                {/* Costos Backend */}
                <div className="cost-section" style={{ background: '#f1f5f9', border: '2px solid #cbd5e1' }}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    💼 Costos Backend
                  </h3>
                  {calc.isEUR && (
                    <div className="cost-row" style={{ background: '#d1fae5', padding: '0.5rem', borderRadius: '6px', marginBottom: '0.75rem', border: '1px solid #10b981' }}>
                      <span style={{ color: '#065f46', fontWeight: '600' }}>💶 PP Original (EUR):</span>
                      <span style={{ color: '#065f46', fontWeight: '700' }}>€{formatCurrency(calc.ppOriginal)}</span>
                    </div>
                  )}
                  {calc.isEUR && (
                    <div className="cost-row">
                      <span>💵 PP Convertido (USD):</span>
                      <span>${formatCurrency(calc.ppInUSD)}</span>
                    </div>
                  )}
                  <div className="cost-row">
                    <span>📦 FOB:</span>
                    <span>${formatCurrency(calc.fob)}</span>
                  </div>
                  <div className="cost-row">
                    <span>🛡️ Garantía (3%):</span>
                    <span>${formatCurrency(calc.gtia)}</span>
                  </div>
                  <div className="cost-row">
                    <span>📋 Despacho:</span>
                    <span>${formatCurrency(calc.desp)}</span>
                  </div>
                  <div className="cost-row total">
                    <span style={{ color: '#2563eb', fontSize: '1.1rem' }}>💰 KST Total:</span>
                    <span style={{ color: '#2563eb', fontSize: '1.1rem' }}>${formatCurrency(calc.kst)}</span>
                  </div>
                </div>

                {/* Precios de Venta */}
                <div className="cost-section" style={{ background: '#d1fae5', border: '2px solid #10b981' }}>
                  <h3 style={{ color: '#065f46', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    💵 Precios de Venta
                    {sales.isFixedPrice && (
                      <span className="badge badge-orange">PRECIO FIJO</span>
                    )}
                  </h3>
                  <div className="cost-row">
                    <span style={{ color: '#065f46' }}>💳 Contado (Neto):</span>
                    <span style={{ fontWeight: '600' }}>${formatCurrency(sales.cashNet)}</span>
                  </div>
                  <div className="cost-row">
                    <span style={{ color: '#065f46' }}>💳 Contado + IVA (10%):</span>
                    <span style={{ fontWeight: '700' }}>${formatCurrency(sales.cashIva)}</span>
                  </div>
                  <div className="cost-row total" style={{ borderColor: '#10b981', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
                    <span style={{ color: '#047857', fontSize: '1.1rem' }}>💰 Financiado + IVA:</span>
                    <span style={{ color: '#047857', fontSize: '1.1rem' }}>${formatCurrency(sales.finIva)}</span>
                  </div>
                  <div className="cost-row">
                    <span style={{ color: '#065f46' }}>📅 Cuota Mensual (12 meses):</span>
                    <span style={{ fontWeight: '600' }}>${formatCurrency(sales.cuot)}</span>
                  </div>
                  <div className="cost-row total" style={{ borderColor: '#10b981', background: '#a7f3d0', padding: '0.75rem', borderRadius: '6px', marginTop: '0.75rem' }}>
                    <span style={{ color: '#047857', fontWeight: '700', fontSize: '1.1rem' }}>✅ Ganancia Neta:</span>
                    <span style={{ color: '#047857', fontWeight: '700', fontSize: '1.1rem' }}>${formatCurrency(sales.cashNet - calc.kst)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  // Renderizar vista según estado
  return view === 'ventas' ? <VentasView /> : <AdminView />;
}
