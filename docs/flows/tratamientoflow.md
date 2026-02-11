# Flow Tratamiento - WhatsApp Flow

## Descripcion
Flow para registrar tratamientos veterinarios desde WhatsApp.
Soporta hasta 3 categorías diferentes en un mismo tratamiento.

## JSON del Flow

```json
{
  "version": "6.3",
  "routing_model": {
    "INICIO": ["ANIMAL_UNO"],
    "ANIMAL_UNO": ["ANIMAL_DOS", "CONFIRMAR"],
    "ANIMAL_DOS": ["ANIMAL_TRES", "CONFIRMAR"],
    "ANIMAL_TRES": ["CONFIRMAR"],
    "CONFIRMAR": []
  },
  "screens": [
    {
      "id": "INICIO",
      "title": "Tratamiento",
      "terminal": false,
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Registrar Tratamiento"
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
            "type": "TextInput",
            "name": "tratamiento",
            "label": "Tratamiento",
            "required": true
          },
          {
            "type": "TextInput",
            "name": "marca",
            "label": "Marca",
            "required": false
          },
          {
            "type": "Footer",
            "label": "Continuar",
            "on-click-action": {
              "name": "navigate",
              "next": {
                "type": "screen",
                "name": "ANIMAL_UNO"
              },
              "payload": {
                "fecha": "${form.fecha}",
                "potrero": "${form.potrero}",
                "tratamiento": "${form.tratamiento}",
                "marca": "${form.marca}"
              }
            }
          }
        ]
      }
    },
    {
      "id": "ANIMAL_UNO",
      "title": "Animal 1",
      "terminal": false,
      "data": {
        "fecha": {"type": "string", "__example__": "2025-02-07"},
        "potrero": {"type": "string", "__example__": "clxabcd1234567890"},
        "tratamiento": {"type": "string", "__example__": "Vacuna Antiaftosa"},
        "marca": {"type": "string", "__example__": "Biogenesis"}
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Animal 1 Tratado"
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
            "name": "peso_uno",
            "label": "Peso promedio (kg)",
            "input-type": "number",
            "required": false
          },
          {
            "type": "EmbeddedLink",
            "text": "Agregar mas animales",
            "on-click-action": {
              "name": "navigate",
              "next": {
                "type": "screen",
                "name": "ANIMAL_DOS"
              },
              "payload": {
                "fecha": "${data.fecha}",
                "potrero": "${data.potrero}",
                "tratamiento": "${data.tratamiento}",
                "marca": "${data.marca}",
                "cat_uno": "${form.cat_uno}",
                "cantidad_uno": "${form.cantidad_uno}",
                "peso_uno": "${form.peso_uno}",
                "cat_dos": "",
                "cantidad_dos": "",
                "peso_dos": "",
                "cat_tres": "",
                "cantidad_tres": "",
                "peso_tres": ""
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
                "tratamiento": "${data.tratamiento}",
                "marca": "${data.marca}",
                "cat_uno": "${form.cat_uno}",
                "cantidad_uno": "${form.cantidad_uno}",
                "peso_uno": "${form.peso_uno}",
                "cat_dos": "",
                "cantidad_dos": "",
                "peso_dos": "",
                "cat_tres": "",
                "cantidad_tres": "",
                "peso_tres": ""
              }
            }
          }
        ]
      }
    },
    {
      "id": "ANIMAL_DOS",
      "title": "Animal 2",
      "terminal": false,
      "data": {
        "fecha": {"type": "string", "__example__": "2025-02-07"},
        "potrero": {"type": "string", "__example__": "clxabcd1234567890"},
        "tratamiento": {"type": "string", "__example__": "Vacuna Antiaftosa"},
        "marca": {"type": "string", "__example__": "Biogenesis"},
        "cat_uno": {"type": "string", "__example__": "Vacas"},
        "cantidad_uno": {"type": "number", "__example__": 50},
        "peso_uno": {"type": "number", "__example__": 450},
        "cat_dos": {"type": "string", "__example__": ""},
        "cantidad_dos": {"type": "number", "__example__": 0},
        "peso_dos": {"type": "number", "__example__": 0},
        "cat_tres": {"type": "string", "__example__": ""},
        "cantidad_tres": {"type": "number", "__example__": 0},
        "peso_tres": {"type": "number", "__example__": 0}
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Animal 2 Tratado"
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
            "name": "peso_dos",
            "label": "Peso promedio (kg)",
            "input-type": "number",
            "required": false
          },
          {
            "type": "EmbeddedLink",
            "text": "Agregar mas animales",
            "on-click-action": {
              "name": "navigate",
              "next": {
                "type": "screen",
                "name": "ANIMAL_TRES"
              },
              "payload": {
                "fecha": "${data.fecha}",
                "potrero": "${data.potrero}",
                "tratamiento": "${data.tratamiento}",
                "marca": "${data.marca}",
                "cat_uno": "${data.cat_uno}",
                "cantidad_uno": "${data.cantidad_uno}",
                "peso_uno": "${data.peso_uno}",
                "cat_dos": "${form.cat_dos}",
                "cantidad_dos": "${form.cantidad_dos}",
                "peso_dos": "${form.peso_dos}",
                "cat_tres": "${data.cat_tres}",
                "cantidad_tres": "${data.cantidad_tres}",
                "peso_tres": "${data.peso_tres}"
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
                "tratamiento": "${data.tratamiento}",
                "marca": "${data.marca}",
                "cat_uno": "${data.cat_uno}",
                "cantidad_uno": "${data.cantidad_uno}",
                "peso_uno": "${data.peso_uno}",
                "cat_dos": "${form.cat_dos}",
                "cantidad_dos": "${form.cantidad_dos}",
                "peso_dos": "${form.peso_dos}",
                "cat_tres": "${data.cat_tres}",
                "cantidad_tres": "${data.cantidad_tres}",
                "peso_tres": "${data.peso_tres}"
              }
            }
          }
        ]
      }
    },
    {
      "id": "ANIMAL_TRES",
      "title": "Animal 3",
      "terminal": false,
      "data": {
        "fecha": {"type": "string", "__example__": "2025-02-07"},
        "potrero": {"type": "string", "__example__": "clxabcd1234567890"},
        "tratamiento": {"type": "string", "__example__": "Vacuna Antiaftosa"},
        "marca": {"type": "string", "__example__": "Biogenesis"},
        "cat_uno": {"type": "string", "__example__": "Vacas"},
        "cantidad_uno": {"type": "number", "__example__": 50},
        "peso_uno": {"type": "number", "__example__": 450},
        "cat_dos": {"type": "string", "__example__": "Novillos"},
        "cantidad_dos": {"type": "number", "__example__": 30},
        "peso_dos": {"type": "number", "__example__": 380},
        "cat_tres": {"type": "string", "__example__": ""},
        "cantidad_tres": {"type": "number", "__example__": 0},
        "peso_tres": {"type": "number", "__example__": 0}
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Animal 3 Tratado (ultimo)"
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
            "name": "peso_tres",
            "label": "Peso promedio (kg)",
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
                "tratamiento": "${data.tratamiento}",
                "marca": "${data.marca}",
                "cat_uno": "${data.cat_uno}",
                "cantidad_uno": "${data.cantidad_uno}",
                "peso_uno": "${data.peso_uno}",
                "cat_dos": "${data.cat_dos}",
                "cantidad_dos": "${data.cantidad_dos}",
                "peso_dos": "${data.peso_dos}",
                "cat_tres": "${form.cat_tres}",
                "cantidad_tres": "${form.cantidad_tres}",
                "peso_tres": "${form.peso_tres}"
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
        "tratamiento": {"type": "string", "__example__": "Vacuna Antiaftosa"},
        "marca": {"type": "string", "__example__": "Biogenesis"},
        "cat_uno": {"type": "string", "__example__": "Vacas"},
        "cantidad_uno": {"type": "number", "__example__": 50},
        "peso_uno": {"type": "number", "__example__": 450},
        "cat_dos": {"type": "string", "__example__": ""},
        "cantidad_dos": {"type": "number", "__example__": 0},
        "peso_dos": {"type": "number", "__example__": 0},
        "cat_tres": {"type": "string", "__example__": ""},
        "cantidad_tres": {"type": "number", "__example__": 0},
        "peso_tres": {"type": "number", "__example__": 0}
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Confirmar Tratamiento"
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
                "tipo": "TRATAMIENTO",
                "fecha": "${data.fecha}",
                "potrero": "${data.potrero}",
                "tratamiento": "${data.tratamiento}",
                "marca": "${data.marca}",
                "cat_uno": "${data.cat_uno}",
                "cantidad_uno": "${data.cantidad_uno}",
                "peso_uno": "${data.peso_uno}",
                "cat_dos": "${data.cat_dos}",
                "cantidad_dos": "${data.cantidad_dos}",
                "peso_dos": "${data.peso_dos}",
                "cat_tres": "${data.cat_tres}",
                "cantidad_tres": "${data.cantidad_tres}",
                "peso_tres": "${data.peso_tres}",
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
INICIO (fecha, potrero, tratamiento, marca)
  → ANIMAL_UNO (cat_uno, cantidad_uno, peso_uno)
    → [EmbeddedLink] ANIMAL_DOS (cat_dos, cantidad_dos, peso_dos)
      → [EmbeddedLink] ANIMAL_TRES (cat_tres, cantidad_tres, peso_tres)
        → CONFIRMAR (notas, foto)
    → [Footer] CONFIRMAR (notas, foto)
  → [Footer] CONFIRMAR (notas, foto)
```

