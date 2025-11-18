export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-6">Política de Privacidad</h1>
        <p className="text-gray-600 mb-4">Última actualización: {new Date().toLocaleDateString('es-UY')}</p>
        
        <div className="space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Información que recopilamos</h2>
            <p>MiCampoData recopila información necesaria para la gestión de campos agrícolas:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Nombre y apellido</li>
              <li>Email y teléfono</li>
              <li>Datos del campo (nombre, ubicación)</li>
              <li>Eventos registrados (nacimientos, gastos, lluvias, etc.)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Uso de la información</h2>
            <p>Utilizamos tu información para:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Proporcionar y mejorar nuestros servicios</li>
              <li>Gestionar tu cuenta y preferencias</li>
              <li>Comunicarnos contigo sobre tu campo</li>
              <li>Generar reportes y estadísticas</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. WhatsApp Bot</h2>
            <p>Nuestro bot de WhatsApp:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Procesa mensajes de texto y audio para registrar eventos</li>
              <li>No almacena mensajes sin procesar</li>
              <li>Utiliza OpenAI para transcripción y procesamiento</li>
              <li>Los datos procesados se guardan en tu cuenta</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Seguridad</h2>
            <p>Implementamos medidas de seguridad para proteger tu información:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Contraseñas encriptadas</li>
              <li>Conexiones seguras (HTTPS)</li>
              <li>Acceso controlado por roles</li>
              <li>Base de datos protegida</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Compartir información</h2>
            <p>No vendemos ni compartimos tu información personal con terceros, excepto:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Con tu consentimiento explícito</li>
              <li>Para cumplir con requisitos legales</li>
              <li>Servicios necesarios (hosting, procesamiento de pagos)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Tus derechos</h2>
            <p>Tienes derecho a:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Acceder a tu información</li>
              <li>Corregir datos incorrectos</li>
              <li>Solicitar eliminación de tu cuenta</li>
              <li>Exportar tus datos</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Contacto</h2>
            <p>Para consultas sobre privacidad:</p>
            <p className="mt-2">
              Email: <a href="mailto:privacy@micampodata.com" className="text-blue-600 hover:underline">privacy@micampodata.com</a>
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