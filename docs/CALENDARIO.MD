# 📅 Calendario - Bot Rural

## Resumen

Sistema de calendario integrado con WhatsApp y la web.

### Funcionalidadess:
- ✅ Crear actividades desde WhatsApp (audio o texto)
- ✅ Crear actividades desde la web
- ✅ Consultar pendientes desde WhatsApp
- ✅ Ver calendario visual en la web
- ✅ Marcar como realizada desde la web
- ✅ Colores por estado (pendiente, hoy, vencida, realizada)
- ✅ Zona horaria Uruguay

---

## 📁 Archivos incluidos

| Archivo | Destino | Descripción |
|---------|---------|-------------|
| `openai-parser.ts` | `src/lib/openai-parser.ts` | Parser actualizado con tipos CALENDARIO |
| `calendarioHandler.ts` | `src/lib/whatsapp/handlers/calendarioHandler.ts` | Handlers de WhatsApp |
| `api-calendario-route.ts` | `src/app/api/calendario/route.ts` | API GET/POST |
| `api-calendario-id-route.ts` | `src/app/api/calendario/[id]/route.ts` | API PATCH/DELETE |
| `calendario-page.tsx` | `src/app/dashboard/calendario/page.tsx` | Página del calendario |
| `INTEGRACION-BOT-WEBHOOK.ts` | (instrucciones) | Código para integrar en el webhook |
| `INSTRUCCIONES-SIDEBAR.ts` | (instrucciones) | Cómo agregar al sidebar |

---

## 🚀 Pasos de implementación

### 1. Schema de Prisma

Agregar al final de `prisma/schema.prisma`:
```prisma
model ActividadCalendario {
  id                String    @id @default(cuid())
  campoId           String
  usuarioId         String?
  
  titulo            String
  fechaProgramada   DateTime  @db.Date
  realizada         Boolean   @default(false)
  fechaRealizacion  DateTime?
  
  origen            String    @default("WEB")
  notas             String?
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  campo             Campo     @relation(fields: [campoId], references: [id], onDelete: Cascade)
  
  @@index([campoId])
  @@index([fechaProgramada])
  @@index([realizada])
}
```

Y en el modelo `Campo` agregar:
```prisma
actividadesCalendario ActividadCalendario[]
```

Luego ejecutar:
```bash
npx prisma db push
```

### 2. Copiar archivos
```bash
# Parser actualizado
cp openai-parser.ts src/lib/openai-parser.ts

# Handler de WhatsApp
cp calendarioHandler.ts src/lib/whatsapp/handlers/calendarioHandler.ts

# API
mkdir -p src/app/api/calendario/[id]
cp api-calendario-route.ts src/app/api/calendario/route.ts
cp api-calendario-id-route.ts src/app/api/calendario/[id]/route.ts

# Página
mkdir -p src/app/dashboard/calendario
cp calendario-page.tsx src/app/dashboard/calendario/page.tsx
```

### 3. Actualizar el webhook

Ver archivo `INTEGRACION-BOT-WEBHOOK.ts` para el código exacto.

Resumen:
1. Importar los handlers de calendario
2. Agregar los casos `CALENDARIO_CREAR` y `CALENDARIO_CONSULTAR` antes del switch existente
3. Actualizar el mensaje de ayuda

### 4. Exportar handlers

En `src/lib/whatsapp/index.ts`, agregar:
```typescript
export {
  handleCalendarioCrear,
  handleCalendarioConsultar,
} from "./handlers/calendarioHandler"
```

### 5. Agregar al sidebar

En tu `layout.tsx` del dashboard, agregar el link:
```typescript
{ href: '/dashboard/calendario', icon: '📅', label: 'Calendario' }
```

---

## 💬 Ejemplos de uso por WhatsApp

### Crear actividades:
- "en 14 días tengo que sacar tablilla"
- "acordame el martes de llamar al veterinario"
- "la semana que viene hay que vacunar"
- "mañana llega el camión"
- "pasado mañana pagar al peón"
- "el 20 revisar bebederos"

### Consultar pendientes:
- "calendario"
- "pendientes"
- "qué tengo agendado"
- "qué hay para hacer"

---

## 🎨 Estados visuales

| Estado | Color | Descripción |
|--------|-------|-------------|
| Pendiente | 🔵 Azul | Actividad futura |
| Hoy | 🟡 Amarillo | Actividad para hoy |
| Vencida | 🔴 Rojo | No realizada y pasó la fecha |
| Realizada | 🟢 Verde | Marcada como completada |

---

## ⚠️ Notas

- Las actividades vencidas se muestran hasta 7 días después
- Solo se puede marcar como realizada desde la web