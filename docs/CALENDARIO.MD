📅 Calendario - Bot Rural
Resumen
Sistema de calendario a corto plazo (60 días) integrado con WhatsApp y la web.
Funcionalidades:

✅ Crear actividades desde WhatsApp (audio o texto)
✅ Crear actividades desde la web
✅ Consultar pendientes desde WhatsApp
✅ Ver calendario visual en la web
✅ Marcar como realizada desde la web
✅ Colores por estado (pendiente, hoy, vencida, realizada)
✅ Zona horaria Uruguay


📁 Archivos incluidos
ArchivoDestinoDescripciónopenai-parser.tssrc/lib/openai-parser.tsParser actualizado con tipos CALENDARIOcalendarioHandler.tssrc/lib/whatsapp/handlers/calendarioHandler.tsHandlers de WhatsAppapi-calendario-route.tssrc/app/api/calendario/route.tsAPI GET/POSTapi-calendario-id-route.tssrc/app/api/calendario/[id]/route.tsAPI PATCH/DELETEcalendario-page.tsxsrc/app/dashboard/calendario/page.tsxPágina del calendarioINTEGRACION-BOT-WEBHOOK.ts(instrucciones)Código para integrar en el webhookINSTRUCCIONES-SIDEBAR.ts(instrucciones)Cómo agregar al sidebar

🚀 Pasos de implementación
1. Schema de Prisma
Agregar al final de prisma/schema.prisma:
prismamodel ActividadCalendario {
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
Y en el modelo Campo agregar:
prismaactividadesCalendario ActividadCalendario[]
Luego ejecutar:
bashnpx prisma db push
2. Copiar archivos
bash# Parser actualizado
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
3. Actualizar el webhook
Ver archivo INTEGRACION-BOT-WEBHOOK.ts para el código exacto.
Resumen:

Importar los handlers de calendario
Agregar los casos CALENDARIO_CREAR y CALENDARIO_CONSULTAR antes del switch existente
Actualizar el mensaje de ayuda

4. Exportar handlers
En src/lib/whatsapp/index.ts, agregar:
typescriptexport {
  handleCalendarioCrear,
  handleCalendarioConsultar,
} from "./handlers/calendarioHandler"
5. Agregar al sidebar
En tu layout.tsx del dashboard, agregar el link:
typescript{ href: '/dashboard/calendario', icon: '📅', label: 'Calendario' }

💬 Ejemplos de uso por WhatsApp
Crear actividades:

"en 14 días tengo que sacar tablilla"
"acordame el martes de llamar al veterinario"
"la semana que viene hay que vacunar"
"mañana llega el camión"
"pasado mañana pagar al peón"
"el 20 revisar bebederos"

Consultar pendientes:

"calendario"
"pendientes"
"qué tengo agendado"
"qué hay para hacer"


🎨 Estados visuales
EstadoColorDescripciónPendiente🔵 AzulActividad futuraHoy🟡 AmarilloActividad para hoyVencida🔴 RojoNo realizada y pasó la fechaRealizada🟢 VerdeMarcada como completada

⚠️ Limitaciones

Máximo 60 días hacia adelante
Las actividades vencidas se muestran hasta 7 días después
Solo se puede marcar como realizada desde la web