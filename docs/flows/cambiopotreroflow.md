# Flow Cambio de Potrero - WhatsApp Flow

## Descripcion
Flow para registrar cambios de animales entre potreros desde WhatsApp.
Soporta hasta 3 categorías diferentes en un mismo movimiento.

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
      "title": "Cambio de Potrero",
      "terminal": false,
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Cambio de Potrero"
          },
          {
            "type": "DatePicker",
            "name": "fecha",
            "label": "Fecha",
            "required": true
          },
          {
            "type": "Dropdown",
            "name": "potreroOrigen",
            "label": "Potrero Origen",
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
            "type": "Dropdown",
            "name": "potreroDestino",
            "label": "Potrero Destino",
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
                "potreroOrigen": "${form.potreroOrigen}",
                "potreroDestino": "${form.potreroDestino}"
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
        "potreroOrigen": {"type": "string", "__example__": "clxabcd1234567890"},
        "potreroDestino": {"type": "string", "__example__": "clxabcd1234567891"}
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Categoria 1 a Mover"
          },
          {
            "type": "Dropdown",
            "name": "cat_uno",
            "label": "Categoria",
            "required": true,
            "data-source": [
              {"id": "Vacas", "title": "Vacas (50 disponibles)"},
              {"id": "Vacas Gordas", "title": "Vacas Gordas (20 disponibles)"},
              {"id": "Toros", "title": "Toros (5 disponibles)"},
              {"id": "Novillos", "title": "Novillos (35 disponibles)"},
              {"id": "Vaquillonas +2 años", "title": "Vaquillonas +2 años (30 disponibles)"},
              {"id": "Terneros", "title": "Terneros (40 disponibles)"},
              {"id": "Ovejas", "title": "Ovejas (200 disponibles)"}
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
                "potreroOrigen": "${data.potreroOrigen}",
                "potreroDestino": "${data.potreroDestino}",
                "cat_uno": "${form.cat_uno}",
                "cantidad_uno": "${form.cantidad_uno}",
                "cat_dos": "",
                "cantidad_dos": "",
                "cat_tres": "",
                "cantidad_tres": ""
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
                "potreroOrigen": "${data.potreroOrigen}",
                "potreroDestino": "${data.potreroDestino}",
                "cat_uno": "${form.cat_uno}",
                "cantidad_uno": "${form.cantidad_uno}",
                "cat_dos": "",
                "cantidad_dos": "",
                "cat_tres": "",
                "cantidad_tres": ""
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
        "potreroOrigen": {"type": "string", "__example__": "clxabcd1234567890"},
        "potreroDestino": {"type": "string", "__example__": "clxabcd1234567891"},
        "cat_uno": {"type": "string", "__example__": "Vacas"},
        "cantidad_uno": {"type": "number", "__example__": 25},
        "cat_dos": {"type": "string", "__example__": ""},
        "cantidad_dos": {"type": "number", "__example__": 0},
        "cat_tres": {"type": "string", "__example__": ""},
        "cantidad_tres": {"type": "number", "__example__": 0}
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Categoria 2 a Mover"
          },
          {
            "type": "Dropdown",
            "name": "cat_dos",
            "label": "Categoria",
            "required": true,
            "data-source": [
              {"id": "Vacas", "title": "Vacas (50 disponibles)"},
              {"id": "Vacas Gordas", "title": "Vacas Gordas (20 disponibles)"},
              {"id": "Toros", "title": "Toros (5 disponibles)"},
              {"id": "Novillos", "title": "Novillos (35 disponibles)"},
              {"id": "Vaquillonas +2 años", "title": "Vaquillonas +2 años (30 disponibles)"},
              {"id": "Terneros", "title": "Terneros (40 disponibles)"},
              {"id": "Ovejas", "title": "Ovejas (200 disponibles)"}
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
                "potreroOrigen": "${data.potreroOrigen}",
                "potreroDestino": "${data.potreroDestino}",
                "cat_uno": "${data.cat_uno}",
                "cantidad_uno": "${data.cantidad_uno}",
                "cat_dos": "${form.cat_dos}",
                "cantidad_dos": "${form.cantidad_dos}",
                "cat_tres": "${data.cat_tres}",
                "cantidad_tres": "${data.cantidad_tres}"
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
                "potreroOrigen": "${data.potreroOrigen}",
                "potreroDestino": "${data.potreroDestino}",
                "cat_uno": "${data.cat_uno}",
                "cantidad_uno": "${data.cantidad_uno}",
                "cat_dos": "${form.cat_dos}",
                "cantidad_dos": "${form.cantidad_dos}",
                "cat_tres": "${data.cat_tres}",
                "cantidad_tres": "${data.cantidad_tres}"
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
        "potreroOrigen": {"type": "string", "__example__": "clxabcd1234567890"},
        "potreroDestino": {"type": "string", "__example__": "clxabcd1234567891"},
        "cat_uno": {"type": "string", "__example__": "Vacas"},
        "cantidad_uno": {"type": "number", "__example__": 25},
        "cat_dos": {"type": "string", "__example__": "Novillos"},
        "cantidad_dos": {"type": "number", "__example__": 15},
        "cat_tres": {"type": "string", "__example__": ""},
        "cantidad_tres": {"type": "number", "__example__": 0}
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Categoria 3 a Mover (ultima)"
          },
          {
            "type": "Dropdown",
            "name": "cat_tres",
            "label": "Categoria",
            "required": true,
            "data-source": [
              {"id": "Vacas", "title": "Vacas (50 disponibles)"},
              {"id": "Vacas Gordas", "title": "Vacas Gordas (20 disponibles)"},
              {"id": "Toros", "title": "Toros (5 disponibles)"},
              {"id": "Novillos", "title": "Novillos (35 disponibles)"},
              {"id": "Vaquillonas +2 años", "title": "Vaquillonas +2 años (30 disponibles)"},
              {"id": "Terneros", "title": "Terneros (40 disponibles)"},
              {"id": "Ovejas", "title": "Ovejas (200 disponibles)"}
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
                "potreroOrigen": "${data.potreroOrigen}",
                "potreroDestino": "${data.potreroDestino}",
                "cat_uno": "${data.cat_uno}",
                "cantidad_uno": "${data.cantidad_uno}",
                "cat_dos": "${data.cat_dos}",
                "cantidad_dos": "${data.cantidad_dos}",
                "cat_tres": "${form.cat_tres}",
                "cantidad_tres": "${form.cantidad_tres}"
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
        "potreroOrigen": {"type": "string", "__example__": "clxabcd1234567890"},
        "potreroDestino": {"type": "string", "__example__": "clxabcd1234567891"},
        "cat_uno": {"type": "string", "__example__": "Vacas"},
        "cantidad_uno": {"type": "number", "__example__": 25},
        "cat_dos": {"type": "string", "__example__": ""},
        "cantidad_dos": {"type": "number", "__example__": 0},
        "cat_tres": {"type": "string", "__example__": ""},
        "cantidad_tres": {"type": "number", "__example__": 0}
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Confirmar Cambio"
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
                "tipo": "CAMBIO_POTRERO",
                "fecha": "${data.fecha}",
                "potreroOrigen": "${data.potreroOrigen}",
                "potreroDestino": "${data.potreroDestino}",
                "cat_uno": "${data.cat_uno}",
                "cantidad_uno": "${data.cantidad_uno}",
                "cat_dos": "${data.cat_dos}",
                "cantidad_dos": "${data.cantidad_dos}",
                "cat_tres": "${data.cat_tres}",
                "cantidad_tres": "${data.cantidad_tres}",
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
INICIO (fecha, potreroOrigen, potreroDestino)
  → CATEGORIA_UNO (cat_uno, cantidad_uno)
    → [EmbeddedLink] CATEGORIA_DOS (cat_dos, cantidad_dos)
      → [EmbeddedLink] CATEGORIA_TRES (cat_tres, cantidad_tres)
        → CONFIRMAR (notas, foto)
    → [Footer] CONFIRMAR (notas, foto)
  → [Footer] CONFIRMAR (notas, foto)
```

## Campos

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| fecha | DatePicker | Si | Fecha del cambio |
| potreroOrigen | Dropdown | Si | Potrero de origen |
| potreroDestino | Dropdown | Si | Potrero de destino |
| cat_uno | Dropdown | Si | Primera categoría a mover |
| cantidad_uno | TextInput | Si | Cantidad de la primera categoría |
| cat_dos | Dropdown | No | Segunda categoría a mover (opcional) |
| cantidad_dos | TextInput | No | Cantidad de la segunda categoría |
| cat_tres | Dropdown | No | Tercera categoría a mover (opcional) |
| cantidad_tres | TextInput | No | Cantidad de la tercera categoría |
| notas | TextArea | No | Observaciones adicionales |
| foto | PhotoPicker | No | Imagen del evento |

## Nota importante

**Para testing en Meta**: El flow usa data-source hardcodeado con ejemplos realistas.

**Para producción**:
- El dropdown de potreros debe cargarse dinámicamente desde `/api/lotes`
- El dropdown de categorías debe cargarse según el potrero origen seleccionado
- El backend debe validar que potreroOrigen != potreroDestino
- El backend debe procesar hasta 3 categorías, ignorando las que estén vacías

**Funcionalidad completa**:
- **En la web**: El modal permite agregar múltiples categorías con el botón "➕ Agregar otra categoría" sin límite
- **En WhatsApp Flow**: ✅ Soporta hasta 3 categorías con navegación mediante "Agregar otra categoría" o "Finalizar"
- El usuario puede saltar a CONFIRMAR en cualquier momento usando el botón "Finalizar"
