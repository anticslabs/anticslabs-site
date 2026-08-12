const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_TYPES = new Set(['studio', 'support']);

function json(message, status = 200) {
  return Response.json({ message }, {
    status,
    headers: { 'Cache-Control': 'no-store' }
  });
}

function clean(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function verifyTurnstile(token, secret, remoteIp) {
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (remoteIp) body.append('remoteip', remoteIp);

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body
  });
  if (!response.ok) return false;
  const result = await response.json();
  return result.success === true;
}

export async function onRequestPost({ request, env }) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get('Origin');
  if (origin && origin !== requestUrl.origin) {
    return json('This form can only be submitted from the Antics Labs website.', 403);
  }

  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > 30000) return json('That message is too large.', 413);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json('Please complete the form and try again.', 400);
  }

  if (clean(payload.website, 200)) {
    return json('Thanks—your message has been sent.');
  }

  const formType = clean(payload.formType, 20);
  const name = clean(payload.name, 100);
  const email = clean(payload.email, 254);
  const company = clean(payload.company, 120);
  const topic = clean(payload.topic, 80);
  const message = clean(payload.message, 5000);
  const startedAt = Number(payload.startedAt || 0);

  if (!ALLOWED_TYPES.has(formType) || !name || !EMAIL_PATTERN.test(email) || !topic || message.length < 10) {
    return json('Please complete every required field.', 400);
  }

  if (!startedAt || Date.now() - startedAt < 1000 || Date.now() - startedAt > 86400000) {
    return json('Please refresh the page and try again.', 400);
  }

  if (env.TURNSTILE_SECRET) {
    const token = clean(payload['cf-turnstile-response'], 2048);
    const remoteIp = request.headers.get('CF-Connecting-IP');
    if (!token || !(await verifyTurnstile(token, env.TURNSTILE_SECRET, remoteIp))) {
      return json('Please complete the security check and try again.', 400);
    }
  }

  const requiredConfig = ['CF_ACCOUNT_ID', 'CF_EMAIL_API_TOKEN', 'FORM_TO_EMAIL', 'FORM_FROM_EMAIL'];
  if (requiredConfig.some(key => !env[key])) {
    console.error('Contact form email configuration is incomplete.');
    return json('The form is not quite ready yet. Please try again later.', 503);
  }

  const label = formType === 'support' ? 'Support request' : 'Studio inquiry';
  const text = [
    label,
    `Name: ${name}`,
    `Email: ${email}`,
    company ? `Company: ${company}` : null,
    `Topic: ${topic}`,
    '',
    message
  ].filter(value => value !== null).join('\n');

  const html = `
    <h1>${escapeHtml(label)}</h1>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    ${company ? `<p><strong>Company:</strong> ${escapeHtml(company)}</p>` : ''}
    <p><strong>Topic:</strong> ${escapeHtml(topic)}</p>
    <hr>
    <p>${escapeHtml(message).replaceAll('\n', '<br>')}</p>
  `;

  const emailResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/email/sending/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.CF_EMAIL_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: env.FORM_TO_EMAIL,
      from: env.FORM_FROM_EMAIL,
      replyTo: email,
      subject: `[Antics Labs] ${label}: ${topic}`,
      text,
      html
    })
  });

  if (!emailResponse.ok) {
    console.error('Cloudflare Email Service rejected a contact form message.', emailResponse.status);
    return json('We couldn’t send that message. Please try again in a moment.', 502);
  }

  return json('Thanks—your message has been sent.');
}
