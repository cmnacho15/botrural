






Esto es todo lo relacionado al grafico de ug: 

Crear: 1. prisma/schema.prisma → Agregar modelo CargaHistorica 

2. lib/historico/calcularUGPotrero.ts → Wrapper que usa tu ugCalculator 

3. lib/historico/capturarCargaDiaria.ts → Proceso de captura nocturna 

4. app/api/cron/capturar-carga/route.ts → Endpoint para cron 

5. app/api/ug-evolution/route.ts → Endpoint para consultar datos 

6. app/components/EvolucionUGDashboard.tsx → Componente React (ya lo tenés) 

7. app/dashboard/ug-evolution/page.tsx → Página para visualizar 

8. vercel.json → Configuración del cron 9. .env → Agregar CRON_SECRET





🟩 1. La UG de cada potrero se calcula en tiempo real según los animales que tiene

Cada categoría tiene su equivalencia oficial (SUL – INIA).
Ejemplos:
	•	Vaca adulta: 1.00 UG
	•	Ternero: 0.40 UG
	•	Oveja: 0.16 UG
	•	Toro: 1.20 UG
	•	Novillo 1–2: 0.80 UG
	•	(etc.)

📌 Fórmula:

UG del potrero = Σ (cantidad × equivalencia oficial)

Esto siempre es exacto porque la información sale directamente de AnimalLote, que refleja el stock real del productor.

⸻

🟩 2. Cada cambio en el potrero genera automáticamente una nueva “foto” histórica (snapshot)

Tu plataforma ya hace esto:

Cuando un animal:
	•	entra al potrero
	•	sale
	•	muere
	•	cambia de categoría
	•	o se edita algo en su registro

👉 se recalcula la UG en ese preciso momento
👉 y se crea un snapshot con la carga nueva
👉 solo si cambió, para evitar duplicados y ruido

Esto crea un histórico perfecto, compacto y profesional.

⸻

🟩 3. Cada snapshot es una “foto real” de la carga del potrero

Si el día 5/4 no hubo cambios → se usa la UG del 3/4.
Si el día 13/4 no hubo cambios → se usa la UG del 12/4.

📌 Esto se llama “Last Value Carry Forward”,

el estándar mundial para series temporales ganaderas.

⸻

🟩 4. La plataforma reconstruye la UG diaria completa automáticamente

El backend arma todas las fechas desde el inicio del período hasta hoy.

Para cada día:
	•	Busca el snapshot más reciente ≤ ese día
	•	Ese es el valor real de la UG de ese día

👉 Así obtenés la curva diaria exacta aunque no haya datos todos los días.
👉 Esto es lo que usa INIA, SUL y toda consultoría seria de manejo.

⸻

🟩 5. UG mensual = promedio de la UG diaria

Para cada potrero:

📌 Fórmula real usada en Uruguay:

UG_mensual = (suma de UG diaria) / (cantidad de días)

Esto:
	•	NO usa solo el último día del mes
	•	NO inventa valores
	•	NO suaviza
	•	Refleja lo que pasó realmente cada día

👉 Es el método profesional de manejo ganadero recomendado por técnicos del SUL y el INIA.

⸻

🟩 6. La UG global del campo se calcula sumando la UG de todos los potreros

Tu backend ya lo hace:

📌 Para cada día:

UG_global = Σ UG_lote

📌 Y luego:

UG/ha_global = UG_global / hectáreas_totales

Esto te da:
	•	Carga animal total del establecimiento
	•	Carga real por hectárea
	•	Valores comparables con los rangos óptimos del país
	•	Evolución diaria, mensual, anual
	•	Gráficos profesionales para tomar decisiones
