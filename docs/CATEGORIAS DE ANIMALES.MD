# 📋 CATEGORÍAS DE ANIMALES - Guía Completa

## 🎯 ¿Qué son las Categorías de Animales?

Las **Categorías de Animales** son las clasificaciones que usás en todo el sistema para referirte a tipos específicos de animales (Vacas, Toros, Novillos, Ovejas, etc.).

### ¿Por qué son importantes?

1. **Cálculo de UG (Unidades Ganaderas)**: Cada categoría tiene una equivalencia específica en UG
2. **Consistencia en el sistema**: Se usan en modales, reportes, filtros, estadísticas
3. **Agrupación**: Permiten agrupar animales por tipo en reportes y dashboards

---

## 🏗️ Arquitectura del Sistema

### 1️⃣ **Definición Central** (`src/lib/constants.ts`)

```typescript
import { TipoAnimal } from '@prisma/client'

export const CATEGORIAS_ANIMALES_DEFAULT = [
  // BOVINOS
  { nombreSingular: 'Toros', nombrePlural: 'Toros', tipoAnimal: TipoAnimal.BOVINO },
  { nombreSingular: 'Vacas', nombrePlural: 'Vacas', tipoAnimal: TipoAnimal.BOVINO },
  // ... etc
]
```

**✅ Este es el ÚNICO lugar donde definís las categorías predeterminadas.**

---

### 2️⃣ **Creación Automática en Registro**

Cuando un usuario se registra (`/api/register`), se crean automáticamente:

```typescript
// 4. Crear categorías de animales predeterminadas
await tx.categoriaAnimal.createMany({
  data: CATEGORIAS_ANIMALES_DEFAULT.map(cat => ({
    nombreSingular: cat.nombreSingular,
    nombrePlural: cat.nombrePlural,
    tipoAnimal: cat.tipoAnimal,
    campoId: campo.id,
    activo: true,
    esPredeterminado: true,
  })),
})
```

**Resultado**: El nuevo usuario ya tiene las 21 categorías en su campo.

---

### 3️⃣ **API de Gestión** (`/api/categorias-animal/route.ts`)

Esta API permite:

#### 📖 **GET** - Obtener categorías de un campo

```typescript
// USO NORMAL (con sesión)
fetch('/api/categorias-animal')

// USO ESPECIAL (para SNIG, sin sesión)
fetch('/api/categorias-animal?campoId=xyz')
```

**Dónde se usa:**
- ✅ **Modales** (Nacimiento, Mortandad, Recategorización, Venta, Compra, Consumo, etc.)
- ✅ **SNIG** (necesita campoId por parámetro porque no hay sesión)
- ✅ **Filtros en Datos**
- ✅ **Dropdowns en formularios**

#### ➕ **POST** - Crear categoría personalizada

```typescript
fetch('/api/categorias-animal', {
  method: 'POST',
  body: JSON.stringify({
    nombreSingular: 'Vaquillas +1 año',
    nombrePlural: 'Vaquillas +1 año',
    tipoAnimal: 'BOVINO'
  })
})
```

**Dónde se usa:**
- ✅ Página de **Preferencias** (cuando el usuario crea una categoría custom)

#### 🔄 **PATCH** - Activar/Desactivar categoría

```typescript
fetch('/api/categorias-animal', {
  method: 'PATCH',
  body: JSON.stringify({
    id: 'abc123',
    activo: false
  })
})
```

**Dónde se usa:**
- ✅ Página de **Preferencias** (toggle on/off de categorías)

---

## 🔢 Cálculo de UG (Unidades Ganaderas)

### Archivo: `src/lib/ugCalculator.ts`

```typescript
export const EQUIVALENCIAS_UG: Record<string, number> = {
  // BOVINOS
  'Toros': 1.20,
  'Vacas': 1.00,
  'Novillos +3 años': 1.00,
  'Terneros nacidos': 0.25,  // 👈 NUEVA CATEGORÍA
  // ... etc
}

export function calcularUGTotales(animales: Array<{ categoria: string; cantidad: number }>): number {
  return animales.reduce((total, animal) => {
    const equivalencia = EQUIVALENCIAS_UG[animal.categoria] || 0.8 // default si no existe
    return total + (animal.cantidad * equivalencia)
  }, 0)
}
```

