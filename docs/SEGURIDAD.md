🔐 Documentación de Seguridad - MiCampoData

Jerarquía de Roles

ADMIN_GENERAL
Primer usuario del campo. Acceso total a toda la plataforma. Puede ver y editar todo, crear invitaciones, gestionar equipo, modificar permisos, acceder totalmente a finanzas y usar bot y web.

COLABORADOR
Acceso web y bot. Puede ver y crear lotes, eventos y datos. No puede invitar, ni ver equipo, ni preferencias. Tiene un permiso opcional: accesoFinanzas. Si accesoFinanzas = true puede ver y editar gastos y mano de obra. Si accesoFinanzas = false no ve finanzas.

EMPLEADO
Acceso solo al bot de WhatsApp. No accede a la web. Puede registrar datos y consultar información básica. No accede a finanzas ni a configuración.

CONTADOR
Acceso web limitado. No usa bot. Puede ver gastos y mano de obra pero no editar nada. No ve lotes, eventos, insumos, ni equipo.

⸻

Matriz de Permisos (en texto plano)

Dashboard:
	•	ADMIN_GENERAL → acceso total
	•	COLABORADOR → acceso limitado
	•	COLABORADOR con accesoFinanzas → limitado
	•	EMPLEADO → sin acceso
	•	CONTADOR → acceso solo financiero

Lotes:
	•	ADMIN_GENERAL: lectura y escritura
	•	COLABORADOR: lectura y escritura
	•	COLABORADOR con accesoFinanzas: lectura y escritura
	•	EMPLEADO: acceso vía bot
	•	CONTADOR: sin acceso

Datos / Eventos:
	•	ADMIN_GENERAL: RW
	•	COLABORADOR: RW
	•	COLABORADOR con accesoFinanzas: RW
	•	EMPLEADO: solo bot
	•	CONTADOR: sin acceso

Insumos: igual que datos/eventos.

Gastos:
	•	ADMIN_GENERAL: RW
	•	COLABORADOR sin accesoFinanzas: sin acceso
	•	COLABORADOR con accesoFinanzas: RW
	•	EMPLEADO: sin acceso
	•	CONTADOR: solo lectura

Mano de Obra: igual que gastos.

Equipo:
	•	ADMIN_GENERAL: RW
	•	Todos los demás: sin acceso

Preferencias:
	•	ADMIN_GENERAL: RW
	•	Todos los demás: sin acceso

Bot WhatsApp:
	•	ADMIN_GENERAL: sí
	•	COLABORADOR: sí
	•	COLABORADOR con accesoFinanzas: sí
	•	EMPLEADO: sí
	•	CONTADOR: no

⸻

Controles de Seguridad Implementados

Backend

Autenticación:
Cada endpoint verifica sesión así:
“si no existe session.user.id → error 401”.

Autorización por Rol:
Se hace con el helper requireAuth que devuelve { error, user }. Si error, se devuelve.

Aislamiento por Campo:
En todos los recursos se compara resource.campoId con user.campoId. Si no coinciden → 403.

Control de Acceso Financiero:
Antes de mostrar o editar gastos/mano de obra se verifica “canAccessFinanzas(user)”.
Antes de escritura (POST/PUT/DELETE) se usa “canWriteFinanzas(user)”.

Validación de Invitaciones:
Se verifica usado o expirado antes de permitir registro. Una invitación usada tiene usedAt.
expiresAt se compara con la fecha actual.

⸻

Frontend

Sidebar dinámico:
La sidebar muestra solo los items permitidos según rol. Se filtra la lista con una condición: “item.roles incluye el rol del usuario”.

Bloqueo de empleados:
Si el rol es EMPLEADO, se muestra una pantalla de acceso denegado (no puede entrar a la web).

Botones según permisos:
Cuando el usuario tiene permiso financiero aparece, por ejemplo, el botón para crear gastos. Si no, no aparece.

⸻

Flujos de Seguridad

Registro del Primer Usuario
	1.	Se verifica que no existan usuarios.
	2.	Se crea un campo.
	3.	Se asigna rol ADMIN_GENERAL.
	4.	accesoFinanzas = true por defecto.

⸻

Invitaciones

Solo ADMIN_GENERAL puede generar invitaciones.
El token generado es único, expira en 7 días y se marca como usado.
El usuario se registra siempre dentro del campo del creador de la invitación.

⸻

Registro por Invitación
	1.	Se valida token.
	2.	Se verifica expiración y si ya está usado.
	3.	Se crea usuario con su rol (empleado, colaborador, contador).
	4.	Se marca la invitación como usada.
	5.	Se asigna el campo correspondiente.

⸻

Acceso a Finanzas

Para acceder a /api/gastos o /api/mano-obra:
	1.	requireAuth verifica usuario.
	2.	canAccessFinanzas valida permisos básicos.
	3.	Para POST/PUT/DELETE se usa canWriteFinanzas.
	4.	Los datos devueltos están filtrados por campoId.

⸻

Vulnerabilidades Mitigadas

IDOR (Insecure Direct Object Reference):
Todo está aislado por campoId y por rol.

Privilege Escalation:
No se puede saltar permisos porque el backend valida rol en cada endpoint crítico.

Token Reuse:
Las invitaciones se invalidan tras un uso.

Tokens Expirados:
expiresAt se verifica antes de permitir registro.

Cross-Campo Access:
Nunca se devuelven datos de otro campo porque cada query filtra campoId.

SQL Injection:
Prisma ORM protege contra inyecciones SQL.

XSS:
React escapa contenido y se sanitizan inputs críticos.

⸻

Recomendaciones Futuras

Rate Limiting:
Agregar límites en /api/login y /api/register.

Logging/Auditoría:
Registrar cambios críticos como edición de gastos o cambios de permisos.

2FA:
Para ADMIN_GENERAL y CONTADOR.

HTTPS obligatorio:
En producción todo debe ser HTTPS.

Rotación de Secrets:
Rotar NEXTAUTH_SECRET y manejar con secrets manager.

⸻

Checklist de Pruebas de Seguridad (Testing)

Autenticación:
	•	Usuario sin sesión no accede a dashboard.
	•	Token inválido es rechazado.
	•	Sesión expira correctamente.

Autorización:
	•	Colaborador sin finanzas no puede entrar a gastos.
	•	Contador no puede editar.
	•	Empleado no entra a la web.

Invitaciones:
	•	Token expirado no sirve.
	•	Token usado no sirve.
	•	Solo admin genera invitaciones.

Aislamiento por campo:
	•	Usuario de un campo no ve datos del otro.

Bot WhatsApp:
	•	Empleado no entra a web.
	•	Tokens funcionan según rol.

⸻

Contacto de Seguridad

security@micampodata.com
Respuesta estimada: 24–48 horas.
