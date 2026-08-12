(function () {
  const form = document.querySelector('[data-contact-form]');
  if (!form) return;

  const status = form.querySelector('[data-form-status]');
  const submitButton = form.querySelector('button[type="submit"]');
  const startedAt = form.querySelector('input[name="startedAt"]');
  const topic = form.querySelector('select[name="topic"]');
  let turnstileWidgetId = null;

  startedAt.value = String(Date.now());

  if (topic) {
    const requestedTopic = new URLSearchParams(window.location.search).get('topic');
    if (requestedTopic && Array.from(topic.options).some(option => option.value === requestedTopic)) {
      topic.value = requestedTopic;
    }
  }

  function showStatus(message, isError) {
    status.textContent = message;
    status.classList.add('visible');
    status.classList.toggle('error', Boolean(isError));
    status.setAttribute('role', isError ? 'alert' : 'status');
  }

  function loadTurnstile(siteKey) {
    const container = form.querySelector('[data-turnstile]');
    if (!container || !siteKey) return;

    const renderWidget = function () {
      turnstileWidgetId = window.turnstile.render(container, {
        sitekey: siteKey,
        theme: 'light',
        size: 'flexible'
      });
    };

    if (window.turnstile) {
      renderWidget();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = renderWidget;
    document.head.appendChild(script);
  }

  fetch('/api/form-config')
    .then(response => response.ok ? response.json() : null)
    .then(config => {
      if (config && config.turnstileSiteKey) loadTurnstile(config.turnstileSiteKey);
    })
    .catch(() => {
      // The form can still be reviewed before optional Turnstile is configured.
    });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    status.classList.remove('visible', 'error');
    submitButton.disabled = true;
    submitButton.textContent = 'Sending…';

    const payload = Object.fromEntries(new FormData(form).entries());

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || 'Something went wrong. Please try again.');
      }

      form.reset();
      startedAt.value = String(Date.now());
      if (turnstileWidgetId !== null && window.turnstile) {
        window.turnstile.reset(turnstileWidgetId);
      }
      showStatus('Thanks—your message has been sent. We’ll be in touch.', false);
    } catch (error) {
      showStatus(error.message || 'Something went wrong. Please try again.', true);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Send message →';
    }
  });
})();
