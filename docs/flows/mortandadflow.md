# Flow Mortandad - WhatsApp Flow

## Descripcion
Flow para registrar mortandad de animales desde WhatsApp.
Soporta hasta 3 categorías diferentes en un mismo evento.

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
      "title": "Mortandad",
      "terminal": false,
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Registrar Mortandad"
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
            "type": "TextInput",
            "name": "caravana_uno",
            "label": "Caravana (opcional)",
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
                "caravana_uno": "${form.caravana_uno}",
                "cat_dos": "",
                "cantidad_dos": "",
                "caravana_dos": "",
                "cat_tres": "",
                "cantidad_tres": "",
                "caravana_tres": ""
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
                "caravana_uno": "${form.caravana_uno}",
                "cat_dos": "",
                "cantidad_dos": "",
                "caravana_dos": "",
                "cat_tres": "",
                "cantidad_tres": "",
                "caravana_tres": ""
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
        "cat_uno": {"type": "string", "__example__": "Vacas"},
        "cantidad_uno": {"type": "number", "__example__": 2},
        "caravana_uno": {"type": "string", "__example__": "1234"},
        "cat_dos": {"type": "string", "__example__": ""},
        "cantidad_dos": {"type": "number", "__example__": 0},
        "caravana_dos": {"type": "string", "__example__": ""},
        "cat_tres": {"type": "string", "__example__": ""},
        "cantidad_tres": {"type": "number", "__example__": 0},
        "caravana_tres": {"type": "string", "__example__": ""}
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
            "type": "TextInput",
            "name": "caravana_dos",
            "label": "Caravana (opcional)",
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
                "caravana_uno": "${data.caravana_uno}",
                "cat_dos": "${form.cat_dos}",
                "cantidad_dos": "${form.cantidad_dos}",
                "caravana_dos": "${form.caravana_dos}",
                "cat_tres": "${data.cat_tres}",
                "cantidad_tres": "${data.cantidad_tres}",
                "caravana_tres": "${data.caravana_tres}"
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
                "caravana_uno": "${data.caravana_uno}",
                "cat_dos": "${form.cat_dos}",
                "cantidad_dos": "${form.cantidad_dos}",
                "caravana_dos": "${form.caravana_dos}",
                "cat_tres": "${data.cat_tres}",
                "cantidad_tres": "${data.cantidad_tres}",
                "caravana_tres": "${data.caravana_tres}"
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
        "cat_uno": {"type": "string", "__example__": "Vacas"},
        "cantidad_uno": {"type": "number", "__example__": 2},
        "caravana_uno": {"type": "string", "__example__": "1234"},
        "cat_dos": {"type": "string", "__example__": "Novillos"},
        "cantidad_dos": {"type": "number", "__example__": 1},
        "caravana_dos": {"type": "string", "__example__": "5678"},
        "cat_tres": {"type": "string", "__example__": ""},
        "cantidad_tres": {"type": "number", "__example__": 0},
        "caravana_tres": {"type": "string", "__example__": ""}
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
            "type": "TextInput",
            "name": "caravana_tres",
            "label": "Caravana (opcional)",
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
                "caravana_uno": "${data.caravana_uno}",
                "cat_dos": "${data.cat_dos}",
                "cantidad_dos": "${data.cantidad_dos}",
                "caravana_dos": "${data.caravana_dos}",
                "cat_tres": "${form.cat_tres}",
                "cantidad_tres": "${form.cantidad_tres}",
                "caravana_tres": "${form.caravana_tres}"
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
        "cat_uno": {"type": "string", "__example__": "Vacas"},
        "cantidad_uno": {"type": "number", "__example__": 2},
        "caravana_uno": {"type": "string", "__example__": "1234"},
        "cat_dos": {"type": "string", "__example__": ""},
        "cantidad_dos": {"type": "number", "__example__": 0},
        "caravana_dos": {"type": "string", "__example__": ""},
        "cat_tres": {"type": "string", "__example__": ""},
        "cantidad_tres": {"type": "number", "__example__": 0},
        "caravana_tres": {"type": "string", "__example__": ""}
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Confirmar Mortandad"
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
                "tipo": "MORTANDAD",
                "fecha": "${data.fecha}",
                "potrero": "${data.potrero}",
                "cat_uno": "${data.cat_uno}",
                "cantidad_uno": "${data.cantidad_uno}",
                "caravana_uno": "${data.caravana_uno}",
                "cat_dos": "${data.cat_dos}",
                "cantidad_dos": "${data.cantidad_dos}",
                "caravana_dos": "${data.caravana_dos}",
                "cat_tres": "${data.cat_tres}",
                "cantidad_tres": "${data.cantidad_tres}",
                "caravana_tres": "${data.caravana_tres}",
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
  → CATEGORIA_UNO (cat_uno, cantidad_uno, caravana_uno)
    → [EmbeddedLink] CATEGORIA_DOS (cat_dos, cantidad_dos, caravana_dos)
      → [EmbeddedLink] CATEGORIA_TRES (cat_tres, cantidad_tres, caravana_tres)
        → CONFIRMAR (notas, foto)
    → [Footer] CONFIRMAR (notas, foto)
  → [Footer] CONFIRMAR (notas, foto)
```

## Campos

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| fecha | DatePicker | Si | Fecha del evento |
| potrero | Dropdown | Si | Potrero donde ocurrio |
| cat_uno | Dropdown | Si | Primera categoría |
| cantidad_uno | TextInput | Si | Cantidad de la primera categoría |
| caravana_uno | TextInput | No | Caravana de la primera categoría (bovinos) |
| cat_dos | Dropdown | No | Segunda categoría (opcional) |
| cantidad_dos | TextInput | No | Cantidad de la segunda categoría |
| caravana_dos | TextInput | No | Caravana de la segunda categoría |
| cat_tres | Dropdown | No | Tercera categoría (opcional) |
| cantidad_tres | TextInput | No | Cantidad de la tercera categoría |
| caravana_tres | TextInput | No | Caravana de la tercera categoría |
| notas | TextArea | No | Observaciones adicionales |
| foto | PhotoPicker | No | Imagen del evento |

## Nota importante

**Para testing en Meta**: El flow usa data-source hardcodeado con ejemplos realistas de categorías de animales con cantidades.

**Para producción**: El dropdown de categorías debe cargarse dinámicamente según el potrero seleccionado desde la tabla `AnimalLote`.

**Funcionalidad completa**:
- **En WhatsApp Flow**: ✅ Soporta hasta 3 categorías con navegación mediante "Agregar otra categoria" o "Finalizar"
- El usuario puede saltar a CONFIRMAR en cualquier momento usando el botón "Finalizar"
- El backend debe procesar hasta 3 categorías, ignorando las que estén vacías
