# ✅ Checklist de Implementación - Sistema de Roles

## Pre-Deployment

### 1. Base de Datos
- [ ] Backup completo de la base de datos de producción
- [ ] Crear snapshot de Supabase (si aplica)
- [ ] Verificar que tienes plan de rollback

### 2. Código
- [ ] Todos los archivos nuevos están en Git
- [ ] Branch de feature testeada en local
- [ ] Code review completado
- [ ] No hay console.logs de debug

### 3. Configuración
- [ ] Variables de entorno actualizadas en `.env`
- [ ] `NEXTAUTH_URL` apunta a dominio correcto
- [ ] `WHATSAPP_BOT_NUMBER` configurado
- [ ] Secrets en producción (Vercel/Railway/etc.)

---

## Deployment - Paso a Paso

### Fase 1: Actualizar Schema (⚠️ CRÍTICO)
```bash
# 1. Hacer backup
pg_dump $DATABASE_URL > backup_pre_roles_$(date +%Y%m%d).sql

# 2. Aplicar nuevo schema
npx prisma db push

# 3. Generar cliente Prisma
npx prisma generate

# 4. Verificar que los enums se crearon
# Conectarse a la DB y verificar:
# SELECT unnest(enum_range(NULL::\"Role\"));
# Debe mostrar: ADMIN_GENERAL, COLABORADOR, EMPLEADO, CONTADOR
```

### Fase 2: Migrar Usuarios Existentes
```bash
# 5. Ejecutar script de migración
npx ts-node scripts/migrate-existing-users.ts

# 6. Verificar resultado
# Conectarse a Prisma Studio o DB directamente
npx prisma studio

# 7. Verificar que:
# - Cada campo tiene exactamente 1 ADMIN_GENERAL
# - Usuarios antiguos fueron convertidos correctamente
# - accesoFinanzas está seteado correctamente
```

### Fase 3: Desplegar Código
```bash
# 8. Merge a main/production
git checkout main
git merge feature/roles-system
git push origin main

# 9. Si usas Vercel/Railway, deployment automático
# Verificar logs de deployment

# 10. Ejecutar migraciones en producción (si no fue automático)
# En Vercel: Build command debe incluir prisma generate
```

### Fase 4: Verificación Post-Deploy

#### Testing Manual

##### Login Existente
- [ ] ADMIN_GENERAL puede loguearse
- [ ] Ve todos los menús
- [ ] Puede acceder a /dashboard/equipo
- [ ] Puede crear invitaciones

##### Invitaciones
- [ ] Crear invitación COLABORADOR
- [ ] Verificar link de WhatsApp funciona
- [ ] Registrar usuario con link web
- [ ] Usuario nuevo puede loguearse

- [ ] Crear invitación EMPLEADO  
- [ ] Token en WhatsApp solicita nombre/apellido
- [ ] Usuario registrado NO puede entrar a web

- [ ] Crear invitación CONTADOR
- [ ] Link web funciona
- [ ] Contador solo ve Gastos y Mano de Obra
- [ ] Contador NO puede editar gastos

##### Permisos Financieros
- [ ] ADMIN_GENERAL ve finanzas
- [ ] COLABORADOR sin flag NO ve finanzas
- [ ] COLABORADOR con flag SÍ ve finanzas
- [ ] Habilitar/deshabilitar flag desde /equipo funciona

##### Sidebar Condicional
- [ ] ADMIN_GENERAL ve: Inicio, Lotes, Datos, Insumos, Gastos, Mano Obra, Equipo, Preferencias
- [ ] COLABORADOR (sin $) ve: Inicio, Lotes, Datos, Insumos
- [ ] COLABORADOR (con $) ve: Inicio, Lotes, Datos, Insumos, Gastos, Mano Obra
- [ ] CONTADOR ve: Inicio, Gastos, Mano Obra

##### Seguridad
- [ ] Intentar acceder a /dashboard/equipo como COLABORADOR → Redirige o muestra error
- [ ] Intentar POST a /api/gastos como CONTADOR → 403 Forbidden
- [ ] Intentar GET a /api/gastos sin autenticación → 401 Unauthorized

---

## Post-Deployment

### Monitoreo (Primeras 24h)

- [ ] Revisar logs de errores en Vercel/Sentry
- [ ] Verificar que usuarios pueden loguearse
- [ ] Confirmar que invitaciones se están creando
- [ ] Revisar métricas de uso del bot

### Comunicación

- [ ] Notificar a usuarios existentes sobre cambios
- [ ] Enviar tutorial de nuevas funcionalidades
- [ ] Documentar para soporte

### Tareas de Limpieza

- [ ] Eliminar invitaciones antiguas (pre-sistema)
```sql
DELETE FROM "Invitation" 
WHERE "createdAt" < '2025-11-16' 
AND "role" NOT IN ('COLABORADOR', 'EMPLEADO', 'CONTADOR');
```

- [ ] Actualizar documentación de usuario
- [ ] Crear videos tutoriales
- [ ] Actualizar FAQ

---

## Rollback Plan (Si algo sale mal)

### 1. Rollback de Código
```bash
# Revertir a commit anterior
git revert HEAD
git push origin main

# O hacer rollback en Vercel
# Dashboard → Deployments → Rollback
```

### 2. Rollback de Base de Datos
```bash
# Restaurar desde backup
psql $DATABASE_URL < backup_pre_roles_YYYYMMDD.sql

# Luego ejecutar:
npx prisma db pull  # Sincronizar schema con DB
npx prisma generate
```

### 3. Comunicación de Rollback
- [ ] Notificar a usuarios de la reversión
- [ ] Explicar causa del problema
- [ ] Definir timeline de nuevo intento

---

## Problemas Comunes y Soluciones

### Error: "Enum value already exists"
```bash
# Solución: El enum ya fue creado previamente
# Verificar schema y saltear creación manual
```

### Error: "Column accesoFinanzas does not exist"
```bash
# Solución: 
npx prisma db push --force-reset  # ⚠️ Solo en desarrollo
# O agregar columna manualmente:
ALTER TABLE "User" ADD COLUMN "accesoFinanzas" BOOLEAN DEFAULT false;
```

### Error: "Cannot read property 'role' of null"
```bash
# Solución: Usuario no tiene rol asignado
# Ejecutar script de migración nuevamente
npx ts-node scripts/migrate-existing-users.ts
```

### Bot no responde a tokens
```bash
# Verificar:
# 1. WHATSAPP_BOT_NUMBER en .env
# 2. Webhook está recibiendo requests
# 3. Logs en /api/bot-webhook
```

---

## Métricas de Éxito

### Indicadores Clave
- [ ] 0 errores 500 en APIs críticas
- [ ] Tiempo de respuesta < 500ms en /api/usuarios
- [ ] 100% de usuarios antiguos migrados correctamente
- [ ] 0 vulnerabilidades de seguridad detectadas
- [ ] Tasa de éxito de invitaciones > 95%

### Feedback de Usuarios
- [ ] Encuesta post-deployment
- [ ] Recopilar comentarios primeros 7 días
- [ ] Ajustar UX según feedback