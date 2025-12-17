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
  { nombreSingular: 'Novillos +3 años', nombrePlural: 'Novillos +3 años', tipoAnimal: TipoAnimal.BOVINO },
  { nombreSingular: 'Novillos 2–3 años', nombrePlural: 'Novillos 2–3 años', tipoAnimal: TipoAnimal.BOVINO },
  { nombreSingular: 'Novillos 1–2 años', nombrePlural: 'Novillos 1–2 años', tipoAnimal: TipoAnimal.BOVINO },
  { nombreSingular: 'Vaquillonas +2 años', nombrePlural: 'Vaquillonas +2 años', tipoAnimal: TipoAnimal.BOVINO },
  { nombreSingular: 'Vaquillonas 1–2 años', nombrePlural: 'Vaquillonas 1–2 años', tipoAnimal: TipoAnimal.BOVINO },
  { nombreSingular: 'Terneros', nombrePlural: 'Terneros', tipoAnimal: TipoAnimal.BOVINO },
  { nombreSingular: 'Terneras', nombrePlural: 'Terneras', tipoAnimal: TipoAnimal.BOVINO },
  { nombreSingular: 'Terneros nacidos', nombrePlural: 'Terneros nacidos', tipoAnimal: TipoAnimal.BOVINO },
  
  // OVINOS
  { nombreSingular: 'Carneros', nombrePlural: 'Carneros', tipoAnimal: TipoAnimal.OVINO },
  { nombreSingular: 'Ovejas', nombrePlural: 'Ovejas', tipoAnimal: TipoAnimal.OVINO },
  { nombreSingular: 'Capones', nombrePlural: 'Capones', tipoAnimal: TipoAnimal.OVINO },
  { nombreSingular: 'Borregas 2–4 dientes', nombrePlural: 'Borregas 2–4 dientes', tipoAnimal: TipoAnimal.OVINO },
  { nombreSingular: 'Corderas DL', nombrePlural: 'Corderas DL', tipoAnimal: TipoAnimal.OVINO },
  { nombreSingular: 'Corderos DL', nombrePlural: 'Corderos DL', tipoAnimal: TipoAnimal.OVINO },
  { nombreSingular: 'Corderos/as Mamones', nombrePlural: 'Corderos/as Mamones', tipoAnimal: TipoAnimal.OVINO },
  
  // EQUINOS
  { nombreSingular: 'Padrillos', nombrePlural: 'Padrillos', tipoAnimal: TipoAnimal.EQUINO },
  { nombreSingular: 'Yeguas', nombrePlural: 'Yeguas', tipoAnimal: TipoAnimal.EQUINO },
  { nombreSingular: 'Caballos', nombrePlural: 'Caballos', tipoAnimal: TipoAnimal.EQUINO },
  { nombreSingular: 'Potrillos', nombrePlural: 'Potrillos', tipoAnimal: TipoAnimal.EQUINO },
] as const
```

**✅ Este es el ÚNICO lugar donde definís las categorías predeterminadas que se crean automáticamente.**

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
  skipDuplicates: true,
})
```

**Resultado**: El nuevo usuario ya tiene todas las categorías en su campo.

---

### 3️⃣ **API de Gestión** (`/api/categorias-animal/route.ts`)

Esta API permite gestionar las categorías de animales de forma dinámica.

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
- ✅ **Filtros en Datos** (DatosContext carga las categorías activas)
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

**Nota importante:** Las categorías desactivadas NO aparecen en:
- Dropdowns de modales
- Filtros de la página Datos
- Nuevos eventos

Pero **SÍ siguen funcionando** para eventos históricos.

---

## 🔢 Cálculo de UG (Unidades Ganaderas)

