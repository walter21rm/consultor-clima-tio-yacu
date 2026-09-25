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

    const captions = ['Puente y poza natural', 'El río bajo el puente'];
    const slides = Array.from(document.querySelectorAll('.place-slide'));
    const dots = Array.from(document.querySelectorAll('.place-dot'));
    const captionEl = document.getElementById('place-caption');
    let slideIndex = 0;
    let slideTimer;

    function showSlide(next) {
      slides[slideIndex].classList.remove('is-active');
      slides[slideIndex].setAttribute('aria-hidden', 'true');
      dots[slideIndex].classList.remove('is-active');
      dots[slideIndex].setAttribute('aria-selected', 'false');
      slideIndex = next;
      slides[slideIndex].classList.add('is-active');
      slides[slideIndex].setAttribute('aria-hidden', 'false');
      dots[slideIndex].classList.add('is-active');
      dots[slideIndex].setAttribute('aria-selected', 'true');
      if (captionEl) captionEl.textContent = captions[slideIndex];
    }

    function startSlides() {
      clearInterval(slideTimer);
      slideTimer = setInterval(() => showSlide((slideIndex + 1) % slides.length), 6500);
    }

    slides.forEach((slide, index) => {
      slide.setAttribute('aria-hidden', index === 0 ? 'false' : 'true');
    });
    dots.forEach((dot, index) => {
      dot.addEventListener('click', () => {
        showSlide(index);
        startSlides();
      });
    });
    if (slides.length > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      startSlides();
    }

    const form = document.getElementById('tioyacu-form');
    const errorEl = document.getElementById('tioyacu-error');
    const resultEl = document.getElementById('prediction-result');
    const adviceEl = document.getElementById('advice');
    const metricsEl = document.getElementById('result-metrics');
    const consultBtn = document.getElementById('consult-btn');

    document.getElementById('logout-btn').addEventListener('click', () => {
      logout(localStorage, redirectToLogin);
    });

    function showError(message) {
      errorEl.textContent = message;
      errorEl.hidden = !message;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      showError('');
      resultEl.hidden = true;

      const currentToken = requireAuth(localStorage, redirectToLogin);
      if (!currentToken) return;

      const date = document.getElementById('visit-date').value;
      if (!date) {
        showError('Elige una fecha.');
        return;
      }

      consultBtn.disabled = true;
      consultBtn.textContent = 'Consultando…';

      try {
        const response = await fetch(`/api/v1/tioyacu/consult?date=${encodeURIComponent(date)}`, {
          headers: { Authorization: `Bearer ${currentToken}` },
        });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) {
          logout(localStorage, redirectToLogin);
          return;
        }
        if (!response.ok) {
          throw new Error(data.error || 'No se pudo consultar la fecha.');
        }

        const people = data.kind === 'pasado' ? data.attendees : data.estimatedAttendees;
        document.getElementById('result-count').textContent =
          data.kind === 'pasado'
            ? `${people} personas asistieron`
            : `${people} personas estimadas`;
        document.getElementById('result-reason').textContent = data.note || data.reason || '';
        document.getElementById('result-temperature').textContent = data.weather.temperature;
        document.getElementById('result-condition').textContent = data.weather.condition;
        document.getElementById('result-humidity').textContent = data.weather.humidity;
        metricsEl.hidden = false;

        if (data.advice) {
          adviceEl.hidden = false;
          adviceEl.textContent = data.advice === 'ir' ? 'Ir' : 'No ir';
          adviceEl.className = `advice ${data.advice === 'ir' ? 'go' : 'stop'}`;
          document.getElementById('result-reason').textContent = `${data.adviceText} ${data.reason || ''}`.trim();
        } else {
          adviceEl.hidden = true;
        }

        resultEl.hidden = false;
      } catch (err) {
        showError(err.message);
      } finally {
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
