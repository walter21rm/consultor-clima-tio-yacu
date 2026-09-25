const {
  getWeatherByLocation,
  translateCondition,
} = require('../../src/services/weatherService');

describe('[Avanzado] Servicio weatherService', () => {
  const originalKey = process.env.WEATHER_API_KEY;

  afterEach(() => {
    process.env.WEATHER_API_KEY = originalKey;
    jest.restoreAllMocks();
  });

  test('translateCondition traduce estados conocidos y conserva desconocidos', () => {
    expect(translateCondition('Sunny')).toBe('Soleado');
    expect(translateCondition('Clear')).toBe('Despejado');
    expect(translateCondition('Chubasco')).toBe('Lluvia');
    expect(translateCondition('Posibles chubascos')).toBe('Posibles lluvia');
    expect(translateCondition('Rare aurora')).toBe('Rare aurora');
    expect(translateCondition('')).toBe('Desconocido');
  });

  test('falla con 500 si falta WEATHER_API_KEY', async () => {
    process.env.WEATHER_API_KEY = 'tu_api_key_de_weatherapi';

    await expect(getWeatherByLocation('Mexico')).rejects.toMatchObject({
      status: 500,
      message: expect.stringMatching(/WEATHER_API_KEY/i),
    });
  });

  test('redondea temperatura y formatea humedad', async () => {
    global.fetch = jest.fn().mockImplementation(async (url) => {
      if (String(url).includes('search.json')) {
        return { ok: true, status: 200, json: async () => [] };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          location: { name: 'Madrid', localtime: '2026-09-22 16:00' },
          current: {
            temp_c: 19.6,
            humidity: 55,
            condition: { text: 'Soleado' },
          },
        }),
      };
    });

    const result = await getWeatherByLocation('Spain');

    expect(result).toEqual(
      expect.objectContaining({
        location: 'Madrid',
        city: 'Madrid',
        temperature: '20°C',
        condition: 'Soleado',
        humidity: '55%',
        period: 'afternoon',
        sky: 'clear',
      })
    );

    const currentCall = global.fetch.mock.calls.find(([url]) => String(url).includes('current.json'));
    expect(String(currentCall[0])).toContain('lang=es');
  });
});
