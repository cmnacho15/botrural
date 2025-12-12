
DOS ARCHIVOS CREADOS EXPLUSIVAMENTE PARA ESTA FUNCION Y PODER EXPORTAR EN PDF 
VER BIEN CON NICO 

src/app/dashboard/reportes/pastoreo/page.tsx


src/app/api/reportes/pastoreo-rotativo/route.ts



# 📋 Reporte de Pastoreo Rotativo

## ¿Qué es?

El Reporte de Pastoreo Rotativo genera un historial detallado de los movimientos de animales dentro de un módulo de pastoreo, mostrando cómo rotan entre los diferentes potreros del módulo a lo largo del tiempo.

## ¿Cómo funciona?

### 1. Selección de módulo
- Debes seleccionar un **módulo de pastoreo** (ej: "D3")
- Solo se analizan los potreros asignados a ese módulo
- Opcionalmente puedes filtrar por rango de fechas

### 2. Eventos incluidos
El reporte considera únicamente eventos relacionados con **rotación de pastoreo**:

✅ **CAMBIO_POTRERO** - Movimientos entre potreros
- Cuando movés animales de un potrero a otro dentro del módulo

✅ **AJUSTE** - Ingresos/ajustes manuales
- Cuando ingresás animales desde el formulario de nuevo potrero
- Cuando editás animales en un potrero existente

❌ **NO incluye eventos económicos/productivos:**
- Ventas, muertes, compras, nacimientos
- Estos afectan el inventario pero no la rotación de pastoreo

### 3. Agrupamiento inteligente
- Si múltiples categorías entran el **mismo día** al **mismo potrero**, se agrupan en una sola fila
- Ejemplo: "Vacas, Terneros/as" en lugar de dos filas separadas
- Esto refleja la realidad del pastoreo rotativo: si entran juntas, salen juntas

### 4. Información mostrada

Para cada movimiento/entrada de animales, el reporte muestra:

| Columna | Descripción |
|---------|-------------|
| **CANT. DÍAS DESDE HOY** | Cuántos días pasaron desde hoy hasta ese movimiento |
| **POTRERO** | Nombre del potrero al que ingresaron |
| **FECHA ENTRADA** | Cuándo ingresaron los animales |
| **DÍAS** | Cuántos días permanecieron en ese potrero |
| **FECHA SALIDA** | Cuándo salieron del potrero (o "-" si aún están) |
| **DESCANSO** | Días de descanso del potrero hasta la próxima entrada |
| **Hectáreas** | Superficie del potrero |
| **COMENTARIOS** | Categorías de animales (ej: "Vacas, Terneros/as") |

### 5. Cálculo de datos

**Días en potrero:**
- Diferencia entre fecha de entrada y fecha de salida
- Si aún están en el potrero: 0 días

**Descanso:**
- Días transcurridos desde que salieron los animales hasta que vuelven a entrar otros
- Fundamental para gestión de pasturas

**Días desde hoy:**
- Permite identificar eventos recientes vs. históricos
- Ordenados de más reciente a más antiguo

## Caso de uso

Este reporte es ideal para:
- 📊 Analizar la rotación histórica de un módulo
- 🌱 Verificar que los descansos de potreros sean adecuados
- 📈 Evaluar la eficiencia del sistema de pastoreo rotativo
- 📄 Generar documentación para planificación futura
- 💾 Exportar a PDF para registros físicos

## Exportación PDF

El reporte puede descargarse en formato PDF con:
- Colores en columnas clave (días desde hoy, potrero)
- Formato tabla estilo Excel
- Nombre de archivo: `pastoreo-{modulo}-{fecha}.pdf`