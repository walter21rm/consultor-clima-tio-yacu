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
    expect(translateCondition('Rare aurora')).toBe('Rare aurora');
    expect(translateCondition('')).toBe('Desconocido');
  });

  test('falla con 500 si falta WEATHER_API_KEY', async () => {
    process.env.WEATHER_API_KEY = 'tu_api_key_de_weatherapi';

    await expect(getWeatherByLocation('Peru')).rejects.toMatchObject({
      status: 500,
      message: expect.stringMatching(/WEATHER_API_KEY/i),
    });
  });

  test('redondea temperatura y formatea humedad', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        location: { name: 'Madrid' },
        current: {
          temp_c: 19.6,
          humidity: 55,
          condition: { text: 'Soleado' },
        },
      }),
    });

    const result = await getWeatherByLocation('Spain');

    expect(result).toEqual({
      location: 'Madrid',
      temperature: '20°C',
      condition: 'Soleado',
      humidity: '55%',
    });

    const calledUrl = String(global.fetch.mock.calls[0][0]);
    expect(calledUrl).toContain('q=Spain');
    expect(calledUrl).toContain('lang=es');
  });
});
