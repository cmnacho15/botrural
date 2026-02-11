# Flow Consumo - WhatsApp Flow

## Descripcion
Flow para registrar consumo de animales (autoconsumo) desde WhatsApp.
Soporta hasta 3 categorías diferentes en un mismo evento.
**Nota**: No incluye equinos (no se consumen).

## JSON del Flow

```json
{
  "version": "6.3",
  "routing_model": {
    "INICIO": ["CATEGORIA_UNO"],
    "CATEGORIA_UNO": ["CATEGORIA_DOS", "CONFIRMAR"],
    "CATEGORIA_DOS": ["CATEGORIA_TRES", "CONFIRMAR"],
    "CATEGORIA_TRES": ["CONFIRMAR"],
    "CONFIRMAR": []
  },
  "screens": [
    {
      "id": "INICIO",
      "title": "Consumo",
      "terminal": false,
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Registrar Consumo"
          },
          {
            "type": "DatePicker",
            "name": "fecha",
            "label": "Fecha",
            "required": true
          },
          {
            "type": "Dropdown",
            "name": "potrero",
            "label": "Potrero",
            "required": true,
            "data-source": [
              {"id": "clxabcd1234567890", "title": "Norte"},
              {"id": "clxabcd1234567891", "title": "Sur"},
              {"id": "clxabcd1234567892", "title": "Este"},
              {"id": "clxabcd1234567893", "title": "Oeste"},
              {"id": "clxabcd1234567894", "title": "Centro"}
            ]
          },
          {
            "type": "Footer",
            "label": "Continuar",
            "on-click-action": {
              "name": "navigate",
              "next": {
                "type": "screen",
                "name": "CATEGORIA_UNO"
              },
              "payload": {
                "fecha": "${form.fecha}",
                "potrero": "${form.potrero}"
              }
            }
          }
        ]
      }
    },
    {
      "id": "CATEGORIA_UNO",
      "title": "Categoria 1",
      "terminal": false,
      "data": {
        "fecha": {"type": "string", "__example__": "2025-02-07"},
        "potrero": {"type": "string", "__example__": "clxabcd1234567890"}
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Categoria 1"
          },
          {
            "type": "Dropdown",
            "name": "cat_uno",
            "label": "Tipo de animal",
            "required": true,
            "data-source": [
              {"id": "Vacas", "title": "Vacas (50 disponibles)"},
              {"id": "Vacas Gordas", "title": "Vacas Gordas (20 disponibles)"},
              {"id": "Novillos", "title": "Novillos (35 disponibles)"},
              {"id": "Vaquillonas +2 años", "title": "Vaquillonas +2 años (30 disponibles)"},
              {"id": "Terneros", "title": "Terneros (40 disponibles)"},
              {"id": "Ovejas", "title": "Ovejas (200 disponibles)"},
              {"id": "Corderos", "title": "Corderos (80 disponibles)"}
            ]
          },
          {
            "type": "TextInput",
            "name": "cantidad_uno",
            "label": "Cantidad",
            "input-type": "number",
            "required": true
          },
          {
            "type": "TextInput",
            "name": "peso_uno",
            "label": "Peso promedio (kg)",
            "input-type": "number",
            "required": false
          },
          {
            "type": "TextInput",
            "name": "precioKg_uno",
            "label": "Precio U$S/kg",
            "input-type": "number",
            "required": false
          },
          {
            "type": "EmbeddedLink",
            "text": "Agregar otra categoria",
            "on-click-action": {
              "name": "navigate",
              "next": {
                "type": "screen",
                "name": "CATEGORIA_DOS"
              },
              "payload": {
                "fecha": "${data.fecha}",
                "potrero": "${data.potrero}",
                "cat_uno": "${form.cat_uno}",
                "cantidad_uno": "${form.cantidad_uno}",
                "peso_uno": "${form.peso_uno}",
                "precioKg_uno": "${form.precioKg_uno}",
                "cat_dos": "",
                "cantidad_dos": "",
                "peso_dos": "",
                "precioKg_dos": "",
                "cat_tres": "",
                "cantidad_tres": "",
                "peso_tres": "",
                "precioKg_tres": ""
              }
            }
          },
          {
            "type": "Footer",
            "label": "Finalizar",
            "on-click-action": {
              "name": "navigate",
              "next": {
                "type": "screen",
                "name": "CONFIRMAR"
              },
              "payload": {
                "fecha": "${data.fecha}",
                "potrero": "${data.potrero}",
                "cat_uno": "${form.cat_uno}",
                "cantidad_uno": "${form.cantidad_uno}",
                "peso_uno": "${form.peso_uno}",
                "precioKg_uno": "${form.precioKg_uno}",
                "cat_dos": "",
                "cantidad_dos": "",
                "peso_dos": "",
                "precioKg_dos": "",
                "cat_tres": "",
                "cantidad_tres": "",
                "peso_tres": "",
                "precioKg_tres": ""
              }
            }
          }
        ]
      }
    },
    {
      "id": "CATEGORIA_DOS",
      "title": "Categoria 2",
      "terminal": false,
      "data": {
        "fecha": {"type": "string", "__example__": "2025-02-07"},
        "potrero": {"type": "string", "__example__": "clxabcd1234567890"},
        "cat_uno": {"type": "string", "__example__": "Novillos"},
        "cantidad_uno": {"type": "number", "__example__": 2},
        "peso_uno": {"type": "number", "__example__": 380},
        "precioKg_uno": {"type": "number", "__example__": 1.60},
        "cat_dos": {"type": "string", "__example__": ""},
        "cantidad_dos": {"type": "number", "__example__": 0},
        "peso_dos": {"type": "number", "__example__": 0},
        "precioKg_dos": {"type": "number", "__example__": 0},
        "cat_tres": {"type": "string", "__example__": ""},
        "cantidad_tres": {"type": "number", "__example__": 0},
        "peso_tres": {"type": "number", "__example__": 0},
        "precioKg_tres": {"type": "number", "__example__": 0}
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Categoria 2"
          },
          {
            "type": "Dropdown",
            "name": "cat_dos",
            "label": "Tipo de animal",
            "required": true,
            "data-source": [
              {"id": "Vacas", "title": "Vacas (50 disponibles)"},
              {"id": "Vacas Gordas", "title": "Vacas Gordas (20 disponibles)"},
              {"id": "Novillos", "title": "Novillos (35 disponibles)"},
              {"id": "Vaquillonas +2 años", "title": "Vaquillonas +2 años (30 disponibles)"},
              {"id": "Terneros", "title": "Terneros (40 disponibles)"},
              {"id": "Ovejas", "title": "Ovejas (200 disponibles)"},
              {"id": "Corderos", "title": "Corderos (80 disponibles)"}
            ]
          },
          {
            "type": "TextInput",
            "name": "cantidad_dos",
            "label": "Cantidad",
            "input-type": "number",
            "required": true
          },
          {
            "type": "TextInput",
            "name": "peso_dos",
            "label": "Peso promedio (kg)",
            "input-type": "number",
            "required": false
          },
          {
            "type": "TextInput",
            "name": "precioKg_dos",
            "label": "Precio U$S/kg",
            "input-type": "number",
            "required": false
          },
          {
            "type": "EmbeddedLink",
            "text": "Agregar otra categoria",
            "on-click-action": {
              "name": "navigate",
              "next": {
                "type": "screen",
                "name": "CATEGORIA_TRES"
              },
              "payload": {
                "fecha": "${data.fecha}",
                "potrero": "${data.potrero}",
                "cat_uno": "${data.cat_uno}",
                "cantidad_uno": "${data.cantidad_uno}",
                "peso_uno": "${data.peso_uno}",
                "precioKg_uno": "${data.precioKg_uno}",
                "cat_dos": "${form.cat_dos}",
                "cantidad_dos": "${form.cantidad_dos}",
                "peso_dos": "${form.peso_dos}",
                "precioKg_dos": "${form.precioKg_dos}",
                "cat_tres": "${data.cat_tres}",
                "cantidad_tres": "${data.cantidad_tres}",
                "peso_tres": "${data.peso_tres}",
                "precioKg_tres": "${data.precioKg_tres}"
              }
            }
          },
          {
            "type": "Footer",
            "label": "Finalizar",
            "on-click-action": {
              "name": "navigate",
              "next": {
                "type": "screen",
                "name": "CONFIRMAR"
              },
              "payload": {
                "fecha": "${data.fecha}",
                "potrero": "${data.potrero}",
                "cat_uno": "${data.cat_uno}",
                "cantidad_uno": "${data.cantidad_uno}",
                "peso_uno": "${data.peso_uno}",
                "precioKg_uno": "${data.precioKg_uno}",
                "cat_dos": "${form.cat_dos}",
                "cantidad_dos": "${form.cantidad_dos}",
                "peso_dos": "${form.peso_dos}",
                "precioKg_dos": "${form.precioKg_dos}",
                "cat_tres": "${data.cat_tres}",
                "cantidad_tres": "${data.cantidad_tres}",
                "peso_tres": "${data.peso_tres}",
                "precioKg_tres": "${data.precioKg_tres}"
              }
            }
          }
        ]
      }
    },
    {
      "id": "CATEGORIA_TRES",
      "title": "Categoria 3",
      "terminal": false,
      "data": {
        "fecha": {"type": "string", "__example__": "2025-02-07"},
        "potrero": {"type": "string", "__example__": "clxabcd1234567890"},
        "cat_uno": {"type": "string", "__example__": "Novillos"},
        "cantidad_uno": {"type": "number", "__example__": 2},
        "peso_uno": {"type": "number", "__example__": 380},
        "precioKg_uno": {"type": "number", "__example__": 1.60},
        "cat_dos": {"type": "string", "__example__": "Ovejas"},
        "cantidad_dos": {"type": "number", "__example__": 1},
        "peso_dos": {"type": "number", "__example__": 45},
        "precioKg_dos": {"type": "number", "__example__": 2.20},
        "cat_tres": {"type": "string", "__example__": ""},
        "cantidad_tres": {"type": "number", "__example__": 0},
        "peso_tres": {"type": "number", "__example__": 0},
        "precioKg_tres": {"type": "number", "__example__": 0}
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Categoria 3 (ultima)"
          },
          {
            "type": "Dropdown",
            "name": "cat_tres",
            "label": "Tipo de animal",
            "required": true,
            "data-source": [
              {"id": "Vacas", "title": "Vacas (50 disponibles)"},
              {"id": "Vacas Gordas", "title": "Vacas Gordas (20 disponibles)"},
              {"id": "Novillos", "title": "Novillos (35 disponibles)"},
              {"id": "Vaquillonas +2 años", "title": "Vaquillonas +2 años (30 disponibles)"},
              {"id": "Terneros", "title": "Terneros (40 disponibles)"},
              {"id": "Ovejas", "title": "Ovejas (200 disponibles)"},
              {"id": "Corderos", "title": "Corderos (80 disponibles)"}
            ]
          },
          {
            "type": "TextInput",
            "name": "cantidad_tres",
            "label": "Cantidad",
            "input-type": "number",
            "required": true
          },
          {
            "type": "TextInput",
            "name": "peso_tres",
            "label": "Peso promedio (kg)",
            "input-type": "number",
            "required": false
          },
          {
            "type": "TextInput",
            "name": "precioKg_tres",
            "label": "Precio U$S/kg",
            "input-type": "number",
            "required": false
          },
          {
            "type": "Footer",
            "label": "Finalizar",
            "on-click-action": {
              "name": "navigate",
              "next": {
                "type": "screen",
                "name": "CONFIRMAR"
              },
              "payload": {
                "fecha": "${data.fecha}",
                "potrero": "${data.potrero}",
                "cat_uno": "${data.cat_uno}",
                "cantidad_uno": "${data.cantidad_uno}",
                "peso_uno": "${data.peso_uno}",
                "precioKg_uno": "${data.precioKg_uno}",
                "cat_dos": "${data.cat_dos}",
                "cantidad_dos": "${data.cantidad_dos}",
                "peso_dos": "${data.peso_dos}",
                "precioKg_dos": "${data.precioKg_dos}",
                "cat_tres": "${form.cat_tres}",
                "cantidad_tres": "${form.cantidad_tres}",
                "peso_tres": "${form.peso_tres}",
                "precioKg_tres": "${form.precioKg_tres}"
              }
            }
          }
        ]
      }
    },
    {
      "id": "CONFIRMAR",
      "title": "Confirmar",
      "terminal": true,
      "data": {
        "fecha": {"type": "string", "__example__": "2025-02-07"},
        "potrero": {"type": "string", "__example__": "clxabcd1234567890"},
        "cat_uno": {"type": "string", "__example__": "Novillos"},
        "cantidad_uno": {"type": "number", "__example__": 2},
        "peso_uno": {"type": "number", "__example__": 380},
        "precioKg_uno": {"type": "number", "__example__": 1.60},
        "cat_dos": {"type": "string", "__example__": ""},
        "cantidad_dos": {"type": "number", "__example__": 0},
        "peso_dos": {"type": "number", "__example__": 0},
        "precioKg_dos": {"type": "number", "__example__": 0},
        "cat_tres": {"type": "string", "__example__": ""},
        "cantidad_tres": {"type": "number", "__example__": 0},
        "peso_tres": {"type": "number", "__example__": 0},
        "precioKg_tres": {"type": "number", "__example__": 0}
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Confirmar Consumo"
          },
          {
            "type": "TextArea",
            "name": "notas",
            "label": "Observaciones",
            "required": false
          },
          {
            "type": "PhotoPicker",
            "name": "foto",
            "label": "Imagen",
            "photo-source": "camera_gallery",
            "max-file-size-kb": 10240,
            "min-uploaded-photos": 0,
            "max-uploaded-photos": 1
          },
          {
            "type": "Footer",
            "label": "Confirmar",
            "on-click-action": {
              "name": "complete",
              "payload": {
                "tipo": "CONSUMO",
                "fecha": "${data.fecha}",
                "potrero": "${data.potrero}",
                "cat_uno": "${data.cat_uno}",
                "cantidad_uno": "${data.cantidad_uno}",
                "peso_uno": "${data.peso_uno}",
                "precioKg_uno": "${data.precioKg_uno}",
                "cat_dos": "${data.cat_dos}",
                "cantidad_dos": "${data.cantidad_dos}",
                "peso_dos": "${data.peso_dos}",
                "precioKg_dos": "${data.precioKg_dos}",
                "cat_tres": "${data.cat_tres}",
                "cantidad_tres": "${data.cantidad_tres}",
                "peso_tres": "${data.peso_tres}",
                "precioKg_tres": "${data.precioKg_tres}",
                "notas": "${form.notas}",
                "foto": "${form.foto}"
              }
            }
          }
        ]
      }
    }
  ]
}
```

