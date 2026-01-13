📋 Resumen Completo - Sistema de Recategorización Automática

✅ ARCHIVOS NUEVOS CREADOS
1. Migración y Schema
prisma/schema.prisma

✅ Modificado (agregado modelo ConfigRecategorizacion)


2. APIs
src/app/api/recategorizacion/pendientes/route.ts

✅ Nuevo - Obtiene categorías pendientes de dividir

src/app/api/recategorizacion/config/route.ts

✅ Nuevo - GET y PUT para configuración

src/app/api/recategorizacion/dividir-bovinos/route.ts

✅ Nuevo - POST para dividir Terneros nacidos por sexo

src/app/api/recategorizacion/dividir-ovinos-sexado/route.ts

✅ Nuevo - POST para dividir Corderos Mamones por sexo

src/app/api/recategorizacion/dividir-ovinos-castracion/route.ts

✅ Nuevo - POST para dividir Corderos DL (castración)

src/app/api/cron/recategorizacion-automatica/route.ts

✅ Nuevo - Cron que ejecuta recategorización automática


3. Modales
src/app/components/modales/ModalDividirBovinos.tsx

✅ Nuevo - Modal para dividir Terneros nacidos

src/app/components/modales/ModalDividirOvinosSexado.tsx

✅ Nuevo - Modal para dividir Corderos Mamones

src/app/components/modales/ModalDividirOvinosCastracion.tsx

✅ Nuevo - Modal para dividir Corderos DL


4. Componentes
src/app/components/BannerRecategorizacion.tsx

✅ Nuevo - Banner de advertencia (15 días antes)

src/app/preferencias/components/RecategorizacionPreferencias.tsx

✅ Nuevo - Componente principal de configuración


🔧 ARCHIVOS MODIFICADOS
1. Layout del Dashboard
src/app/dashboard/layout.tsx
Cambios:

✅ Importado BannerRecategorizacion
✅ Agregado <BannerRecategorizacion /> después del header


2. Página de Preferencias
src/app/dashboard/preferencias/page.tsx
Cambios:

✅ Importado RecategorizacionPreferencias
✅ Agregado 'recategorizacion' al tipo de activeTab
✅ Agregado tab "🔄 Recategorización" en el nav
✅ Agregado contenido del tab con <RecategorizacionPreferencias />


📂 Estructura de Carpetas Creada
src/
├── app/
│   ├── api/
│   │   ├── cron/
│   │   │   └── recategorizacion-automatica/
│   │   │       └── route.ts                    ← NUEVO
│   │   └── recategorizacion/
│   │       ├── config/
│   │       │   └── route.ts                    ← NUEVO
│   │       ├── pendientes/
│   │       │   └── route.ts                    ← NUEVO
│   │       ├── dividir-bovinos/
│   │       │   └── route.ts                    ← NUEVO
│   │       ├── dividir-ovinos-sexado/
│   │       │   └── route.ts                    ← NUEVO
│   │       └── dividir-ovinos-castracion/
│   │           └── route.ts                    ← NUEVO
│   │
│   ├── components/
│   │   ├── BannerRecategorizacion.tsx          ← NUEVO
│   │   └── modales/
│   │       ├── ModalDividirBovinos.tsx         ← NUEVO
│   │       ├── ModalDividirOvinosSexado.tsx    ← NUEVO
│   │       └── ModalDividirOvinosCastracion.tsx← NUEVO
│   │
│   └── preferencias/
│       └── components/
│           └── RecategorizacionPreferencias.tsx ← NUEVO
│
└── prisma/
    └── schema.prisma                            ← MODIFICADO

🗄️ Base de Datos
Modelo Agregado:
prismamodel ConfigRecategorizacion {
  id            String   @id @default(cuid())
  campoId       String   @unique
  bovinosActivo Boolean  @default(false)
  ovinosActivo  Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  campo         Campo    @relation(...)
}
Relación Agregada en Campo:
prismamodel Campo {
  // ... campos existentes
  configRecategorizacion ConfigRecategorizacion?
}

⚙️ Comandos Ejecutados
bash# 1. Aplicar migración
npx prisma migrate dev --name agregar_config_recategorizacion

