# 📘 Guía de Usuario - Sistema de Roles MiCampoData

## Tipos de Usuario

### 🔷 Administrador General
**Eres el dueño del campo en el sistema**

✅ Lo que puedes hacer:
- Ver y gestionar todos los datos
- Invitar nuevos usuarios
- Modificar permisos de colaboradores
- Acceso completo a finanzas
- Configurar preferencias del sistema

🎯 Casos de uso:
- Gestión diaria del establecimiento
- Control financiero completo
- Administración del equipo

---

### 🔷 Colaborador
**Trabajas en el campo y gestionas datos**

✅ Lo que puedes hacer:
- Gestionar lotes y animales
- Registrar eventos (lluvias, tratamientos, etc.)
- Usar el bot de WhatsApp
- Ver reportes generales

❌ Lo que NO puedes hacer:
- Invitar otros usuarios
- Modificar configuración avanzada
- Ver finanzas (a menos que el admin te lo habilite)

💡 **Acceso a Finanzas**: El administrador puede habilitarte el acceso a gastos y mano de obra desde el menú "Equipo".

---

### 🔷 Empleado de Campo
**Solo usas el bot de WhatsApp**

✅ Lo que puedes hacer:
- Enviar datos vía WhatsApp (audios o texto)
- Registrar eventos del campo
- Consultar información básica

❌ Lo que NO puedes hacer:
- Entrar a la plataforma web
- Ver finanzas
- Gestionar usuarios

🎤 **Solo Bot**: No necesitas email ni contraseña, solo tu número de WhatsApp.

---

### 🔷 Contador
**Acceso de solo lectura a finanzas**

✅ Lo que puedes hacer:
- Ver todos los gastos
- Ver registros de mano de obra
- Exportar reportes financieros

❌ Lo que NO puedes hacer:
- Editar o crear gastos
- Ver lotes o animales
- Usar el bot de WhatsApp

📊 **Función**: Auditoría y control contable externo.

---

## Cómo Invitar Usuarios

### Para Administradores

1. Ve a **Dashboard → Equipo**
2. Clic en **"Invitar usuario"**
3. Elige el tipo de usuario:
   - **Colaborador**: Si la persona trabajará con la plataforma web y el bot
   - **Empleado**: Si solo usará WhatsApp
   - **Contador**: Si solo verá finanzas

4. Se generará un link:
   - **Colaborador/Empleado**: Link de WhatsApp
   - **Contador**: Link web directo

5. Envía el link a la persona
6. La persona completará su registro

---

## Preguntas Frecuentes

### ¿Puedo cambiar el rol de un usuario?
No directamente. El rol se asigna al momento de la invitación y no se puede cambiar. Si necesitas cambiar el rol, debes eliminar el usuario y crear una nueva invitación.

### ¿Puedo dar acceso a finanzas a un colaborador?
Sí. Ve a **Equipo**, busca al colaborador y usa el toggle "Acceso Finanzas".

### ¿Qué pasa si un empleado intenta entrar a la web?
Verá un mensaje de "Acceso restringido" indicándole que su cuenta solo funciona con el bot.

### ¿Cuánto tiempo dura una invitación?
7 días. Después de ese tiempo expira y debes crear una nueva.

### ¿Un contador puede editar gastos?
No, solo puede verlos. Si necesitas que edite, invítalo como Colaborador con acceso a finanzas.

### ¿Puedo tener múltiples administradores?
Solo hay un Administrador General (el primero que se registró). Pero puedes dar permisos amplios a Colaboradores con acceso a finanzas.