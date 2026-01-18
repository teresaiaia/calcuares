# 🚀 CALCUARES - INSTALACIÓN COMPLETA DESDE CERO

## 📋 Proyecto: Calculadora de Precios Ares
**Versión 2.0** - Completamente nuevo y optimizado con Supabase

---

## ✨ CARACTERÍSTICAS:

- ✅ **Calculadora completa** de precios de equipos médicos
- ✅ **Guardar en Supabase** - Los datos persisten permanentemente
- ✅ **Importar/Exportar** Excel y CSV
- ✅ **Soporte EUR y USD** con tipo de cambio
- ✅ **Búsqueda en tiempo real**
- ✅ **Auto-guardado** al editar productos
- ✅ **Precio fijo manual** opcional
- ✅ **Cálculo automático** de costos y precios de venta
- ✅ **Diseño profesional** y responsive

---

## 🎯 PASO 0: Crear tabla en Supabase (CRÍTICO)

### 1. Ve a Supabase
- https://supabase.com/dashboard
- Selecciona tu proyecto (o crea uno nuevo si no tienes)

### 2. Ejecutar script SQL
1. Click en **"SQL Editor"** en el menú lateral
2. Click en **"New Query"**
3. Abre el archivo **`crear_tabla_productos.sql`**
4. **Copia TODO el contenido**
5. **Pégalo** en el editor de Supabase
6. Click en **"Run"** (botón verde abajo a la derecha)
7. Deberías ver: ✅ "Success. No rows returned"

**¡Sin este paso, la aplicación NO funcionará!**

---

## 📦 PASO 1: Crear repositorio NUEVO en GitHub

### Opción A: Repositorio completamente nuevo

1. Ve a https://github.com/new
2. **Repository name:** `calcuares-nuevo`
3. **Description:** "Calculadora de Precios - Ares Medical Equipment"
4. **Public** o **Private** (tu elección)
5. **NO marques** "Add README"
6. Click en **"Create repository"**

### Opción B: Borrar el repositorio viejo y crear nuevo

1. Ve a https://github.com/teresaiaia/calcuares/settings
2. Scroll hasta abajo → **"Danger Zone"**
3. Click en **"Delete this repository"**
4. Confirma escribiendo el nombre
5. Luego crea uno nuevo con el **Paso A**

---

## 📁 PASO 2: Subir archivos a GitHub

### Estructura de archivos que debes subir:

```
calcuares-nuevo/
├── public/
│   └── index.html
├── src/
│   ├── App.js
│   ├── App.css
│   ├── index.js
│   ├── index.css
│   └── supabaseClient.js
├── .env.example
├── .gitignore
├── package.json
└── crear_tabla_productos.sql
```

### Subir cada archivo:

1. Ve a tu repositorio nuevo en GitHub
2. Click en **"Add file"** → **"Upload files"**
3. **Arrastra TODOS los archivos** del proyecto
4. Click en **"Commit changes"**

**IMPORTANTE:** Sube todos los archivos manteniendo la estructura de carpetas.

---

## 🔐 PASO 3: Configurar variables de entorno en Vercel

### 1. Obtener credenciales de Supabase

