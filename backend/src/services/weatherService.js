const CONDITION_ES = {
  Clear: 'Despejado',
  Sunny: 'Soleado',
  'Partly cloudy': 'Parcialmente nublado',
  Cloudy: 'Nublado',
  Overcast: 'Cubierto',
  Mist: 'Neblina',
  'Patchy rain possible': 'Posible lluvia dispersa',
  'Patchy snow possible': 'Posible nieve dispersa',
  'Thundery outbreaks possible': 'Posibles tormentas',
  Fog: 'Niebla',
  'Light rain': 'Lluvia ligera',
  'Moderate rain': 'Lluvia moderada',
  'Heavy rain': 'Lluvia intensa',
  'Light snow': 'Nieve ligera',
  'Moderate snow': 'Nieve moderada',
  'Heavy snow': 'Nieve intensa',
};

const PERU_CITIES = [
  { label: 'Chachapoyas', query: 'Chachapoyas, Peru' },
  { label: 'Huaraz', query: 'Huaraz, Peru' },
  { label: 'Abancay', query: 'Abancay, Peru' },
  { label: 'Arequipa', query: 'Arequipa, Peru' },
  { label: 'Ayacucho', query: 'Ayacucho, Peru' },
  { label: 'Cajamarca', query: 'Cajamarca, Peru' },
  { label: 'Callao', query: 'Callao, Peru' },
  { label: 'Cusco', query: 'Cusco, Peru' },
  { label: 'Huancavelica', query: 'Huancavelica, Peru' },
  { label: 'Huanuco', query: 'Huanuco, Peru' },
  { label: 'Ica', query: 'Ica, Peru' },
  { label: 'Huancayo', query: 'Huancayo, Peru' },
  { label: 'Trujillo', query: 'Trujillo, Peru' },
  { label: 'Chiclayo', query: 'Chiclayo, Peru' },
  { label: 'Lima', query: 'Lima, Peru' },
  { label: 'Iquitos', query: 'Iquitos, Peru' },
  { label: 'Puerto Maldonado', query: 'Puerto Maldonado, Peru' },
  { label: 'Moquegua', query: 'Moquegua, Peru' },
  { label: 'Cerro de Pasco', query: 'Cerro de Pasco, Peru' },
  { label: 'Piura', query: 'Piura, Peru' },
  { label: 'Puno', query: 'Puno, Peru' },
  { label: 'Moyobamba', query: 'Moyobamba, Peru' },
  { label: 'Tacna', query: 'Tacna, Peru' },
  { label: 'Tumbes', query: 'Tumbes, Peru' },
  { label: 'Pucallpa', query: 'Pucallpa, Peru' },
];

function softenCondition(text) {
  return String(text || '').replace(/chubascos?/gi, (match) =>
    match[0] === match[0].toUpperCase() ? 'Lluvia' : 'lluvia'
  );
}

function translateCondition(text) {
  if (!text) return 'Desconocido';
  return softenCondition(CONDITION_ES[text] || text);
}

function isPeruCountry(location) {
  return /^(peru|perú)$/i.test(String(location || '').trim());
}

function isPeruCountryName(country) {
  return /peru|perú/i.test(String(country || ''));
}

function periodFromLocaltime(localtime) {
  const hour = Number(String(localtime || '').split(' ')[1]?.split(':')[0]);
  if (Number.isNaN(hour)) return 'afternoon';
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'night';
}

function skyFromCondition(text) {
  const value = String(text || '').toLowerCase();
  if (/rain|lluvia|drizzle|lloviz|storm|tormenta|thunder|chubasco/.test(value)) {
    return 'rain';
  }
  if (/cloud|nublad|overcast|cubierto|mist|neblina|fog|niebla/.test(value)) {
    return 'cloudy';
  }
  return 'clear';
}

function requireApiKey() {
  const apiKey = process.env.WEATHER_API_KEY;
  if (!apiKey || apiKey === 'tu_api_key_de_weatherapi') {
    const error = new Error(
      'WEATHER_API_KEY no configurada. Obtén una en https://www.weatherapi.com/'
    );
    error.status = 500;
    throw error;
  }
  return apiKey;
}