**Dónde se usa:**
- ✅ `/dashboard/lotes` - Carga global y por potrero
- ✅ `/dashboard/indicadores` - Gráficos de UG
- ✅ `/dashboard/ug-evolution` - Evolución histórica
- ✅ `/api/dashboard-data` - Resúmenes

---

## 📂 Archivos que Usan Categorías

### **Modales (todos en `/src/app/components/modales/`)**

| Modal | Uso |
|-------|-----|
| `ModalNacimiento.tsx` | Fetch categorías → dropdown "Categoría de nacidos" |
| `ModalMortandad.tsx` | Fetch categorías → dropdown "Categoría afectada" |
| `ModalRecategorizacion.tsx` | Fetch categorías → "De" y "A" |
| `ModalVenta.tsx` | Fetch categorías → renglones de venta |
| `ModalCompra.tsx` | Fetch categorías → renglones de compra |
| `ModalConsumo.tsx` | Fetch categorías → renglones de consumo |
| `ModalTacto.tsx` | Fetch categorías → dropdown |
| `ModalTratamiento.tsx` | Fetch categorías → dropdown |

**Patrón común:**

```typescript
const { data: categorias = [] } = useSWR('/api/categorias-animal', fetcher)

// Luego en el dropdown:
<select>
  {categorias
    .filter(c => c.tipoAnimal === 'BOVINO' && c.activo)
    .map(cat => (
      <option key={cat.id} value={cat.nombreSingular}>
        {cat.nombreSingular}
      </option>
    ))
  }
</select>
```

---

### **Páginas**

| Página | Uso |
|--------|-----|
| `/dashboard/lotes` | Fetch categorías → Agrupación en badges |
| `/dashboard/datos` | Fetch categorías → Filtros de búsqueda |
| `/dashboard/indicadores` | Fetch categorías → Gráficos por categoría |
| `/dashboard/preferencias` | Fetch + POST + PATCH → CRUD de categorías |
| `/dashboard/snig` | Fetch con `?campoId=` → Confirmar SNIG |

---

### **APIs**

| API | Uso |
|-----|-----|
| `/api/eventos` | Valida que la categoría exista al crear evento |
| `/api/ventas` | Valida categorías en renglones |
| `/api/compras` | Valida categorías en renglones |
| `/api/consumos` | Valida categorías en renglones |

---

## ➕ Cómo Agregar una Nueva Categoría Predeterminada

### **Paso 1: Agregar en `constants.ts`**

```typescript
export const CATEGORIAS_ANIMALES_DEFAULT = [
  // ... categorías existentes ...
  
  // 🆕 NUEVA
  { 
    nombreSingular: 'Terneros destetados', 
    nombrePlural: 'Terneros destetados', 
    tipoAnimal: TipoAnimal.BOVINO 
  },
]
```

### **Paso 2: Agregar equivalencia UG en `ugCalculator.ts`**

```typescript
export const EQUIVALENCIAS_UG: Record<string, number> = {
  // ... equivalencias existentes ...
  
  // 🆕 NUEVA
  'Terneros destetados': 0.50,
}
```

### **Paso 3: Correr script para usuarios existentes**

```bash
npx tsx scripts/add-new-categorias.ts
```

**✅ LISTO** - Nuevos usuarios ya la tienen, usuarios viejos también.

---

## 🗑️ ¿Se Puede Borrar `/api/categorias-animal`?

### ❌ **NO, ES CRÍTICO**

Esta API se usa en:

1. ✅ **Todos los modales** (18+ componentes)
2. ✅ **SNIG** (importación de animales)
3. ✅ **Preferencias** (CRUD de categorías)
4. ✅ **Filtros en Datos**
5. ✅ **Validación en APIs de eventos**

**Sin esta API, TODO el sistema de animales se rompe.**

---

## 🔧 Cómo Funciona el Sistema Completo

### **Flujo de Registro de Usuario Nuevo**

```
1. Usuario se registra → /api/register
2. Se crea Campo → campo.id = 'abc123'
3. Se crean 21 categorías de animales con campoId = 'abc123'
4. Usuario entra al dashboard → Fetch /api/categorias-animal
5. Aparecen en todos los dropdowns y modales
```

---

### **Flujo de Usuario Existente (antes del fix)**

