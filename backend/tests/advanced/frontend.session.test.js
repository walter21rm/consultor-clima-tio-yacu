const {
  TOKEN_KEY,
  getToken,
  requireAuth,
  logout,
  saveToken,
} = require('../../../frontend/js/session');

function createMemoryStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    },
  };
}

describe('[Avanzado] Sesión en frontend (guardas BDD)', () => {
  test('requireAuth redirige a login si no hay token', () => {
    const storage = createMemoryStorage();
    const redirect = jest.fn();

    const token = requireAuth(storage, redirect);

    expect(token).toBeNull();
    expect(redirect).toHaveBeenCalledWith('index.html');
  });

  test('requireAuth permite continuar con sesión activa', () => {
    const storage = createMemoryStorage({ [TOKEN_KEY]: 'jwt-demo' });
    const redirect = jest.fn();

    const token = requireAuth(storage, redirect);

    expect(token).toBe('jwt-demo');
    expect(redirect).not.toHaveBeenCalled();
  });

  test('logout limpia el token y redirige al login', () => {
    const storage = createMemoryStorage({ [TOKEN_KEY]: 'jwt-demo' });
    const redirect = jest.fn();

    logout(storage, redirect);

    expect(getToken(storage)).toBeNull();
    expect(redirect).toHaveBeenCalledWith('index.html');
  });

  test('saveToken persiste el JWT para consultas posteriores', () => {
    const storage = createMemoryStorage();

    saveToken(storage, 'nuevo-token');

    expect(getToken(storage)).toBe('nuevo-token');
  });
});