# 2. Generar cliente Prisma
npx prisma generate
```

---

## 🎯 **Funcionalidades Implementadas**

### **1. Recategorización Automática**
- ✅ Se ejecuta el **1ro de Enero** de cada año
- ✅ Configurable por campo (activar/desactivar bovinos y ovinos)
- ✅ Respeta animales nuevos (`fechaIngreso < 1/1`)
- ✅ Genera eventos de tipo `RECATEGORIZACION`

### **2. División Manual**
- ✅ **Bovinos:** Terneros nacidos → Terneros + Terneras
- ✅ **Ovinos (sexado):** Corderos Mamones → Corderos DL + Corderas DL
- ✅ **Ovinos (castración):** Corderos DL → Capones + Carneros

### **3. Banner de Advertencia**
- ✅ Aparece **15 días antes** del 1ro de enero
- ✅ Se puede cerrar (se guarda en `localStorage`)
- ✅ Link directo a Preferencias

### **4. Interfaz en Preferencias**
- ✅ Tab "🔄 Recategorización"
- ✅ Activar/desactivar por especie
- ✅ Botones para dividir categorías pendientes
- ✅ Información clara de qué se automatiza y qué no

---

## 📊 **Categorías que se Recategorizan**

### **Automáticas (1ro de Enero):**

**Bovinos:**
- Terneros → Novillos 1-2
- Terneras → Vaquillonas 1-2
- Novillos 1-2 → Novillos 2-3
- Novillos 2-3 → Novillos +3
- Vaquillonas 1-2 → Vaquillonas +2
- Vaquillonas +2 → Vacas

**Ovinos:**
- Corderas DL → Borregas 2-4 dientes
- Borregas 2-4 dientes → Ovejas

---

### **Manuales (siempre):**

**Bovinos:**
- Terneros nacidos (requiere sexado al caravanear)

**Ovinos:**
- Corderos Mamones (requiere sexado al destetar)
- Corderos DL (requiere registrar castración)

**Equinos:**
- Todas las categorías (solo manual)

---

## 🔄 **Flujo Completo del Sistema**
```
1. Usuario activa recategorización en Preferencias
   ↓
2. Banner aparece 15 días antes del 1 de enero
   ↓
3. Cron ejecuta a las 23:00 del 31 de diciembre
   ↓
4. Recategoriza animales automáticamente
   ↓
5. Genera eventos de tipo RECATEGORIZACION
   ↓
6. Usuario ve cambios en sus potreros

📝 Notas Importantes

✅ Sin pérdida de datos: Los animales solo cambian de categoría
✅ Reversible: El usuario puede recategorizar manualmente si algo salió mal
✅ Historial: Todos los cambios quedan registrados como eventos
✅ Validación: Los modales validan que los números sumen exacto
✅ Respeta categorías desactivadas: Si el usuario desactivó una categoría, se saltea


🚀 Para Hacer Deploy

Commitear todos los archivos nuevos
Ejecutar migración en producción:

bash   vercel --prod

Configurar cron en Vercel (opcional, para ejecutar automáticamente)


📞 Soporte
Si necesitas modificar algo, revisa el archivo:
GUIA-MODIFICACION-RECATEGORIZACION.md

Fecha de Implementación: Enero 2026
Versión: 1.0
Estado: ✅ Completo y funcional-----------------


📋 Guía de Modificación - Sistema de Recategorización Automática

🎯 Cambios Comunes que Podrías Necesitar

1. Cambiar la fecha automática de recategorización
Actualmente: 1ro de Enero
Archivos a modificar:
A) Cron que ejecuta la recategorización
Archivo: src/app/api/cron/recategorizacion-automatica/route.ts
Busca esto:
typescript// Solo ejecutar el 1ro de enero
if (dia !== 1 || mes !== 1) {
  return NextResponse.json({ message: "No es la fecha de recategorización" });
}
Cambia dia !== 1 y mes !== 1 por los valores que quieras:

Mes: 1 = Enero, 2 = Febrero, ..., 12 = Diciembre
Día: 1 a 31

Ejemplo para 21 de septiembre:
typescriptif (dia !== 21 || mes !== 9) {
  return NextResponse.json({ message: "No es la fecha de recategorización" });
}

B) Banner de advertencia (15 días antes)
Archivo: src/app/components/BannerRecategorizacion.tsx
Busca esto:
typescriptconst proximoEnero = new Date(anioActual + 1, 0, 1) // 1 de enero del próximo año
Cambia el segundo parámetro (mes - 1) y el tercero (día):
typescriptconst proximoEnero = new Date(anioActual + 1, 8, 21) // 21 de septiembre (mes 8 porque enero=0)
Y también cambia:
typescriptconst fechaObjetivo = hoy > new Date(anioActual, 0, 1)
Por:
typescriptconst fechaObjetivo = hoy > new Date(anioActual, 8, 21)
Y el texto del banner:
typescriptRecategorización automática el 21 de septiembre

C) Texto en Preferencias
Archivo: src/app/preferencias/components/RecategorizacionPreferencias.tsx
Busca esto:
typescript<p className="text-sm text-gray-700 mb-2">
  <strong>📅 Fecha de cambio:</strong> 1ro de Enero
</p>
Cambia por:
typescript<p className="text-sm text-gray-700 mb-2">
  <strong>📅 Fecha de cambio:</strong> 21 de Septiembre
</p>

