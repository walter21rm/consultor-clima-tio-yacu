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

**Objetivo:** registrar cuánta gente asistió en fechas pasadas y, para una fecha futura, estimar la asistencia y decir si conviene ir o no ir según el clima previsto.

## 2. Alcance

Incluye:

- Registrar asistencia de una fecha pasada (fecha + cantidad de personas).
- Listar asistencias anteriores.
- Predecir la asistencia de una fecha futura.
- Indicar **ir** o **no ir** según el clima de esa fecha futura.
- Mostrar el clima usado en esa predicción (temperatura, estado, humedad).
- Explicar en una frase por qué sube o baja la estimación y por qué conviene ir o no.

No incluye:

- Varios sitios turísticos.
- Pagos, boletería ni usuarios distintos del login demo.
- Un modelo de machine learning.
- Desplegar en EC2 en esta etapa.

## 3. Requerimientos funcionales

1. El sistema exige sesión activa (JWT) en todas las operaciones de asistencia y predicción.
2. El usuario puede guardar la asistencia de una fecha ya ocurrida: fecha (`YYYY-MM-DD`) y cantidad de personas (entero mayor o igual a 0).
3. Si esa fecha ya tiene un registro, el sistema lo actualiza.
4. El usuario puede consultar el historial, ordenado de la fecha más reciente a la más antigua.
5. El usuario puede pedir la predicción de una fecha futura.
6. Para esa fecha el sistema consulta el pronóstico de WeatherAPI en Rioja.
7. La predicción usa el historial guardado y ajusta el número según el clima y si la fecha cae en fin de semana.
8. La respuesta de una fecha futura muestra personas estimadas, clima, el motivo del ajuste y la indicación **ir** o **no ir**.
9. Si no hay historial, la base es 80 personas entre semana y 140 el fin de semana (valores de arranque del curso, editables luego).
10. Una fecha futura no se puede guardar como asistencia real. Una fecha pasada no se predice: se muestra el registro guardado si existe.

## 4. Regla de predicción

Base = promedio de asistencias guardadas del mismo tipo de día (entre semana o fin de semana). Si no hay datos de ese tipo, se usa 80 o 140.

Ajustes sobre la base, aplicados en este orden y luego redondeados a entero, con mínimo 0:

| Condición del pronóstico | Ajuste |
| --- | --- |
| Lluvia, llovizna o tormenta | −35 % |
| Nublado, cubierto, neblina o niebla | −10 % |
| Soleado o despejado | +15 % |
| Temperatura menor a 18 °C | −10 % adicional |
| Temperatura mayor a 30 °C | −5 % adicional |
| Sábado o domingo | +25 % si la base salió solo de días de semana |

Ejemplo: base 100, sábado soleado y 24 °C → 100 × 1.15 × 1.25 = 144 personas.

## 4.1 Indicación de ir o no ir

Solo aplica a fechas futuras. Se decide con el pronóstico de ese día, no con la cantidad de gente.

| Pronóstico | Indicación |
| --- | --- |
| Lluvia, llovizna o tormenta | **No ir** |
| Temperatura menor a 16 °C | **No ir** |
| Soleado, despejado, nublado, cubierto o neblina, con 16 °C o más | **Ir** |

Textos:

- Ir: "El clima permite la visita: conviene ir a Tío Yacu."
- No ir por lluvia: "Hay lluvia prevista: no conviene ir a Tío Yacu."
- No ir por frío: "La temperatura es muy baja: no conviene ir a Tío Yacu."

Si se cumplen lluvia y frío a la vez, la indicación es **no ir** y el texto menciona la lluvia.

## 5. Base de datos

Tabla `attendance`:

| Columna | Tipo | Regla |
| --- | --- | --- |
| id | entero | clave primaria |
| visit_date | texto `YYYY-MM-DD` | única |
| attendees | entero | ≥ 0 |
| created_at | texto ISO | automático |
| updated_at | texto ISO | automático |

El archivo SQLite no se sube a Git.

## 6. Diseño de API

Todas las rutas llevan `Authorization: Bearer <token_jwt>`.

### Registrar o actualizar asistencia pasada

`POST /api/v1/tioyacu/attendance`

```json
{ "date": "2026-08-15", "attendees": 120 }
```

`200 OK`:

```json
{
  "date": "2026-08-15",
  "attendees": 120,
  "source": "registrado"
}
```

Errores: `400` fecha inválida, fecha futura o cantidad inválida. `401` sin sesión.

### Historial

`GET /api/v1/tioyacu/attendance`

`200 OK`:

```json
{
  "records": [
    { "date": "2026-08-15", "attendees": 120 }
  ]
}
```

### Predicción

`GET /api/v1/tioyacu/prediction?date=2026-10-04`

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

Si la fecha es pasada y ya hay registro, responde ese número con `"source": "registrado"` y no inventa una predicción.

Errores: `400` fecha inválida. `401` sin sesión. `502` si WeatherAPI falla en una fecha futura.

## 7. Interfaz

Nueva vista **Tío Yacu**, accesible tras el login, además de la consulta de clima que ya existe.

- Campo de fecha.
- Campo de cantidad de personas y botón **Registrar asistencia** (solo fechas pasadas).
- Botón **Predecir** para la fecha elegida.
- Tabla del historial: fecha y personas.
- Resultado de predicción: personas estimadas, temperatura, estado, humedad, el motivo y un aviso visible de **Ir** o **No ir**.

Sin sesión, la vista redirige al login.

## 8. Criterios de aceptación (BDD)

### Escenario 1 — Registrar asistencia pasada

Dado que el usuario está logueado en Tío Yacu  
Cuando indica una fecha pasada y la cantidad de personas, y pulsa **Registrar asistencia**  
Entonces el sistema guarda el dato y lo muestra en el historial.

### Escenario 2 — Predecir una fecha futura con clima

Dado que hay historial guardado y el usuario está logueado  
Cuando elige una fecha futura y pulsa **Predecir**  
Entonces el sistema consulta el clima de Rioja y muestra personas estimadas, clima, motivo y si conviene **ir** o **no ir**.

### Escenario 2b — No ir si el día futuro tiene lluvia

Dado que el usuario está logueado  
Cuando predice una fecha futura cuyo pronóstico es lluvia  
Entonces el sistema muestra **No ir** y el texto de lluvia prevista.

### Escenario 3 — Ver asistencia anterior

Dado que existen registros guardados  
Cuando el usuario abre Tío Yacu  
Entonces ve la lista de fechas pasadas con su cantidad de personas.

### Escenario 4 — Sin sesión

Dado que no hay sesión activa  
Cuando intenta registrar, listar o predecir  
Entonces la API responde 401 y la interfaz vuelve al login.

## 9. Orden si apruebas

1. Implementar base, API, regla de predicción y vista.
2. Pruebas básicas, intermedias y avanzadas (WeatherAPI mockeada).
3. Mostrarte el resultado en local.
4. Desplegar en AWS EC2 solo cuando lo confirmes.
