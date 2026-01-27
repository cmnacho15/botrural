# BotRural - Plataforma de Gestión Agropecuaria

## Introducción

**BotRural** es una plataforma de gestión integral para establecimientos agropecuarios en Uruguay, desarrollada por **MiCampoData**. Combinamos tecnología de inteligencia artificial con la simplicidad de WhatsApp para facilitar el registro y seguimiento de todas las operaciones del campo.

---

## ¿Qué es BotRural?

BotRural es un asistente virtual que funciona a través de WhatsApp, permitiendo a los productores rurales registrar sus operaciones simplemente enviando fotos de sus facturas, remitos y documentos comerciales.

### Funcionalidades principales:

- **Registro de compras y gastos** - El productor envía la foto de una factura y el sistema extrae automáticamente todos los datos (proveedor, montos, IVA, items, fecha, etc.)

- **Registro de ventas de ganado** - Procesamiento de remitos de venta con detalle de categorías, pesos, precios por kilo, liquidaciones

- **Registro de ventas de lana** - Liquidaciones de lana con análisis de laboratorio, rendimiento, calidad

- **Dashboard web** - Panel de control donde el productor visualiza toda su información financiera, movimientos de stock, eventos del campo

- **Exportación a Excel** - Informes detallados para contadores y análisis

- **Gestión multi-campo** - Soporte para productores con múltiples establecimientos

---

## Tecnología utilizada

- **Inteligencia Artificial (Claude/Anthropic)** - Para OCR y extracción inteligente de datos de facturas y documentos escaneados o fotografiados

- **WhatsApp Business API** - Interfaz conversacional simple y accesible

- **Base de datos relacional** - Almacenamiento seguro de todas las operaciones

- **Plataforma web (Next.js)** - Dashboard de visualización y gestión

---

## Integración con Facturación Electrónica

### Necesidad actual

Actualmente, el productor debe:
1. Recibir una factura (física o por email)
2. Fotografiarla con el celular
3. Enviarla al bot por WhatsApp
4. El sistema procesa y registra los datos

### Oportunidad de integración

Con acceso directo a los CFE (Comprobantes Fiscales Electrónicos) emitidos **hacia** el productor, BotRural podría:

- **Importar automáticamente** las facturas de compra sin intervención del usuario
- **Eliminar errores de OCR** al obtener datos estructurados directamente
- **Agilizar el proceso** - El productor solo confirma en lugar de fotografiar
- **Completar información** que a veces no está clara en la foto (RUT completo, detalles de items, etc.)

### Lo que BotRural necesita

1. **Consulta de CFE recibidos** - Listar facturas donde el RUT del productor es el receptor
2. **Datos estructurados** - Acceso a los campos del CFE (emisor, items, montos, IVA, fecha)
3. **Filtrado por fecha** - Para sincronización incremental (ej: facturas de los últimos 7 días)

**Nota:** BotRural **no emite** facturas, solo las **recibe y procesa** para gestión interna del productor.

---

## Cobertura

- **Zona de trabajo:** Todo Uruguay
- **Clientes:** Productores agropecuarios (ganadería, agricultura, lechería)
- **Tipos de operaciones:** Compras de insumos, ventas de ganado, ventas de lana, servicios

---

## Cliente en común

Tenemos como cliente en común al productor de apellido **APA**, lo cual nos dio la oportunidad de conocer el trabajo de Factura Ya y explorar esta posible sinergia.

---

## Propuesta

Nos interesa explorar la posibilidad de integración entre BotRural y Factura Ya para:

1. **Acceder a CFE recibidos** por nuestros clientes en común
2. **Automatizar la importación** de facturas de compra al sistema de gestión
3. **Mejorar la experiencia** del productor eliminando pasos manuales

Quedamos a disposición para una reunión técnica donde podamos profundizar en los detalles de implementación y evaluar la viabilidad de esta integración.

---

## Contacto

**MiCampoData - BotRural**

*Gestión agropecuaria inteligente*

---

*Documento preparado para Factura Ya - Enero 2026*
