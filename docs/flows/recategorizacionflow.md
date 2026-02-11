# Flow Recategorización - WhatsApp Flow

## Descripcion
Flow para recategorizar animales (cambiar de categoría, ej: Terneros → Novillos) desde WhatsApp.

## JSON del Flow

```json
{
  "version": "6.3",
  "routing_model": {
    "INICIO": ["CONFIRMAR"],
    "CONFIRMAR": []
  },
  "screens": [
    {
      "id": "INICIO",
      "title": "Recategorización",
      "terminal": false,
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Recategorizar Animales"
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
            "type": "Dropdown",
            "name": "categoriaActual",
            "label": "Categoría Actual",
            "required": true,
            "data-source": [
              {"id": "Terneros", "title": "Terneros (40 disponibles)"},
              {"id": "Terneras", "title": "Terneras (35 disponibles)"},
              {"id": "Novillos 1–2 años", "title": "Novillos 1–2 años (25 disponibles)"},
              {"id": "Vaquillonas 1–2 años", "title": "Vaquillonas 1–2 años (30 disponibles)"},
              {"id": "Corderos", "title": "Corderos (80 disponibles)"},
              {"id": "Borregas", "title": "Borregas (60 disponibles)"}
            ]
          },
          {
            "type": "Dropdown",
            "name": "categoriaNueva",
            "label": "Categoría Nueva",
            "required": true,
            "data-source": [
              {"id": "Novillos 1–2 años", "title": "Novillos 1–2 años"},
              {"id": "Novillos 2–3 años", "title": "Novillos 2–3 años"},
              {"id": "Novillos +3 años", "title": "Novillos +3 años"},
              {"id": "Vaquillonas 1–2 años", "title": "Vaquillonas 1–2 años"},
              {"id": "Vaquillonas +2 años", "title": "Vaquillonas +2 años"},
              {"id": "Vacas", "title": "Vacas"},
              {"id": "Borregas", "title": "Borregas"},
              {"id": "Borregas 2–4 dientes", "title": "Borregas 2–4 dientes"},
              {"id": "Ovejas", "title": "Ovejas"}
            ]
          },
          {
            "type": "TextInput",
            "name": "cantidad",
            "label": "Cantidad",
            "input-type": "number",
            "required": true
          },
          {
            "type": "Footer",
            "label": "Continuar",
            "on-click-action": {
              "name": "navigate",
              "next": {
                "type": "screen",
                "name": "CONFIRMAR"
              },
              "payload": {
                "fecha": "${form.fecha}",
                "potrero": "${form.potrero}",
                "categoriaActual": "${form.categoriaActual}",
                "categoriaNueva": "${form.categoriaNueva}",
                "cantidad": "${form.cantidad}"
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
        "categoriaActual": {"type": "string", "__example__": "Terneros"},
        "categoriaNueva": {"type": "string", "__example__": "Novillos 1–2 años"},
        "cantidad": {"type": "number", "__example__": 20}
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Confirmar Recategorización"
          },
          {
            "type": "TextBody",
            "text": "Se recategorizarán los animales seleccionados"
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
                "tipo": "RECATEGORIZACION",
                "fecha": "${data.fecha}",
                "potrero": "${data.potrero}",
                "categoriaActual": "${data.categoriaActual}",
                "categoriaNueva": "${data.categoriaNueva}",
                "cantidad": "${data.cantidad}",
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
INICIO (fecha, potrero, categoriaActual, categoriaNueva, cantidad) -> CONFIRMAR (notas, foto)
```

## Campos

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| fecha | DatePicker | Si | Fecha de recategorización |
| potrero | Dropdown | Si | Potrero donde están los animales |
| categoriaActual | Dropdown | Si | Categoría actual de los animales |
| categoriaNueva | Dropdown | Si | Nueva categoría destino |
| cantidad | TextInput | Si | Cantidad de animales a recategorizar |
| notas | TextArea | No | Observaciones adicionales |
| foto | PhotoPicker | No | Imagen del evento |

## Categorías por especie

### Vacunos
- Terneros/Terneras → Novillos 1–2 años / Vaquillonas 1–2 años
- Novillos 1–2 años → Novillos 2–3 años → Novillos +3 años
- Vaquillonas 1–2 años → Vaquillonas +2 años → Vacas

### Ovinos
- Corderos/Corderas → Borregas
- Borregas → Borregas 2–4 dientes → Ovejas

### Equinos
- Potrillos → Caballos / Yeguas

## Nota importante

**Para testing en Meta**: El flow usa data-source hardcodeado con ejemplos mixtos de todas las especies.

**Para producción**:
- El dropdown "Categoría Actual" debe cargarse según los animales del potrero seleccionado
- El dropdown "Categoría Nueva" debe filtrarse según la especie de la categoría actual:
  - Si es vacuno → solo mostrar categorías de vacunos
  - Si es ovino → solo mostrar categorías de ovinos
  - Si es equino → solo mostrar categorías de equinos
- El backend debe validar que categoriaActual != categoriaNueva
- El backend debe validar que ambas categorías sean de la misma especie