## Flujo de navegacion

```
INICIO (fecha, potrero)
  → CATEGORIA_UNO (cat_uno, cantidad_uno, peso_uno, precioKg_uno)
    → [EmbeddedLink] CATEGORIA_DOS (cat_dos, cantidad_dos, peso_dos, precioKg_dos)
      → [EmbeddedLink] CATEGORIA_TRES (cat_tres, cantidad_tres, peso_tres, precioKg_tres)
        → CONFIRMAR (notas, foto)
    → [Footer] CONFIRMAR (notas, foto)
  → [Footer] CONFIRMAR (notas, foto)
```

## Campos

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| fecha | DatePicker | Si | Fecha del consumo |
| potrero | Dropdown | Si | Potrero de origen |
| cat_uno | Dropdown | Si | Primera categoría (sin equinos) |
| cantidad_uno | TextInput | Si | Cantidad de la primera categoría |
| peso_uno | TextInput | No | Peso promedio primera categoría (kg) |
| precioKg_uno | TextInput | No | Precio USD/kg primera categoría |
| cat_dos | Dropdown | No | Segunda categoría (opcional) |
| cantidad_dos | TextInput | No | Cantidad de la segunda categoría |
| peso_dos | TextInput | No | Peso promedio segunda categoría (kg) |
| precioKg_dos | TextInput | No | Precio USD/kg segunda categoría |
| cat_tres | Dropdown | No | Tercera categoría (opcional) |
| cantidad_tres | TextInput | No | Cantidad de la tercera categoría |
| peso_tres | TextInput | No | Peso promedio tercera categoría (kg) |
| precioKg_tres | TextInput | No | Precio USD/kg tercera categoría |
| notas | TextArea | No | Observaciones adicionales |
| foto | PhotoPicker | No | Imagen del evento |

## Nota importante

**Para testing en Meta**: El flow usa data-source hardcodeado con ejemplos realistas (sin equinos).

**Para producción**:
- Dropdowns deben cargarse dinámicamente desde la base de datos
- El backend debe filtrar equinos (yeguarizos, padrillos, caballos, yeguas, potros)
- Se usa endpoint `/api/consumos` (no `/api/eventos`)

**Funcionalidad completa**:
- **En WhatsApp Flow**: ✅ Soporta hasta 3 categorías con navegación mediante "Agregar otra categoria" o "Finalizar"
- El usuario puede saltar a CONFIRMAR en cualquier momento usando el botón "Finalizar"
- El backend debe procesar hasta 3 categorías, ignorando las que estén vacías
