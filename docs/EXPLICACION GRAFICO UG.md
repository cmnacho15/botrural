“Mi plataforma calcula la UG de cada potrero a partir de sus animales reales, captura automáticamente la carga diaria si cambia, reconstruye la curva diaria completa y obtiene la carga mensual por prorrateo diario, que es el método profesional usado por INIA y SUL para manejo ganadero.”


🟩 1. La UG de cada potrero se calcula a partir de los animales que tiene en ese momento

Cada categoría tiene su equivalencia oficial (SUL-INIA).
Por ejemplo:
	•	Vaca = 1.0 UG
	•	Ternero = 0.40 UG
	•	Oveja = 0.16 UG

Entonces:
UG del potrero = suma(cantidad × equivalencia de cada categoría)

Este cálculo es siempre correcto, porque se basa en lo que realmente hay en la tabla AnimalLote.

⸻

🟩 2. Todas las noches a las 00:00 se ejecuta un CRON automático

Este proceso:
	1.	Lee los animales de cada potrero.
	2.	Calcula la UG real del potrero (usando equivalencias oficiales).
	3.	Busca el último valor histórico guardado.
	4.	Si la UG cambió → guarda un snapshot nuevo.
	5.	Si es igual → NO guarda nada.

👉 Esto crea un histórico limpio, sin duplicados y sin ruido.

⸻

🟩 3. Cada snapshot histórico representa la “foto real” de la carga del potrero en ese día

Ejemplo:
	•	3 de abril → 40 UG
	•	12 de abril → 28 UG
	•	15 de abril → 33 UG

Si no había snapshot el 5 de abril → ese día se usa la UG del 3/4.
Esto se llama “last value carry forward”, estándar mundial en series de tiempo.

⸻

🟩 4. Para analizar un mes, la app reconstruye la UG diaria real

Para cada día del mes:
	•	busca el último snapshot ≤ ese día
	•	ese es el valor real de UG del día

Así obtengo la curva diaria verdadera aunque no haya datos todos los días.

⸻

🟩 5. Cálculo mensual = promedio diario del mes

Para cada potrero:  UG mensual = (suma de UG diaria) / (días del mes)

Este método es el profesional usado en Uruguay para evaluar carga animal.

👉 No usa el último valor del mes,
👉 NO usa estimaciones,
👉 sino la UG equivalente diaria, que es lo más exacto para manejo ganadero.

⸻

🟩 6. La UG global del campo se calcula sumando la UG de todos los potreros

Y luego: UG/ha global = UG_global / hectáreas_totales

Esto te da:
	•	carga total del establecimiento
	•	carga por hectárea real
	•	comparada automáticamente con rangos óptimos (SUL)