# SDD — Predicción de asistencia en Tío Yacu

Documento de especificación. No se implementa ni se despliega hasta tu visto bueno.

## 1. Información general

| Campo | Detalle |
| --- | --- |
| Módulo | Predicción de asistencia turística |
| Sitio | Naciente del río Tío Yacu (Segunda Jerusalén, Rioja, San Martín, Perú) |
| Actor principal | Usuario autenticado |
| Clima | WeatherAPI, ubicación fija `Rioja, Peru` (la más cercana al sitio) |
| Persistencia | SQLite en el servidor (`backend/data/tioyacu.db`) |
| Auth | El JWT que ya existe (`admin` / `admin123`) |
| Despliegue | AWS EC2, solo después de aprobar esta SDD y la implementación |

**Objetivo:** al elegir una fecha pasada, mostrar cuánta gente asistió y cómo estuvo el clima ese día. Al elegir una fecha futura, estimar la asistencia y decir si conviene ir o no ir. El usuario no carga esos datos.

## 2. Alcance

Incluye:

- Consultar una fecha pasada y ver la asistencia de ese día y el clima real (temperatura, estado, humedad).
- Esos datos salen de la base, no de un formulario del usuario.
- Predecir la asistencia de una fecha futura.
- Indicar **ir** o **no ir** según el clima de esa fecha futura.
- Explicar de dónde sale la cifra.

No incluye:

- Que el usuario registre a mano cuánta gente fue.
- Varios sitios turísticos.
- Pagos, boletería ni usuarios distintos del login demo.
- Un modelo de machine learning.
- Desplegar en EC2 en esta etapa.

## 3. Requerimientos funcionales

1. El sistema exige sesión activa (JWT) para consultar una fecha.
2. El usuario elige una fecha y pulsa **Consultar**. No escribe la cantidad de personas.
3. Si la fecha ya pasó, el sistema muestra cuánta gente asistió ese día y el clima real de Rioja (Open-Meteo).
4. Si la fecha es futura, el sistema consulta el pronóstico de WeatherAPI en Rioja, estima la asistencia e indica **ir** o **no ir**.
5. La base numérica son los totales mensuales oficiales de 2025, guardados en SQLite. DIRCETUR no publica el conteo de cada día.
6. La asistencia de un día pasado es la parte de ese total mensual que corresponde al clima y al tipo de día. Los días del mes suman el total oficial.
7. Si el año pedido todavía no tiene total oficial, se usa el mismo mes de 2025 y la nota lo dice. El clima sí es el de la fecha elegida.
8. La respuesta de una fecha futura muestra personas estimadas, clima, el motivo y la indicación **ir** o **no ir**.

## 4. Regla de predicción

Base = visitantes oficiales de ese mes en 2025 dividido entre los días del mes. Agosto: 31 233 / 31 ≈ 1 008 personas.

Ajustes sobre la base, aplicados en este orden y luego redondeados a entero, con mínimo 0:

| Condición del pronóstico | Ajuste |
| --- | --- |
| Lluvia, llovizna, chubasco o tormenta | −35 % |
| Nublado, cubierto, neblina o niebla | −10 % |
| Soleado o despejado | +15 % |
| Temperatura menor a 18 °C | −10 % adicional |
| Temperatura mayor a 30 °C | −5 % adicional |
| Sábado o domingo | +15 % |

En una fecha pasada no se usa esta fórmula. Ese día recibe una parte del total mensual según si llovió y si fue fin de semana, de modo que los días del mes suman el total oficial.

## 4.1 Indicación de ir o no ir

Solo aplica a fechas futuras. Se decide con el pronóstico de ese día, no con la cantidad de gente.

| Pronóstico | Indicación |
| --- | --- |
| Lluvia, llovizna, chubasco o tormenta | **No ir** |

Si WeatherAPI responde «chubasco», el sistema lo trata como lluvia. «Chubasco ligero» se muestra como «lluvia ligera»; cualquier otro chubasco se muestra como «lluvia». En ambos casos la indicación es **no ir**.
| Temperatura menor a 16 °C | **No ir** |
| Soleado, despejado, nublado, cubierto o neblina, con 16 °C o más | **Ir** |

Textos:

- Ir: "El clima permite la visita: conviene ir a Tío Yacu."
- No ir por lluvia: "Hay lluvia prevista: no conviene ir a Tío Yacu."
- No ir por frío: "La temperatura es muy baja: no conviene ir a Tío Yacu."

Si se cumplen lluvia y frío a la vez, la indicación es **no ir** y el texto menciona la lluvia.

## 5. Base de datos

Sí se usa base de datos: SQLite en `backend/data/tioyacu.db`.

Tabla `monthly_visitors`:

