Cuando trabajes con tasas de cambio en tu plataforma, tenés que recordar tres lugares clave: primero, el archivo que obtiene la tasa desde internet está en src/lib/currency.ts, y allí se encuentran las funciones getUSDToUYU, convertirAUYU y obtenerTasaCambio, que se encargan de traer la cotización real, convertir montos y devolver la tasa correcta. Segundo, la API interna que el frontend consulta está en app/api/tasa-cambio/route.ts, y simplemente llama a getUSDToUYU() y devuelve la tasa al cliente cuando haces un fetch desde el modal. Tercero, las rutas que crean ingresos o gastos (app/api/ingresos/route.ts y app/api/gastos/route.ts) usan esas funciones para guardar todo de forma coherente en la BD: cuando un gasto o ingreso se crea en USD, se guarda montoOriginal, montoEnUYU convertido y la tasaCambio del día; cuando se crean en UYU, la tasaCambio se guarda como null porque no existe conversión. Al ver todo en USD en la página de gastos, si el gasto fue creado originalmente en USD, se usa la tasa guardada en BD y nunca se recalcula; si fue creado en UYU, como no tiene tasa guardada, se usa la tasa actual proveniente de la API interna (/api/tasa-cambio). Ese es el comportamiento profesional y correcto: respetar la tasa histórica de los gastos/ingresos en USD y convertir los UYU con la tasa del día actual. Todos los archivos importantes relacionados con tasa de cambio son solamente esos tres: src/lib/currency.ts, app/api/tasa-cambio/route.ts y las rutas API de creación/edición de gastos e ingresos que ya tenés configuradas.

📌 Resumen simple y definitivo sobre cómo funciona la tasa de cambio en tu sistema

Cuando registrás un gasto o ingreso, tu sistema guarda la información de esta manera:

⸻

🟦 1. Si el gasto/ingreso se creó en USD
	•	✔ Se guarda la tasa de cambio del día exacto en que se creó.
Ejemplos: 40.50, 41.20, 39.85, etc.
	•	Esa tasa queda congelada para siempre dentro del registro.

🔍 Al ver ese registro en USD:

👉 Se usa la misma tasa guardada.
No se recalcula nunca más.
Esto es EXACTAMENTE lo correcto contablemente.

⸻

🇺🇾 2. Si el gasto/ingreso se creó en UYU (pesos uruguayos)
	•	❌ No se guarda tasaCambio → queda null, porque ya está en pesos.
	•	No tiene sentido guardar una tasa cuando la moneda original es UYU.

🔍 Al ver ese registro en USD:

👉 Tu sistema usa la tasa de cambio ACTUAL de la API en tiempo real.
Ejemplos: 40.85, 41.00, 40.70, etc.

Esto es correcto, porque:
	•	El gasto se hizo en UYU → no existía una tasa original.
	•	Para convertirlo ahora a USD, necesitás la tasa de hoy.

⸻

🧠 Resumen ultra-corto
	•	💵 Gastos en USD → usan su propia tasa guardada (correcta y fija).
	•	🇺🇾 Gastos en UYU → usan la tasa actual de la API cuando querés ver en USD.