## Campos

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| fecha | DatePicker | Si | Fecha del tratamiento |
| potrero | Dropdown | Si | Potrero donde se realizo |
| tratamiento | TextInput | Si | Nombre del tratamiento o medicamento |
| marca | TextInput | No | Marca del producto |
| cat_uno | Dropdown | Si | Primera categoría tratada |
| cantidad_uno | TextInput | Si | Cantidad de la primera categoría |
| peso_uno | TextInput | No | Peso promedio primera categoría (kg) |
| cat_dos | Dropdown | No | Segunda categoría tratada (opcional) |
| cantidad_dos | TextInput | No | Cantidad de la segunda categoría |
| peso_dos | TextInput | No | Peso promedio segunda categoría (kg) |
| cat_tres | Dropdown | No | Tercera categoría tratada (opcional) |
| cantidad_tres | TextInput | No | Cantidad de la tercera categoría |
| peso_tres | TextInput | No | Peso promedio tercera categoría (kg) |
| notas | TextArea | No | Observaciones adicionales |
| foto | PhotoPicker | No | Imagen del evento |

## Nota importante

**Para testing en Meta**: El flow usa data-source hardcodeado con ejemplos realistas.

**Para producción**: Ambos dropdowns (potreros y categorías) deben cargarse dinámicamente desde la base de datos.

**Funcionalidad completa**:
- **En la web**: El modal permite agregar múltiples animales con el botón "➕ Agregar Más Animales" sin límite
- **En WhatsApp Flow**: ✅ Soporta hasta 3 categorías con navegación mediante "Agregar mas animales" o "Finalizar"
- El usuario puede saltar a CONFIRMAR en cualquier momento usando el botón "Finalizar"
- El backend debe procesar hasta 3 animales/categorías, ignorando las que estén vacías
