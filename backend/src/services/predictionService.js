const { findOfficialMonth, SOURCE } = require('../db/attendanceDb');

const PLACE = 'Tío Yacu';
const LOCATION_LABEL = 'Rioja';
const FORECAST_QUERY = 'Rioja, Peru';
const RIOJA = { latitude: -6.0609, longitude: -77.168 };

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

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function classifyWeather(condition, temperature) {
  const value = String(condition || '').toLowerCase();
  const rain = /lluvia|lloviz|tormenta|chubasco|rain|drizzle|thunder|storm/.test(value);
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

function conditionFromCode(code, precipitation) {
  if (precipitation >= 1 || [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) {
    return 'Lluvia';
  }
  if ([95, 96, 99].includes(code)) return 'Tormenta';
  if ([45, 48].includes(code)) return 'Niebla';
  if (code === 0) return 'Despejado';
  if (code === 1 || code === 2) return 'Parcialmente nublado';
  if (code === 3) return 'Nublado';
  return 'Nublado';
}

function dayWeight(date, weather) {
  let weight = isWeekend(date) ? 1.35 : 1;
  const flags = classifyWeather(weather.condition, weather.tempC);
  if (flags.rain) weight *= 0.65;
  else if (flags.cloudy) weight *= 0.9;
  else if (flags.sunny) weight *= 1.1;
  return weight;
}

function distributeMonth(total, days) {
  const weights = days.map((day) => dayWeight(day.date, day.weather));
  const sum = weights.reduce((acc, value) => acc + value, 0);
  const raw = weights.map((weight) => (total * weight) / sum);
  const counts = raw.map((value) => Math.floor(value));
  let remainder = total - counts.reduce((acc, value) => acc + value, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - counts[index] }))
    .sort((a, b) => b.fraction - a.fraction);
  for (let index = 0; index < remainder; index += 1) {
    counts[order[index].index] += 1;
  }
  return counts;
}

function estimateAttendees(base, flags) {
  let factor = 1;
  if (flags.rain) factor *= 0.65;
  else if (flags.cloudy) factor *= 0.9;
  else if (flags.sunny) factor *= 1.15;
  if (flags.cold) factor *= 0.9;
  if (flags.hot) factor *= 0.95;
  if (flags.weekendBoost) factor *= 1.15;
  return Math.max(0, Math.round(base * factor));
}

function buildReason(flags) {
  if (flags.weekendBoost && flags.sunny) {
    return 'Fin de semana y día soleado: se espera más visita que el promedio del mes.';
  }
  if (flags.rain) {
    return 'Hay lluvia prevista: se espera menos visita que el promedio del mes.';
  }
  if (flags.weekendBoost) {
    return 'Es fin de semana: se espera más visita que el promedio del mes.';
  }
  if (flags.sunny) {
    return 'Día soleado: se espera más visita que el promedio del mes.';
  }
  if (flags.cloudy) {
    return 'Día nublado: se espera un poco menos de visita que el promedio del mes.';
  }
  return 'Se usa el promedio diario del mes oficial más cercano.';
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
    condition: String(day.condition?.text || 'Desconocido')
      .replace(/chubascos?\s+ligeros?/gi, 'Lluvia ligera')
      .replace(/chubascos?/gi, (match) =>
        match[0] === match[0].toUpperCase() ? 'Lluvia' : 'lluvia'
      ),
    humidity: `${day.avghumidity}%`,
  };
}

async function fetchHistoricalMonth(year, month) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth(year, month)).padStart(2, '0')}`;
  const url = new URL('https://archive-api.open-meteo.com/v1/archive');
  url.searchParams.set('latitude', String(RIOJA.latitude));
  url.searchParams.set('longitude', String(RIOJA.longitude));
  url.searchParams.set('start_date', start);
  url.searchParams.set('end_date', end);
  url.searchParams.set(
    'daily',
    'weather_code,temperature_2m_mean,relative_humidity_2m_mean,precipitation_sum'
  );
  url.searchParams.set('timezone', 'America/Lima');

  const response = await fetch(url);
  if (!response.ok) {
    const error = new Error('No se pudo consultar el clima histórico de Rioja.');
    error.status = 502;
    throw error;
  }

  const data = await response.json();
  const times = data.daily?.time || [];
  if (times.length !== daysInMonth(year, month)) {
    const error = new Error('No hay clima histórico para ese mes.');
    error.status = 502;
    throw error;
  }

  return times.map((time, index) => {
    const precipitation = data.daily.precipitation_sum[index] ?? 0;
    const code = data.daily.weather_code[index];
    const tempC = data.daily.temperature_2m_mean[index];
    const humidity = data.daily.relative_humidity_2m_mean[index];
    return {
      date: parseDate(time),
      iso: time,
      weather: {
        temperature: `${Math.round(tempC)}°C`,
        tempC,
        condition: conditionFromCode(code, precipitation),
        humidity: `${Math.round(humidity)}%`,
      },
    };
  });
}

async function consultDate(dateValue) {
  const date = parseDate(dateValue);
  if (!date) {
    const error = new Error('La fecha es inválida. Usa el formato YYYY-MM-DD.');
    error.status = 400;
    throw error;
  }

  const iso = formatDate(date);
  const official = findOfficialMonth(date.getMonth() + 1);
  if (!official) {
    const error = new Error('No hay un total oficial para ese mes.');
    error.status = 404;
    throw error;
  }

  if (date < todayDate()) {
    const monthDays = await fetchHistoricalMonth(date.getFullYear(), date.getMonth() + 1);
    const counts = distributeMonth(official.visitors, monthDays);
    const index = monthDays.findIndex((day) => day.iso === iso);
    if (index < 0) {
      const error = new Error('No hay clima histórico para esa fecha.');
      error.status = 502;
      throw error;
    }

    const sameYear = official.year === date.getFullYear();
    return {
      place: PLACE,
      location: LOCATION_LABEL,
      date: iso,
      kind: 'pasado',
      attendees: counts[index],
      weather: {
        temperature: monthDays[index].weather.temperature,
        condition: monthDays[index].weather.condition,
        humidity: monthDays[index].weather.humidity,
      },
      officialMonth: {
        year: official.year,
        month: official.month,
        visitors: official.visitors,
        source: SOURCE,
      },
      note: sameYear
        ? `La asistencia del día reparte el total oficial de ese mes (${official.visitors} visitantes) según el clima real. No hay conteo diario publicado.`
        : `Aún no hay total oficial de ${date.getFullYear()}. La asistencia del día reparte el total de ${monthName(official.month)} ${official.year} (${official.visitors} visitantes, ${SOURCE}) según el clima real de la fecha elegida.`,
    };
  }

  const weather = await fetchForecast(iso);
  const flags = {
    ...classifyWeather(weather.condition, weather.tempC),
    weekendBoost: isWeekend(date),
  };
  const base = official.visitors / daysInMonth(official.year, official.month);
  const advice = buildAdvice(flags);

  return {
    place: PLACE,
    location: LOCATION_LABEL,
    date: iso,
    kind: 'futuro',
    estimatedAttendees: estimateAttendees(base, flags),
    advice: advice.advice,
    adviceText: advice.adviceText,
    weather: {
      temperature: weather.temperature,
      condition: weather.condition,
      humidity: weather.humidity,
    },
    reason: buildReason(flags),
    officialMonth: {
      year: official.year,
      month: official.month,
      visitors: official.visitors,
      source: SOURCE,
    },
  };
}

function monthName(month) {
  return [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'setiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ][month - 1];
}

module.exports = {
  parseDate,
  formatDate,
  todayDate,
  consultDate,
  distributeMonth,
  conditionFromCode,
};
