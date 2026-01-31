import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { Trash2, Plus, Upload, Search, Download, RefreshCw, Eye, DollarSign, LogOut, User, Package } from 'lucide-react';
import * as XLSX from 'xlsx';
import './App.css';
import ComprasCargas from './ComprasCargas';

export default function Adminares() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(() => {
    const saved = localStorage.getItem('exchangeRate');
    return saved ? parseFloat(saved) : 1.20;
  });
  const [globalInterest, setGlobalInterest] = useState(() => {
    const saved = localStorage.getItem('globalInterest');
    return saved ? parseFloat(saved) : 12;
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState('calculos'); // CAMBIADO: 'calculos' en lugar de 'admin'
  
  // Estados de autenticación
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const categories = ['UC', 'HP', 'ACC', 'CONS', 'SRVP'];

  // Guardar en localStorage cuando cambian
  useEffect(() => {
    localStorage.setItem('exchangeRate', exchangeRate);
  }, [exchangeRate]);

  useEffect(() => {
    localStorage.setItem('globalInterest', globalInterest);
  }, [globalInterest]);

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      setIsAuthenticated(true);
      setView(user.rol === 'admin' ? 'calculos' : 'ventas'); // CAMBIADO: 'calculos' en lugar de 'admin'
      fetchProducts();
    } else {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ============= FUNCIONES DE AUTENTICACIÓN =============

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);

    try {
      // Buscar usuario en Supabase
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', loginEmail.toLowerCase().trim())
        .eq('activo', true)
        .single();

      if (error || !data) {
        setLoginError('Usuario o contraseña incorrectos');
        setLoggingIn(false);
        return;
      }

      // Por simplicidad, comparamos contraseña directamente
      // En producción real, deberías usar bcrypt o similar
      // Por ahora aceptamos cualquier contraseña que coincida
      const isValidPassword = loginPassword === 'admin123' || loginPassword === 'vendedor123';
      
      if (!isValidPassword) {
        setLoginError('Usuario o contraseña incorrectos');
        setLoggingIn(false);
        return;
      }

      // Actualizar último login
      await supabase
        .from('usuarios')
        .update({ last_login: new Date().toISOString() })
        .eq('id', data.id);

      // Guardar usuario en localStorage
      const userSession = {
        id: data.id,
        email: data.email,
        nombre: data.nombre,
        rol: data.rol
      };
      
      localStorage.setItem('currentUser', JSON.stringify(userSession));
      setCurrentUser(userSession);
      setIsAuthenticated(true);
      setView(userSession.rol === 'admin' ? 'calculos' : 'ventas'); // CAMBIADO: 'calculos' en lugar de 'admin'
      
      // Cargar productos
      await fetchProducts();
      
    } catch (error) {
      console.error('Error en login:', error);
      setLoginError('Error al iniciar sesión. Intenta de nuevo.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
    setIsAuthenticated(false);
    setLoginEmail('');
    setLoginPassword('');
    setView('calculos'); // CAMBIADO: 'calculos' en lugar de 'admin'
  };

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
        observaciones: product.observaciones || '',
        precio_verificado: product.precio_verificado || false,
        flete_alto: parseFloat(product.flete_alto || 0),
        flete_ancho: parseFloat(product.flete_ancho || 0),
        flete_profundidad: parseFloat(product.flete_profundidad || 0),
        flete_peso_real: parseFloat(product.flete_peso_real || 0),
        flete_coeficiente: parseFloat(product.flete_coeficiente || 5000),
        flete_precio_kg_real: parseFloat(product.flete_precio_kg_real || 0),
        flete_precio_kg_vol: parseFloat(product.flete_precio_kg_vol || 0),
        flete_precio_fijo: parseFloat(product.flete_precio_fijo || 0),
        flete_origen: product.flete_origen || '',
        flete_obs: product.flete_obs || ''
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
      price_in_eur: false,
      observaciones: '',
      precio_verificado: false,
      flete_alto: 0,
      flete_ancho: 0,
      flete_profundidad: 0,
      flete_peso_real: 0,
      flete_coeficiente: 5000,
      flete_precio_kg_real: 0,
      flete_precio_kg_vol: 0,
      flete_precio_fijo: 0,
      flete_origen: '',
      flete_obs: ''
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
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
  }, [products, searchTerm]);

  // Pantalla de login
  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{
          background: 'white',
          padding: '2.5rem',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          width: '100%',
          maxWidth: '400px',
          margin: '1rem'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.5rem' }}>
              Adminares
            </h1>
            <p style={{ color: '#64748b' }}>Sistema de Gestión</p>
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#475569' }}>
                Email
              </label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="input"
                placeholder="usuario@example.com"
                required
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#475569' }}>
                Contraseña
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
                style={{ width: '100%' }}
              />
            </div>

            {loginError && (
              <div style={{
                background: '#fee2e2',
                border: '1px solid #fca5a5',
                color: '#991b1b',
                padding: '0.75rem',
                borderRadius: '6px',
                marginBottom: '1rem',
                fontSize: '0.875rem'
              }}>
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loggingIn}
              className="btn btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '0.75rem',
                fontSize: '1rem'
              }}
            >
              {loggingIn ? (
                <>
                  <RefreshCw className="animate-spin" size={20} />
                  Iniciando sesión...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>

          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: '#f8fafc',
            borderRadius: '6px',
            fontSize: '0.75rem',
            color: '#64748b'
          }}>
            <p style={{ margin: 0 }}>
              <strong>Usuario de prueba:</strong><br />
              Email: admin@ares.com<br />
              Contraseña: admin123
            </p>
          </div>
        </div>
      </div>
    );
  }

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
      {/* Header con navegación */}
      <div className="card header-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <div>
              <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.5rem' }}>
                ⚡ Adminares
              </h1>
              <p style={{ color: '#64748b', fontSize: '1.1rem' }}>Sistema de Gestión - Ares Medical Equipment</p>
            </div>
            
            {/* Botones de navegación */}
            {currentUser?.rol === 'admin' && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setView('calculos')}
                  style={{
                    background: view === 'calculos' ? 'white' : 'rgba(102, 126, 234, 0.1)',
                    color: view === 'calculos' ? '#667eea' : '#475569',
                    border: view === 'calculos' ? '2px solid #667eea' : '1px solid #e2e8f0',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.9rem',
                    fontWeight: view === 'calculos' ? '600' : '400',
                    transition: 'all 0.2s'
                  }}
                >
                  <DollarSign size={18} />
                  Cálculos
                </button>
                <button
                  onClick={() => setView('compras')}
                  style={{
                    background: view === 'compras' ? 'white' : 'rgba(102, 126, 234, 0.1)',
                    color: view === 'compras' ? '#667eea' : '#475569',
                    border: view === 'compras' ? '2px solid #667eea' : '1px solid #e2e8f0',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.9rem',
                    fontWeight: view === 'compras' ? '600' : '400',
                    transition: 'all 0.2s'
                  }}
                >
                  <Package size={18} />
                  Compras y Cargas
                </button>
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {saving && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', fontWeight: '600' }}>
                <RefreshCw className="animate-spin" size={20} />
                <span>Guardando...</span>
              </div>
            )}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: '600', color: '#1e293b' }}>
                <User size={16} style={{ display: 'inline', marginRight: '0.25rem' }} />
                {currentUser?.nombre}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {currentUser?.rol === 'admin' ? 'Administrador' : 'Vendedor'}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="btn btn-secondary"
              style={{ padding: '0.5rem 1rem' }}
            >
              <LogOut size={18} />
              Salir
            </button>
          </div>
        </div>
      </div>

      {/* Renderizado condicional según la vista */}
      {view === 'calculos' && (
        <>
          {/* Configuración Global */}
          <div className="card">
            <div className="grid grid-3">
              <div>
                <label className="input-label">💵 Interés Anual Global (%)</label>
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
                <label className="input-label">💱 Tipo de Cambio EUR → USD</label>
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
                <label className="input-label">📁 Importar / Exportar</label>
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
              
              // Cálculos de flete
              const fleteCalc = (() => {
                const alto = parseFloat(product.flete_alto || 0);
                const ancho = parseFloat(product.flete_ancho || 0);
                const prof = parseFloat(product.flete_profundidad || 0);
                const pesoReal = parseFloat(product.flete_peso_real || 0);
                const coef = parseFloat(product.flete_coeficiente || 5000);
                const precioKgReal = parseFloat(product.flete_precio_kg_real || 0);
                const precioKgVol = parseFloat(product.flete_precio_kg_vol || 0);
                const precioFijo = parseFloat(product.flete_precio_fijo || 0);

                const pesoVolumetrico = (alto * ancho * prof) / coef;
                const costoReal = pesoReal * precioKgReal;
                const costoVol = pesoVolumetrico * precioKgVol;
                const costoTotal = precioFijo > 0 ? precioFijo : Math.max(costoReal, costoVol);
                const diferencia = costoVol - costoReal;

                return { pesoVolumetrico, costoReal, costoVol, costoTotal, diferencia };
              })();
              
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

                  {/* Sección de Cotización de Flete */}
                  <div style={{ marginTop: '1.5rem' }}>
                    <button
                      onClick={() => {
                        const element = document.getElementById(`flete-${product.id}`);
                        if (element) {
                          element.style.display = element.style.display === 'none' ? 'block' : 'none';
                        }
                      }}
                      style={{
                        background: '#C8D9E6',
                        border: '2px solid #567C8D',
                        color: '#2F4156',
                        padding: '0.75rem 1rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        fontSize: '0.9rem',
                        marginBottom: '1rem'
                      }}
                    >
                      📊 Cotización de Flete (Click para expandir)
                    </button>

                    <div id={`flete-${product.id}`} style={{ display: 'none' }}>
                      {(() => {
                        return (
                          <div style={{ 
                            background: '#f0f9ff', 
                            padding: '1rem', 
                            borderRadius: '8px', 
                            border: '2px solid #bae6fd' 
                          }}>
                            <h4 style={{ 
                              color: '#0369a1', 
                              marginBottom: '1rem', 
                              fontSize: '0.95rem', 
                              fontWeight: '700',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              Cálculo de Peso Volumétrico y Costo de Flete
                            </h4>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem', marginBottom: '0.6rem' }}>
                              {/* Fila 1: Dimensiones y Peso */}
                              <div>
                                <label style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '600', display: 'block', marginBottom: '0.2rem' }}>
                                  Alto (cm)
                                </label>
                                <input
                                  type="number"
                                  step="0.1"
                                  defaultValue={product.flete_alto}
                                  onBlur={(e) => handleInputChange(product.id, 'flete_alto', e.target.value)}
                                  className="input"
                                  style={{ padding: '0.3rem 0.4rem', fontSize: '0.7rem' }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '600', display: 'block', marginBottom: '0.2rem' }}>
                                  Ancho (cm)
                                </label>
                                <input
                                  type="number"
                                  step="0.1"
                                  defaultValue={product.flete_ancho}
                                  onBlur={(e) => handleInputChange(product.id, 'flete_ancho', e.target.value)}
                                  className="input"
                                  style={{ padding: '0.3rem 0.4rem', fontSize: '0.7rem' }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '600', display: 'block', marginBottom: '0.2rem' }}>
                                  Prof (cm)
                                </label>
                                <input
                                  type="number"
                                  step="0.1"
                                  defaultValue={product.flete_profundidad}
                                  onBlur={(e) => handleInputChange(product.id, 'flete_profundidad', e.target.value)}
                                  className="input"
                                  style={{ padding: '0.3rem 0.4rem', fontSize: '0.7rem' }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '600', display: 'block', marginBottom: '0.2rem' }}>
                                  Peso Real (kg)
                                </label>
                                <input
                                  type="number"
                                  step="0.1"
                                  defaultValue={product.flete_peso_real}
                                  onBlur={(e) => handleInputChange(product.id, 'flete_peso_real', e.target.value)}
                                  className="input"
                                  style={{ padding: '0.3rem 0.4rem', fontSize: '0.7rem' }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '600', display: 'block', marginBottom: '0.2rem' }}>
                                  Coeficiente
                                </label>
                                <input
                                  type="number"
                                  step="1"
                                  defaultValue={product.flete_coeficiente}
                                  onBlur={(e) => handleInputChange(product.id, 'flete_coeficiente', e.target.value)}
                                  className="input"
                                  style={{ padding: '0.3rem 0.4rem', fontSize: '0.7rem' }}
                                />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                                <div style={{ background: '#f0f9ff', padding: '0.3rem 0.4rem', borderRadius: '4px', border: '1px solid #bae6fd', textAlign: 'center' }}>
                                  <div style={{ fontSize: '0.6rem', color: '#0369a1', fontWeight: '600' }}>Peso Vol</div>
                                  <div style={{ fontSize: '0.75rem', color: '#0c4a6e', fontWeight: '700' }}>
                                    {fleteCalc.pesoVolumetrico.toFixed(2)} kg
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem', marginBottom: '0.6rem' }}>
                              {/* Fila 2: Precios */}
                              <div>
                                <label style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '600', display: 'block', marginBottom: '0.2rem' }}>
                                  $/kg Real
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  defaultValue={product.flete_precio_kg_real}
                                  onBlur={(e) => handleInputChange(product.id, 'flete_precio_kg_real', e.target.value)}
                                  className="input"
                                  style={{ padding: '0.3rem 0.4rem', fontSize: '0.7rem' }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '600', display: 'block', marginBottom: '0.2rem' }}>
                                  $/kg Vol
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  defaultValue={product.flete_precio_kg_vol}
                                  onBlur={(e) => handleInputChange(product.id, 'flete_precio_kg_vol', e.target.value)}
                                  className="input"
                                  style={{ padding: '0.3rem 0.4rem', fontSize: '0.7rem' }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '600', display: 'block', marginBottom: '0.2rem' }}>
                                  Precio Fijo
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  defaultValue={product.flete_precio_fijo || ''}
                                  onBlur={(e) => handleInputChange(product.id, 'flete_precio_fijo', e.target.value)}
                                  placeholder="Opcional"
                                  className="input"
                                  style={{ padding: '0.3rem 0.4rem', fontSize: '0.7rem', background: '#fffbeb' }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '600', display: 'block', marginBottom: '0.2rem' }}>
                                  Origen
                                </label>
                                <input
                                  type="text"
                                  defaultValue={product.flete_origen}
                                  onBlur={(e) => handleInputChange(product.id, 'flete_origen', e.target.value)}
                                  placeholder="País"
                                  className="input"
                                  style={{ padding: '0.3rem 0.4rem', fontSize: '0.7rem' }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '600', display: 'block', marginBottom: '0.2rem' }}>
                                  Observación
                                </label>
                                <input
                                  type="text"
                                  defaultValue={product.flete_obs}
                                  onBlur={(e) => handleInputChange(product.id, 'flete_obs', e.target.value)}
                                  placeholder="Ej: Dic 2024"
                                  className="input"
                                  style={{ padding: '0.3rem 0.4rem', fontSize: '0.7rem' }}
                                />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                <div style={{ 
                                  background: fleteCalc.diferencia > 0 ? '#fee2e2' : '#d1fae5', 
                                  padding: '0.2rem 0.4rem', 
                                  borderRadius: '4px', 
                                  border: `1px solid ${fleteCalc.diferencia > 0 ? '#fca5a5' : '#86efac'}`,
                                  textAlign: 'center'
                                }}>
                                  <div style={{ fontSize: '0.6rem', color: fleteCalc.diferencia > 0 ? '#991b1b' : '#065f46', fontWeight: '600' }}>
                                    Diferencia
                                  </div>
                                  <div style={{ fontSize: '0.7rem', color: fleteCalc.diferencia > 0 ? '#7f1d1d' : '#064e3b', fontWeight: '700' }}>
                                    {fleteCalc.diferencia > 0 ? '+' : ''}{fleteCalc.diferencia.toFixed(2)}
                                  </div>
                                </div>
                                <div style={{ background: '#C8D9E6', padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid #567C8D', textAlign: 'center' }}>
                                  <div style={{ fontSize: '0.6rem', color: '#2F4156', fontWeight: '600' }}>Costo Total</div>
                                  <div style={{ fontSize: '0.75rem', color: '#2F4156', fontWeight: '700' }}>
                                    ${formatCurrency(fleteCalc.costoTotal)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </>
      )}

      {/* Vista de Compras y Cargas */}
      {view === 'compras' && (
        <ComprasCargas />
      )}
    </div>
  );
}
