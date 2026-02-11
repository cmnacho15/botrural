# Flow Tacto - WhatsApp Flow

## Descripcion
Flow para registrar tacto reproductivo (preñez) desde WhatsApp.

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
      "title": "Tacto",
      "terminal": false,
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Registrar Tacto"
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
            "name": "animalesTactados",
            "label": "Animales tactados",
            "input-type": "number",
            "required": true
          },
          {
            "type": "TextInput",
            "name": "animalesPreñados",
            "label": "Animales preñados",
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
                "animalesTactados": "${form.animalesTactados}",
                "animalesPreñados": "${form.animalesPreñados}"
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
        "animalesTactados": {"type": "number", "__example__": 120},
        "animalesPreñados": {"type": "number", "__example__": 100}
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Confirmar Tacto"
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
                "tipo": "TACTO",
                "fecha": "${data.fecha}",
                "potrero": "${data.potrero}",
                "animalesTactados": "${data.animalesTactados}",
                "animalesPreñados": "${data.animalesPreñados}",
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
INICIO (fecha, potrero, tactados, preñados) -> CONFIRMAR (notas, foto)
```

## Campos

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| fecha | DatePicker | Si | Fecha del tacto |
| potrero | Dropdown | Si | Potrero donde se realizo |
| animalesTactados | TextInput | Si | Total de animales tactados |
| animalesPreñados | TextInput | Si | Total de animales preñados |
| notas | TextArea | No | Observaciones adicionales |
| foto | PhotoPicker | No | Imagen del evento |

## Nota importante

**Para testing en Meta**: El flow usa data-source hardcodeado con potreros de ejemplo.

**Para producción**: El dropdown de potreros debe cargarse dinámicamente desde `/api/lotes`.

**Nota backend**: El porcentaje de preñez se calcula automáticamente en el backend: `(preñados / tactados) * 100`
