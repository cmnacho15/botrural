# 📱 Bot Rural - Guía Completa de Uso por WhatsApp

**Versión:** 2.0
**Última actualización:** Enero 2025

---

## Índice

1. [Introducción](#introducción)
2. [Primeros Pasos](#primeros-pasos)
3. [Tipos de Mensajes](#tipos-de-mensajes)
4. [Registrar Eventos del Campo](#registrar-eventos-del-campo)
5. [Facturas y Documentos](#facturas-y-documentos)
6. [Consultar Datos Registrados](#consultar-datos-registrados)
7. [Reportes PDF](#reportes-pdf)
8. [Calendario y Recordatorios](#calendario-y-recordatorios)
9. [Gestión de Stock](#gestión-de-stock)
10. [Comandos Útiles](#comandos-útiles)
11. [Ejemplos Prácticos](#ejemplos-prácticos)

---

## Introducción

El Bot Rural te permite registrar y consultar toda la información de tu campo directamente desde WhatsApp. Funciona con inteligencia artificial, por lo que entiende lenguaje natural - no necesitás memorizar comandos exactos.

### ¿Qué podés hacer?

- ✅ Registrar eventos (lluvias, nacimientos, mortandades, tratamientos, etc.)
- ✅ Cargar facturas de compra y venta con solo una foto
- ✅ Consultar datos registrados previamente
- ✅ Generar reportes PDF
- ✅ Programar recordatorios
- ✅ Consultar y editar stock de animales
- ✅ Ver info del mapa y potreros

---

## Primeros Pasos

### Registro inicial

1. El administrador del campo te envía un **código de invitación** (ej: `ABC123`)
2. Enviá ese código al bot por WhatsApp
3. El bot te pide tu nombre
4. ¡Listo! Ya estás conectado al campo

### Cambiar de campo

Si tenés acceso a varios campos:
```
cambiar campo
mis campos
```
El bot te muestra la lista y elegís cuál querés usar.

---

## Tipos de Mensajes

El bot acepta tres tipos de mensajes:

### 📝 Texto
Escribí normalmente lo que querés registrar.

### 🎤 Audio
Grabá un audio describiendo el evento. El bot lo transcribe y procesa automáticamente.

### 📷 Fotos
- **Foto sola**: El bot analiza si es una factura
- **Foto + texto en descripción**: Registra el evento con la foto adjunta

---

## Registrar Eventos del Campo

### 🌧️ Clima

**Lluvia:**
```
llovieron 25mm
lluvia 30 milímetros
25mm
cayeron 15 milímetros
```

**Helada:**
```
heló
helada
hubo helada anoche
```

---

### 🐄 Animales

**Nacimientos:**
```
nacieron 3 terneros
nacieron 5 terneros en potrero norte
parió una vaca en el sur
nacieron 10 corderos en el este
```

**Mortandad:**
```
murieron 2 vacas
se murió un ternero en el norte
perdí 3 ovejas en potrero sur
murió un novillo
```

**Consumo propio:**
```
consumí 2 vacas
faené un novillo del norte
consumo familiar 1 vaca
```

---

### 💉 Tratamientos Sanitarios

Para aplicación de **productos veterinarios** (vacunas, antiparasitarios, antibióticos):

```
vacuné 50 vacas contra aftosa
apliqué ivermectina a los terneros
bañé todo el norte
desparasité las vacas del sur
di antibiótico a 10 vacas
vacuna de mancha y gangrena a terneros
```

**Múltiples tratamientos:**
```
baño a vacas y terneros, mancha y gangrena a terneros
apliqué ivermectina en norte y este
```

---

### ⛏️ Manejo (Acciones físicas)

Para acciones que **NO son productos veterinarios**:

```
quité tablilla a 18 terneros
puse caravana a 30 vacas
señalé 50 corderos en el norte
marqué los novillos
aparté 10 vacas
encerré las vacas del sur
pesé los terneros
apliqué pintura azul a terneros
```

---

### 🔄 Movimientos de Animales

**Mover categoría específica:**
```
moví 10 vacas del norte al sur
pasé 20 terneros de potrero A al B
moví 15 novillos del este al oeste
```

**Vaciar potrero completo:**
```
mover todo del norte al sur
vaciar potrero norte al sur
paso todo de A a B
```

---

### ✋ Tacto

```
tacto en potrero norte 83 tactadas 59 preñadas
tacto en sol 100 animales 78 preñadas
tacto en el sur: 150 tactadas, 120 preñadas
83 preñadas 67 falladas en potrero este
```

---

### 🔬 DAO (Diagnóstico de Actividad Ovárica)

```
dao en potrero norte a 98 vacas: 20 preñadas, 30 ciclando, 25 anestro superficial, 23 anestro profundo
dao en sol, 92 vaquillonas: 50 preñadas, 20 ciclando
```

---

### 💸 Gastos

```
gasté $5000 en alimento
compré fertilizante por $3000
pagué $10000 de combustible
gasto de veterinario $2500
```

---

## Facturas y Documentos

### 📄 Factura de GASTO (compra)

Enviá una **foto de la factura** sin texto. El bot:
1. Detecta que es una factura de gasto/compra
2. Lee automáticamente: monto, proveedor, descripción
3. Te muestra lo que entendió
4. Te pide confirmación antes de guardar

**Ejemplos de facturas de gasto:**
- Facturas de veterinaria
- Facturas de combustible
- Facturas de alimento/ración
- Facturas de ferretería
- Cualquier compra/gasto

---

### 📄 Factura de VENTA

Enviá una **foto de la factura de venta** (remito de venta de ganado). El bot:
1. Detecta que es una factura de venta
2. Lee: cantidad de animales, categoría, peso, precio
3. Te muestra el resumen
4. Te pide confirmación
5. Descuenta automáticamente del stock si confirmás

**El bot detecta:**
- Cantidad de animales vendidos
- Categoría (novillos, vacas, terneros, etc.)
- Peso total y promedio
- Precio por kg o por animal
- Firma/consignatario

---

### 📄 Estado de Cuenta

Si enviás una foto de un **estado de cuenta** de un consignatario/firma:
1. El bot detecta los pagos pendientes
2. Te pregunta cuáles querés marcar como pagados
3. Actualiza el estado de las ventas

---

### 📷 Foto + Descripción

Si enviás una foto CON texto en la descripción:
```
[Foto] + "llovió 10mm"
[Foto] + "vacuné terneros en el norte"
[Foto] + "quité tablilla a 18 terneros"
[Foto] + "nació un ternero"
```

El bot:
1. Lee el texto de la descripción
2. Detecta qué tipo de evento es
3. Te pide confirmación
4. Guarda el evento CON la foto adjunta

---

### 📷 Foto de Observación

Si enviás una foto **sin texto** y el bot detecta que NO es factura (ej: foto del campo, de animales, del pasto):
- Se guarda como **Observación de Campo**
- Queda registrada con fecha y hora
- Podés verla en la sección Datos de la web

---

### ❓ Si el bot no puede identificar la imagen

Te pregunta:
```
No pude identificar el tipo de imagen. ¿Qué es?
1️⃣ venta - Factura de venta de animales
2️⃣ gasto - Factura de compra/gasto
3️⃣ foto - Foto de campo (observación)

Respondé: venta, gasto o foto
```

---

## Consultar Datos Registrados

### 🔍 Cómo funciona

Podés consultar cualquier dato que hayas registrado previamente, igual que en la página de Datos de la web pero desde WhatsApp.

**El bot entiende consultas naturales:**

### Por tipo de dato:
```
pasame las lluvias
ver tratamientos
manejos
nacimientos
mortandades
ventas
compras
tactos
observaciones
```

### Por período de tiempo:
```
lluvias del mes
tratamientos de enero
manejos de febrero
nacimientos últimos 30 días
mortandades últimos 60 días
ventas del año
tactos de diciembre
```

### Por potrero:
```
tratamientos en potrero norte
manejos del sur
nacimientos en el este
mortandades en potrero A
```

### Por categoría de animal:
```
nacimientos de terneros
mortandades de vacas
tratamientos a novillos
```

### Combinando filtros:
```
tratamientos de enero en potrero norte
nacimientos de terneros últimos 60 días
manejos de vacas del sur
mortandades de terneros del mes
```

---

### 📊 Formato de respuesta

**Si hay pocos registros (10 o menos):**
El bot te envía un mensaje de texto con la lista:

```
🌧️ Lluvias (5 registros)

📅 28/01/25 - 25mm
📅 22/01/25 - 15mm
📅 18/01/25 - 30mm
📅 10/01/25 - 12mm
📅 05/01/25 - 8mm
```

**Si hay muchos registros (más de 10):**
El bot genera y envía un **PDF** con todos los datos en formato de tabla:

```
🌧️ Encontré 45 registros de Lluvias. Generando PDF...
```

Y te envía el documento PDF con:
- Título del tipo de dato
- Nombre del campo
- Cantidad de registros
- Tabla con todos los datos
- Fecha de generación

---

## Reportes PDF

### 📊 Reporte de Carga (Stock actual)

```
reporte de carga
pdf carga
stock actual
cuántos animales tengo
planilla de carga
```

Genera un PDF con:
- Stock por potrero
- Cantidad por categoría
- Carga en UG/ha
- Totales del campo

---

### 🔄 Reporte de Pastoreo

```
reporte de pastoreo
pdf pastoreo
historial de pastoreo
rotación de potreros
```

Genera un PDF con el historial de movimientos y rotación de potreros.

---

### 🔬 Reporte de DAO

```
reporte dao
pdf dao
historial de dao
ver daos
```

Genera un PDF con todos los DAOs registrados.

---

### 🗺️ Mapa del Campo

```
mapa
ver mapa
mapa del campo
```

Te envía un resumen de los potreros y el link para ver el mapa interactivo completo en la web.

---

## Calendario y Recordatorios

### 📅 Crear recordatorio

**Por días:**
```
en 14 días sacar tablilla
en 7 días vacunar
en 30 días hacer tacto
```

**Por fecha específica:**
```
el 5 de febrero revisar alambrado
el 15 de marzo hacer destete
```

**Por día de la semana:**
```
el martes vacunar
el viernes revisar molino
```

**Relativo:**
```
mañana revisar alambrado
pasado mañana encerrar vacas
```

---

### 📋 Ver pendientes

```
calendario
qué tengo pendiente
actividades
tareas
```

Te muestra las próximas actividades programadas con botones para:
- ✅ Marcar como completada
- 🗑️ Eliminar
- ⏰ Posponer

---

## Gestión de Stock

### 📍 Consultar stock de un potrero

```
potrero norte
stock norte
ver potrero sur
cuántos hay en el este
```

Te muestra los animales que hay en ese potrero por categoría.

---

### ✏️ Editar stock

Después de consultar un potrero, podés editar la cantidad:

```
15 vacas
novillos 20
30 terneros
```

El bot te pide confirmación antes de actualizar.

---

### 📝 Informar conteo

```
conté 11 novillos en casco
hay 15 vacas en el norte
tengo 20 terneros en el sur
encontré 25 terneros en el oeste
```

---

## Comandos Útiles

### ❌ Cancelar operación
```
cancelar
```
Cancela cualquier operación pendiente de confirmación.

### 🔄 Cambiar de campo
```
cambiar campo
mis campos
otros campos
```

### ✅ Confirmar
Cuando el bot te pide confirmación, podés:
- Tocar el botón **Confirmar**
- Escribir: `confirmar`, `si`, `sí`

### ✏️ Editar
Si el bot entendió mal:
- Tocar el botón **Editar**
- Escribir: `editar`, `modificar`

### ❌ Cancelar registro
- Tocar el botón **Cancelar**
- Escribir: `cancelar`, `no`

---

## Ejemplos Prácticos

### Día típico de trabajo

**Mañana - Registrar lluvia de anoche:**
```
Vos: llovieron 15mm
Bot: *Entendí:* Lluvia 15mm [Confirmar] [Editar] [Cancelar]
Vos: [Confirmar]
Bot: ✅ Dato guardado correctamente
```

**Recorrida - Encontraste mortandad:**
```
Vos: [Foto del animal] + "murió un ternero en potrero norte"
Bot: *Entendí:* 💀 Mortandad: 1 ternero en Norte, con foto adjunta [Confirmar]
Vos: [Confirmar]
Bot: ✅ Dato guardado correctamente
```

**Trabajo sanitario:**
```
Vos: vacuné 50 vacas contra aftosa en el sur
Bot: *Entendí:* 💉 Tratamiento: vacuna aftosa a 50 vacas en Sur [Confirmar]
Vos: [Confirmar]
```

**Manejo:**
```
Vos: quité tablilla a 18 terneros
Bot: *Entendí:* ⛏️ Manejo: quité tablilla a 18 terneros [Confirmar]
Vos: [Confirmar]
```

**Fin del día - Cargar factura:**
```
Vos: [Foto de factura de veterinaria]
Bot: Procesando imagen... ⏳
Bot: *Factura de Gasto detectada:*
     Proveedor: Veterinaria Sur
     Monto: $15.000
     Concepto: Medicamentos
     [Confirmar] [Cancelar]
Vos: [Confirmar]
```

---

### Consultar información

**Ver lluvias del mes:**
```
Vos: pasame las lluvias del mes
Bot: 🌧️ Lluvias (8 registros)
     📅 28/01 - 15mm
     📅 22/01 - 25mm
     ...
```

**Ver tratamientos con muchos registros:**
```
Vos: tratamientos del año
Bot: 💉 Encontré 47 registros de Tratamientos. Generando PDF...
Bot: [Envía PDF]
```

**Stock actual:**
```
Vos: reporte de carga
Bot: ⏳ Generando PDF de carga actual...
Bot: [Envía PDF con stock completo]
```

---

### Programar recordatorio

```
Vos: en 14 días hacer tacto
Bot: 📅 *Actividad programada*
     Título: hacer tacto
     Fecha: 12/02/2025
     [Confirmar] [Cancelar]
Vos: [Confirmar]
Bot: ✅ Recordatorio guardado. Te aviso cuando se acerque la fecha.
```

---

## Soporte

Si tenés problemas o consultas:
- 🌐 Web: botrural.vercel.app
- 📧 Contacto desde la aplicación web

---

*Bot Rural - Gestión de campo simplificada*