1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Ve a **Settings** → **API**
4. Copia estos dos valores:
   - **Project URL** (ejemplo: https://tuproyecto.supabase.co)
   - **anon/public key** (es una clave larga que empieza con "eyJ...")

### 2. Configurar en Vercel

1. Ve a https://vercel.com/dashboard
2. Click en **"Add New..."** → **"Project"**
3. Importa tu repositorio **calcuares-nuevo**
4. **Antes de hacer deploy**, click en **"Environment Variables"**
5. Agrega estas dos variables:

| Name | Value |
|------|-------|
| `REACT_APP_SUPABASE_URL` | Tu Project URL de Supabase |
| `REACT_APP_SUPABASE_ANON_KEY` | Tu anon key de Supabase |

6. Click en **"Deploy"**

---

## ⏳ PASO 4: Esperar deployment

1. Vercel empezará a construir tu proyecto (2-4 minutos)
2. Cuando termine verás: ✅ **"Deployment Ready"**
3. Click en **"Visit"** para ver tu aplicación

---

## ✅ PASO 5: Verificar que todo funciona

### Prueba estas funcionalidades:

1. **Agregar producto:**
   - Click en "Agregar Producto"
   - Llena los campos
   - Espera 1 segundo (auto-guardado)
   - Recarga la página
   - El producto debe seguir ahí ✅

2. **Buscar producto:**
   - Escribe en el buscador
   - Los resultados se filtran en tiempo real ✅

3. **Importar CSV:**
   - Click en "Importar"
   - Selecciona un archivo CSV o Excel
   - Los productos se importan a Supabase ✅

4. **Exportar datos:**
   - Click en el botón de descarga
   - Se descarga un CSV con todos tus productos ✅

---

## 📊 FORMATO CSV PARA IMPORTAR

Tu archivo CSV debe tener estas columnas:

```csv
COD,BRAND,ORI,PROD,CAT,PP,FRT,BNK,ADU,SERV,TRNG,EXTR,MARGIN,FIXEDPRICE,PRICEINEUR
VOL-001,Classys,Corea,Ultraformer,UC,33000,4500,99,22,50,800,0,55,0,false
```

**Columnas:**
- COD: Código del producto
- BRAND: Marca
- ORI: Origen
- PROD: Producto/Modelo
- CAT: Categoría (UC, HP, ACC, CONS, SRVP)
- PP: Precio
- FRT: Flete
- BNK: Banco
- ADU: Aduana (%)
- SERV: Servicio
- TRNG: Capacitación
- EXTR: Imprevistos
- MARGIN: Margen (%)
- FIXEDPRICE: Precio fijo manual (0 = automático)
- PRICEINEUR: true o false

---

## ❗ PROBLEMAS COMUNES

### Error: "supabaseUrl and supabaseAnonKey are required"
**Solución:** 
1. Ve a Vercel → Settings → Environment Variables
2. Verifica que agregaste las dos variables
3. Redeploy: Deployments → ... → Redeploy

### Error: "relation public.productos does not exist"
**Solución:** No ejecutaste el script SQL en Supabase. Ve al PASO 0.

### Los productos no se guardan
**Solución:**
1. Abre F12 → Console
2. Busca errores de Supabase
3. Verifica que las variables de entorno estén correctas
4. Ve a Supabase → Table Editor → Deberías ver la tabla "productos"

### Página en blanco
**Solución:**
1. F12 → Console
2. Copia el error
3. Generalmente es porque falta ejecutar el script SQL

---

## 🔧 PRÓXIMOS PASOS OPCIONALES

Puedes agregar después:

1. ✅ **Sistema de cotizaciones** (generar PDFs)
2. ✅ **Múltiples usuarios** (login/autenticación)
3. ✅ **Historial de precios** (ver cambios)
4. ✅ **Dashboard con estadísticas**
5. ✅ **Vista para vendedores** (sin edición)
6. ✅ **Notificaciones** de cambios de precios

---

## 📞 AYUDA

Si tienes algún problema:

1. Verifica que ejecutaste el script SQL en Supabase
2. Verifica que las variables de entorno están en Vercel
3. Abre F12 → Console y busca errores
4. Ve a Supabase → Table Editor → Verifica que existe la tabla "productos"

---

## 🎉 ¡LISTO!

Tu calculadora de precios está funcionando con:
- ✅ Datos guardados permanentemente en Supabase
- ✅ Auto-guardado al editar
- ✅ Importar/Exportar Excel
- ✅ Búsqueda en tiempo real
- ✅ Diseño profesional

**Link de tu aplicación:** https://tu-proyecto.vercel.app

---

**Versión:** 2.0.0
**Fecha:** Enero 2026
**Desarrollado para:** Ares Medical Equipment
