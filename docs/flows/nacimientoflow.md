# Flow Nacimiento - WhatsApp Flow

## Descripcion
Flow para registrar nacimientos de animales desde WhatsApp.
**Importante**: Solo permite registrar UNA categoría por evento: Terneros O Corderos (no ambos).

## JSON del Flow

```json
{
  "version": "6.3",
  "routing_model": {
    "INICIO": ["REGISTRAR"],
    "REGISTRAR": ["CONFIRMAR"],
    "CONFIRMAR": []
  },
  "screens": [
    {
      "id": "INICIO",
      "title": "Nacimiento",
      "terminal": false,
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Registrar Nacimiento"
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
                "name": "REGISTRAR"
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
      "id": "REGISTRAR",
      "title": "Datos del Nacimiento",
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
            "text": "Datos del Nacimiento"
          },
          {
            "type": "Dropdown",
            "name": "tipoAnimal",
            "label": "Tipo de Animal",
            "required": true,
            "data-source": [
              {"id": "terneros", "title": "Terneros"},
              {"id": "corderos", "title": "Corderos"}
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
                "fecha": "${data.fecha}",
                "potrero": "${data.potrero}",
                "tipoAnimal": "${form.tipoAnimal}",
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
        "tipoAnimal": {"type": "string", "__example__": "terneros"},
        "cantidad": {"type": "number", "__example__": 5}
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Confirmar Nacimiento"
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
                "tipo": "NACIMIENTO",
                "fecha": "${data.fecha}",
                "potrero": "${data.potrero}",
                "tipoAnimal": "${data.tipoAnimal}",
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
INICIO (fecha, potrero)
  → REGISTRAR (tipoAnimal, cantidad)
    → CONFIRMAR (notas, foto)
```

## Campos

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| fecha | DatePicker | Si | Fecha del nacimiento |
| potrero | Dropdown | Si | Potrero donde ocurrió |
| tipoAnimal | Dropdown | Si | Tipo: "terneros" o "corderos" (solo uno) |
| cantidad | TextInput | Si | Cantidad de animales nacidos |
| notas | TextArea | No | Observaciones adicionales |
| foto | PhotoPicker | No | Imagen del evento |

## Nota importante

**Para testing en Meta**: El flow usa data-source hardcodeado con potreros de ejemplo.

**Para producción**: El dropdown de potreros debe cargarse dinámicamente desde la base de datos.

**Funcionalidad**:
- **En WhatsApp Flow**: ✅ Permite registrar UNA SOLA categoría por evento
- Solo 2 opciones: Terneros O Corderos
- NO permite múltiples categorías (es un evento simple)
- Lógica: En un parto solo pueden nacer terneros (vacunos) O corderos (ovinos), nunca ambos
