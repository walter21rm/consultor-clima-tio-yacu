(function () {
  function boot() {
    if (!window.ConsultorSession) {
      window.location.replace('./index.html');
      return;
    }

    const { requireAuth, logout } = window.ConsultorSession;

    function redirectToLogin() {
      window.location.replace('./index.html');
    }

    const token = requireAuth(localStorage, redirectToLogin);
    if (!token) return;

    const form = document.getElementById('weather-form');
    const errorEl = document.getElementById('weather-error');
    const loadingEl = document.getElementById('weather-loading');
    const resultEl = document.getElementById('weather-result');
    const logoutBtn = document.getElementById('logout-btn');
    const consultBtn = document.getElementById('consult-btn');

    logoutBtn.addEventListener('click', () => logout(localStorage, redirectToLogin));

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const currentToken = requireAuth(localStorage, redirectToLogin);
      if (!currentToken) return;

      const location = document.getElementById('location').value;
      errorEl.hidden = true;
      resultEl.hidden = true;
      loadingEl.hidden = false;
      consultBtn.disabled = true;
      consultBtn.textContent = 'Consultando…';

      if (!location) {
        loadingEl.hidden = true;
        consultBtn.disabled = false;
        consultBtn.textContent = 'Consultar';
        errorEl.textContent = 'Selecciona un país o región.';
        errorEl.hidden = false;
        return;
      }

      try {
        const url = `/api/v1/weather?location=${encodeURIComponent(location)}`;
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        });

        let data = {};
        try {
          data = await response.json();
        } catch {
          throw new Error('Respuesta inválida del servidor.');
        }

        if (response.status === 401) {
          logout(localStorage, redirectToLogin);
          return;
        }

        if (!response.ok) {
          throw new Error(data.error || 'No se pudo obtener el clima.');
        }

        document.getElementById('result-location').textContent = data.location;
        document.getElementById('result-temperature').textContent = data.temperature;
        document.getElementById('result-condition').textContent = data.condition;
        document.getElementById('result-condition-copy').textContent = data.condition;
        document.getElementById('result-humidity').textContent = data.humidity;

        resultEl.hidden = false;
        resultEl.classList.remove('weather-board');
        void resultEl.offsetWidth;
        resultEl.classList.add('weather-board');
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
      } finally {
        loadingEl.hidden = true;
        consultBtn.disabled = false;
        consultBtn.textContent = 'Consultar';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
