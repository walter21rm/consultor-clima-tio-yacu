const { findAttendance, listAttendance } = require('../db/attendanceDb');

const PLACE = 'Tío Yacu';
const LOCATION_LABEL = 'Rioja';
const FORECAST_QUERY = 'Rioja, Peru';

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function formatDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function todayDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function classifyWeather(condition, temperature) {
  const value = String(condition || '').toLowerCase();
  const rain = /lluvia|lloviz|tormenta|rain|drizzle|thunder|storm/.test(value);
  const cloudy =
    !rain && /nublad|cubiert|neblina|niebla|cloud|overcast|mist|fog/.test(value);
  const sunny = !rain && !cloudy && /soleado|despejado|sunny|clear/.test(value);
  return {
    rain,
    cloudy,
    sunny,
    cold: temperature < 18,
    hot: temperature > 30,
    veryCold: temperature < 16,
  };
}

function averageOf(records, weekend) {
  const subset = records.filter(
    (record) => isWeekend(parseDate(record.date)) === weekend
  );
  if (subset.length === 0) return null;
  const total = subset.reduce((sum, record) => sum + record.attendees, 0);
  return total / subset.length;
}

function baseFor(date, records) {
  const weekend = isWeekend(date);
  const sameType = averageOf(records, weekend);
  if (sameType != null) {
    return { base: sameType, weekendBoost: false };
  }

  if (weekend) {
    const weekdays = averageOf(records, false);
    if (weekdays != null) {
      return { base: weekdays, weekendBoost: true };
    }
    return { base: 140, weekendBoost: false };
  }

  return { base: 80, weekendBoost: false };
}

function estimateAttendees(base, flags) {
  let factor = 1;
  if (flags.rain) factor *= 0.65;
  else if (flags.cloudy) factor *= 0.9;
  else if (flags.sunny) factor *= 1.15;
  if (flags.cold) factor *= 0.9;
  if (flags.hot) factor *= 0.95;
  if (flags.weekendBoost) factor *= 1.25;
  return Math.max(0, Math.round(base * factor));
}

function buildReason(flags) {
  if (flags.weekendBoost && flags.sunny) {
    return 'Fin de semana y día soleado: se espera más visita que el promedio.';
  }
  if (flags.rain) {
    return 'Hay lluvia prevista: se espera menos visita que el promedio.';
  }
  if (flags.weekendBoost) {
    return 'Es fin de semana: se espera más visita que el promedio de días de semana.';
  }
  if (flags.sunny) {
    return 'Día soleado: se espera más visita que el promedio.';
  }
  if (flags.cloudy) {
    return 'Día nublado: se espera un poco menos de visita que el promedio.';
  }
  if (flags.veryCold || flags.cold) {
    return 'Temperatura baja: se espera menos visita que el promedio.';
  }
  if (flags.hot) {
    return 'Temperatura alta: se espera un poco menos de visita que el promedio.';
  }
  return 'Se usa el promedio de asistencia de días similares.';
}

function buildAdvice(flags) {
  if (flags.rain) {
    return {
      advice: 'no ir',
      adviceText: 'Hay lluvia prevista: no conviene ir a Tío Yacu.',
    };
  }
  if (flags.veryCold) {
    return {
      advice: 'no ir',
      adviceText: 'La temperatura es muy baja: no conviene ir a Tío Yacu.',
    };
  }
  return {
    advice: 'ir',
    adviceText: 'El clima permite la visita: conviene ir a Tío Yacu.',
  };
}

async function fetchForecast(date) {
  const apiKey = process.env.WEATHER_API_KEY;
  if (!apiKey || apiKey === 'tu_api_key_de_weatherapi') {
    const error = new Error('WEATHER_API_KEY no configurada.');
    error.status = 500;
    throw error;
  }

  const url = new URL('https://api.weatherapi.com/v1/forecast.json');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('q', FORECAST_QUERY);
  url.searchParams.set('days', '14');
  url.searchParams.set('dt', date);
  url.searchParams.set('lang', 'es');

  const response = await fetch(url);
  if (!response.ok) {
    const error = new Error('No hay pronóstico disponible para esa fecha.');
    error.status = 502;
    throw error;
  }

  const data = await response.json();
  const day = data.forecast?.forecastday?.[0]?.day;
  if (!day) {
    const error = new Error('No hay pronóstico disponible para esa fecha.');
    error.status = 502;
    throw error;
  }

  return {
    temperature: `${Math.round(day.avgtemp_c)}°C`,
    tempC: day.avgtemp_c,
    condition: day.condition?.text || 'Desconocido',
    humidity: `${day.avghumidity}%`,
  };
}

async function predictAttendance(dateValue) {
  const date = parseDate(dateValue);
  if (!date) {
    const error = new Error('La fecha es inválida. Usa el formato YYYY-MM-DD.');
    error.status = 400;
    throw error;
  }

  const iso = formatDate(date);
  if (date < todayDate()) {
    const saved = findAttendance(iso);
    if (!saved) {
      const error = new Error('No hay asistencia registrada para esa fecha.');
      error.status = 404;
      throw error;
    }
    return {
      place: PLACE,
      location: LOCATION_LABEL,
      date: iso,
      estimatedAttendees: saved.attendees,
      source: 'registrado',
    };
  }

  const weather = await fetchForecast(iso);
  const flags = {
    ...classifyWeather(weather.condition, weather.tempC),
    weekendBoost: false,
  };
  const { base, weekendBoost } = baseFor(date, listAttendance());
  flags.weekendBoost = weekendBoost;
  const advice = buildAdvice(flags);

  return {
    place: PLACE,
    location: LOCATION_LABEL,
    date: iso,
    estimatedAttendees: estimateAttendees(base, flags),
    advice: advice.advice,
    adviceText: advice.adviceText,
    weather: {
      temperature: weather.temperature,
      condition: weather.condition,
      humidity: weather.humidity,
    },
    reason: buildReason(flags),
    source: 'prediccion',
  };
}

module.exports = {
  parseDate,
  formatDate,
  todayDate,
  predictAttendance,
  estimateAttendees,
  baseFor,
  classifyWeather,
};
