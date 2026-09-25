# Consultor de Clima

Aplicación web para el curso **Desarrollo de aplicaciones para la nube**.
Permite a un usuario autenticado consultar el clima de un país o región mediante **WeatherAPI**.

## Características

- Login con **JWT** (sesión activa requerida).
- Vista de consulta con menú desplegable de países/regiones y botón **Consultar**.
- Endpoint `GET /api/v1/weather?location={nombre}` protegido con `Authorization: Bearer <token>`.
- Respuesta con temperatura, estado y humedad.
- Frontend estático servido por Express.

## Requisitos previos

1. Node.js 18 o superior.
2. Cuenta gratuita en [WeatherAPI](https://www.weatherapi.com/) y tu API key.
3. (Opcional) Cuenta en Render, Railway o Azure App Service para desplegar en la nube.

## Configuración

```bash
cd backend
copy .env.example .env
```

Edita `backend/.env`:

```env
PORT=3000
JWT_SECRET=cambia_este_secreto_en_produccion
DEMO_USER=admin
DEMO_PASSWORD=admin123
WEATHER_API_KEY=tu_api_key_real
```

## Instalación y ejecución local

```bash
npm run install:all
npm start
```

Abre [http://localhost:3000](http://localhost:3000).

Credenciales demo: `admin` / `admin123`.

## Tío Yacu

Tras iniciar sesión, abre **Tío Yacu** para:

- registrar cuánta gente asistió en una fecha pasada;
- ver ese historial;
- predecir la asistencia de una fecha futura según el clima de Rioja;
- ver si conviene **ir** o **no ir**.

La especificación está en [docs/sdd-tio-yacu.md](docs/sdd-tio-yacu.md). Los registros se guardan en SQLite (`backend/data/tioyacu.db`).

## Pruebas automatizadas

La suite está en `backend/tests/` y se divide en tres niveles:

| Nivel | Carpeta | Qué cubre |
|-------|---------|-----------|
| Básico | `tests/basic` | Health, páginas estáticas, login |
| Intermedio | `tests/intermediate` | JWT, contrato `/api/v1/weather`, errores 400/404/502 |
| Avanzado | `tests/advanced` | Escenarios BDD, `weatherService`, guardas de sesión del frontend |

```bash
npm test                 # toda la suite
npm run test:basic
npm run test:intermediate
npm run test:advanced
```

Las pruebas del clima **mockean WeatherAPI** (no consumen tu cuota).

## API

### Login

`POST /api/v1/auth/login`

```json
{ "username": "admin", "password": "admin123" }
```

Respuesta:

```json
{ "token": "<jwt>" }
```

### Clima

`GET /api/v1/weather?location=Peru`

Headers:

```http
Authorization: Bearer <token_jwt>
```

Respuesta 200:

```json
{
  "location": "Peru",
  "temperature": "24°C",
  "condition": "Despejado",
  "humidity": "60%"
}
```

Errores:

| Código | Caso |
|--------|------|
| 400 | Falta `location` |
| 401 | Sin token o token inválido |
| 404 | Ubicación no encontrada |
| 502 | Fallo del proveedor externo |

## Criterios BDD / Gherkin

### Escenario 1 — Consulta exitosa

**Dado** que el usuario está logueado y en la vista de consulta meteorológica  
**Cuando** selecciona un país o región y pulsa **Consultar**  
**Entonces** el sistema muestra temperatura, estado y humedad de esa ubicación.

### Escenario 2 — Sin sesión activa

**Dado** un usuario sin autenticar  
**Cuando** intenta abrir la consulta o llamar a la API de clima  
**Entonces** la UI redirige al login y la API responde 401.

## Estructura

```
consultor-clima/
  backend/
    src/
      index.js
      routes/auth.js
      routes/weather.js
      middleware/auth.js
      services/weatherService.js
    .env.example
  frontend/
    index.html
    weather.html
    css/styles.css
    js/auth.js
    js/weather.js
  README.md
```

## Deploy en AWS EC2

Desde la raíz del proyecto (requiere AWS CLI autenticado y `backend/.env` con tu `WEATHER_API_KEY`):

```powershell
.\deploy\aws\deploy.ps1
```

El script crea una instancia **t3.micro** (Amazon Linux 2023) en `us-east-1`, abre HTTP :80, instala Node + nginx y publica la app.

Para terminar la instancia y evitar cargos:

```powershell
.\deploy\aws\teardown.ps1
```

## Deploy en la nube (Render)

1. Sube el repositorio a GitHub.
2. En Render: **New Web Service** → conecta el repo.
3. Root Directory: `backend` (o deja la raíz y usa `npm start`).
4. Build: `npm install`
5. Start: `npm start`
6. Variables de entorno en el panel de Render:
   - `WEATHER_API_KEY`
   - `JWT_SECRET`
   - `DEMO_USER` / `DEMO_PASSWORD` (opcional)
   - `PORT` lo asigna Render automáticamente; Express ya usa `process.env.PORT`.

En Railway o Azure App Service el flujo es equivalente: build Node, start `npm start`, secrets en el hosting.

## Entregables sugeridos del curso

- Capturas: login, consulta exitosa, redirección sin auth.
- URL pública del servicio desplegado.
- Explicación breve: JWT, integración WeatherAPI, secretos en variables de entorno.
