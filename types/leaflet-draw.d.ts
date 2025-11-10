declare module 'leaflet' {
  interface TileLayerOptions {
    attribution?: string
    maxZoom?: number
    minZoom?: number
  }

  interface LayersControlOptions {
    collapsed?: boolean
    position?: string
  }

  function tileLayer(urlTemplate: string, options?: TileLayerOptions): TileLayer
  
  namespace control {
    function layers(
      baseLayers?: { [name: string]: Layer },
      overlays?: { [name: string]: Layer },
      options?: LayersControlOptions
    ): Control.Layers
  }

  namespace Control {
    class Draw extends Control {
      constructor(options?: any)
    }
    
    interface Layers extends Control {
      addTo(map: Map): this
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

  class FeatureGroup extends LayerGroup {
    clearLayers(): this
    getLayers(): Layer[]
  }
}

declare module 'leaflet-draw' {
  import * as L from 'leaflet'
  export = L
}