2. Cambiar cuántos días antes aparece el banner
Actualmente: 15 días antes
Archivo: src/app/components/BannerRecategorizacion.tsx
Busca esto:
typescript// Mostrar si faltan 15 días o menos
if (diasFaltantes > 0 && diasFaltantes <= 15) {
Cambia 15 por el número de días que quieras:
typescriptif (diasFaltantes > 0 && diasFaltantes <= 30) { // 30 días antes

3. Agregar/Quitar categorías que se recategorizan automáticamente
Archivo: src/app/api/cron/recategorizacion-automatica/route.ts
Para BOVINOS:
Busca esto:
typescriptconst RECATEGORIZACIONES_BOVINOS = [
  { de: "Terneros", a: "Novillos 1-2" },
  { de: "Terneras", a: "Vaquillonas 1-2" },
  { de: "Novillos 1-2", a: "Novillos 2-3" },
  { de: "Novillos 2-3", a: "Novillos +3" },
  { de: "Vaquillonas 1-2", a: "Vaquillonas +2" },
  { de: "Vaquillonas +2", a: "Vacas" },
];
Para agregar una nueva:
typescript{ de: "Nombre Origen", a: "Nombre Destino" },
Para quitar: Simplemente elimina la línea

Para OVINOS:
Busca esto:
typescriptconst RECATEGORIZACIONES_OVINOS = [
  { de: "Corderas DL", a: "Borregas 2-4 dientes" },
  { de: "Borregas 2-4 dientes", a: "Ovejas" },
];
Mismo proceso: agrega o quita líneas

⚠️ IMPORTANTE: También actualiza el texto en Preferencias para que coincida:
Archivo: src/app/preferencias/components/RecategorizacionPreferencias.tsx
Busca: ℹ️ Se recategorizan automáticamente: y actualiza la lista

4. Modificar qué categorías requieren división manual
Archivo: src/app/api/recategorizacion/pendientes/route.ts
Busca esto:
typescriptcategoria: {
  in: ["Terneros nacidos", "Terneras nacidas", "Corderos Mamones", "Corderas Mamonas", "Corderos DL"],
},
Para agregar una nueva categoría pendiente:

Agrega el nombre exacto a la lista
Luego crea la lógica para agruparla en el mismo archivo


5. Cambiar los nombres de las categorías predeterminadas
⚠️ CUIDADO: Esto afecta el funcionamiento. Solo hacelo si realmente necesitas cambiar los nombres.
Archivos a modificar:

Cron: src/app/api/cron/recategorizacion-automatica/route.ts

Actualiza RECATEGORIZACIONES_BOVINOS y RECATEGORIZACIONES_OVINOS


API Pendientes: src/app/api/recategorizacion/pendientes/route.ts

Actualiza el array in: [...]


APIs de División:

src/app/api/recategorizacion/dividir-bovinos/route.ts
src/app/api/recategorizacion/dividir-ovinos-sexado/route.ts
src/app/api/recategorizacion/dividir-ovinos-castracion/route.ts
Actualiza los nombres en categoria: "Nombre"


Componente de Preferencias: src/app/preferencias/components/RecategorizacionPreferencias.tsx

Actualiza todos los textos que mencionen categorías




6. Deshabilitar especies (Ej: no quiero ovinos)
Archivo: src/app/preferencias/components/RecategorizacionPreferencias.tsx
Para ocultar la sección de OVINOS:
Busca:
typescript{/* CONFIGURACIÓN OVINOS */}
<div className="bg-white border border-gray-200 rounded-lg p-6">
Elimina todo ese bloque hasta el </div> correspondiente
También elimina en:

src/app/api/cron/recategorizacion-automatica/route.ts → Comentar el bloque de ovinos
src/app/api/recategorizacion/config/route.ts → Dejar solo bovinosActivo


7. Agregar una tercera especie (Ej: porcinos)
Archivos a crear/modificar:

Schema Prisma: Agregar campo porcinosActivo a ConfigRecategorizacion
API Config: Agregar manejo del campo
Cron: Crear RECATEGORIZACIONES_PORCINOS
API Pendientes: Agregar detección de categorías porcinas
APIs de División: Crear endpoint similar a los existentes
Modal: Crear modal de división
Componente Preferencias: Agregar sección visual


📂 Resumen de Archivos Críticos
ArchivoPropósitosrc/app/api/cron/recategorizacion-automatica/route.tsEjecuta la recategorización (fecha, categorías)src/app/components/BannerRecategorizacion.tsxBanner de advertencia (días antes, fecha)src/app/preferencias/components/RecategorizacionPreferencias.tsxInterfaz visual (textos, botones)src/app/api/recategorizacion/pendientes/route.tsDetecta categorías pendientesprisma/schema.prismaBase de datos (estructura)

⚠️ Después de Cambios en Schema
Si modificas prisma/schema.prisma:
bashnpx prisma migrate dev --name nombre_del_cambio
npx prisma generate

🔄 Configuración del Cron en Vercel
Para que el cron se ejecute automáticamente:
Archivo: vercel.json (en la raíz del proyecto)
json{
  "crons": [{
    "path": "/api/cron/recategorizacion-automatica",
    "schedule": "0 23 31 12 *"
  }]
}
Formato: minuto hora día mes día_semana
Ejemplos:

0 23 31 12 * → 31 dic a las 23:00 (para ejecutar el 1 ene)
0 23 20 8 * → 20 sep a las 23:00 (para ejecutar el 21 sep)