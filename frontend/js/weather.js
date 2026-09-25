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
    const citiesGrid = document.getElementById('cities-grid');
    const rainEl = document.querySelector('.rain');

    if (rainEl && rainEl.children.length === 0) {
      rainEl.innerHTML = Array.from({ length: 40 }, () => '<span></span>').join('');
    }

    logoutBtn.addEventListener('click', () => logout(localStorage, redirectToLogin));

    function resetAtmosphere() {
      document.body.classList.remove(
        'theme-morning',
        'theme-afternoon',
        'theme-night',
        'sky-rain',
        'sky-cloudy',
        'sky-clear',
        'has-result'
      );
    }

    function applyAtmosphere(atmosphere) {
      resetAtmosphere();
      if (!atmosphere) return;
      document.body.classList.add('has-result');
      document.body.classList.add(`theme-${atmosphere.period || 'afternoon'}`);
      document.body.classList.add(`sky-${atmosphere.sky || 'clear'}`);
    }

    function showBoard() {
      resultEl.hidden = false;
      resultEl.classList.remove('weather-board');
      void resultEl.offsetWidth;
      resultEl.classList.add('weather-board');
    }

    function renderRows(items) {
      citiesGrid.hidden = false;
      citiesGrid.innerHTML = `
        <table class="results-table">
          <thead>
            <tr>
              <th>Ciudad</th>
              <th>Temperatura</th>
              <th>Estado</th>
              <th>Humedad</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map(
                (item) => `
              <tr>
                <td>
                  <strong>${item.city || item.location}</strong>
                  ${item.region && item.region !== item.city ? `<span>${item.region}</span>` : ''}
                </td>
                <td>${item.temperature}</td>
                <td>${item.condition}</td>
                <td>${item.humidity}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      `;
    }

    function renderResults(data) {
      const cities = Array.isArray(data.cities) ? data.cities : [data];
      const atmosphere = data.atmosphere || {
        period: data.period,
        sky: data.sky,
        localtime: data.localtime,
      };

      document.getElementById('result-location').textContent = data.cities
        ? 'Perú'
        : data.city || data.location;
      document.getElementById('result-summary').textContent = data.cities
        ? `${cities.length} lugares`
        : data.condition;

      renderRows(cities);
      applyAtmosphere(atmosphere);
      showBoard();
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const currentToken = requireAuth(localStorage, redirectToLogin);
      if (!currentToken) return;

      const location = document.getElementById('location').value.trim() || 'Peru';
      errorEl.hidden = true;
      resultEl.hidden = true;
      loadingEl.hidden = false;
      consultBtn.disabled = true;
      consultBtn.textContent = 'Consultando…';
      resetAtmosphere();

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

        renderResults(data);
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
        resetAtmosphere();
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
