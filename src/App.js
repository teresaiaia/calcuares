import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { Trash2, Plus, Upload, Search, Download, RefreshCw, Eye, DollarSign } from 'lucide-react';
import * as XLSX from 'xlsx';
import './App.css';

export default function Calcuares() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(() => {
    const saved = localStorage.getItem('exchangeRate');
    return saved ? parseFloat(saved) : 1.10;
  });
  const [globalInterest, setGlobalInterest] = useState(() => {
    const saved = localStorage.getItem('globalInterest');
    return saved ? parseFloat(saved) : 12;
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState('admin');

  const categories = ['UC', 'HP', 'ACC', 'CONS', 'SRVP'];

  // Guardar en localStorage cuando cambian
  useEffect(() => {
    localStorage.setItem('exchangeRate', exchangeRate);
  }, [exchangeRate]);

  useEffect(() => {
    localStorage.setItem('globalInterest', globalInterest);
  }, [globalInterest]);

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
        price_in_eur: product.price_in_eur || false,
        observaciones: product.observaciones || ''
      };
      
      if (product.id && product.id > 0) {
        const { error } = await supabase
          .from('productos')
          .update(productData)
          .eq('id', product.id);
        
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('productos')
          .insert([productData])
          .select();
        
        if (error) throw error;
        
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

  const deleteProduct = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este producto?')) return;
    
    try {
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

  const addProduct = () => {
    const tempId = -Date.now();
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
      price_in_eur: false,
      observaciones: ''
    };
    
    setProducts(prev => [newProduct, ...prev]);
  };

  const handleInputChange = useCallback((id, field, value) => {
    setProducts(prev => prev.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
    
    setTimeout(() => {
      setProducts(current => {
        const product = current.find(p => p.id === id);
        if (product) saveProduct(product);
        return current;
      });
    }, 1000);
  }, []);

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

  const handleFileImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      let data = [];
      
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet);
      } else {
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
        price_in_eur: (row.priceineur || row.eur || '').toLowerCase() === 'true',
        observaciones: row.observaciones || row.obs || ''
      }));

      for (const product of newProducts) {
        const { error } = await supabase
          .from('productos')
          .insert([product]);
        
        if (error) console.error('Error importing product:', error);
      }
      
      await fetchProducts();
      alert(`✅ ${newProducts.length} productos importados exitosamente`);
    } catch (error) {
      console.error('Error importing file:', error);
      alert('Error al importar archivo: ' + error.message);
    }
    
    e.target.value = '';
  };

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

  // Exportar vista de ventas a PDF
  const exportToPDF = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Lista de Precios - Ares Medical Equipment</title>
        <style>
          @page { size: A4; margin: 15mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: Arial, sans-serif; 
            font-size: 9pt;
            line-height: 1.3;
          }
          .header { 
            text-align: center; 
            margin-bottom: 15px; 
            border-bottom: 2px solid #567C8D;
            padding-bottom: 10px;
          }
          .header h1 { 
            color: #567C8D; 
            font-size: 18pt; 
            margin-bottom: 5px;
          }
          .header p { 
            color: #666; 
            font-size: 10pt;
          }
          .products { 
            display: grid; 
            grid-template-columns: repeat(3, 1fr); 
            gap: 10px; 
          }
          .product { 
            border: 1px solid #ddd; 
            padding: 8px; 
            border-radius: 6px;
            page-break-inside: avoid;
          }
          .product-header { 
            border-bottom: 1px solid #ddd; 
            padding-bottom: 5px; 
            margin-bottom: 5px; 
          }
          .product-code { 
            font-size: 7pt; 
            color: #666; 
          }
          .product-title { 
            font-size: 10pt; 
            font-weight: bold; 
            color: #1e293b; 
            margin: 3px 0;
          }
          .product-obs { 
            font-size: 7pt; 
            color: #666; 
            font-style: italic;
            margin: 3px 0;
            line-height: 1.2;
          }
          .badges { 
            display: flex; 
            gap: 3px; 
            margin-top: 3px;
            flex-wrap: wrap;
          }
          .badge { 
            font-size: 6pt; 
            padding: 2px 5px; 
            border-radius: 10px; 
            background: #e8ecf1;
            color: #1e293b;
          }
          .prices { 
            background: #C5D9E3; 
            padding: 6px; 
            border-radius: 6px;
            margin-top: 5px;
          }
          .price-row { 
            display: flex; 
            justify-content: space-between; 
            margin: 2px 0;
            font-size: 8pt;
          }
          .price-highlight { 
            background: #3D5A6B; 
            color: white; 
            padding: 4px; 
            border-radius: 4px;
            margin: 3px 0;
            font-weight: bold;
            font-size: 9pt;
          }
          .price-small {
            font-size: 6pt;
            color: #2D4A5B;
            border-top: 1px solid #567C8D;
            padding-top: 3px;
            margin-top: 3px;
          }
          .footer { 
            text-align: center; 
            margin-top: 15px; 
            padding-top: 10px;
            border-top: 1px solid #ddd;
            font-size: 7pt; 
            color: #666; 
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>💰 Lista de Precios - Ares</h1>
          <p>Catálogo de Productos y Cotizaciones</p>
          <p style="font-size: 8pt; margin-top: 5px;">
            Interés Anual: ${globalInterest}% | Tipo de Cambio EUR→USD: ${exchangeRate} | 
            Fecha: ${new Date().toLocaleDateString('es-PY')}
          </p>
        </div>
        <div class="products">
          ${filteredProducts.map(product => {
            const calc = calculateBackend(product);
            const sales = calculateSales(calc.kst, parseFloat(product.margin || 0), parseFloat(globalInterest || 0), product.fixed_price);
            
            return `
              <div class="product">
                <div class="product-header">
                  <div class="product-code">${product.cod}</div>
                  <div class="product-title">${product.prod || 'Sin nombre'}</div>
                  ${product.observaciones ? `<div class="product-obs">${product.observaciones}</div>` : ''}
                  <div class="badges">
                    <span class="badge">${product.brand}</span>
                    <span class="badge">${product.ori}</span>
                    <span class="badge">${product.cat}</span>
                  </div>
                </div>
                <div class="prices">
                  <div class="price-row">
                    <span>💳 Contado (Neto):</span>
                    <span>$${formatCurrency(sales.cashNet)}</span>
                  </div>
                  <div class="price-highlight">
                    <div class="price-row" style="color: white;">
                      <span>💳 CONTADO + IVA:</span>
                      <span>$${formatCurrency(sales.cashIva)}</span>
                    </div>
                  </div>
                  <div class="price-small">
                    <div class="price-row">
                      <span>💰 Financiado + IVA:</span>
                      <span>$${formatCurrency(sales.finIva)}</span>
                    </div>
                    <div class="price-row">
                      <span>📅 Cuota (12 meses):</span>
                      <span>$${formatCurrency(sales.cuot)}</span>
                    </div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="footer">
          <p>Ares Medical Equipment | Lista de Precios</p>
          <p>Interés: ${globalInterest}% anual | Pago inicial: 50% | Precios sujetos a cambios sin previo aviso</p>
        </div>
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    const search = searchTerm.toLowerCase();
    return products.filter(p => (
      p.cod?.toLowerCase().includes(search) ||
      p.brand?.toLowerCase().includes(search) ||
      p.ori?.toLowerCase().includes(search) ||
      p.prod?.toLowerCase().includes(search) ||
      p.cat?.toLowerCase().includes(search)
    ));
  }, [products, searchTerm]);

  if (loading) {
    return (
      <div className="loading">
        <RefreshCw className="animate-spin" size={32} />
        <span style={{ marginLeft: '1rem' }}>Cargando productos...</span>
      </div>
    );
  }

  return (
    <div className="app-container">
      {view === 'ventas' ? (
        // VISTA DE VENTAS
        <>
          <div className="card header-card" style={{ background: '#567C8D' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>
                  💰 Lista de Precios - Ares
                </h1>
                <p style={{ color: 'white', fontSize: '1.1rem' }}>Catálogo de Productos y Cotizaciones</p>
              </div>
              <button onClick={() => setView('admin')} className="btn btn-success" style={{ background: 'white', color: '#567C8D' }}>
                <DollarSign size={20} />
                Panel Admin
              </button>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '1rem', borderRadius: '10px', color: 'white' }}>
              <div style={{ display: 'flex', gap: '2rem', fontSize: '0.9rem' }}>
                <div><strong>💵 Interés Anual:</strong> {globalInterest}%</div>
                <div><strong>💱 Tipo de Cambio EUR→USD:</strong> {exchangeRate}</div>
                <div><strong>📊 Total Productos:</strong> {products.length}</div>
              </div>
            </div>
          </div>

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
              <button onClick={exportToPDF} className="btn btn-primary" title="Exportar a PDF">
                <Download size={20} />
                Exportar PDF
              </button>
            </div>
            <div style={{ marginTop: '0.75rem', color: '#64748b', fontSize: '0.875rem' }}>
              📊 {filteredProducts.length} {filteredProducts.length === 1 ? 'producto' : 'productos'} {searchTerm ? 'encontrados' : 'disponibles'}
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: '#64748b', fontSize: '1.1rem' }}>
                {products.length === 0 ? '📦 No hay productos disponibles' : '🔍 No se encontraron productos'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {filteredProducts.map(product => {
                const calc = calculateBackend(product);
                const sales = calculateSales(calc.kst, parseFloat(product.margin || 0), parseFloat(globalInterest || 0), product.fixed_price);
                
                return (
                  <div key={product.id} className="card" style={{ border: '2px solid #e2e8f0', padding: '1rem' }}>
                    <div style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
                      <div style={{ fontSize: '0.65rem', color: '#64748b', marginBottom: '0.25rem' }}>{product.cod}</div>
                      <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.25rem', lineHeight: '1.2' }}>
                        {product.prod || 'Sin nombre'}
                      </h3>
                      {product.observaciones && (
                        <p style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.5rem', fontStyle: 'italic', lineHeight: '1.3' }}>
                          {product.observaciones}
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-blue" style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem' }}>{product.brand}</span>
                        <span className="badge badge-purple" style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem' }}>{product.ori}</span>
                        <span className="badge badge-green" style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem' }}>{product.cat}</span>
                      </div>
                    </div>

                    <div style={{ background: '#C5D9E3', borderRadius: '8px', padding: '0.75rem', border: '2px solid #567C8D' }}>
                      <h4 style={{ color: '#2D4A5B', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                        💵 Precios de Venta
                        {sales.isFixedPrice && (
                          <span className="badge badge-orange" style={{ marginLeft: '0.25rem', fontSize: '0.55rem' }}>ESPECIAL</span>
                        )}
                      </h4>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#2D4A5B', fontSize: '0.7rem' }}>💳 Contado (Neto):</span>
                          <span style={{ fontWeight: '600', fontSize: '0.7rem' }}>${formatCurrency(sales.cashNet)}</span>
                        </div>
                        
                        {/* PRECIO DESTACADO - CONTADO + IVA */}
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          background: '#3D5A6B',
                          padding: '0.5rem',
                          borderRadius: '6px',
                          margin: '0.25rem 0'
                        }}>
                          <span style={{ color: 'white', fontWeight: '700', fontSize: '0.85rem' }}>💳 CONTADO + IVA:</span>
                          <span style={{ color: 'white', fontWeight: '700', fontSize: '1.1rem' }}>${formatCurrency(sales.cashIva)}</span>
                        </div>
                        
                        {/* Precios financiados - tipografía muy pequeña */}
                        <div style={{ 
                          paddingTop: '0.35rem', 
                          borderTop: '1px solid #567C8D',
                          marginTop: '0.25rem'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.15rem' }}>
                            <span style={{ color: '#2D4A5B', fontSize: '0.6rem' }}>💰 Financiado + IVA:</span>
                            <span style={{ fontWeight: '600', fontSize: '0.6rem' }}>${formatCurrency(sales.finIva)}</span>
                          </div>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#2D4A5B', fontSize: '0.6rem' }}>📅 Cuota (12 meses):</span>
                            <span style={{ fontWeight: '600', fontSize: '0.6rem' }}>${formatCurrency(sales.cuot)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '0.5rem', fontSize: '0.6rem', color: '#64748b', textAlign: 'center', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0' }}>
                      Interés: {globalInterest}% anual | Pago inicial: 50%
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        // VISTA ADMIN
        <>
          <div className="card header-card" style={{ background: '#7A9BAE' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>
                  💰 Calcuares
                </h1>
                <p style={{ color: 'white', fontSize: '1.1rem' }}>Calculadora de Precios - Ares Medical Equipment</p>
              </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                {saving && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#567C8D', fontWeight: '600', background: 'white', padding: '0.5rem 1rem', borderRadius: '8px' }}>
                    <RefreshCw className="animate-spin" size={20} />
                    <span>Guardando...</span>
                  </div>
                )}
                <button onClick={() => setView('ventas')} className="btn btn-success" style={{ background: 'white', color: '#567C8D' }}>
                  <Eye size={20} />
                  Vista de Ventas
                </button>
              </div>
            </div>

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
                    <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileImport} style={{ display: 'none' }} />
                  </label>
                  <button onClick={exportData} className="btn btn-secondary">
                    <Download size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>

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
                        <div style={{ fontSize: '0.75rem', color: '#567C8D', marginTop: '0.25rem' }}>
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

                    <div style={{ gridColumn: 'span 4' }}>
                      <label className="input-label">📝 Observaciones</label>
                      <textarea
                        defaultValue={product.observaciones || ''}
                        onBlur={(e) => handleInputChange(product.id, 'observaciones', e.target.value)}
                        placeholder="Descripción del producto, características, beneficios..."
                        className="input"
                        rows="3"
                        style={{ resize: 'vertical', fontFamily: 'inherit' }}
                      />
                      <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                        💡 Este texto aparecerá en la vista de ventas debajo del título del producto
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-2" style={{ marginTop: '2rem' }}>
                    <div className="cost-section" style={{ background: '#f1f5f9', border: '2px solid #cbd5e1' }}>
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                        💼 Costos Backend
                      </h3>
                      {calc.isEUR && (
                        <div className="cost-row" style={{ background: '#C5D9E3', padding: '0.5rem', borderRadius: '6px', marginBottom: '0.75rem', border: '1px solid #567C8D' }}>
                          <span style={{ color: '#2D4A5B', fontWeight: '600' }}>💶 PP Original (EUR):</span>
                          <span style={{ color: '#2D4A5B', fontWeight: '700' }}>€{formatCurrency(calc.ppOriginal)}</span>
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

                    <div className="cost-section" style={{ background: '#C5D9E3', border: '2px solid #567C8D' }}>
                      <h3 style={{ color: '#2D4A5B', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                        💵 Precios de Venta
                        {sales.isFixedPrice && (
                          <span className="badge badge-orange">PRECIO FIJO</span>
                        )}
                      </h3>
                      <div className="cost-row">
                        <span style={{ color: '#2D4A5B' }}>💳 Contado (Neto):</span>
                        <span style={{ fontWeight: '600' }}>${formatCurrency(sales.cashNet)}</span>
                      </div>
                      <div className="cost-row">
                        <span style={{ color: '#2D4A5B' }}>💳 Contado + IVA (10%):</span>
                        <span style={{ fontWeight: '700' }}>${formatCurrency(sales.cashIva)}</span>
                      </div>
                      <div className="cost-row total" style={{ borderColor: '#567C8D', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
                        <span style={{ color: '#3D5A6B', fontSize: '1.1rem' }}>💰 Financiado + IVA:</span>
                        <span style={{ color: '#3D5A6B', fontSize: '1.1rem' }}>${formatCurrency(sales.finIva)}</span>
                      </div>
                      <div className="cost-row">
                        <span style={{ color: '#2D4A5B' }}>📅 Cuota Mensual (12 meses):</span>
                        <span style={{ fontWeight: '600' }}>${formatCurrency(sales.cuot)}</span>
                      </div>
                      <div className="cost-row total" style={{ borderColor: '#567C8D', background: '#A8C5D6', padding: '0.75rem', borderRadius: '6px', marginTop: '0.75rem' }}>
                        <span style={{ color: '#3D5A6B', fontWeight: '700', fontSize: '1.1rem' }}>✅ Ganancia Neta:</span>
                        <span style={{ color: '#3D5A6B', fontWeight: '700', fontSize: '1.1rem' }}>${formatCurrency(sales.cashNet - calc.kst)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </>
      )}
    </div>
  );
}