### Archivo: `src/lib/ugCalculator.ts`
```typescript
export const EQUIVALENCIAS_UG: Record<string, number> = {
  // 🐄 VACUNOS
  'Toros': 1.20,
  'Vacas': 1.00,
  'Novillos +3 años': 1.20,
  'Novillos 2–3 años': 1.00,
  'Novillos 1–2 años': 0.70,
  'Vaquillonas +2 años': 1.00,
  'Vaquillonas 1–2 años': 0.70,
  'Terneros': 0.40,
  'Terneras': 0.40,
  'Terneros nacidos': 0,  // No cuentan en UG (equivalencia especial)
  
  // 🐑 OVINOS
  'Carneros': 0.17,
  'Ovejas': 0.16,
  'Capones': 0.14,
  'Borregas 2–4 dientes': 0.16,
  'Corderas DL': 0.10,
  'Corderos DL': 0.10,
  'Corderos/as Mamones': 0.10,

  // 🐴 YEGUARIZOS
  'Padrillos': 1.20,
  'Yeguas': 1.20,
  'Caballos': 1.20,
  'Potrillos': 1.20,
}

/**
 * Calcula las UG de las vacas considerando terneros nacidos
 * 🆕 LÓGICA ESPECIAL: Vacas con ternero nacido = 1.2 UG
 */
function calcularUGVacas(animales: Animal[]): number {
  const ternerosNacidos = animales.find(a => a.categoria === 'Terneros nacidos')?.cantidad || 0
  const vacasTotal = animales.find(a => a.categoria === 'Vacas')?.cantidad || 0
  const vacasConCria = Math.min(ternerosNacidos, vacasTotal)
  const vacasSinCria = Math.max(0, vacasTotal - ternerosNacidos)
  return (vacasConCria * 1.2) + (vacasSinCria * 1.0)
}

/**
 * Calcula las UG totales de una lista de animales
 * 🆕 LÓGICA ESPECIAL: Si hay "Terneros nacidos", las vacas equivalentes valen 1.2 UG
 */
export function calcularUGTotales(animales: Animal[]): number {
  if (!animales || animales.length === 0) return 0

  let ugTotales = 0
  
  // 1️⃣ Calcular UG de vacas con lógica especial
  const ugVacas = calcularUGVacas(animales)
  ugTotales += ugVacas

  // 2️⃣ Calcular UG del resto de animales (excepto vacas)
  for (const animal of animales) {
    if (animal.categoria === 'Vacas') {
      continue  // Ya las contamos arriba
    }
    
    const equivalencia = EQUIVALENCIAS_UG[animal.categoria] || 0
    ugTotales += animal.cantidad * equivalencia
  }

  return ugTotales
}
```

**Dónde se usa:**
- ✅ `/dashboard/lotes` - Carga global y por potrero
- ✅ `/dashboard/indicadores` - Gráficos de UG
- ✅ `/dashboard/ug-evolution` - Evolución histórica
- ✅ `/api/dashboard-data` - Resúmenes

**⚠️ Importante:** Las categorías en `EQUIVALENCIAS_UG` deben coincidir EXACTAMENTE con las de `CATEGORIAS_ANIMALES_DEFAULT`.

---

## 📂 Archivos que Usan Categorías

### **Modales (todos en `/src/app/components/modales/`)**

| Modal | Uso |
|-------|-----|
| `ModalNacimiento.tsx` | Dropdown con categorías especiales ("Terneros nacidos" / "Corderos/as Mamones") |
| `ModalMortandad.tsx` | Fetch categorías activas → dropdown "Categoría afectada" |
| `ModalRecategorizacion.tsx` | Fetch categorías activas → "De" y "A" |
| `ModalVenta.tsx` | Fetch categorías activas → renglones de venta |
| `ModalCompra.tsx` | Fetch categorías activas → renglones de compra |
| `ModalConsumo.tsx` | Fetch categorías activas → renglones de consumo |
| `ModalTacto.tsx` | Fetch categorías activas → dropdown |
| `ModalTratamiento.tsx` | Fetch categorías activas → dropdown |

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
| `/dashboard/lotes` | Muestra animales agrupados por categoría con badges |
| `/dashboard/datos` | Carga categorías activas para filtros + búsqueda |
| `/dashboard/indicadores` | Gráficos por categoría |
| `/dashboard/preferencias` | CRUD completo de categorías (crear, activar/desactivar) |
| `/dashboard/snig` | Fetch con `?campoId=` para confirmar importación |

---

### **APIs**