```
1. Usuario ya existente → NO tenía categorías en DB
2. Fetch /api/categorias-animal → []
3. Modales no funcionaban (sin opciones)
4. Corrimos script → add-new-categorias.ts
5. Ahora todos tienen las 21 categorías
```

---

### **Flujo de Cálculo de UG**

```
1. Usuario tiene animales en potrero:
   - 10 Vacas
   - 5 Terneros nacidos
   
2. Se llama calcularUGTotales([
     { categoria: 'Vacas', cantidad: 10 },
     { categoria: 'Terneros nacidos', cantidad: 5 }
   ])
   
3. Resultado:
   - 10 * 1.00 = 10.00 UG (Vacas)
   - 5 * 0.25 = 1.25 UG (Terneros nacidos)
   - TOTAL = 11.25 UG
   
4. Carga UG/ha:
   - Potrero tiene 10 hectáreas
   - 11.25 UG / 10 ha = 1.13 UG/ha ✅ Verde (óptimo)
```

---

## 🎨 Colores de Carga UG

En `/dashboard/lotes` se muestra con colores:

```typescript
const color = 
  cargaUG < 0.7 ? 'bg-blue-100 text-blue-700'    // Baja
  : cargaUG <= 1.5 ? 'bg-green-100 text-green-700' // Óptima ✅
  : cargaUG <= 2.0 ? 'bg-orange-100 text-orange-700' // Alta ⚠️
  : 'bg-red-100 text-red-700' // Sobrecarga 🔴
```

**Rangos:**
- **< 0.7 UG/ha**: Azul - Subcargado
- **0.7 - 1.5 UG/ha**: Verde - Óptimo ✅
- **1.5 - 2.0 UG/ha**: Naranja - Alta
- **> 2.0 UG/ha**: Rojo - Sobrecarga

---

## 📊 Relación Lanar/Vacuno

En `/dashboard/lotes` también se calcula:

```typescript
export function calcularRelacionLanarVacuno(lotes: Lote[]) {
  // Cuenta UG de ovinos vs UG de vacunos
  // Resultado: 1.5 significa "1.5 UG de ovinos por cada 1 UG de vacunos"
}
```

**Solo se muestra si hay AMBOS tipos en el campo.**

---

## 🧪 Testing

Para verificar que todo funciona:

### **Test 1: Registro nuevo usuario**
```bash
# Registrá un usuario nuevo
# Entrá a /dashboard/lotes
# ✅ Debería ver categorías en modales
```

### **Test 2: Usuarios existentes**
```bash
# Corrés el script
npx tsx scripts/add-new-categorias.ts

# ✅ Debería decir "Agregadas X categorías nuevas"
```

### **Test 3: Crear categoría custom**
```bash
# Entrá a /dashboard/preferencias
# Creá "Vaquillas especiales"
# ✅ Debería aparecer en modales
```

---

## 🚨 Troubleshooting

### Problema: "No aparecen categorías en modales"
```
Causa: Usuario viejo sin categorías en DB
Solución: Correr npx tsx scripts/add-new-categorias.ts
```

### Problema: "UG mal calculadas"
```
Causa: Falta categoría en EQUIVALENCIAS_UG
Solución: Agregar en src/lib/ugCalculator.ts
```

### Problema: "Categoría duplicada"
```
Causa: Se intentó crear una que ya existe
Solución: La API ya valida esto con skipDuplicates
```

---

## 📝 Resumen Rápido

| Acción | Dónde |
|--------|-------|
| **Ver categorías** | `constants.ts` |
| **Agregar nueva** | `constants.ts` + `ugCalculator.ts` + correr script |
| **API GET** | `/api/categorias-animal` (se usa EN TODOS LADOS) |
| **API POST** | `/api/categorias-animal` (crear custom) |
| **Cálculo UG** | `ugCalculator.ts` |
| **Script migración** | `scripts/add-new-categorias.ts` |

---

## 🎯 Conclusión

**NO BORRES `/api/categorias-animal`** - es el corazón del sistema de animales.

Para agregar categorías nuevas:
1. ✏️ Editá `constants.ts`
2. ✏️ Agregá equivalencia en `ugCalculator.ts`
3. ▶️ Corrés `npx tsx scripts/add-new-categorias.ts`

**Y listo** - nuevos y viejos usuarios tienen la categoría disponible en todo el sistema.