| Columna | Tipo | Regla |
| --- | --- | --- |
| year | entero | parte de la clave |
| month | entero | parte de la clave, 1 a 12 |
| visitors | entero | total oficial del mes |
| source | texto | DIRCETUR San Martín / MINCETUR |

Al iniciar, se cargan los 12 meses de 2025. Agosto 2025: 31 233 visitantes. El año suma 341 528.

El archivo SQLite no se sube a Git. Los totales oficiales sí van en el código que llena la tabla.

## 6. Diseño de API

Todas las rutas llevan `Authorization: Bearer <token_jwt>`.

### Consultar una fecha

`GET /api/v1/tioyacu/consult?date=2026-08-15`

Fecha pasada, `200 OK`:

```json
{
  "place": "Tío Yacu",
  "location": "Rioja",
  "date": "2026-08-15",
  "kind": "pasado",
  "attendees": 980,
  "weather": {
    "temperature": "22°C",
    "condition": "Lluvia",
    "humidity": "88%"
  },
  "officialMonth": {
    "year": 2025,
    "month": 8,
    "visitors": 31233,
    "source": "DIRCETUR San Martín / MINCETUR, Reporte Regional de Turismo San Martín 2025"
  },
  "note": "Aún no hay total oficial de 2026. La asistencia del día reparte el total de agosto 2025."
}
```

Fecha futura, el mismo endpoint:

`200 OK`:

```json
{
  "place": "Tío Yacu",
  "location": "Rioja",
  "date": "2026-10-04",
  "estimatedAttendees": 144,
  "advice": "ir",
  "adviceText": "El clima permite la visita: conviene ir a Tío Yacu.",
  "weather": {
    "temperature": "24°C",
    "condition": "Soleado",
    "humidity": "70%"
  },
  "reason": "Fin de semana y día soleado: se espera más visita que el promedio."
}
```

Errores: `400` fecha inválida. `401` sin sesión. `502` si falla el clima histórico o el pronóstico.

## 7. Interfaz

Nueva vista **Tío Yacu**, accesible tras el login, además de la consulta de clima que ya existe.

La parte superior muestra fotografías reales de la naciente: el puente de paja y las pozas. Cambian solas, con una transición suave, y también se eligen con los puntos. El texto de cada foto dice qué se está viendo. Debajo se cita a los autores (JYB Devot y EfraSC, licencia CC BY-SA 4.0).

Junto a las fotos aparecen datos del lugar: agua de la naciente a 12–15 °C, pozas de agua cristalina, cascada principal de 8 metros y la ubicación en Segunda Jerusalén, a unos 16 km de Rioja.

La consulta queda debajo de esa presentación:

- Campo de fecha y botón **Consultar**.
- Fecha pasada: personas que asistieron, temperatura, estado, humedad y la nota de la fuente oficial.
- Fecha futura: personas estimadas, clima, motivo y un aviso visible de **Ir** o **No ir**.

Sin sesión, la vista redirige al login.

## 8. Criterios de aceptación (BDD)

### Escenario 0 — Presentación del lugar

Dado que el usuario está logueado en Tío Yacu  
Entonces ve fotografías reales de la naciente que cambian solas, los datos del lugar y la cita de los autores. Puede elegir una foto con los puntos.

### Escenario 1 — Fecha pasada con asistencia y clima

Dado que el usuario está logueado en Tío Yacu  
Cuando elige una fecha pasada, por ejemplo del mes anterior, y pulsa **Consultar**  
Entonces el sistema muestra cuánta gente asistió ese día, el clima real y la fuente del total mensual. El usuario no escribe la cantidad.

### Escenario 2 — Predecir una fecha futura con clima

Dado que el usuario está logueado  
Cuando elige una fecha futura y pulsa **Consultar**  
Entonces el sistema consulta el clima de Rioja y muestra personas estimadas, clima, motivo y si conviene **ir** o **no ir**.

### Escenario 2b — No ir si el día futuro tiene lluvia

Dado que el usuario está logueado  
Cuando predice una fecha futura cuyo pronóstico es lluvia o chubasco  
Entonces el sistema muestra **No ir** y el texto de lluvia prevista. Si el pronóstico dice «chubasco ligero», el estado visible es «lluvia ligera».

### Escenario 3 — Sin sesión

Dado que no hay sesión activa  
Cuando intenta consultar una fecha  
Entonces la API responde 401 y la interfaz vuelve al login.

## 9. Orden si apruebas

1. Implementar base, API, regla de predicción y vista.
2. Pruebas básicas, intermedias y avanzadas (WeatherAPI mockeada).
3. Mostrarte el resultado en local.
4. Desplegar en AWS EC2 solo cuando lo confirmes.