| API | Uso |
|-----|-----|
| `/api/eventos` | Valida que la categoría existe y actualiza stock de animales |
| `/api/ventas` | Valida categorías en renglones y descuenta stock |
| `/api/compras` | Valida categorías en renglones e incrementa stock |
| `/api/consumos` | Valida categorías en renglones y descuenta stock |
| `/api/datos` | Retorna eventos con campo `categoriaAnimal` para filtros |

---

### **Contexto de Datos** (`/app/contexts/DatosContext.tsx`)

Este contexto es crítico para el funcionamiento de los filtros en la página de Datos.

**Carga categorías activas al montar:**
```typescript
useEffect(() => {
  fetch('/api/categorias-animal')
    .then(r => r.json())
    .then(categorias => {
      const activas = categorias
        .filter((c: any) => c.activo)
        .map((c: any) => c.nombreSingular)
      setCategoriasActivas(activas)
    })
}, [])
```

**Agrupación de categorías para matching flexible:**
```typescript
const AGRUPACION_ANIMALES: Record<string, string[]> = {
  'Novillos': ['Novillos +3 años', 'Novillos 2–3 años', 'Novillos 1–2 años', 'Novillos'],
  'Vaquillonas': ['Vaquillonas +2 años', 'Vaquillonas 1–2 años', 'Vaquillonas'],
  'Terneros': ['Terneros'],
  'Terneras': ['Terneras'],
  'Terneros nacidos': ['Terneros nacidos'],
  'Corderos/as Mamones': ['Corderos/as Mamones'],
  // ... más categorías
}
```

**Filtro inteligente de animales:**
- Busca tanto en `dato.categoriaAnimal` (campo específico del evento)
- Como en `dato.descripcion` (texto descriptivo)
- Soporta eventos especiales como recategorización (busca en origen Y destino)

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
] as const
```

### **Paso 2: Agregar equivalencia UG en `ugCalculator.ts`**
```typescript
export const EQUIVALENCIAS_UG: Record<string, number> = {
  // ... equivalencias existentes ...
  
  // 🆕 NUEVA
  'Terneros destetados': 0.50,
}
```

**Y actualizar los arrays de categorías en las funciones:**
```typescript
// En calcularEstadisticasLote() y calcularEstadisticasCampo()
if (['Toros', 'Novillos +3 años', 'Novillos 2–3 años', 
     'Novillos 1–2 años', 'Vaquillonas +2 años', 'Vaquillonas 1–2 años', 
     'Terneros', 'Terneras', 'Terneros nacidos', 'Terneros destetados'].includes(animal.categoria)) {  // 🆕 AGREGAR
  desglosePorTipo.vacunos += ugAnimal
}

// En calcularRelacionLanarVacuno()
const categoriasVacunas = ['Toros', 'Vacas', 'Novillos +3 años', 'Novillos 2–3 años', 
                           'Novillos 1–2 años', 'Vaquillonas +2 años', 'Vaquillonas 1–2 años', 
                           'Terneros', 'Terneras', 'Terneros nacidos', 'Terneros destetados']  // 🆕 AGREGAR
