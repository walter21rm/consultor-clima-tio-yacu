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

function translateCondition(text) {
  if (!text) return 'Desconocido';
  return CONDITION_ES[text] || text;
}

async function getWeatherByLocation(location) {
  const apiKey = process.env.WEATHER_API_KEY;

  if (!apiKey || apiKey === 'tu_api_key_de_weatherapi') {
    const error = new Error(
      'WEATHER_API_KEY no configurada. Obtén una en https://www.weatherapi.com/'
    );
    error.status = 500;
    throw error;
  }

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

  const data = await response.json();
  const conditionText =
    data.current?.condition?.text || translateCondition(data.current?.condition?.text);

  return {
    location: data.location?.name || location,
    temperature: `${Math.round(data.current.temp_c)}°C`,
    condition: conditionText,
    humidity: `${data.current.humidity}%`,
  };
}

module.exports = { getWeatherByLocation, translateCondition };
