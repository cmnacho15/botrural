// src/lib/whatsapp/index.ts

// Services
export * from './services/messageService'

// Handlers
export * from './handlers/audioHandler'
export * from './handlers/confirmationHandler'
export * from './handlers/gastoHandler'
export * from './handlers/imageHandler'
export * from './handlers/potreroHandler'
export * from './handlers/registrationHandler'
export * from './handlers/ventaHandler'
export { isToken } from './handlers/tokenHandler'
export {
  handleCalendarioCrear,
  handleCalendarioConsultar,
  handleCalendarioButtonResponse,
} from "./handlers/calendarioHandler"

export { sendWhatsAppButtons } from "./sendMessage"

export {
  handleMoverPotreroModulo,
  handleMoverPotreroModuloConfirmacion,
} from "./handlers/moverPotreroModuloHandler"

export { handleReporteCarga } from "./handlers/reporteCargaHandler"
export { handleReportePastoreo, handleReportePastoreoButtonResponse } from "./handlers/reportePastoreoHandler"
export { sendWhatsAppDocument } from "./sendMessage"

export {
  handleStockConsulta,
  handleStockEdicion,
  handleStockButtonResponse,
} from "./handlers/stockConsultaHandler"

export {
  handleCambiarCampo,
  handleCambiarCampoSeleccion,
  handleSeleccionGrupo,
} from "./handlers/campoHandler"

export { handleTacto, confirmarTacto } from './handlers/tactoHandler'
export { handleDAO, confirmarDAO } from './handlers/daoHandler'
export { handleLotesGranos, handleLotesGranosResponse } from './handlers/ventaHandler'
export { handleReporteDAO } from './handlers/reporteDAOHandler'

export { handleMapa } from "./handlers/mapaHandler"
export { sendWhatsAppImage } from "./sendMessage"

export { handleSeleccionPotreroModulo } from './handlers/moduloSelectionHandler'

export {
  handleEstadoDeCuenta,
  handlePagoButtonResponse,
  handlePagoTextResponse,
} from './handlers/pagoHandler'

// Agricultura
export {
  handleAgricultura,
  confirmarAgricultura,
  cancelarAgricultura,
} from './handlers/agriculturaHandler'

// Insumos
export {
  handleInsumos,
  confirmarInsumos,
  cancelarInsumos,
} from './handlers/insumosHandler'

// Processor (para el worker)
export { processWhatsAppMessage } from './processor'