```

### **Paso 3: Agregar en DatosContext (si aplica)**

Si querés que la nueva categoría tenga agrupación especial en filtros:
```typescript
const AGRUPACION_ANIMALES: Record<string, string[]> = {
  // ... existentes ...
  'Terneros destetados': ['Terneros destetados'],  // 🆕 AGREGAR
}
```

### **Paso 4: Correr script para usuarios existentes**
```bash
npx tsx scripts/add-new-categorias.ts
```

**✅ LISTO** - Nuevos usuarios ya la tienen, usuarios viejos también.

---

## 🔄 Migrar una Categoría Existente (Ejemplo: Terneros/as → Terneros + Terneras)

Si necesitás **dividir** o **cambiar** categorías existentes, seguí este proceso:

### **Paso 1: Crear script de migración**
```typescript
// scripts/migrate-terneros-categoria.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const campos = await prisma.campo.findMany({
    include: {
      categoriasAnimal: true,
      lotes: true
    }
  })

  for (const campo of campos) {
    // 1. Crear nuevas categorías
    await prisma.categoriaAnimal.createMany({
      data: [
        { nombreSingular: 'Terneros', nombrePlural: 'Terneros', tipoAnimal: 'BOVINO', campoId: campo.id, activo: true, esPredeterminado: true },
        { nombreSingular: 'Terneras', nombrePlural: 'Terneras', tipoAnimal: 'BOVINO', campoId: campo.id, activo: true, esPredeterminado: true }
      ],
      skipDuplicates: true
    })

    // 2. Migrar datos de AnimalesLote (dividir 50/50)
    const animalesLote = await prisma.animalLote.findMany({
      where: { 
        loteId: { in: campo.lotes.map(l => l.id) },
        categoria: 'Terneros/as'
      }
    })

    for (const animal of animalesLote) {
      const mitad = Math.floor(animal.cantidad / 2)
      const resto = animal.cantidad % 2

      await prisma.animalLote.create({
        data: { loteId: animal.loteId, categoria: 'Terneros', cantidad: mitad + resto, peso: animal.peso, fechaIngreso: animal.fechaIngreso }
      })

      await prisma.animalLote.create({
        data: { loteId: animal.loteId, categoria: 'Terneras', cantidad: mitad, peso: animal.peso, fechaIngreso: animal.fechaIngreso }
      })

      await prisma.animalLote.delete({ where: { id: animal.id } })
    }

    // 3. Actualizar Eventos
    await prisma.evento.updateMany({
      where: { campoId: campo.id, categoria: 'Terneros/as' },
      data: { categoria: 'Terneros' }
    })

    // 4. Actualizar Ventas, Compras, Consumos...
    // (Similar al punto 3)

    // 5. Desactivar categoría antigua
    const categoriaAntigua = campo.categoriasAnimal.find(c => c.nombreSingular === 'Terneros/as')
    if (categoriaAntigua) {
      await prisma.categoriaAnimal.update({
        where: { id: categoriaAntigua.id },
        data: { activo: false }
      })
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

### **Paso 2: Ejecutar migración**
```bash
npx tsx scripts/migrate-terneros-categoria.ts
```

---

## 🗑️ ¿Se Puede Borrar `/api/categorias-animal`?

### ❌ **NO, ES CRÍTICO**

Esta API se usa en:

1. ✅ **Todos los modales** (18+ componentes)
2. ✅ **SNIG** (importación de animales)
3. ✅ **Preferencias** (CRUD de categorías)
4. ✅ **Filtros en Datos** (DatosContext)
5. ✅ **Validación en APIs de eventos**

**Sin esta API, TODO el sistema de animales se rompe.**

---

## 🔧 Cómo Funciona el Sistema Completo

### **Flujo de Registro de Usuario Nuevo**
```
1. Usuario se registra → /api/register
2. Se crea Campo → campo.id = 'abc123'
3. Se crean 23 categorías de animales con campoId = 'abc123'
   (Bovinos: 10, Ovinos: 7, Equinos: 4)
4. Usuario entra al dashboard → Fetch /api/categorias-animal
5. Aparecen en todos los dropdowns y modales
```

---

### **Flujo de Cálculo de UG con Terneros Nacidos**
```
1. Usuario tiene animales en potrero:
   - 10 Vacas
   - 5 Terneros nacidos
   
2. Se llama calcularUGTotales([
     { categoria: 'Vacas', cantidad: 10 },
     { categoria: 'Terneros nacidos', cantidad: 5 }
   ])
   
3. Lógica especial:
   - 5 Vacas tienen cría = 5 * 1.2 = 6.0 UG
   - 5 Vacas sin cría = 5 * 1.0 = 5.0 UG
   - Terneros nacidos = 5 * 0 = 0 UG (no cuentan, ya están en las vacas)
   - TOTAL = 11.0 UG
   
4. Carga UG/ha:
   - Potrero tiene 10 hectáreas
   - 11.0 UG / 10 ha = 1.10 UG/ha ✅ Verde (óptimo)
```

---

### **Flujo de Filtrado en Página Datos**
```
1. Usuario filtra por "Terneros nacidos"
2. DatosContext verifica:
   - ¿"Terneros nacidos" está en categoriasActivas? ✅ Sí
3. Para cada evento:
   - Verifica dato.categoriaAnimal === "Terneros nacidos" ✅
   - O busca "Terneros nacidos" en dato.descripcion
4. Muestra eventos que coinciden
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
  // Cuenta total de animales (no UG) de ovinos vs vacunos
  // Resultado: 1.5 significa "1.5 ovinos por cada 1 vacuno"
}
```

**Solo se muestra si hay AMBOS tipos en el campo.**

---

## 🧪 Testing

Para verificar que todo funciona:

### **Test 1: Registro nuevo usuario**
```bash
# 1. Registrá un usuario nuevo
# 2. Entrá a /dashboard/lotes
# 3. Abrí modal de Nacimiento
# ✅ Debería ver "Terneros nacidos" y "Corderos/as Mamones"
```

### **Test 2: Usuarios existentes**
```bash
# 1. Corrés el script
npx tsx scripts/add-new-categorias.ts

# ✅ Debería decir "Agregadas X categorías nuevas"
```

### **Test 3: Crear categoría custom**
```bash
# 1. Entrá a /dashboard/preferencias
# 2. Creá "Vaquillas especiales"
# ✅ Debería aparecer en modales inmediatamente
```

### **Test 4: Filtro en Datos**
```bash
# 1. Creá un nacimiento de "Terneros nacidos"
# 2. Entrá a /dashboard/datos
# 3. Filtrá por "Terneros nacidos"
# ✅ Debería mostrar el evento de nacimiento
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

### Problema: "Filtro no muestra eventos de una categoría"
```
Causa 1: Categoría está desactivada
Solución: Activarla en /dashboard/preferencias

Causa 2: Falta en AGRUPACION_ANIMALES
Solución: Agregar en src/app/contexts/DatosContext.tsx

Causa 3: El API no devuelve categoriaAnimal
Solución: Verificar que /api/datos incluya: categoriaAnimal: evento.categoria
```

---

## 📝 Resumen Rápido

| Acción | Dónde |
|--------|-------|
| **Ver categorías** | `constants.ts` (línea ~50) |
| **Agregar nueva** | `constants.ts` + `ugCalculator.ts` + script |
| **API GET** | `/api/categorias-animal` (se usa EN TODOS LADOS) |
| **API POST** | `/api/categorias-animal` (crear custom) |
| **Cálculo UG** | `ugCalculator.ts` (línea ~10) |
| **Filtros Datos** | `DatosContext.tsx` (línea ~30) |
| **Script migración** | `scripts/add-new-categorias.ts` |

---

## 🎯 Checklist para Agregar Nueva Categoría

- [ ] Agregar en `src/lib/constants.ts` → CATEGORIAS_ANIMALES_DEFAULT
- [ ] Agregar equivalencia en `src/lib/ugCalculator.ts` → EQUIVALENCIAS_UG
- [ ] Actualizar arrays en funciones de ugCalculator (calcularEstadisticas, calcularRelacion)
- [ ] (Opcional) Agregar en `src/app/contexts/DatosContext.tsx` → AGRUPACION_ANIMALES
- [ ] Correr `npx tsx scripts/add-new-categorias.ts`
- [ ] Probar en modal de evento relevante
- [ ] Probar cálculo de UG en /dashboard/lotes
- [ ] Probar filtro en /dashboard/datos

---

## 🎯 Conclusión

**NO BORRES `/api/categorias-animal`** - es el corazón del sistema de animales.

Para agregar categorías nuevas:
1. ✏️ Editá `constants.ts` (agregar a array)
2. ✏️ Agregá equivalencia en `ugCalculator.ts` (3 lugares: EQUIVALENCIAS_UG + 2 funciones)
3. ✏️ (Opcional) Agregá en `DatosContext.tsx` (AGRUPACION_ANIMALES)
4. ▶️ Corrés `npx tsx scripts/add-new-categorias.ts`

**Y listo** - nuevos y viejos usuarios tienen la categoría disponible en todo el sistema. ✅