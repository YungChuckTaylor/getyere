// Public OAuth options only. Provider credentials belong in Supabase, never in the bundle.
export const SOCIAL_PROVIDERS = ['google', 'facebook'];

export async function startSocialSignIn({ provider, client, native, location }) {
  if (!SOCIAL_PROVIDERS.includes(provider)) throw new Error('Unsupported sign-in provider.');
  if (!client) throw new Error('Cloud sign-in is not configured yet.');
  if (native?.enabled) return native.auth.signInWithOAuth({ provider });

  // PKCE's verifier is origin-scoped: return to the origin that started sign-in,
  // not a configured apex/www alias. Preserve contact invitations across OAuth.
  const redirect = new URL('/', location.origin);
  const invite = new URLSearchParams(location.search).get('invite');
  if (invite) redirect.searchParams.set('invite', invite);
  const result = await client.auth.signInWithOAuth({ provider, options: { redirectTo: redirect.href } });
  if (result.error) throw result.error;
  return result;
}

const eye = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path data-eye-slash d="m3 3 18 18" hidden/></svg>';

export function togglePasswordVisibility(input, button) {
  const visible = input.type === 'password';
  input.type = visible ? 'text' : 'password';
  button.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
  button.setAttribute('title', visible ? 'Hide password' : 'Show password');
  button.setAttribute('aria-pressed', String(visible));
  button.querySelector('[data-eye-slash]').toggleAttribute('hidden', !visible);
}

// Called after each auth render. No document listeners/observers, no password storage.
export function enhancePasswordFields(root) {
  root.querySelectorAll('input[type="password"]').forEach((input, index) => {
    if (input.dataset.revealReady) return;
    input.dataset.revealReady = 'true';
    if (!input.id) input.id = `password-${input.name || index}`;
    const wrapper = input.ownerDocument.createElement('span');
    wrapper.className = 'relative block';
    input.before(wrapper);
    wrapper.append(input);
    input.style.paddingRight = '3.25rem';
    const button = input.ownerDocument.createElement('button');
    button.type = 'button';
    button.className = 'absolute right-1 bottom-1 flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:text-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500';
    button.setAttribute('aria-controls', input.id);
    button.setAttribute('aria-label', 'Show password');
    button.setAttribute('title', 'Show password');
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = eye;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      togglePasswordVisibility(input, button);
    });
    wrapper.append(button);
  });
}
