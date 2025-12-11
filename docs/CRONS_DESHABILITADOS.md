# Cron Jobs Deshabilitados

## Límite plan gratuito Vercel: 2 cron jobs máximo

### ACTIVOS (2/2):
- ✅ `marcar-pagados`: Se ejecuta diariamente a las 3 AM para marcar facturas/pagos vencidos
- ✅ `capturar-carga`: Se ejecuta diariamente a las 3:05 AM para capturar datos de carga animal

### DESHABILITADO temporalmente:
- ❌ `calendario-recordatorios`: Se ejecutaba diariamente a las 12 PM (mediodía) para enviar recordatorios de eventos del calendario

### Para reactivar cuando tengas plan Pro:
Agregar al array de crons en vercel.json:
```json
{
  "path": "/api/cron/calendario-recordatorios",
  "schedule": "0 12 * * *"
}
```