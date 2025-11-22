# 📅 Sistema Automático de Pagos/Cobros a Plazo

## 📋 ¿Qué es?

Un sistema automatizado que marca gastos e ingresos a plazo como "pagados/cobrados" cuando llega su fecha de vencimiento.

---

## ⚙️ ¿Cómo funciona?

### 1. **Configuración del Cron Job**

El sistema usa un **cron job de Vercel** configurado en `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/marcar-pagados",
      "schedule": "0 3 * * *"
    }
  ]
}
```

**Significado del schedule:**
- `0 3 * * *` = Todos los días a las **3:00 AM (UTC)**

---

### 2. **¿Qué hace el cron automáticamente?**

**Cada día a las 3:00 AM:**

1. ✅ Busca todos los **GASTOS** con:
   - `tipo: 'GASTO'`
   - `metodoPago: 'Plazo'`
   - `pagado: false`

2. ✅ Busca todos los **INGRESOS** con:
   - `tipo: 'INGRESO'`
   - `metodoPago: 'Plazo'`
   - `pagado: false`

3. ✅ Para cada uno, calcula:
   ```
   Fecha de Vencimiento = Fecha Original + Días de Plazo
   ```

4. ✅ Si `Fecha de Vencimiento <= Hoy`:
   - Marca automáticamente como `pagado: true`

---

## 📝 Ejemplos Prácticos

### Ejemplo 1: Gasto a Plazo

| Acción | Fecha | Estado |
|--------|-------|--------|
| Creo gasto con 30 días plazo | 21/11/2025 | ⏳ Pendiente |
| Pasan los días... | ... | ⏳ Pendiente |
| Llega el día 30 | 21/12/2025 | ⏳ Pendiente |
| **Cron se ejecuta (3 AM)** | **22/12/2025** | **✅ Pagado** |

### Ejemplo 2: Ingreso a Plazo

| Acción | Fecha | Estado |
|--------|-------|--------|
| Registro venta con 80 días plazo | 21/11/2025 | ⏳ Por cobrar |
| Pasan los días... | ... | ⏳ Por cobrar |
| Llega el día 80 | 09/02/2026 | ⏳ Por cobrar |
| **Cron se ejecuta (3 AM)** | **10/02/2026** | **✅ Cobrado** |

---

## 🧪 Prueba Manual del Cron

### **Comando en Terminal de Visual Studio Code:**

```bash
curl https://botrural.vercel.app/api/cron/marcar-pagados \
  -H "Authorization: Bearer Xp9Kz2mNvQ8rTbY1cDfE3gHiJ4kLmO5pQ6rS7tU8vW9xY0zA"
```

### **¿Cómo ejecutarlo?**

1. Abre Visual Studio Code
2. Ve a **Terminal** → **New Terminal** (o presiona `` Ctrl + ` ``)
3. Pega el comando completo
4. Presiona **Enter**

### **Respuesta esperada:**

```json
{
  "success": true,
  "fecha": "2025-11-21T22:34:47.165Z",
  "resumen": {
    "totalActualizados": 1,
    "gastos": {
      "encontrados": 4,
      "vencidos": 1,
      "marcados": 1,
      "detalles": [
        {
          "id": "cmhxr15q00003ks04jsahbcqi",
          "descripcion": "Prueba",
          "monto": 1111,
          "fechaOriginal": "2025-11-13T00:00:00.000Z",
          "diasPlazo": 1,
          "fechaVencimiento": "2025-11-14T00:00:00.000Z"
        }
      ]
    },
    "ingresos": {
      "encontrados": 2,
      "vencidos": 0,
      "marcados": 0,
      "detalles": []
    }
  }
}
```

### **Interpretación:**

- `totalActualizados: 1` → Marcó 1 registro como pagado/cobrado
- `gastos.encontrados: 4` → Encontró 4 gastos a plazo en total
- `gastos.vencidos: 1` → 1 gasto ya venció
- `gastos.marcados: 1` → Lo marcó como pagado ✅
- `ingresos.vencidos: 0` → Ningún ingreso venció todavía

---

## 🔐 Configuración de Seguridad

### **Variable de Entorno: `CRON_SECRET`**

**En Vercel:**
1. Ve a tu proyecto → **Settings** → **Environment Variables**
2. Crea/verifica:
   - **Name:** `CRON_SECRET`
   - **Value:** `Xp9Kz2mNvQ8rTbY1cDfE3gHiJ4kLmO5pQ6rS7tU8vW9xY0zA`
   - **Environments:** Production, Preview, Development (todas)

**En `.env` local:**
```env
CRON_SECRET=Xp9Kz2mNvQ8rTbY1cDfE3gHiJ4kLmO5pQ6rS7tU8vW9xY0zA
```

⚠️ **Importante:** Debe ser **exactamente el mismo valor** en ambos lugares.

---

## 📂 Archivos Involucrados

### 1. **`vercel.json`** (raíz del proyecto)
Define cuándo se ejecuta el cron.

### 2. **`/app/api/cron/marcar-pagados/route.ts`**
Contiene la lógica que:
- Busca gastos/ingresos vencidos
- Los marca como pagados/cobrados

### 3. **Tabla `Gasto` en la base de datos**
Almacena tanto gastos como ingresos con:
- `tipo`: 'GASTO' o 'INGRESO'
- `metodoPago`: 'Contado' o 'Plazo'
- `diasPlazo`: Número de días
- `pagado`: `true` o `false`

---

## ❓ Preguntas Frecuentes

### **¿Puedo marcarlo manualmente antes?**
✅ Sí, en cualquier momento puedes ir a la página de Gastos → Editar → "Marcar como Pagado/Cobrado"

### **¿Qué pasa si pago antes del vencimiento?**
El sistema lo mantendrá como pendiente hasta la fecha de vencimiento, a menos que lo marques manualmente.

### **¿Funciona para gastos E ingresos?**
✅ Sí, ambos tipos se procesan automáticamente.

### **¿Puedo cambiar la hora de ejecución?**
Sí, modifica el `schedule` en `vercel.json`. Ejemplo:
- `0 8 * * *` → Todos los días a las 8 AM
- `0 */6 * * *` → Cada 6 horas

### **¿Cómo sé si funcionó?**
Revisa los logs en Vercel o ejecuta el comando curl manualmente para ver el resumen.

---

## 🚀 Resumen Rápido

| Concepto | Valor |
|----------|-------|
| **Frecuencia** | Diaria a las 3:00 AM |
| **Qué procesa** | Gastos e Ingresos a Plazo |
| **Qué marca** | Registros vencidos como pagados/cobrados |
| **Seguridad** | Requiere token `CRON_SECRET` |
| **Prueba manual** | Comando `curl` en terminal |

---

## ✅ Estado Actual

- [x] Cron job configurado en Vercel
- [x] Variable `CRON_SECRET` definida
- [x] API funcionando correctamente
- [x] Procesamiento de GASTOS activo
- [x] Procesamiento de INGRESOS activo
- [x] Prueba manual exitosa

**🎯 El sistema está completamente operativo y funcionando automáticamente.**