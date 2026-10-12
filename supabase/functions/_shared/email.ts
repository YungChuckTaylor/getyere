import { env } from './http.ts';

export async function sendYereEmail(to: string, subject: string, html: string, text: string) {
  const apiKey = env('RESEND_API_KEY');
  const from = env('RESEND_FROM_EMAIL');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html, text })
  });
  if (!response.ok) {
    const message = (await response.text()).slice(0, 500);
    throw new Error(`Email provider rejected delivery (${response.status}): ${message}`);
  }
  return await response.json();
}
