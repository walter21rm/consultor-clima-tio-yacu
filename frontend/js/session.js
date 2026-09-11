const TOKEN_KEY = 'consultor_clima_token';

function getToken(storage) {
  try {
    return storage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function requireAuth(storage, redirect) {
  const token = getToken(storage);
  if (!token) {
    redirect('index.html');
    return null;
  }
  return token;
}

function logout(storage, redirect) {
  try {
    storage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
  redirect('index.html');
}

function saveToken(storage, token) {
  storage.setItem(TOKEN_KEY, token);
}

const ConsultorSession = {
  TOKEN_KEY,
  getToken,
  requireAuth,
  logout,
  saveToken,
};

// En el navegador siempre exponemos window (evitar module.exports que rompe algunos previews).
if (typeof window !== 'undefined') {
  window.ConsultorSession = ConsultorSession;
}

// Solo CommonJS puro (Jest/Node), no en browser.
if (typeof window === 'undefined' && typeof module === 'object' && module.exports) {
  module.exports = ConsultorSession;
}
