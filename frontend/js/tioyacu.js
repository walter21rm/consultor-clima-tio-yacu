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

    const errorEl = document.getElementById('tioyacu-error');
    const resultEl = document.getElementById('prediction-result');
    const adviceEl = document.getElementById('advice');
    const historyEl = document.getElementById('history');
    const metricsEl = document.getElementById('result-metrics');

    document.getElementById('logout-btn').addEventListener('click', () => {
      logout(localStorage, redirectToLogin);
    });

    function showError(message) {
      errorEl.textContent = message;
      errorEl.hidden = !message;
    }

    async function api(path, options = {}) {
      const currentToken = requireAuth(localStorage, redirectToLogin);
      if (!currentToken) return null;
      const response = await fetch(path, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`,
          ...(options.headers || {}),
        },
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        logout(localStorage, redirectToLogin);
        return null;
      }
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo completar la operación.');
      }
      return data;
    }

    function renderHistory(records) {
      if (!records.length) {
        historyEl.innerHTML = '<p class="lead">Aún no hay asistencias registradas.</p>';
        return;
      }
      historyEl.innerHTML = `
        <table class="results-table">
          <thead>
            <tr><th>Fecha</th><th>Personas</th></tr>
          </thead>
          <tbody>
            ${records
              .map(
                (record) =>
                  `<tr><td>${record.date}</td><td>${record.attendees}</td></tr>`
              )
              .join('')}
          </tbody>
        </table>
      `;
    }

    async function loadHistory() {
      const data = await api('/api/v1/tioyacu/attendance');
      if (data) renderHistory(data.records || []);
    }

    function showResult(data) {
      resultEl.hidden = false;
      document.getElementById('result-count').textContent =
        data.source === 'registrado'
          ? `${data.estimatedAttendees} personas registradas`
          : `${data.estimatedAttendees} personas estimadas`;
      document.getElementById('result-reason').textContent = data.reason || '';

      if (data.advice) {
        adviceEl.hidden = false;
        adviceEl.textContent = data.advice === 'ir' ? 'Ir' : 'No ir';
        adviceEl.className = `advice ${data.advice === 'ir' ? 'go' : 'stop'}`;
        document.getElementById('result-reason').textContent = `${data.adviceText} ${data.reason || ''}`.trim();
      } else {
        adviceEl.hidden = true;
      }

      if (data.weather) {
        metricsEl.hidden = false;
        document.getElementById('result-temperature').textContent = data.weather.temperature;
        document.getElementById('result-condition').textContent = data.weather.condition;
        document.getElementById('result-humidity').textContent = data.weather.humidity;
      } else {
        metricsEl.hidden = true;
      }
    }

    document.getElementById('save-btn').addEventListener('click', async () => {
      showError('');
      resultEl.hidden = true;
      try {
        const attendees = document.getElementById('attendees').value;
        await api('/api/v1/tioyacu/attendance', {
          method: 'POST',
          body: JSON.stringify({
            date: document.getElementById('visit-date').value,
            attendees: attendees === '' ? null : Number(attendees),
          }),
        });
        await loadHistory();
      } catch (err) {
        showError(err.message);
      }
    });

    document.getElementById('predict-btn').addEventListener('click', async () => {
      showError('');
      resultEl.hidden = true;
      try {
        const date = document.getElementById('visit-date').value;
        const data = await api(`/api/v1/tioyacu/prediction?date=${encodeURIComponent(date)}`);
        if (data) showResult(data);
      } catch (err) {
        showError(err.message);
      }
    });

    loadHistory().catch((err) => showError(err.message));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
