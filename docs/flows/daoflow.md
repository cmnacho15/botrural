# Flow DAO - WhatsApp Flow

## Descripcion
Flow para registrar Diagnostico de Actividad Ovarica (DAO) desde WhatsApp.
Soporta hasta 4 categorias (Vacas, Vacas Gordas, Vaquillonas +2 anos, Vaquillonas 1-2 anos).

## JSON del Flow

```json
{
  "version": "6.3",
  "routing_model": {
    "INICIO": ["CATEGORIA_UNO"],
    "CATEGORIA_UNO": ["CATEGORIA_DOS", "CONFIRMAR"],
    "CATEGORIA_DOS": ["CATEGORIA_TRES", "CONFIRMAR"],
    "CATEGORIA_TRES": ["CATEGORIA_CUATRO", "CONFIRMAR"],
    "CATEGORIA_CUATRO": ["CONFIRMAR"],
    "CONFIRMAR": []
  },
  "screens": [
    {
      "id": "INICIO",
      "title": "DAO - Diagnostico",
      "terminal": false,
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Diagnostico de Actividad Ovarica"
          },
          {
            "type": "TextBody",
            "text": "Registra los resultados del monitoreo reproductivo"
          },
          {
            "type": "DatePicker",
            "name": "fecha",
            "label": "Fecha del DAO",
            "required": true
          },
          {
            "type": "Dropdown",
            "name": "potrero",
            "label": "Potrero",
            "required": true,
            "data-source": [
              {"id": "clxabcd1234567890", "title": "Norte (Vacas 50, Vacas Gordas 20)"},
              {"id": "clxabcd1234567891", "title": "Sur (Vaquillonas +2 años 30)"},
              {"id": "clxabcd1234567892", "title": "Este (Vacas 40, Vaquillonas 1–2 años 25)"},
              {"id": "clxabcd1234567893", "title": "Oeste (Vacas Gordas 35)"}
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
              {"id": "Vacas", "title": "Vacas"},
              {"id": "Vacas Gordas", "title": "Vacas Gordas"},
              {"id": "Vaquillonas +2 anos", "title": "Vaquillonas +2 anos"},
              {"id": "Vaquillonas 1-2 anos", "title": "Vaquillonas 1-2 anos"}
            ]
          },
          {
            "type": "TextInput",
            "name": "prenado_uno",
            "label": "Prenadas",
            
            "required": false
          },
          {
            "type": "TextInput",
            "name": "ciclando_uno",
            "label": "Ciclando",
            
            "required": false
          },
          {
            "type": "TextInput",
            "name": "anestro_sup_uno",
            "label": "Anestro Superficial",
            
            "required": false
          },
          {
            "type": "TextInput",
            "name": "anestro_prof_uno",
            "label": "Anestro Profundo",
            
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
                "prenado_uno": "${form.prenado_uno}",
                "ciclando_uno": "${form.ciclando_uno}",
                "anestro_sup_uno": "${form.anestro_sup_uno}",
                "anestro_prof_uno": "${form.anestro_prof_uno}",
                "cat_dos": "",
                "prenado_dos": "",
                "ciclando_dos": "",
                "anestro_sup_dos": "",
                "anestro_prof_dos": "",
                "cat_tres": "",
                "prenado_tres": "",
                "ciclando_tres": "",
                "anestro_sup_tres": "",
                "anestro_prof_tres": "",
                "cat_cuatro": "",
                "prenado_cuatro": "",
                "ciclando_cuatro": "",
                "anestro_sup_cuatro": "",
                "anestro_prof_cuatro": ""
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
                "prenado_uno": "${form.prenado_uno}",
                "ciclando_uno": "${form.ciclando_uno}",
                "anestro_sup_uno": "${form.anestro_sup_uno}",
                "anestro_prof_uno": "${form.anestro_prof_uno}",
                "cat_dos": "",
                "prenado_dos": "",
                "ciclando_dos": "",
                "anestro_sup_dos": "",
                "anestro_prof_dos": "",
                "cat_tres": "",
                "prenado_tres": "",
                "ciclando_tres": "",
                "anestro_sup_tres": "",
                "anestro_prof_tres": "",
                "cat_cuatro": "",
                "prenado_cuatro": "",
                "ciclando_cuatro": "",
                "anestro_sup_cuatro": "",
                "anestro_prof_cuatro": ""
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
        "prenado_uno": {"type": "string", "__example__": "5"},
        "ciclando_uno": {"type": "string", "__example__": "3"},
        "anestro_sup_uno": {"type": "string", "__example__": "2"},
        "anestro_prof_uno": {"type": "string", "__example__": "1"},
        "cat_dos": {"type": "string", "__example__": ""},
        "prenado_dos": {"type": "string", "__example__": ""},
        "ciclando_dos": {"type": "string", "__example__": ""},
        "anestro_sup_dos": {"type": "string", "__example__": ""},
        "anestro_prof_dos": {"type": "string", "__example__": ""},
        "cat_tres": {"type": "string", "__example__": ""},
        "prenado_tres": {"type": "string", "__example__": ""},
        "ciclando_tres": {"type": "string", "__example__": ""},
        "anestro_sup_tres": {"type": "string", "__example__": ""},
        "anestro_prof_tres": {"type": "string", "__example__": ""},
        "cat_cuatro": {"type": "string", "__example__": ""},
        "prenado_cuatro": {"type": "string", "__example__": ""},
        "ciclando_cuatro": {"type": "string", "__example__": ""},
        "anestro_sup_cuatro": {"type": "string", "__example__": ""},
        "anestro_prof_cuatro": {"type": "string", "__example__": ""}
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
              {"id": "Vacas", "title": "Vacas"},
              {"id": "Vacas Gordas", "title": "Vacas Gordas"},
              {"id": "Vaquillonas +2 anos", "title": "Vaquillonas +2 anos"},
              {"id": "Vaquillonas 1-2 anos", "title": "Vaquillonas 1-2 anos"}
            ]
          },
          {
            "type": "TextInput",
            "name": "prenado_dos",
            "label": "Prenadas",
            
            "required": false
          },
          {
            "type": "TextInput",
            "name": "ciclando_dos",
            "label": "Ciclando",
            
            "required": false
          },
          {
            "type": "TextInput",
            "name": "anestro_sup_dos",
            "label": "Anestro Superficial",
            
            "required": false
          },
          {
            "type": "TextInput",
            "name": "anestro_prof_dos",
            "label": "Anestro Profundo",
            
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
                "prenado_uno": "${data.prenado_uno}",
                "ciclando_uno": "${data.ciclando_uno}",
                "anestro_sup_uno": "${data.anestro_sup_uno}",
                "anestro_prof_uno": "${data.anestro_prof_uno}",
                "cat_dos": "${form.cat_dos}",
                "prenado_dos": "${form.prenado_dos}",
                "ciclando_dos": "${form.ciclando_dos}",
                "anestro_sup_dos": "${form.anestro_sup_dos}",
                "anestro_prof_dos": "${form.anestro_prof_dos}",
                "cat_tres": "${data.cat_tres}",
                "prenado_tres": "${data.prenado_tres}",
                "ciclando_tres": "${data.ciclando_tres}",
                "anestro_sup_tres": "${data.anestro_sup_tres}",
                "anestro_prof_tres": "${data.anestro_prof_tres}",
                "cat_cuatro": "${data.cat_cuatro}",
                "prenado_cuatro": "${data.prenado_cuatro}",
                "ciclando_cuatro": "${data.ciclando_cuatro}",
                "anestro_sup_cuatro": "${data.anestro_sup_cuatro}",
                "anestro_prof_cuatro": "${data.anestro_prof_cuatro}"
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
                "prenado_uno": "${data.prenado_uno}",
                "ciclando_uno": "${data.ciclando_uno}",
                "anestro_sup_uno": "${data.anestro_sup_uno}",
                "anestro_prof_uno": "${data.anestro_prof_uno}",
                "cat_dos": "${form.cat_dos}",
                "prenado_dos": "${form.prenado_dos}",
                "ciclando_dos": "${form.ciclando_dos}",
                "anestro_sup_dos": "${form.anestro_sup_dos}",
                "anestro_prof_dos": "${form.anestro_prof_dos}",
                "cat_tres": "${data.cat_tres}",
                "prenado_tres": "${data.prenado_tres}",
                "ciclando_tres": "${data.ciclando_tres}",
                "anestro_sup_tres": "${data.anestro_sup_tres}",
                "anestro_prof_tres": "${data.anestro_prof_tres}",
                "cat_cuatro": "${data.cat_cuatro}",
                "prenado_cuatro": "${data.prenado_cuatro}",
                "ciclando_cuatro": "${data.ciclando_cuatro}",
                "anestro_sup_cuatro": "${data.anestro_sup_cuatro}",
                "anestro_prof_cuatro": "${data.anestro_prof_cuatro}"
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
        "prenado_uno": {"type": "string", "__example__": "5"},
        "ciclando_uno": {"type": "string", "__example__": "3"},
        "anestro_sup_uno": {"type": "string", "__example__": "2"},
        "anestro_prof_uno": {"type": "string", "__example__": "1"},
        "cat_dos": {"type": "string", "__example__": "Vacas Gordas"},
        "prenado_dos": {"type": "string", "__example__": "4"},
        "ciclando_dos": {"type": "string", "__example__": "2"},
        "anestro_sup_dos": {"type": "string", "__example__": "1"},
        "anestro_prof_dos": {"type": "string", "__example__": "0"},
        "cat_tres": {"type": "string", "__example__": ""},
        "prenado_tres": {"type": "string", "__example__": ""},
        "ciclando_tres": {"type": "string", "__example__": ""},
        "anestro_sup_tres": {"type": "string", "__example__": ""},
        "anestro_prof_tres": {"type": "string", "__example__": ""},
        "cat_cuatro": {"type": "string", "__example__": ""},
        "prenado_cuatro": {"type": "string", "__example__": ""},
        "ciclando_cuatro": {"type": "string", "__example__": ""},
        "anestro_sup_cuatro": {"type": "string", "__example__": ""},
        "anestro_prof_cuatro": {"type": "string", "__example__": ""}
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Categoria 3"
          },
          {
            "type": "Dropdown",
            "name": "cat_tres",
            "label": "Categoria",
            "required": true,
            "data-source": [
              {"id": "Vacas", "title": "Vacas"},
              {"id": "Vacas Gordas", "title": "Vacas Gordas"},
              {"id": "Vaquillonas +2 anos", "title": "Vaquillonas +2 anos"},
              {"id": "Vaquillonas 1-2 anos", "title": "Vaquillonas 1-2 anos"}
            ]
          },
          {
            "type": "TextInput",
            "name": "prenado_tres",
            "label": "Prenadas",
            
            "required": false
          },
          {
            "type": "TextInput",
            "name": "ciclando_tres",
            "label": "Ciclando",
            
            "required": false
          },
          {
            "type": "TextInput",
            "name": "anestro_sup_tres",
            "label": "Anestro Superficial",
            
            "required": false
          },
          {
            "type": "TextInput",
            "name": "anestro_prof_tres",
            "label": "Anestro Profundo",
            
            "required": false
          },
          {
            "type": "EmbeddedLink",
            "text": "Agregar otra categoria",
            "on-click-action": {
              "name": "navigate",
              "next": {
                "type": "screen",
                "name": "CATEGORIA_CUATRO"
              },
              "payload": {
                "fecha": "${data.fecha}",
                "potrero": "${data.potrero}",
                "cat_uno": "${data.cat_uno}",
                "prenado_uno": "${data.prenado_uno}",
                "ciclando_uno": "${data.ciclando_uno}",
                "anestro_sup_uno": "${data.anestro_sup_uno}",
                "anestro_prof_uno": "${data.anestro_prof_uno}",
                "cat_dos": "${data.cat_dos}",
                "prenado_dos": "${data.prenado_dos}",
                "ciclando_dos": "${data.ciclando_dos}",
                "anestro_sup_dos": "${data.anestro_sup_dos}",
                "anestro_prof_dos": "${data.anestro_prof_dos}",
                "cat_tres": "${form.cat_tres}",
                "prenado_tres": "${form.prenado_tres}",
                "ciclando_tres": "${form.ciclando_tres}",
                "anestro_sup_tres": "${form.anestro_sup_tres}",
                "anestro_prof_tres": "${form.anestro_prof_tres}",
                "cat_cuatro": "${data.cat_cuatro}",
                "prenado_cuatro": "${data.prenado_cuatro}",
                "ciclando_cuatro": "${data.ciclando_cuatro}",
                "anestro_sup_cuatro": "${data.anestro_sup_cuatro}",
                "anestro_prof_cuatro": "${data.anestro_prof_cuatro}"
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
                "prenado_uno": "${data.prenado_uno}",
                "ciclando_uno": "${data.ciclando_uno}",
                "anestro_sup_uno": "${data.anestro_sup_uno}",
                "anestro_prof_uno": "${data.anestro_prof_uno}",
                "cat_dos": "${data.cat_dos}",
                "prenado_dos": "${data.prenado_dos}",
                "ciclando_dos": "${data.ciclando_dos}",
                "anestro_sup_dos": "${data.anestro_sup_dos}",
                "anestro_prof_dos": "${data.anestro_prof_dos}",
                "cat_tres": "${form.cat_tres}",
                "prenado_tres": "${form.prenado_tres}",
                "ciclando_tres": "${form.ciclando_tres}",
                "anestro_sup_tres": "${form.anestro_sup_tres}",
                "anestro_prof_tres": "${form.anestro_prof_tres}",
                "cat_cuatro": "${data.cat_cuatro}",
                "prenado_cuatro": "${data.prenado_cuatro}",
                "ciclando_cuatro": "${data.ciclando_cuatro}",
                "anestro_sup_cuatro": "${data.anestro_sup_cuatro}",
                "anestro_prof_cuatro": "${data.anestro_prof_cuatro}"
              }
            }
          }
        ]
      }
    },
    {
      "id": "CATEGORIA_CUATRO",
      "title": "Categoria 4",
      "terminal": false,
      "data": {
        "fecha": {"type": "string", "__example__": "2025-02-07"},
        "potrero": {"type": "string", "__example__": "clxabcd1234567890"},
        "cat_uno": {"type": "string", "__example__": "Vacas"},
        "prenado_uno": {"type": "string", "__example__": "5"},
        "ciclando_uno": {"type": "string", "__example__": "3"},
        "anestro_sup_uno": {"type": "string", "__example__": "2"},
        "anestro_prof_uno": {"type": "string", "__example__": "1"},
        "cat_dos": {"type": "string", "__example__": "Vacas Gordas"},
        "prenado_dos": {"type": "string", "__example__": "4"},
        "ciclando_dos": {"type": "string", "__example__": "2"},
        "anestro_sup_dos": {"type": "string", "__example__": "1"},
        "anestro_prof_dos": {"type": "string", "__example__": "0"},
        "cat_tres": {"type": "string", "__example__": "Vaquillonas +2 anos"},
        "prenado_tres": {"type": "string", "__example__": "3"},
        "ciclando_tres": {"type": "string", "__example__": "1"},
        "anestro_sup_tres": {"type": "string", "__example__": "1"},
        "anestro_prof_tres": {"type": "string", "__example__": "0"},
        "cat_cuatro": {"type": "string", "__example__": ""},
        "prenado_cuatro": {"type": "string", "__example__": ""},
        "ciclando_cuatro": {"type": "string", "__example__": ""},
        "anestro_sup_cuatro": {"type": "string", "__example__": ""},
        "anestro_prof_cuatro": {"type": "string", "__example__": ""}
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Categoria 4 (ultima)"
          },
          {
            "type": "Dropdown",
            "name": "cat_cuatro",
            "label": "Categoria",
            "required": true,
            "data-source": [
              {"id": "Vacas", "title": "Vacas"},
              {"id": "Vacas Gordas", "title": "Vacas Gordas"},
              {"id": "Vaquillonas +2 anos", "title": "Vaquillonas +2 anos"},
              {"id": "Vaquillonas 1-2 anos", "title": "Vaquillonas 1-2 anos"}
            ]
          },
          {
            "type": "TextInput",
            "name": "prenado_cuatro",
            "label": "Prenadas",
            
            "required": false
          },
          {
            "type": "TextInput",
            "name": "ciclando_cuatro",
            "label": "Ciclando",
            
            "required": false
          },
          {
            "type": "TextInput",
            "name": "anestro_sup_cuatro",
            "label": "Anestro Superficial",
            
            "required": false
          },
          {
            "type": "TextInput",
            "name": "anestro_prof_cuatro",
            "label": "Anestro Profundo",
            
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
                "prenado_uno": "${data.prenado_uno}",
                "ciclando_uno": "${data.ciclando_uno}",
                "anestro_sup_uno": "${data.anestro_sup_uno}",
                "anestro_prof_uno": "${data.anestro_prof_uno}",
                "cat_dos": "${data.cat_dos}",
                "prenado_dos": "${data.prenado_dos}",
                "ciclando_dos": "${data.ciclando_dos}",
                "anestro_sup_dos": "${data.anestro_sup_dos}",
                "anestro_prof_dos": "${data.anestro_prof_dos}",
                "cat_tres": "${data.cat_tres}",
                "prenado_tres": "${data.prenado_tres}",
                "ciclando_tres": "${data.ciclando_tres}",
                "anestro_sup_tres": "${data.anestro_sup_tres}",
                "anestro_prof_tres": "${data.anestro_prof_tres}",
                "cat_cuatro": "${form.cat_cuatro}",
                "prenado_cuatro": "${form.prenado_cuatro}",
                "ciclando_cuatro": "${form.ciclando_cuatro}",
                "anestro_sup_cuatro": "${form.anestro_sup_cuatro}",
                "anestro_prof_cuatro": "${form.anestro_prof_cuatro}"
              }
            }
          }
        ]
      }
    },
    {
      "id": "CONFIRMAR",
      "title": "Confirmar DAO",
      "terminal": true,
      "data": {
        "fecha": {"type": "string", "__example__": "2025-02-07"},
        "potrero": {"type": "string", "__example__": "clxabcd1234567890"},
        "cat_uno": {"type": "string", "__example__": "Vacas"},
        "prenado_uno": {"type": "string", "__example__": "5"},
        "ciclando_uno": {"type": "string", "__example__": "3"},
        "anestro_sup_uno": {"type": "string", "__example__": "2"},
        "anestro_prof_uno": {"type": "string", "__example__": "1"},
        "cat_dos": {"type": "string", "__example__": ""},
        "prenado_dos": {"type": "string", "__example__": ""},
        "ciclando_dos": {"type": "string", "__example__": ""},
        "anestro_sup_dos": {"type": "string", "__example__": ""},
        "anestro_prof_dos": {"type": "string", "__example__": ""},
        "cat_tres": {"type": "string", "__example__": ""},
        "prenado_tres": {"type": "string", "__example__": ""},
        "ciclando_tres": {"type": "string", "__example__": ""},
        "anestro_sup_tres": {"type": "string", "__example__": ""},
        "anestro_prof_tres": {"type": "string", "__example__": ""},
        "cat_cuatro": {"type": "string", "__example__": ""},
        "prenado_cuatro": {"type": "string", "__example__": ""},
        "ciclando_cuatro": {"type": "string", "__example__": ""},
        "anestro_sup_cuatro": {"type": "string", "__example__": ""},
        "anestro_prof_cuatro": {"type": "string", "__example__": ""}
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Confirmar DAO"
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
            "label": "Confirmar DAO",
            "on-click-action": {
              "name": "complete",
              "payload": {
                "tipo": "DAO",
                "fecha": "${data.fecha}",
                "potrero": "${data.potrero}",
                "cat_uno": "${data.cat_uno}",
                "prenado_uno": "${data.prenado_uno}",
                "ciclando_uno": "${data.ciclando_uno}",
                "anestro_sup_uno": "${data.anestro_sup_uno}",
                "anestro_prof_uno": "${data.anestro_prof_uno}",
                "cat_dos": "${data.cat_dos}",
                "prenado_dos": "${data.prenado_dos}",
                "ciclando_dos": "${data.ciclando_dos}",
                "anestro_sup_dos": "${data.anestro_sup_dos}",
                "anestro_prof_dos": "${data.anestro_prof_dos}",
                "cat_tres": "${data.cat_tres}",
                "prenado_tres": "${data.prenado_tres}",
                "ciclando_tres": "${data.ciclando_tres}",
                "anestro_sup_tres": "${data.anestro_sup_tres}",
                "anestro_prof_tres": "${data.anestro_prof_tres}",
                "cat_cuatro": "${data.cat_cuatro}",
                "prenado_cuatro": "${data.prenado_cuatro}",
                "ciclando_cuatro": "${data.ciclando_cuatro}",
                "anestro_sup_cuatro": "${data.anestro_sup_cuatro}",
                "anestro_prof_cuatro": "${data.anestro_prof_cuatro}",
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

En cada pantalla de categoria:
- **EmbeddedLink "Agregar otra categoria"** -> va a la siguiente categoria
- **Footer "Finalizar"** -> va directo a CONFIRMAR

## Notas importantes

**Para testing en Meta**: El flow usa data-source hardcodeado con ejemplos realistas:
- Potreros con IDs tipo cuid (ej: clxabcd1234567890) y nombres con info de animales
- Categorías fijas de bovinos femeninos para DAO (Vacas, Vacas Gordas, Vaquillonas)

**Para producción**: Cuando se integre con el backend:
1. El dropdown de potreros debe cargarse dinámicamente desde el endpoint `/api/lotes` filtrando solo potreros con animales aptos para DAO
2. Las categorías ya están hardcodeadas correctamente con las 4 categorías permitidas para DAO

**Funcionalidad completa**:
- **En la web**: El modal permite agregar hasta 4 categorías con el botón "➕ Agregar Otra Categoría" para registrar múltiples resultados en un solo DAO
- **En WhatsApp Flow**: Soporta las 4 categorías en pantallas separadas (CATEGORIA_UNO a CATEGORIA_CUATRO) con navegación mediante "Agregar otra categoría" o "Finalizar"
- ✅ Este flow SÍ mantiene la funcionalidad de múltiples categorías

**Para el backend**:
Todos los campos numéricos llegan como strings. Convertir con `parseInt()` o `Number()`:
```javascript
const prenado = parseInt(payload.prenado_uno) || 0
```
