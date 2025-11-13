declare module 'leaflet' {
  export interface Map {
    setView(center: [number, number], zoom: number): this
    addLayer(layer: any): this
    addControl(control: any): this
    on(event: string, handler: (e: any) => void): this
    remove(): void
    fitBounds(bounds: any, options?: any): this
  }

  export interface Layer {
    addTo(map: Map): this
    getLatLngs(): any[]
    bindPopup(content: string): this
  }

  export interface TileLayer extends Layer {}

  export interface FeatureGroupMethods {
    clearLayers(): this
    getLayers(): any[]
    addLayer(layer: any): this
    eachLayer(fn: (layer: any) => void): void
    getBounds(): any
  }

  export function map(id: string, options?: any): Map
  export function tileLayer(url: string, options?: any): TileLayer
  export function polygon(latlngs: number[][], options?: any): Layer

  export class FeatureGroup implements FeatureGroupMethods {
    constructor()
    clearLayers(): this
    getLayers(): any[]
    addLayer(layer: any): this
    eachLayer(fn: (layer: any) => void): void
    getBounds(): any
  }

  export namespace control {
    function layers(baseLayers?: any, overlays?: any, options?: any): any
  }

  export namespace Control {
    class Draw {
      constructor(options?: any)
    }
  }

  export namespace Draw {
    const Event: {
      CREATED: string
      EDITED: string
      DELETED: string
    }
  }
}

declare module 'leaflet-draw' {
  import * as L from 'leaflet'
  export = L
}