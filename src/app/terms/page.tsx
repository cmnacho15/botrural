export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-6">Términos de Uso</h1>
        <p className="text-gray-600 mb-4">Última actualización: {new Date().toLocaleDateString('es-UY')}</p>
        
        <div className="space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Aceptación de términos</h2>
            <p>
              Al usar MiCampoData, aceptas estos términos. Si no estás de acuerdo, 
              no uses el servicio.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Descripción del servicio</h2>
            <p>MiCampoData es una plataforma de gestión agrícola que permite:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Registrar eventos del campo (nacimientos, gastos, lluvias, etc.)</li>
              <li>Gestionar inventario y finanzas</li>
              <li>Interactuar mediante WhatsApp Bot</li>
              <li>Generar reportes y análisis</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Cuenta de usuario</h2>
            <p>Para usar el servicio debes:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Proporcionar información precisa</li>
              <li>Mantener tu contraseña segura</li>
              <li>Notificar actividad no autorizada</li>
              <li>Ser responsable de la actividad en tu cuenta</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Uso aceptable</h2>
            <p>No puedes:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Usar el servicio para actividades ilegales</li>
              <li>Compartir tu cuenta con terceros</li>
              <li>Intentar acceder a cuentas de otros usuarios</li>
              <li>Sobrecargar o dañar el sistema</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. WhatsApp Bot</h2>
            <p>
              El bot de WhatsApp está diseñado para facilitar el registro de datos. 
              Los mensajes enviados al bot son procesados automáticamente usando 
              inteligencia artificial (OpenAI) para extraer información relevante.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Propiedad intelectual</h2>
            <p>
              MiCampoData y su contenido son propiedad de sus creadores. 
              Tus datos te pertenecen y puedes exportarlos o eliminarlos en cualquier momento.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Limitación de responsabilidad</h2>
            <p>
              MiCampoData se proporciona "tal cual". No garantizamos disponibilidad 
              continua ni ausencia de errores. No somos responsables por pérdidas 
              derivadas del uso del servicio.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Modificaciones</h2>
            <p>
              Podemos modificar estos términos en cualquier momento. Los cambios 
              se notificarán mediante email o en la plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Terminación</h2>
            <p>
              Puedes cancelar tu cuenta en cualquier momento. Nos reservamos el 
              derecho de suspender cuentas que violen estos términos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Contacto</h2>
            <p>Para consultas sobre estos términos:</p>
            <p className="mt-2">
              Email: <a href="mailto:support@micampodata.com" className="text-blue-600 hover:underline">support@micampodata.com</a>
            </p>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t">
          <a href="/login" className="text-blue-600 hover:underline">← Volver al inicio</a>
        </div>
      </div>
    </div>
  )
}