function mapCurrentWeather(data, fallbackLocation) {
  const conditionText = softenCondition(
    data.current?.condition?.text || translateCondition(data.current?.condition?.text)
  );
  const localtime = data.location?.localtime || '';

  return {
    location: data.location?.name || fallbackLocation,
    city: data.location?.name || fallbackLocation,
    region: data.location?.region || '',
    country: data.location?.country || '',
    temperature: `${Math.round(data.current.temp_c)}°C`,
    condition: conditionText,
    humidity: `${data.current.humidity}%`,
    localtime,
    period: periodFromLocaltime(localtime),
    sky: skyFromCondition(conditionText),
  };
}

function atmosphereFromCities(cities) {
  const lima = cities.find((item) => /lima/i.test(item.city));
  const source = lima || cities[0];
  return {
    period: source?.period || 'afternoon',
    sky: source?.sky || 'clear',
    localtime: source?.localtime || '',
  };
}

async function fetchCurrent(location) {
  const apiKey = requireApiKey();
  const url = new URL('https://api.weatherapi.com/v1/current.json');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('q', location);
  url.searchParams.set('lang', 'es');

  const response = await fetch(url);

  if (response.status === 400 || response.status === 404) {
    const error = new Error('Ubicación no encontrada.');
    error.status = 404;
    throw error;
  }

  if (!response.ok) {
    const error = new Error('Error al consultar el proveedor del clima.');
    error.status = 502;
    throw error;
  }

  return response.json();
}

async function searchLocations(query) {
  const apiKey = requireApiKey();
  const url = new URL('https://api.weatherapi.com/v1/search.json');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('q', query);

  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

async function getWeatherForQueries(queries) {
  const settled = await Promise.allSettled(
    queries.map(async (item) => {
      const data = await fetchCurrent(item.query);
      const mapped = mapCurrentWeather(data, item.label);
      if (item.requirePeru && !isPeruCountryName(mapped.country)) {
        const error = new Error(`La ubicación ${item.label} no pertenece a Perú.`);
        error.status = 404;
        throw error;
      }
      return mapped;
    })
  );

  return settled.filter((item) => item.status === 'fulfilled').map((item) => item.value);
}

async function getWeatherForPeruCities() {
  const cities = await getWeatherForQueries(
    PERU_CITIES.map((city) => ({ ...city, requirePeru: true }))
  );

  if (cities.length === 0) {
    const error = new Error('No se pudieron identificar ciudades de Perú.');
    error.status = 502;
    throw error;
  }

  return {
    location: 'Perú',
    country: 'Peru',
    atmosphere: atmosphereFromCities(cities),
    cities,
  };
}

async function getWeatherByLocation(location) {
  const query = String(location || '').trim();

  if (!query || isPeruCountry(query)) {
    return getWeatherForPeruCities();
  }

  const matches = (await searchLocations(query)).filter((item) =>
    isPeruCountryName(item.country)
  );

  if (matches.length > 0) {
    const cities = await getWeatherForQueries(
      matches.slice(0, 12).map((item) => ({
        label: item.name,
        query: `${item.lat},${item.lon}`,
        requirePeru: true,
      }))
    );

    if (cities.length === 1) {
      return { ...cities[0], atmosphere: { period: cities[0].period, sky: cities[0].sky, localtime: cities[0].localtime } };
    }

    if (cities.length > 1) {
      return {
        location: query,
        country: 'Peru',
        atmosphere: atmosphereFromCities(cities),
        cities,
      };
    }
  }

  const known = PERU_CITIES.find((city) => city.label.toLowerCase() === query.toLowerCase());
  const data = await fetchCurrent(known ? known.query : `${query}, Peru`);
  const mapped = mapCurrentWeather(data, query);
  return {
    ...mapped,
    atmosphere: {
      period: mapped.period,
      sky: mapped.sky,
      localtime: mapped.localtime,
    },
  };
}

module.exports = {
  getWeatherByLocation,
  getWeatherForPeruCities,
  translateCondition,
  periodFromLocaltime,
  skyFromCondition,
  isPeruCountry,
  PERU_CITIES,
};
