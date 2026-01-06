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

export { handleTacto } from './handlers/tactoHandler'  // ← CAMBIAR AQUÍ
export { handleDAO } from './handlers/daoHandler'
export { handleReporteDAO } from './handlers/reporteDAOHandler'

export { handleMapa } from "./handlers/mapaHandler"
export { sendWhatsAppImage } from "./sendMessage"