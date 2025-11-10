declare module 'leaflet' {
  interface Map {
    setView(center: [number, number], zoom: number): this
    addLayer(layer: any): this
    addControl(control: any): this
    on(event: string, handler: (e: any) => void): this
    remove(): void
  }

  interface Layer {
    addTo(map: Map): this
    getLatLngs(): any[]
  }

  interface TileLayer extends Layer {}

  interface FeatureGroupMethods {
    clearLayers(): this
    getLayers(): any[]
    addLayer(layer: any): this
    eachLayer(fn: (layer: any) => void): void
  }

  function map(id: string, options?: any): Map  // ← Esto retorna Map, no any
  function tileLayer(url: string, options?: any): TileLayer

  class FeatureGroup implements FeatureGroupMethods {
    constructor()
    clearLayers(): this
    getLayers(): any[]
    addLayer(layer: any): this
    eachLayer(fn: (layer: any) => void): void
  }

  namespace control {
    function layers(baseLayers?: any, overlays?: any, options?: any): any
  }

  namespace Control {
    class Draw {
      constructor(options?: any)
    }
  }

  namespace Draw {
    const Event: {
      CREATED: string
      EDITED: string
      DELETED: string
      DRAWSTART: string
      DRAWSTOP: string
      EDITSTART: string
      EDITSTOP: string
    }
  }
}

declare module 'leaflet-draw' {
  import * as L from 'leaflet'
  export = L
}