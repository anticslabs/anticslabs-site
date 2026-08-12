(function () {
  const form = document.querySelector('[data-contact-form]');
  if (!form) return;

  const status = form.querySelector('[data-form-status]');
  const submitButton = form.querySelector('button[type="submit"]');
  const startedAt = form.querySelector('input[name="startedAt"]');
  const topic = form.querySelector('select[name="topic"]');

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

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    status.classList.remove('visible', 'error');
    submitButton.disabled = true;
    submitButton.textContent = 'Sending…';

    const payload = Object.fromEntries(new FormData(form).entries());

    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.success !== true) {
        throw new Error(result.message || result.body?.message || 'Something went wrong. Please try again.');
      }

      form.reset();
      startedAt.value = String(Date.now());
      showStatus('Thanks—your message has been sent. We’ll be in touch.', false);
    } catch (error) {
      showStatus(error.message || 'Something went wrong. Please try again.', true);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Send message →';
    }
  });
})();
