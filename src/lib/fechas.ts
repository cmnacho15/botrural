/**
 * Obtiene la fecha actual en formato YYYY-MM-DD ajustada a la zona horaria local (Uruguay UTC-3)
 * @returns {string} Fecha en formato ISO (YYYY-MM-DD)
 */
export function obtenerFechaLocal(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  const localDate = new Date(now.getTime() - offset)
  return localDate.toISOString().split('T')[0]
}