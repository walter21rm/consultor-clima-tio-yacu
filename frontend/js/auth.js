(function () {
  function boot() {
    if (!window.ConsultorSession) {
      const errorEl = document.getElementById('login-error');
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = 'Error cargando sesión. Recarga la página.';
      }
      return;
    }

    const { saveToken, getToken } = window.ConsultorSession;
    const form = document.getElementById('login-form');
    const errorEl = document.getElementById('login-error');
    const submitBtn = document.getElementById('login-submit');

    if (!form) return;

    const existing = getToken(localStorage);
    if (existing) {
      window.location.replace('./weather.html');
      return;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      errorEl.hidden = true;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Entrando…';

      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;

      try {
        const response = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });

        let data = {};
        try {
          data = await response.json();
        } catch {
          throw new Error('Respuesta inválida del servidor. ¿Está corriendo npm start?');
        }

        if (!response.ok) {
          throw new Error(data.error || 'No se pudo iniciar sesión.');
        }

        if (!data.token) {
          throw new Error('El servidor no devolvió un token.');
        }

        saveToken(localStorage, data.token);

        // Confirmar que quedó guardado antes de navegar
        if (!getToken(localStorage)) {
          throw new Error('No se pudo guardar la sesión en el navegador.');
        }

        window.location.assign('./weather.html');
      } catch (err) {
        errorEl.textContent = err.message || 'Error al iniciar sesión.';
        errorEl.hidden = false;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Iniciar sesión';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
