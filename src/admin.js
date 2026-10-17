const app = document.getElementById('app');
const ADMIN_ACCESS_PATH = '/admin-access';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function shell(content) {
  document.title = 'Yere Admin';
  let robots = document.querySelector('meta[name="robots"]');
  if (!robots) {
    robots = document.createElement('meta');
    robots.name = 'robots';
    document.head.appendChild(robots);
  }
  robots.content = 'noindex,nofollow';
  app.className = 'min-h-screen w-full';
  app.innerHTML = `<main class="min-h-screen bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-slate-100 p-4 md:p-8"><div class="max-w-7xl mx-auto">${content}</div></main>`;
}

function errorMessage(value) {
  return `<p role="alert" class="mt-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">${esc(value)}</p>`;
}

function safeHref(value) {
  if (typeof value !== 'string' || !value) return null;
  try {
    const url = new URL(value, window.location.origin);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function toLocalDateTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function renderLogin(message = '') {
  shell(`<section class="max-w-md mx-auto pt-14 md:pt-24"><div class="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900 p-6 md:p-8 shadow-xl"><div class="flex items-center gap-3 mb-7"><img src="/yere-mark.svg" alt="Yere" class="h-12 w-12 rounded-2xl"><div><p class="font-extrabold text-xl">Yere Admin</p><p class="text-xs text-slate-500">Authorized administrators only</p></div></div><h1 class="text-2xl font-extrabold">Admin sign in</h1><p class="mt-2 text-sm text-slate-500">Use an invited Yere administrator account. Public admin sign-up is disabled.</p>${message ? errorMessage(message) : ''}<form id="adminLoginForm" class="mt-6 space-y-4"><label class="block text-sm font-semibold">Email<input name="email" type="email" autocomplete="username" required class="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-3"></label><label class="block text-sm font-semibold">Password<input name="password" type="password" autocomplete="current-password" required class="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-3"></label><button class="w-full rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white" type="submit">Sign in</button><button id="adminForgotPassword" type="button" class="w-full text-sm font-semibold text-indigo-600 dark:text-indigo-300">Forgot password?</button></form><p id="adminLoginMessage" class="min-h-6 mt-3 text-sm text-slate-500"></p></div></section>`);
}

function completeAdminPasswordSetup(supabase, isRecovery = false) {
  return new Promise((resolve) => {
    const heading = isRecovery ? 'Choose a new password' : 'Choose your password';
    const description = 'Use at least 12 characters. Admin roles will next require an authenticator app.';
    const cancelLabel = isRecovery ? 'Cancel password reset' : 'Cancel invitation setup';
    const cancelledMessage = isRecovery ? 'Password reset cancelled. Sign in when ready.' : 'Invitation setup cancelled. Sign in with an active administrator account when ready.';
    const expiredMessage = isRecovery ? 'The password reset session expired. Request a fresh reset link.' : 'The invitation session expired. Request a fresh invitation.';
    shell(`<section class="max-w-md mx-auto pt-14 md:pt-24"><div class="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900 p-6 md:p-8 shadow-xl"><div class="flex items-center gap-3 mb-7"><img src="/yere-mark.svg" alt="Yere" class="h-12 w-12 rounded-2xl"><div><p class="font-extrabold text-xl">Yere Admin</p><p class="text-xs text-slate-500">Secure account setup</p></div></div><h1 class="text-2xl font-extrabold">${heading}</h1><p class="mt-2 text-sm text-slate-500">${description}</p><form id="adminInvitePasswordForm" class="mt-6 space-y-4"><label class="block text-sm font-semibold">New password<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="72" required class="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-3"></label><label class="block text-sm font-semibold">Confirm password<input name="confirmPassword" type="password" autocomplete="new-password" minlength="12" maxlength="72" required class="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-3"></label><button class="w-full rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white" type="submit">Save password</button><button id="adminInviteCancel" class="w-full rounded-xl border border-slate-200 dark:border-white/10 px-4 py-3 font-semibold" type="button">${cancelLabel}</button></form><p id="adminInvitePasswordError" role="alert" class="mt-3 min-h-5 text-sm text-rose-600"></p></div></section>`);
    const form = document.getElementById('adminInvitePasswordForm');
    const button = form.querySelector('button[type="submit"]');
    const errorHost = document.getElementById('adminInvitePasswordError');
    document.getElementById('adminInviteCancel').addEventListener('click', async () => {
      window.YERE_ADMIN_INVITE_CALLBACK = false;
      window.YERE_ADMIN_PASSWORD_RECOVERY_CALLBACK = false;
      window.history.replaceState({}, '', ADMIN_ACCESS_PATH);
      await supabase.auth.signOut();
      mountLogin(supabase, cancelledMessage);
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = new FormData(form);
      const password = String(values.get('password') || '');
      const confirmation = String(values.get('confirmPassword') || '');
      if (password.length < 12 || password.length > 72) { errorHost.textContent = 'Use a password between 12 and 72 characters.'; return; }
      if (password !== confirmation) { errorHost.textContent = 'The passwords do not match.'; return; }
      button.disabled = true; button.textContent = 'Saving…'; errorHost.textContent = '';
      try {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !data.session) throw sessionError || new Error(expiredMessage);
        window.YERE_ADMIN_INVITE_CALLBACK = false;
        window.YERE_ADMIN_PASSWORD_RECOVERY_CALLBACK = false;
        window.history.replaceState({}, '', ADMIN_ACCESS_PATH);
        resolve(data.session);
      } catch (error) {
        errorHost.textContent = error?.message || `Could not set your password. ${expiredMessage}`;
        button.disabled = false; button.textContent = 'Save password';
      }
    });
  });
}

async function completeTotp(supabase) {
  const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError) throw factorsError;
  let factor = (factorsData?.totp || []).find((entry) => entry.status === 'verified');
  let enrollment = null;
  if (!factor) {
    const stale = (factorsData?.totp || []).find((entry) => entry.status !== 'verified');
    if (stale) {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: stale.id });
      if (error) throw error;
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Yere admin authenticator' });
    if (error) throw error;
    enrollment = data;
    factor = { id: data.id };
  }
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
  if (challengeError) throw challengeError;

  const qrBlock = enrollment?.totp?.qr_code
    ? `<div class="my-4 rounded-xl bg-white p-3 text-center"><img class="mx-auto h-44 w-44" alt="Scan this admin MFA QR code" src="${esc(enrollment.totp.qr_code)}"><p class="mt-2 break-all text-xs text-slate-600">Manual setup: ${esc(enrollment.totp.secret || '')}</p></div>`
    : '';
  return await new Promise((resolve) => {
    shell(`<section class="max-w-md mx-auto pt-12"><div class="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900 p-6 shadow-xl"><h1 class="text-2xl font-extrabold">Verify authenticator</h1><p class="mt-2 text-sm text-slate-500">${enrollment ? 'Scan the QR code with an authenticator app, then enter its six-digit code.' : 'Enter the six-digit code from your authenticator app.'}</p>${qrBlock}<form id="adminTotpForm" class="mt-4 space-y-3"><label class="block text-sm font-semibold">Authenticator code<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required class="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-3 text-center text-2xl tracking-[.35em]"></label><button class="w-full rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white">Verify</button><button id="adminMfaCancel" type="button" class="w-full rounded-xl border border-slate-200 dark:border-white/10 px-4 py-3 font-semibold">Cancel</button></form><p id="adminTotpError" role="alert" class="mt-3 min-h-5 text-sm text-rose-600"></p></div></section>`);
    const form = document.getElementById('adminTotpForm');
    const submit = form.querySelector('button[type="submit"]') || form.querySelector('button:not([type])');
    document.getElementById('adminMfaCancel').addEventListener('click', () => window.location.replace(ADMIN_ACCESS_PATH));
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const code = String(new FormData(form).get('code') || '').trim();
      const errorHost = document.getElementById('adminTotpError');
      if (!/^\d{6}$/.test(code)) {
        errorHost.textContent = 'Enter the six-digit code.';
        return;
      }
      submit.disabled = true;
      submit.textContent = 'Verifying…';
      errorHost.textContent = '';
      try {
        const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code });
        if (verifyError) throw verifyError;
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) throw sessionError || new Error('The verified session could not be restored.');
        resolve(sessionData.session);
      } catch (error) {
        errorHost.textContent = 'That code could not be verified. Check your authenticator and try again.';
        submit.disabled = false;
        submit.textContent = 'Verify';
      }
    });
  });
}

async function saveAdminSession(session) {
  const response = await fetch('/api/admin-session', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: session.access_token })
  });
  const result = await response.json().catch(() => ({}));
  return { response, result };
}

function mountLogin(supabase, initialMessage = '') {
  renderLogin(initialMessage);
  const form = document.getElementById('adminLoginForm');
  document.getElementById('adminForgotPassword').addEventListener('click', async () => {
    const message = document.getElementById('adminLoginMessage');
    const email = String(new FormData(form).get('email') || '').trim().toLowerCase();
    if (!email) { message.textContent = 'Enter your invited admin email first.'; form.elements.email.focus(); return; }
    const recoveryButton = document.getElementById('adminForgotPassword');
    recoveryButton.disabled = true; message.textContent = 'Requesting a secure reset link…';
    try {
      const redirectTo = new URL('/admin-access?flow=recovery', window.YERE_ENV?.publicAppUrl || window.location.origin).href;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      message.textContent = 'If this address belongs to an eligible administrator, password reset instructions will be sent.';
    } catch {
      message.textContent = 'Could not request a password reset. Try again later or contact the project owner.';
    } finally { recoveryButton.disabled = false; }
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = document.getElementById('adminLoginMessage');
    const button = form.querySelector('button');
    button.disabled = true;
    button.textContent = 'Verifying…';
    message.textContent = '';
    try {
      const values = new FormData(form);
      let { data, error } = await supabase.auth.signInWithPassword({
        email: String(values.get('email') || '').trim().toLowerCase(),
        password: String(values.get('password') || '')
      });
      if (error) throw error;
      if (!data.session) throw new Error('Sign-in did not create a session.');
      let result = await saveAdminSession(data.session);
      if (result.response.status === 403 && result.result.code === 'mfa_required') {
        data.session = await completeTotp(supabase);
        result = await saveAdminSession(data.session);
      }
      if (!result.response.ok) throw new Error('Could not verify admin access. Check your invited admin account and authenticator.');
      window.location.replace('/admin');
    } catch (error) {
      const text = error?.message || 'Could not sign in. Please try again.';
      if (message.isConnected) {
        message.textContent = text;
        button.disabled = false;
        button.textContent = 'Sign in';
      } else {
        mountLogin(supabase, text);
      }
    }
  });
  supabase.auth.getSession().then(async ({ data, error }) => {
    const message = document.getElementById('adminLoginMessage');
    if (!message?.isConnected) return;
    const passwordCallback = Boolean(window.YERE_ADMIN_INVITE_CALLBACK || window.YERE_ADMIN_PASSWORD_RECOVERY_CALLBACK);
    if (error || !data.session) {
      if (passwordCallback) message.textContent = 'This link is invalid or expired. Request a new invitation or password reset.';
      return;
    }
    const button = document.getElementById('adminLoginForm')?.querySelector('button');
    if (button) { button.disabled = true; button.textContent = passwordCallback ? 'Secure setup…' : 'Verifying…'; }
    message.textContent = passwordCallback ? 'Complete secure account setup…' : 'Checking invited administrator access…';
    try {
      let session = data.session;
      if (window.YERE_ADMIN_INVITE_CALLBACK || window.YERE_ADMIN_PASSWORD_RECOVERY_CALLBACK) {
        session = await completeAdminPasswordSetup(supabase, Boolean(window.YERE_ADMIN_PASSWORD_RECOVERY_CALLBACK));
      }
      let result = await saveAdminSession(session);
      if (result.response.status === 403 && result.result.code === 'mfa_required') {
        const verifiedSession = await completeTotp(supabase);
        result = await saveAdminSession(verifiedSession);
      }
      if (!result.response.ok) throw new Error('This saved session cannot be used. Sign in with an active invited administrator account.');
      window.location.replace('/admin');
    } catch (sessionError) {
      const text = sessionError?.message || 'Could not complete admin sign-in.';
      if (message.isConnected) {
        message.textContent = text;
        if (button) { button.disabled = false; button.textContent = 'Sign in'; }
      } else mountLogin(supabase, text);
    }
  }).catch(() => {});
}

async function adminRequest(name, body) {
  const url = `/admin-api/${encodeURIComponent(name)}`;
  const response = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  if (response.status === 404) {
    window.location.replace(ADMIN_ACCESS_PATH);
    throw new Error('Admin session expired or access was revoked.');
  }
  if (response.status === 403 && result.code === 'mfa_required') {
    window.location.replace(ADMIN_ACCESS_PATH);
    throw new Error('Complete authenticator verification to continue.');
  }
  if (response.status === 401) {
    window.location.replace(ADMIN_ACCESS_PATH);
    throw new Error('Your admin session needs renewal. Sign in again.');
  }
  if (!response.ok) throw new Error(result.error || 'Admin request failed.');
  return result;
}

function roleLabel(role) {
  return ({ super_admin: 'Super admin', admin: 'Admin', support: 'Support', read_only: 'Read only' })[role] || role;
}

async function mountDashboard(supabase) {
  shell(`<header class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-5"><div class="flex items-center gap-3"><img src="/yere-mark.svg" alt="Yere" class="h-11 w-11 rounded-2xl"><div><p class="text-xs font-bold uppercase tracking-widest text-indigo-500">Private console</p><h1 class="text-2xl font-extrabold">Yere Admin</h1></div></div><div class="flex items-center gap-3"><span id="adminRole" class="rounded-full bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-700 dark:text-indigo-200"></span><button id="adminLogout" class="rounded-xl border border-slate-200 dark:border-white/10 px-4 py-2 text-sm font-semibold">Sign out</button></div></header><div class="grid gap-6 pt-6 lg:grid-cols-[210px_1fr]"><nav class="flex gap-2 overflow-x-auto lg:flex-col" aria-label="Admin sections"><button data-page="overview" data-min-role="read_only" class="admin-nav rounded-xl bg-indigo-600 px-4 py-3 text-left text-sm font-bold text-white">Overview</button><button data-page="users" data-min-role="support" class="admin-nav rounded-xl bg-white dark:bg-ink-900 px-4 py-3 text-left text-sm font-semibold">Users</button><button data-page="reminders" data-min-role="support" class="admin-nav rounded-xl bg-white dark:bg-ink-900 px-4 py-3 text-left text-sm font-semibold">Reminders</button><button data-page="notifications" data-min-role="support" class="admin-nav rounded-xl bg-white dark:bg-ink-900 px-4 py-3 text-left text-sm font-semibold">Notifications</button><button data-page="support" data-min-role="support" class="admin-nav rounded-xl bg-white dark:bg-ink-900 px-4 py-3 text-left text-sm font-semibold">Support</button><button data-page="settings" data-min-role="admin" class="admin-nav rounded-xl bg-white dark:bg-ink-900 px-4 py-3 text-left text-sm font-semibold">Settings</button><button data-page="audit" data-min-role="support" class="admin-nav rounded-xl bg-white dark:bg-ink-900 px-4 py-3 text-left text-sm font-semibold">Admin audit</button><button data-page="admins" data-min-role="super_admin" class="admin-nav rounded-xl bg-white dark:bg-ink-900 px-4 py-3 text-left text-sm font-semibold">Admin access</button></nav><section id="adminContent" class="min-w-0"><div class="animate-pulse rounded-2xl bg-white dark:bg-ink-900 p-8">Loading protected admin data…</div></section></div>`);

  document.getElementById('adminLogout').addEventListener('click', async () => {
    try { await fetch('/api/admin-session', { method: 'DELETE', credentials: 'same-origin' }); } catch { /* Always clear the local session too. */ }
    await supabase.auth.signOut();
    window.location.replace(ADMIN_ACCESS_PATH);
  });

  const me = await adminRequest('admin-me');
  document.getElementById('adminRole').textContent = roleLabel(me.role);
  const roleRanks = { read_only: 1, support: 2, admin: 3, super_admin: 4 };
  document.querySelectorAll('.admin-nav').forEach((button) => {
    if ((roleRanks[me.role] || 0) < (roleRanks[button.dataset.minRole] || 99)) button.hidden = true;
  });
  const pages = ['overview', 'users', 'reminders', 'notifications', 'support', 'settings', 'audit', 'admins'];
  async function show(page) {
    if (!pages.includes(page)) page = 'overview';
    document.querySelectorAll('.admin-nav').forEach((button) => {
      button.className = `admin-nav rounded-xl px-4 py-3 text-left text-sm font-semibold ${button.dataset.page === page ? 'bg-indigo-600 text-white font-bold' : 'bg-white dark:bg-ink-900'}`;
    });
    const host = document.getElementById('adminContent');
    host.innerHTML = '<div class="rounded-2xl bg-white dark:bg-ink-900 p-6 animate-pulse">Loading…</div>';
    try {
      if (page === 'overview') {
        const data = await adminRequest('admin-overview');
        const cards = [
          ['Total user profiles', data.totals.users], ['New profiles · 7 days', data.totals.newUsers7d],
          ['Profiles updated · 30 days', data.totals.profilesUpdated30d], ['Reminders', data.totals.reminders],
          ['Pending invites', data.totals.pendingInvites], ['Notification attempts sent / partial', data.totals.notificationAttemptsSentOrPartial],
          ['Failed notification attempts', data.totals.notificationAttemptsFailed]
        ];
        host.innerHTML = `<div><h2 class="text-xl font-extrabold">Overview</h2><p class="mt-1 text-sm text-slate-500">Counts from the existing Yere records. Feature telemetry and deployment health are not wired yet.</p><div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">${cards.map(([label, value]) => `<article class="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900 p-5"><p class="text-xs font-semibold text-slate-500">${esc(label)}</p><p class="mt-2 text-3xl font-extrabold">${esc(value)}</p></article>`).join('')}</div><p class="mt-4 text-xs text-slate-400">Updated ${esc(new Date(data.generatedAt).toLocaleString())}</p></div>`;
      } else if (page === 'users') {
        host.innerHTML = `<div><h2 class="text-xl font-extrabold">Users</h2><p class="mt-1 text-sm text-slate-500">User search is limited to the current Auth page. Inspecting a user record requires and audits a reason.</p><form id="adminUserSearch" class="mt-4 flex gap-2"><input name="query" maxlength="100" placeholder="Search current page by email, name, or ID" class="min-w-0 flex-1 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900 px-3 py-3"><button class="rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white">Search</button></form><div id="adminUserRows" class="mt-4 overflow-x-auto"></div><div id="adminUserDetail" class="mt-4"></div></div>`;
        const userRows = document.getElementById('adminUserRows');
        let userPage = 1;
        let userQuery = '';
        const loadUsers = async (query = userQuery, page = userPage) => {
          userQuery = query; userPage = page;
          const data = await adminRequest('admin-users-list', { query, page, perPage: 100 });
          userRows.innerHTML = `<table class="w-full min-w-[760px] text-left text-sm"><thead><tr class="border-b border-slate-200 dark:border-white/10 text-slate-500"><th class="p-3">Name</th><th class="p-3">Email</th><th class="p-3">Joined</th><th class="p-3">Last active</th><th class="p-3">Status</th><th class="p-3">Action</th></tr></thead><tbody>${data.users.map((user) => `<tr class="border-b border-slate-100 dark:border-white/5"><td class="p-3 font-semibold">${esc(user.displayName || '—')}</td><td class="p-3">${esc(user.email || '—')}</td><td class="p-3">${esc(user.signupAt ? new Date(user.signupAt).toLocaleDateString() : '—')}</td><td class="p-3">${esc(user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString() : 'Never')}</td><td class="p-3">${esc(user.bannedUntil ? `Banned until ${new Date(user.bannedUntil).toLocaleString()}` : 'Active')}</td><td class="p-3"><button type="button" data-user-id="${esc(user.id)}" class="rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-xs font-bold">Inspect</button>${roleRanks[me.role] >= 3 ? `<button type="button" data-manage-user="${esc(user.id)}" data-banned="${user.bannedUntil ? 'true' : 'false'}" class="ml-2 rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-xs font-bold">Manage</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="p-4 text-slate-500">No users found on this page.</td></tr>'}</tbody></table><div class="mt-3 flex flex-wrap items-center justify-between gap-3"><p class="text-xs text-slate-400">${data.returned} matches on Auth page ${data.page}. Search is applied within each page.</p><div class="flex gap-2"><button type="button" data-auth-page="${Math.max(1, data.page - 1)}" ${data.page <= 1 ? 'disabled' : ''} class="rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-xs font-bold disabled:opacity-40">Previous</button><button type="button" data-auth-page="${data.page + 1}" ${data.hasMore ? '' : 'disabled'} class="rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-xs font-bold disabled:opacity-40">Next</button></div></div>`;
        };
        const userDetail = document.getElementById('adminUserDetail');
        const renderUserDetail = (data) => {
          const lists = (data.lists || []).map((item) => `<li class="rounded-lg bg-slate-50 dark:bg-white/5 p-3">${esc(item.name)} <span class="text-xs text-slate-500">· ${esc(item.color)}</span></li>`).join('') || '<li class="text-slate-500">No lists.</li>';
          const reminders = (data.reminders || []).map((item) => `<article class="rounded-xl border border-slate-200 dark:border-white/10 p-3"><h5 class="font-bold">${esc(item.title)}</h5><p class="mt-1 whitespace-pre-wrap text-sm">${esc(item.notes || 'No notes')}</p>${safeHref(item.url) ? `<a class="mt-1 block break-all text-sm text-indigo-600 underline" href="${esc(safeHref(item.url))}" target="_blank" rel="noopener noreferrer">${esc(item.url)}</a>` : ''}<p class="mt-2 text-xs text-slate-500">Due ${esc(item.due_at ? new Date(item.due_at).toLocaleString() : '—')} · ${esc(item.is_completed ? 'Completed' : item.approval_status)} · ${esc(item.cost ?? 'No cost')} · ${esc(item.delivery_channel)}</p>${item.recurrence ? `<pre class="mt-1 whitespace-pre-wrap break-words text-xs">${esc(JSON.stringify(item.recurrence, null, 2))}</pre>` : ''}</article>`).join('') || '<p class="text-slate-500">No reminders.</p>';
          const contacts = (data.contacts || []).map((item) => `<li class="border-b border-slate-100 dark:border-white/5 py-2">${esc(item.display_name || item.invited_email || item.invited_phone || 'Contact')} · ${esc(item.status)} · ${esc(item.approval_mode)}</li>`).join('') || '<li class="text-slate-500">No contacts.</li>';
          const invites = (data.invites || []).map((item) => `<li class="border-b border-slate-100 dark:border-white/5 py-2">${esc(item.invite_type)} · ${esc(item.invited_email || item.invited_phone || 'Code invite')} · ${esc(item.revoked_at ? 'Revoked' : item.consumed_at ? 'Accepted' : new Date(item.expires_at).toLocaleString())}</li>`).join('') || '<li class="text-slate-500">No invitations.</li>';
          const files = (data.attachments || []).map((item) => {
            const href = safeHref(item.signedUrl);
            return `<li class="border-b border-slate-100 dark:border-white/5 py-2">${esc(item.fileName)} · ${esc(item.contentType)} · ${esc(item.sizeBytes)} bytes ${href ? `· <a class="text-indigo-600 underline" href="${esc(href)}" target="_blank" rel="noopener noreferrer">Open · 60 sec</a>` : ''}</li>`;
          }).join('') || '<li class="text-slate-500">No attachments.</li>';
          const notifications = (data.notificationLogs || []).map((item) => `<tr class="border-b border-slate-100 dark:border-white/5"><td class="p-2">${esc(new Date(item.created_at).toLocaleString())}</td><td class="p-2">${esc(item.channel)}</td><td class="p-2">${esc(item.status)}</td><td class="p-2">${esc(item.attempt)}</td><td class="p-2">${esc(item.error_message || '—')}</td></tr>`).join('');
          const tickets = (data.supportTickets || []).map((item) => `<article class="rounded-xl border border-slate-200 dark:border-white/10 p-3"><p class="font-bold">${esc(item.subject)} · ${esc(item.status)}</p><p class="mt-1 whitespace-pre-wrap text-sm">${esc(item.body)}</p>${item.admin_response ? `<p class="mt-2 whitespace-pre-wrap text-sm text-indigo-700 dark:text-indigo-200">Admin response: ${esc(item.admin_response)}</p>` : ''}</article>`).join('') || '<p class="text-slate-500">No support tickets.</p>';
          userDetail.innerHTML = `<section class="rounded-2xl border border-indigo-200 dark:border-indigo-500/20 bg-white dark:bg-ink-900 p-5"><div class="flex items-start justify-between gap-3"><div><p class="text-xs font-bold uppercase tracking-wider text-indigo-500">Audited user detail</p><h3 class="mt-1 text-xl font-extrabold">${esc(data.profile?.display_name || data.user?.email || data.user?.id)}</h3><p class="text-sm text-slate-500">${esc(data.user?.email || 'No email')} · ${esc(data.user?.id)}</p></div><button type="button" id="adminCloseUserDetail" class="rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-sm">Close</button></div><div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><p><span class="text-slate-500">Joined:</span> ${esc(data.user?.signupAt ? new Date(data.user.signupAt).toLocaleString() : '—')}</p><p><span class="text-slate-500">Last active:</span> ${esc(data.user?.lastActiveAt ? new Date(data.user.lastActiveAt).toLocaleString() : 'Never')}</p><p><span class="text-slate-500">Email confirmed:</span> ${esc(data.user?.emailConfirmedAt ? new Date(data.user.emailConfirmedAt).toLocaleString() : 'No')}</p><p><span class="text-slate-500">Timezone:</span> ${esc(data.profile?.timezone || '—')}</p><p><span class="text-slate-500">Theme:</span> ${esc(data.profile?.theme || '—')}</p><p><span class="text-slate-500">Account ban:</span> ${esc(data.user?.bannedUntil || 'None')}</p></div><details class="mt-4"><summary class="cursor-pointer font-bold">User lists (${(data.lists || []).length})</summary><ul class="mt-2 grid gap-2 sm:grid-cols-2">${lists}</ul></details><details class="mt-4"><summary class="cursor-pointer font-bold">Reminders (${(data.reminders || []).length})</summary><div class="mt-2 grid gap-2">${reminders}</div></details><details class="mt-4"><summary class="cursor-pointer font-bold">Contacts (${(data.contacts || []).length}) and invitations (${(data.invites || []).length})</summary><div class="mt-2 grid gap-4 md:grid-cols-2"><ul>${contacts}</ul><ul>${invites}</ul></div></details><details class="mt-4"><summary class="cursor-pointer font-bold">Attachments (${(data.attachments || []).length})</summary><ul class="mt-2">${files}</ul></details><details class="mt-4"><summary class="cursor-pointer font-bold">Notification attempts (${(data.notificationLogs || []).length})</summary><div class="mt-2 overflow-x-auto"><table class="w-full min-w-[560px] text-left text-xs"><thead><tr class="text-slate-500"><th class="p-2">When</th><th class="p-2">Channel</th><th class="p-2">Status</th><th class="p-2">Attempt</th><th class="p-2">Error</th></tr></thead><tbody>${notifications || '<tr><td colspan="5" class="p-2 text-slate-500">No notification attempts recorded.</td></tr>'}</tbody></table></div></details><details class="mt-4"><summary class="cursor-pointer font-bold">Support tickets (${(data.supportTickets || []).length})</summary><div class="mt-2 grid gap-2">${tickets}</div></details><details class="mt-4"><summary class="cursor-pointer font-bold">User audit history (${(data.userAuditHistory || []).length})</summary><ul class="mt-2 max-h-64 overflow-auto">${(data.userAuditHistory || []).map((item) => `<li class="border-b border-slate-100 dark:border-white/5 py-2 text-sm">${esc(new Date(item.created_at).toLocaleString())} · ${esc(item.actor_name)} · ${esc(item.action)} · ${esc(item.details)}</li>`).join('') || '<li class="text-slate-500">No history.</li>'}</ul></details><details class="mt-4"><summary class="cursor-pointer font-bold">Profile settings</summary><pre class="mt-2 whitespace-pre-wrap break-words text-xs">${esc(JSON.stringify(data.profile?.settings || {}, null, 2))}</pre></details></section>`;
          document.getElementById('adminCloseUserDetail').addEventListener('click', () => userDetail.replaceChildren());
          userDetail.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        await loadUsers();
        document.getElementById('adminUserSearch').addEventListener('submit', async (event) => {
          event.preventDefault();
          const query = String(new FormData(event.currentTarget).get('query') || '');
          userDetail.replaceChildren();
          try { await loadUsers(query, 1); } catch (error) { userRows.innerHTML = errorMessage(error.message); }
        });
        userRows.addEventListener('click', async (event) => {
          const pageButton = event.target.closest('[data-auth-page]');
          if (!pageButton) return;
          const nextPage = Number(pageButton.dataset.authPage);
          if (!Number.isInteger(nextPage) || nextPage < 1) return;
          try { await loadUsers(userQuery, nextPage); } catch (error) { userRows.innerHTML = errorMessage(error?.message || 'Could not load this Auth page.'); }
        });
        userRows.addEventListener('click', async (event) => {
          const button = event.target.closest('[data-user-id]');
          if (!button) return;
          const viewReason = window.prompt('Why do you need to inspect this user? The reason will be added to the admin audit log.');
          if (!viewReason || viewReason.trim().length < 8) { userDetail.innerHTML = errorMessage('A view reason of at least 8 characters is required.'); return; }
          userDetail.innerHTML = '<div class="rounded-2xl bg-white dark:bg-ink-900 p-6">Loading protected user details…</div>';
          try {
            const data = await adminRequest('admin-user-detail', { userId: button.dataset.userId, viewReason: viewReason.trim() });
            renderUserDetail(data);
          } catch (error) { userDetail.innerHTML = errorMessage(error?.message || 'Could not load user details.'); }
        });
        userRows.addEventListener('click', async (event) => {
          const button = event.target.closest('[data-manage-user]');
          if (!button) return;
          const available = me.role === 'super_admin' ? 'ban, unban, or delete' : 'ban or unban';
          const action = String(window.prompt(`Choose an action to ${available}:`) || '').trim().toLowerCase();
          if (!['ban', 'unban', 'delete'].includes(action) || (action === 'delete' && me.role !== 'super_admin')) {
            userDetail.innerHTML = errorMessage('Choose an allowed action.'); return;
          }
          const reason = window.prompt('Why is this account action needed? The reason will be audited.');
          if (!reason || reason.trim().length < 8) { userDetail.innerHTML = errorMessage('An action reason of at least 8 characters is required.'); return; }
          const body = { userId: button.dataset.manageUser, action, reason: reason.trim() };
          if (action === 'delete') {
            body.confirmation = window.prompt(`Type DELETE ${button.dataset.manageUser} to continue:`) || '';
            if (body.confirmation !== `DELETE ${button.dataset.manageUser}`) { userDetail.innerHTML = errorMessage('The deletion confirmation did not match.'); return; }
          }
          if (!window.confirm(`Confirm ${action} for this account?`)) return;
          userDetail.innerHTML = '<div class="rounded-2xl bg-white dark:bg-ink-900 p-6">Applying audited account action…</div>';
          try {
            await adminRequest('admin-user-action', body);
            userDetail.innerHTML = `<p class="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-200">Account ${esc(action)} completed and audited.</p>`;
            const currentQuery = String(new FormData(document.getElementById('adminUserSearch')).get('query') || '');
            await loadUsers(currentQuery);
          } catch (error) { userDetail.innerHTML = errorMessage(error?.message || 'Could not complete this account action.'); }
        });
      } else if (page === 'reminders') {
        host.innerHTML = `<div><h2 class="text-xl font-extrabold">Reminders</h2><p class="mt-1 text-sm text-slate-500">Titles and notes are sensitive. Enter a reason before searching; the reason is recorded in the immutable admin audit log.</p><form id="adminReminderSearch" class="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end"><label class="block text-sm font-semibold">Search titles and notes<input name="query" maxlength="100" placeholder="Optional search phrase" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900 px-3 py-3"></label><label class="block text-sm font-semibold">View reason<input name="viewReason" minlength="8" maxlength="500" required placeholder="At least 8 characters" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900 px-3 py-3"></label><button class="rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white">Search reminders</button></form><div id="adminReminderRows" class="mt-4 overflow-x-auto"><p class="rounded-xl bg-white dark:bg-ink-900 p-4 text-sm text-slate-500">No reminder content loaded. Enter a reason to begin.</p></div><div id="adminReminderDetail" class="mt-4"></div></div>`;
        const form = document.getElementById('adminReminderSearch');
        const rows = document.getElementById('adminReminderRows');
        const detail = document.getElementById('adminReminderDetail');
        const loadReminders = async (query, viewReason) => {
          const data = await adminRequest('admin-reminders-list', { query, viewReason, page: 1, perPage: 100 });
          rows.innerHTML = `<table class="w-full min-w-[700px] text-left text-sm"><thead><tr class="border-b border-slate-200 dark:border-white/10 text-slate-500"><th class="p-3">Title</th><th class="p-3">Owner</th><th class="p-3">Due</th><th class="p-3">Status</th><th class="p-3">Action</th></tr></thead><tbody>${data.reminders.map((reminder) => `<tr class="border-b border-slate-100 dark:border-white/5"><td class="p-3 font-semibold">${esc(reminder.title)}</td><td class="p-3">${esc(reminder.ownerName)}</td><td class="p-3">${esc(new Date(reminder.due_at).toLocaleString())}</td><td class="p-3">${esc(reminder.is_completed ? 'Completed' : reminder.approval_status)}</td><td class="p-3"><button type="button" data-reminder-id="${esc(reminder.id)}" class="rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-xs font-bold">Inspect</button>${roleRanks[me.role] >= 3 ? `<button type="button" data-edit-reminder="${esc(reminder.id)}" class="ml-2 rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-xs font-bold">Edit</button>` : ''}${me.role === 'super_admin' ? `<button type="button" data-delete-reminder="${esc(reminder.id)}" class="ml-2 rounded-lg border border-rose-300 px-3 py-2 text-xs font-bold text-rose-600">Delete</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="p-4 text-slate-500">No reminders found.</td></tr>'}</tbody></table><p class="mt-3 text-xs text-slate-400">Showing ${data.reminders.length} of ${data.total} matching reminders. Use the same recorded reason to inspect an individual reminder.</p>`;
        };
        const showReminder = async (reminderId, viewReason, mode = 'view') => {
          detail.innerHTML = '<div class="rounded-2xl bg-white dark:bg-ink-900 p-6">Loading protected reminder details…</div>';
          try {
            const data = await adminRequest('admin-reminder-detail', { reminderId, viewReason });
            const reminder = data.reminder || {};
            const reminderUrl = safeHref(reminder.url);
            const attachments = (data.attachments || []).map((file) => {
              const href = safeHref(file.signedUrl);
              return `<li class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-white/5 py-2"><span>${esc(file.name)} <span class="text-xs text-slate-400">${esc(file.contentType)} · ${esc(file.sizeBytes)} bytes</span></span>${href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer" class="text-indigo-600 underline">Open · 60 sec</a>` : '<span class="text-xs text-slate-400">Link unavailable</span>'}</li>`;
            }).join('') || '<li class="py-2 text-slate-500">No attachments.</li>';
            const history = (data.deliveryHistory || []).map((entry) => `<tr class="border-b border-slate-100 dark:border-white/5"><td class="p-2">${esc(entry.fired_at ? new Date(entry.fired_at).toLocaleString() : '—')}</td><td class="p-2">${esc(entry.channel)}</td><td class="p-2">${esc(entry.delivery_status)}</td><td class="p-2">${esc(entry.error_message || '—')}</td></tr>`).join('');
            detail.innerHTML = `<section class="rounded-2xl border border-indigo-200 dark:border-indigo-500/20 bg-white dark:bg-ink-900 p-5"><div class="flex flex-wrap items-start justify-between gap-3"><div><p class="text-xs font-bold uppercase tracking-wider text-indigo-500">Audited reminder detail</p><h3 class="mt-1 text-xl font-extrabold">${esc(reminder.title)}</h3><p class="mt-1 text-sm text-slate-500">Owner: ${esc(data.owner?.display_name || 'Yere member')} · ${esc(data.owner?.timezone || 'Timezone unavailable')}</p></div><button type="button" id="adminCloseReminderDetail" class="rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-sm">Close</button></div><div class="mt-4 grid gap-4 lg:grid-cols-2"><div><h4 class="font-bold">Notes</h4><p class="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">${esc(reminder.notes || 'No notes')}</p>${reminderUrl ? `<p class="mt-3 text-sm"><a class="break-all text-indigo-600 underline" href="${esc(reminderUrl)}" target="_blank" rel="noopener noreferrer">${esc(reminder.url)}</a></p>` : ''}<dl class="mt-4 grid grid-cols-2 gap-2 text-sm"><dt class="text-slate-500">Due</dt><dd>${esc(new Date(reminder.due_at).toLocaleString())}</dd><dt class="text-slate-500">Category / list</dt><dd>${esc(data.list?.name || 'Uncategorized')}</dd><dt class="text-slate-500">Cost</dt><dd>${esc(reminder.cost ?? '—')}</dd><dt class="text-slate-500">Recurrence</dt><dd><pre class="whitespace-pre-wrap break-words">${esc(reminder.recurrence ? JSON.stringify(reminder.recurrence, null, 2) : 'None')}</pre></dd><dt class="text-slate-500">Type / channel</dt><dd>${esc(reminder.reminder_type)} / ${esc(reminder.delivery_channel)}</dd><dt class="text-slate-500">Status</dt><dd>${esc(reminder.is_completed ? 'Completed' : reminder.approval_status)}</dd></dl></div><div><h4 class="font-bold">Attachments</h4><ul class="mt-1">${attachments}</ul><h4 class="mt-4 font-bold">Delivery history</h4><div class="mt-1 overflow-x-auto"><table class="w-full min-w-[420px] text-left text-xs"><thead><tr class="text-slate-500"><th class="p-2">Fired</th><th class="p-2">Channel</th><th class="p-2">Status</th><th class="p-2">Error</th></tr></thead><tbody>${history || '<tr><td colspan="4" class="p-2 text-slate-500">No delivery history.</td></tr>'}</tbody></table></div></div></div></section>`;
            if (mode === 'edit') {
              const listOptions = (data.ownerLists || []).map((item) => `<option value="${esc(item.id)}" ${item.id === reminder.list_id ? 'selected' : ''}>${esc(item.name)}</option>`).join('');
              detail.insertAdjacentHTML('beforeend', `<section class="mt-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900 p-5"><h4 class="font-bold">Edit reminder</h4><form id="adminReminderEditForm" class="mt-3 grid gap-3 md:grid-cols-2"><label class="block text-sm font-semibold">Title<input name="title" maxlength="180" required value="${esc(reminder.title)}" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2"></label><label class="block text-sm font-semibold">Due date/time<input name="dueAt" type="datetime-local" required value="${esc(toLocalDateTime(reminder.due_at))}" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2"></label><label class="block text-sm font-semibold md:col-span-2">Notes<textarea name="notes" maxlength="4000" rows="3" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2">${esc(reminder.notes || '')}</textarea></label><label class="block text-sm font-semibold md:col-span-2">Link<input name="url" type="url" maxlength="2048" value="${esc(reminder.url || '')}" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2"></label><label class="block text-sm font-semibold">List<select name="listId" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2"><option value="">Uncategorized</option>${listOptions}</select></label><label class="block text-sm font-semibold">Cost<input name="cost" type="number" min="0" step="0.01" value="${esc(reminder.cost ?? '')}" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2"></label><label class="block text-sm font-semibold">Delivery<select name="deliveryChannel" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2">${['push','email','both','none'].map((value) => `<option value="${value}" ${reminder.delivery_channel === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label class="block text-sm font-semibold">Type<select name="reminderType" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2">${['standard','expiry','renewal'].map((value) => `<option value="${value}" ${reminder.reminder_type === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label class="block text-sm font-semibold md:col-span-2">Recurrence JSON<textarea name="recurrence" rows="3" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2 font-mono text-xs">${esc(reminder.recurrence ? JSON.stringify(reminder.recurrence, null, 2) : '')}</textarea><span class="text-xs text-slate-500">Leave blank for no recurrence; enter a JSON object otherwise.</span></label><label class="flex items-center gap-2 text-sm font-semibold"><input name="isCompleted" type="checkbox" ${reminder.is_completed ? 'checked' : ''}> Completed</label><label class="block text-sm font-semibold md:col-span-2">Action reason<input name="reason" minlength="8" maxlength="500" required placeholder="Why is this reminder being changed?" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2"></label><button class="rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white md:col-span-2">Save audited changes</button></form><p id="adminReminderEditMessage" class="mt-3 min-h-5 text-sm text-slate-500"></p></section>`);
              const editForm = document.getElementById('adminReminderEditForm');
              editForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                const values = new FormData(editForm);
                const message = document.getElementById('adminReminderEditMessage');
                let recurrence = null;
                try {
                  const rawRecurrence = String(values.get('recurrence') || '').trim();
                  if (rawRecurrence) recurrence = JSON.parse(rawRecurrence);
                } catch { message.textContent = 'Recurrence must be valid JSON.'; return; }
                const rawDueAt = String(values.get('dueAt') || '');
                const due = new Date(rawDueAt);
                if (!Number.isFinite(due.getTime())) { message.textContent = 'Enter a valid due date and time.'; return; }
                const rawCost = String(values.get('cost') || '').trim();
                const body = {
                  reminderId, action: 'update', reason: String(values.get('reason') || '').trim(),
                  title: String(values.get('title') || ''), notes: String(values.get('notes') || ''),
                  url: String(values.get('url') || '').trim() || null, dueAt: due.toISOString(), recurrence,
                  listId: String(values.get('listId') || '') || null, cost: rawCost ? Number(rawCost) : null,
                  deliveryChannel: String(values.get('deliveryChannel') || ''),
                  reminderType: String(values.get('reminderType') || ''),
                  isCompleted: editForm.elements.isCompleted.checked
                };
                const saveButton = editForm.querySelector('button');
                saveButton.disabled = true;
                message.textContent = 'Saving and recording the audit…';
                try {
                  await adminRequest('admin-reminder-action', body);
                  await loadReminders(String(new FormData(form).get('query') || '').trim(), viewReason);
                  await showReminder(reminderId, viewReason, 'edit');
                  document.getElementById('adminReminderEditMessage').textContent = 'Changes saved and audited.';
                } catch (error) {
                  message.textContent = error?.message || 'Could not save reminder changes.';
                  saveButton.disabled = false;
                }
              });
            }
            document.getElementById('adminCloseReminderDetail').addEventListener('click', () => { detail.replaceChildren(); });
            detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } catch (error) {
            detail.innerHTML = errorMessage(error?.message || 'Could not load reminder details.');
          }
        };
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const values = new FormData(form);
          const query = String(values.get('query') || '').trim();
          const viewReason = String(values.get('viewReason') || '').trim();
          if (viewReason.length < 8) { rows.innerHTML = errorMessage('Enter a view reason of at least 8 characters.'); return; }
          detail.replaceChildren();
          rows.innerHTML = '<div class="rounded-2xl bg-white dark:bg-ink-900 p-6">Searching…</div>';
          try { await loadReminders(query, viewReason); }
          catch (error) { rows.innerHTML = errorMessage(error?.message || 'Could not load reminders.'); }
        });
        rows.addEventListener('click', async (event) => {
          const viewReason = String(new FormData(form).get('viewReason') || '').trim();
          const inspectButton = event.target.closest('[data-reminder-id]');
          if (inspectButton) {
            if (viewReason.length < 8) { detail.innerHTML = errorMessage('Enter a view reason of at least 8 characters first.'); return; }
            await showReminder(inspectButton.dataset.reminderId, viewReason);
            return;
          }
          const editButton = event.target.closest('[data-edit-reminder]');
          if (editButton) {
            if (viewReason.length < 8) { detail.innerHTML = errorMessage('Enter a view reason of at least 8 characters first.'); return; }
            await showReminder(editButton.dataset.editReminder, viewReason, 'edit');
            return;
          }
          const deleteButton = event.target.closest('[data-delete-reminder]');
          if (!deleteButton) return;
          const reminderId = deleteButton.dataset.deleteReminder;
          const reason = window.prompt('Why does this reminder need to be deleted? The action will be audited.');
          if (!reason || reason.trim().length < 8) { detail.innerHTML = errorMessage('A deletion reason of at least 8 characters is required.'); return; }
          const confirmation = window.prompt(`Type DELETE ${reminderId} to permanently delete this reminder:`);
          if (confirmation !== `DELETE ${reminderId}` || !window.confirm('Permanently delete this reminder and its attachment records?')) return;
          try {
            await adminRequest('admin-reminder-action', { reminderId, action: 'delete', reason: reason.trim(), confirmation });
            detail.innerHTML = '<p class="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-200">Reminder deleted and audited.</p>';
            await loadReminders(String(new FormData(form).get('query') || '').trim(), viewReason);
          } catch (error) { detail.innerHTML = errorMessage(error?.message || 'Could not delete reminder.'); }
        });
      } else if (page === 'notifications') {
        host.innerHTML = `<div><h2 class="text-xl font-extrabold">Notification logs</h2><p class="mt-1 text-sm text-slate-500">Delivery metadata and provider errors can contain sensitive operational details. A reason is required and recorded before loading.</p><form id="adminNotificationSearch" class="mt-4 flex flex-wrap items-end gap-3"><label class="block min-w-[260px] flex-1 text-sm font-semibold">View reason<input name="viewReason" required minlength="8" maxlength="500" placeholder="At least 8 characters" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900 px-3 py-3"></label><label class="block text-sm font-semibold">Status<select name="status" class="mt-1 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900 px-3 py-3"><option value="">All statuses</option><option>sent</option><option>partial</option><option>failed</option><option>queued</option><option>retried</option><option>skipped</option></select></label><button class="rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white">Load logs</button></form><div id="adminNotificationRows" class="mt-4 overflow-x-auto"><p class="rounded-xl bg-white dark:bg-ink-900 p-4 text-sm text-slate-500">No notification logs loaded.</p></div></div>`;
        const form = document.getElementById('adminNotificationSearch');
        const rows = document.getElementById('adminNotificationRows');
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const values = new FormData(form);
          const viewReason = String(values.get('viewReason') || '').trim();
          if (viewReason.length < 8) { rows.innerHTML = errorMessage('Enter a view reason of at least 8 characters.'); return; }
          rows.innerHTML = '<div class="rounded-2xl bg-white dark:bg-ink-900 p-6">Loading notification logs…</div>';
          try {
            const status = String(values.get('status') || '');
            const data = await adminRequest('admin-notification-list', { viewReason, status, page: 1, perPage: 100 });
            rows.innerHTML = `<table class="w-full min-w-[820px] text-left text-sm"><thead><tr class="border-b border-slate-200 dark:border-white/10 text-slate-500"><th class="p-3">When</th><th class="p-3">User</th><th class="p-3">Reminder ID</th><th class="p-3">Channel</th><th class="p-3">Status</th><th class="p-3">Attempt</th><th class="p-3">Error</th></tr></thead><tbody>${data.logs.map((log) => `<tr class="border-b border-slate-100 dark:border-white/5"><td class="p-3">${esc(new Date(log.created_at).toLocaleString())}</td><td class="p-3">${esc(log.user_id || 'Deleted user')}</td><td class="p-3">${esc(log.reminder_id || 'Deleted reminder')}</td><td class="p-3">${esc(log.channel)}</td><td class="p-3">${esc(log.status)}</td><td class="p-3">${esc(log.attempt)}</td><td class="p-3">${esc(log.error_message || '—')}</td></tr>`).join('') || '<tr><td colspan="7" class="p-4 text-slate-500">No notification logs found.</td></tr>'}</tbody></table><p class="mt-3 text-xs text-slate-400">Showing ${data.logs.length} of ${data.total} matching attempts. Provider reference IDs are not displayed.</p>`;
          } catch (error) { rows.innerHTML = errorMessage(error?.message || 'Could not load notification logs.'); }
        });
      } else if (page === 'support') {
        host.innerHTML = `<div><h2 class="text-xl font-extrabold">Support tickets</h2><p class="mt-1 text-sm text-slate-500">Ticket messages are private. A reason is required for viewing; replies and status changes are separately audited. Replies currently appear in the admin console only; email notification is not connected.</p><form id="adminSupportSearch" class="mt-4 flex flex-wrap items-end gap-3"><label class="block min-w-[260px] flex-1 text-sm font-semibold">View reason<input name="viewReason" minlength="8" maxlength="500" required placeholder="At least 8 characters" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900 px-3 py-3"></label><label class="block text-sm font-semibold">Status<select name="status" class="mt-1 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900 px-3 py-3"><option value="">All statuses</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></label><button class="rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white">Load tickets</button></form><div id="adminSupportRows" class="mt-4"><p class="rounded-xl bg-white dark:bg-ink-900 p-4 text-sm text-slate-500">No tickets loaded.</p></div></div>`;
        const form = document.getElementById('adminSupportSearch');
        const rows = document.getElementById('adminSupportRows');
        const loadTickets = async (viewReason, status) => {
          const data = await adminRequest('admin-support-list', { viewReason, status, page: 1, perPage: 100 });
          rows.innerHTML = data.tickets.map((ticket) => `<article class="mt-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900 p-5"><div class="flex flex-wrap justify-between gap-3"><div><p class="text-xs text-slate-500">${esc(ticket.userEmail || ticket.user_id)} · ${esc(new Date(ticket.created_at).toLocaleString())}</p><h3 class="mt-1 font-extrabold">${esc(ticket.subject)}</h3></div><span class="rounded-full bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-700 dark:text-indigo-200">${esc(ticket.status)}</span></div><p class="mt-3 whitespace-pre-wrap text-sm">${esc(ticket.body)}</p><form data-ticket-id="${esc(ticket.id)}" class="mt-4 grid gap-3 md:grid-cols-[180px_1fr]"><label class="block text-sm font-semibold">Status<select name="status" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2">${['open','in_progress','resolved','closed'].map((value) => `<option value="${value}" ${ticket.status === value ? 'selected' : ''}>${value.replace('_',' ')}</option>`).join('')}</select></label><label class="block text-sm font-semibold">Admin response<textarea name="adminResponse" maxlength="10000" rows="3" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2">${esc(ticket.admin_response || '')}</textarea></label><label class="block text-sm font-semibold md:col-span-2">Action reason<input name="reason" minlength="8" maxlength="500" required placeholder="At least 8 characters" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2"></label><button class="rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white md:col-span-2">Save audited response</button></form></article>`).join('') || '<p class="mt-3 rounded-xl bg-white dark:bg-ink-900 p-4 text-sm text-slate-500">No support tickets found.</p>';
          rows.querySelectorAll('[data-ticket-id]').forEach((ticketForm) => ticketForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const values = new FormData(ticketForm);
            const reason = String(values.get('reason') || '').trim();
            if (reason.length < 8) return;
            const button = ticketForm.querySelector('button');
            button.disabled = true;
            try {
              await adminRequest('admin-support-update', {
                ticketId: ticketForm.dataset.ticketId, status: String(values.get('status')),
                adminResponse: String(values.get('adminResponse') || ''), reason
              });
              await loadTickets(viewReason, status);
            } catch (error) { button.disabled = false; window.alert(error?.message || 'Could not update support ticket.'); }
          }));
          if (data.total > data.tickets.length) rows.insertAdjacentHTML('beforeend', `<p class="mt-3 text-xs text-slate-400">Showing ${data.tickets.length} of ${data.total}. Further pagination is not shown in this UI version.</p>`);
        };
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const values = new FormData(form);
          const viewReason = String(values.get('viewReason') || '').trim();
          const status = String(values.get('status') || '');
          if (viewReason.length < 8) { rows.innerHTML = errorMessage('A view reason of at least 8 characters is required.'); return; }
          rows.innerHTML = '<div class="rounded-2xl bg-white dark:bg-ink-900 p-6">Loading tickets…</div>';
          try { await loadTickets(viewReason, status); } catch (error) { rows.innerHTML = errorMessage(error?.message || 'Could not load support tickets.'); }
        });
      } else if (page === 'settings') {
        host.innerHTML = `<div><h2 class="text-xl font-extrabold">App settings and content</h2><p class="mt-1 text-sm text-slate-500">Settings reads and every write require a reason and create immutable audit entries. Maintenance mode and global app settings are super-admin-only.</p><form id="adminSettingsRead" class="mt-4 flex flex-wrap items-end gap-3"><label class="block min-w-[260px] flex-1 text-sm font-semibold">View reason<input name="viewReason" minlength="8" maxlength="500" required placeholder="At least 8 characters" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900 px-3 py-3"></label><button class="rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white">Load settings</button></form><div id="adminSettingsContent" class="mt-4"><p class="rounded-xl bg-white dark:bg-ink-900 p-4 text-sm text-slate-500">Settings have not been loaded.</p></div></div>`;
        const readForm = document.getElementById('adminSettingsRead');
        const settingsHost = document.getElementById('adminSettingsContent');
        const loadSettings = async (viewReason, notice = '') => {
          const data = await adminRequest('admin-settings', { action: 'read', reason: viewReason });
          const flags = (data.featureFlags || []).map((flag) => `<form data-flag-form class="grid gap-2 rounded-xl border border-slate-200 dark:border-white/10 p-3 md:grid-cols-[180px_1fr_auto]"><div><p class="font-mono text-sm font-bold">${esc(flag.key)}</p><p class="text-xs text-slate-500">Updated ${esc(new Date(flag.updated_at).toLocaleString())}</p></div><label class="block text-sm">Description<input name="description" maxlength="500" value="${esc(flag.description)}" class="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-2 py-2"></label><div class="flex flex-wrap items-center gap-2"><input type="hidden" name="key" value="${esc(flag.key)}"><label class="text-xs"><input name="enabled" type="checkbox" ${flag.enabled ? 'checked' : ''}> Enabled</label><input name="reason" required minlength="8" maxlength="500" placeholder="Reason" class="w-40 rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-2 py-2 text-xs"><button class="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white">Save</button></div></form>`).join('') || '<p class="text-sm text-slate-500">No feature flags yet.</p>';
          const announcementForms = (data.announcements || []).map((item) => `<form data-announcement-form data-id="${esc(item.id)}" class="mt-3 grid gap-3 rounded-xl border border-slate-200 dark:border-white/10 p-4 md:grid-cols-2"><label class="block text-sm font-semibold">Title<input name="title" maxlength="160" required value="${esc(item.title)}" class="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2"></label><label class="block text-sm font-semibold">Audience<select name="audience" class="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2"><option value="all" ${item.audience === 'all' ? 'selected' : ''}>Everyone</option><option value="selected" ${item.audience === 'selected' ? 'selected' : ''}>Selected user IDs</option></select></label><label class="block text-sm font-semibold md:col-span-2">Message<textarea name="body" maxlength="5000" required rows="3" class="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2">${esc(item.body)}</textarea></label><label class="block text-sm font-semibold">Selected user IDs<input name="audienceIds" value="${esc((item.audience_ids || []).join(', '))}" placeholder="Comma-separated UUIDs" class="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2"></label><label class="block text-sm font-semibold">Starts<input name="startsAt" type="datetime-local" value="${esc(toLocalDateTime(item.starts_at))}" class="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2"></label><label class="block text-sm font-semibold">Ends (optional)<input name="endsAt" type="datetime-local" value="${esc(toLocalDateTime(item.ends_at))}" class="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2"></label><label class="flex items-center gap-2 text-sm font-semibold"><input name="active" type="checkbox" ${item.active ? 'checked' : ''}> Active</label><label class="block text-sm font-semibold md:col-span-2">Change reason<input name="reason" minlength="8" maxlength="500" required placeholder="At least 8 characters" class="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2"></label><button class="rounded-lg bg-indigo-600 px-4 py-3 font-bold text-white md:col-span-2">Save announcement</button></form>`).join('') || '<p class="text-sm text-slate-500">No announcements yet.</p>';
          const settingsHtml = me.role === 'super_admin' ? `<section class="mt-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900 p-5"><h3 class="font-bold">Global app settings · super admin</h3><div class="mt-3 grid gap-2">${(data.settings || []).map((setting) => `<details class="rounded-lg border border-slate-200 dark:border-white/10 p-3"><summary class="cursor-pointer font-mono text-sm">${esc(setting.key)}</summary><pre class="mt-2 whitespace-pre-wrap break-words text-xs">${esc(JSON.stringify(setting.value, null, 2))}</pre></details>`).join('') || '<p class="text-sm text-slate-500">No app settings.</p>'}</div><form id="adminAppSettingForm" class="mt-4 grid gap-3 md:grid-cols-2"><label class="block text-sm font-semibold">Key<input name="key" maxlength="100" required class="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2"></label><label class="block text-sm font-semibold">JSON value<textarea name="value" rows="3" required placeholder="true, 123, or {&quot;enabled&quot;:true}" class="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2 font-mono text-xs"></textarea></label><label class="block text-sm font-semibold md:col-span-2">Reason<input name="reason" minlength="8" maxlength="500" required class="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2"></label><button class="rounded-lg bg-indigo-600 px-4 py-3 font-bold text-white md:col-span-2">Save app setting</button></form></section>` : '<p class="mt-4 rounded-xl bg-slate-100 dark:bg-white/5 p-3 text-sm text-slate-500">Global app settings are visible only to super admins.</p>';
          const maintenanceHtml = me.role === 'super_admin' ? `<section class="mt-5 rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-white dark:bg-ink-900 p-5"><h3 class="font-bold">Maintenance mode · super admin</h3><p class="mt-1 text-xs text-slate-500">Maintenance mode blocks the regular app but leaves admin routes available.</p><form id="adminMaintenanceForm" class="mt-3 grid gap-3 md:grid-cols-2"><label class="flex items-center gap-2 text-sm font-semibold"><input name="enabled" type="checkbox" ${data.maintenance?.enabled ? 'checked' : ''}> Enable maintenance</label><label class="block text-sm font-semibold">Public message<input name="message" maxlength="500" value="${esc(data.maintenance?.message || '')}" class="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2"></label><label class="block text-sm font-semibold md:col-span-2">Reason<input name="reason" minlength="8" maxlength="500" required class="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2"></label><button class="rounded-lg bg-amber-600 px-4 py-3 font-bold text-white md:col-span-2">Update maintenance</button></form></section>` : `<section class="mt-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900 p-5"><h3 class="font-bold">Maintenance mode</h3><p class="mt-2 text-sm">${data.maintenance?.enabled ? 'Enabled' : 'Disabled'} · ${esc(data.maintenance?.message || '')}</p><p class="mt-1 text-xs text-slate-500">Only super admins can change maintenance mode.</p></section>`;
          settingsHost.innerHTML = `${notice ? `<p class="mb-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-200">${esc(notice)}</p>` : ''}<section class="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900 p-5"><h3 class="font-bold">Feature flags</h3><p class="mt-1 text-xs text-slate-500">Enabled flags can be read publicly; disabled values remain server-only. Add or update below.</p><form id="adminNewFlagForm" class="mt-3 grid gap-2 md:grid-cols-[180px_1fr_auto]"><input name="key" maxlength="80" pattern="[a-z][a-z0-9_-]{0,79}" required placeholder="flag-key" class="rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2 font-mono text-sm"><input name="description" maxlength="500" placeholder="Description" class="rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2"><div class="flex flex-wrap items-center gap-2"><label class="text-xs"><input name="enabled" type="checkbox"> Enabled</label><input name="reason" minlength="8" maxlength="500" required placeholder="Reason" class="w-40 rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-2 py-2 text-xs"><button class="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white">Add flag</button></div></form><div class="mt-3 grid gap-2">${flags}</div></section>${maintenanceHtml}<section class="mt-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900 p-5"><h3 class="font-bold">Announcements</h3><p class="mt-1 text-xs text-slate-500">Active announcements are served by Supabase RLS to the configured audience. No email or push broadcast is sent from this screen.</p><form id="adminNewAnnouncementForm" class="mt-3 grid gap-3 md:grid-cols-2"><label class="block text-sm font-semibold">Title<input name="title" maxlength="160" required class="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2"></label><label class="block text-sm font-semibold">Audience<select name="audience" class="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2"><option value="all">Everyone</option><option value="selected">Selected user IDs</option></select></label><label class="block text-sm font-semibold md:col-span-2">Message<textarea name="body" maxlength="5000" required rows="3" class="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2"></textarea></label><label class="block text-sm font-semibold md:col-span-2">Selected user IDs<input name="audienceIds" placeholder="Comma-separated UUIDs (for selected audience)" class="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2"></label><label class="block text-sm font-semibold">Starts<input name="startsAt" type="datetime-local" class="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2"></label><label class="block text-sm font-semibold">Ends (optional)<input name="endsAt" type="datetime-local" class="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2"></label><label class="flex items-center gap-2 text-sm font-semibold"><input name="active" type="checkbox"> Active immediately</label><label class="block text-sm font-semibold md:col-span-2">Reason<input name="reason" minlength="8" maxlength="500" required class="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2"></label><button class="rounded-lg bg-indigo-600 px-4 py-3 font-bold text-white md:col-span-2">Create announcement</button></form><div class="mt-4">${announcementForms}</div></section>${settingsHtml}`;
          const update = async (action, fields, actionReason) => {
            await adminRequest('admin-settings', { action, reason: actionReason, ...fields });
            await loadSettings(viewReason, 'Settings saved and audited.');
          };
          settingsHost.querySelector('#adminNewFlagForm').addEventListener('submit', async (event) => {
            event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
            try { await update('feature_flag_set', { key: String(values.get('key') || ''), description: String(values.get('description') || ''), enabled: form.elements.enabled.checked }, String(values.get('reason') || '').trim()); }
            catch (error) { window.alert(error?.message || 'Could not save feature flag.'); }
          });
          settingsHost.querySelectorAll('[data-flag-form]').forEach((form) => form.addEventListener('submit', async (event) => {
            event.preventDefault(); const values = new FormData(form);
            try { await update('feature_flag_set', { key: String(values.get('key')), description: String(values.get('description') || ''), enabled: form.elements.enabled.checked }, String(values.get('reason') || '').trim()); }
            catch (error) { window.alert(error?.message || 'Could not save feature flag.'); }
          }));
          const maintenanceForm = settingsHost.querySelector('#adminMaintenanceForm');
          maintenanceForm?.addEventListener('submit', async (event) => {
            event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
            try { await update('maintenance_set', { enabled: form.elements.enabled.checked, message: String(values.get('message') || '') }, String(values.get('reason') || '').trim()); }
            catch (error) { window.alert(error?.message || 'Could not update maintenance mode.'); }
          });
          const settingForm = settingsHost.querySelector('#adminAppSettingForm');
          settingForm?.addEventListener('submit', async (event) => {
            event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
            try {
              const value = JSON.parse(String(values.get('value') || ''));
              await update('setting_set', { key: String(values.get('key') || ''), value }, String(values.get('reason') || '').trim());
            } catch (error) { window.alert(error?.message || 'Enter valid JSON and try again.'); }
          });
          const submitAnnouncement = async (form, id = '') => {
            const values = new FormData(form);
            const parseDate = (raw) => raw ? new Date(String(raw)).toISOString() : null;
            const audienceIds = String(values.get('audienceIds') || '').split(',').map((id) => id.trim()).filter(Boolean);
            const fields = {
              id: id || undefined, title: String(values.get('title') || ''), body: String(values.get('body') || ''),
              audience: String(values.get('audience') || 'all'), audienceIds,
              startsAt: parseDate(values.get('startsAt')), endsAt: parseDate(values.get('endsAt')),
              active: form.elements.active.checked
            };
            await update('announcement_set', fields, String(values.get('reason') || '').trim());
          };
          settingsHost.querySelector('#adminNewAnnouncementForm').addEventListener('submit', async (event) => {
            event.preventDefault(); try { await submitAnnouncement(event.currentTarget); } catch (error) { window.alert(error?.message || 'Could not create announcement.'); }
          });
          settingsHost.querySelectorAll('[data-announcement-form]').forEach((form) => form.addEventListener('submit', async (event) => {
            event.preventDefault(); try { await submitAnnouncement(form, form.dataset.id); } catch (error) { window.alert(error?.message || 'Could not update announcement.'); }
          }));
        };
        readForm.addEventListener('submit', async (event) => {
          event.preventDefault();
          const viewReason = String(new FormData(readForm).get('viewReason') || '').trim();
          if (viewReason.length < 8) { settingsHost.innerHTML = errorMessage('A view reason of at least 8 characters is required.'); return; }
          settingsHost.innerHTML = '<p class="rounded-xl bg-white dark:bg-ink-900 p-4 text-sm text-slate-500">Loading settings…</p>';
          try { await loadSettings(viewReason); } catch (error) { settingsHost.innerHTML = errorMessage(error?.message || 'Could not load admin settings.'); }
        });
      } else if (page === 'admins') {
        host.innerHTML = `<div><h2 class="text-xl font-extrabold">Admin access</h2><p class="mt-1 text-sm text-slate-500">Only super admins can invite accounts, change roles, deactivate admins, or revoke sessions. The first super admin must be provisioned through the deployment runbook.</p><section class="mt-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900 p-5"><h3 class="font-bold">Invite administrator</h3><form id="adminInviteForm" class="mt-3 grid gap-3 md:grid-cols-[1fr_180px_1fr_auto] md:items-end"><label class="block text-sm font-semibold">Email<input name="email" type="email" required class="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-3"></label><label class="block text-sm font-semibold">Role<select name="role" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-3"><option value="admin">Admin · MFA required</option><option value="support">Support</option><option value="read_only">Read only</option></select></label><label class="block text-sm font-semibold">Reason<input name="reason" minlength="8" maxlength="500" required placeholder="Why this access is needed" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-3"></label><button class="rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white">Send invite</button></form><p id="adminInviteMessage" class="mt-3 min-h-5 text-sm text-slate-500"></p></section><section class="mt-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900 p-5"><h3 class="font-bold">Admin accounts and active sessions</h3><form id="adminRosterForm" class="mt-3 flex flex-wrap items-end gap-3"><label class="block min-w-[260px] flex-1 text-sm font-semibold">View reason<input name="viewReason" minlength="8" maxlength="500" required placeholder="At least 8 characters" class="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-3"></label><button class="rounded-xl border border-slate-200 dark:border-white/10 px-4 py-3 font-semibold">Load roster</button></form><div id="adminRoster" class="mt-4"><p class="text-sm text-slate-500">Admin emails and session metadata are hidden until you provide a reason.</p></div></section></div>`;
        const inviteForm = document.getElementById('adminInviteForm');
        const inviteMessage = document.getElementById('adminInviteMessage');
        const rosterForm = document.getElementById('adminRosterForm');
        const roster = document.getElementById('adminRoster');
        const loadRoster = async (viewReason) => {
          const data = await adminRequest('admin-admin-list', { viewReason, page: 1 });
          const adminRows = data.admins.map((account) => `<tr class="border-b border-slate-100 dark:border-white/5 align-top"><td class="p-3">${esc(account.email || 'No email')}<p class="mt-1 text-xs text-slate-400">${esc(account.user_id)}</p></td><td class="p-3">${esc(roleLabel(account.role))}</td><td class="p-3">${esc(account.is_active ? 'Active' : 'Inactive')}</td><td class="p-3">${esc(account.lastSignInAt ? new Date(account.lastSignInAt).toLocaleString() : 'Never')}</td><td class="p-3"><form data-admin-role-form data-user-id="${esc(account.user_id)}" class="grid min-w-[250px] gap-2"><select name="role" class="rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-2 py-2 text-xs"><option value="super_admin" ${account.role === 'super_admin' ? 'selected' : ''}>Super admin</option><option value="admin" ${account.role === 'admin' ? 'selected' : ''}>Admin</option><option value="support" ${account.role === 'support' ? 'selected' : ''}>Support</option><option value="read_only" ${account.role === 'read_only' ? 'selected' : ''}>Read only</option></select><label class="text-xs"><input name="isActive" type="checkbox" ${account.is_active ? 'checked' : ''}> Active</label><input name="reason" minlength="8" maxlength="500" required placeholder="Change reason · min 8 chars" class="rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-2 py-2 text-xs"><button class="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white">Save role</button></form></td></tr>`).join('');
          const sessionRows = data.sessions.map((session) => `<tr class="border-b border-slate-100 dark:border-white/5 align-top"><td class="p-3">${esc(session.email || session.user_id)}${session.isCurrent ? '<span class="ml-2 rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-600">Current</span>' : ''}<p class="mt-1 text-xs text-slate-400">${esc(session.id)}</p></td><td class="p-3">${esc(session.ip || 'Unknown')}<p class="mt-1 max-w-[240px] break-words text-xs text-slate-400">${esc(session.user_agent || 'Unknown browser')}</p></td><td class="p-3">${esc(new Date(session.last_seen_at).toLocaleString())}<p class="mt-1 text-xs text-slate-400">Expires ${esc(new Date(session.expires_at).toLocaleString())}</p></td><td class="p-3"><button type="button" data-revoke-session="${esc(session.id)}" data-current="${session.isCurrent ? 'true' : 'false'}" class="rounded-lg border border-rose-300 px-3 py-2 text-xs font-bold text-rose-600">Revoke</button></td></tr>`).join('');
          roster.innerHTML = `<h4 class="font-bold">Admin accounts (${data.admins.length})</h4><div class="mt-2 overflow-x-auto"><table class="w-full min-w-[920px] text-left text-sm"><thead><tr class="border-b border-slate-200 dark:border-white/10 text-slate-500"><th class="p-3">Account</th><th class="p-3">Role</th><th class="p-3">Status</th><th class="p-3">Last sign in</th><th class="p-3">Role control</th></tr></thead><tbody>${adminRows || '<tr><td colspan="5" class="p-3 text-slate-500">No admin accounts.</td></tr>'}</tbody></table></div><h4 class="mt-6 font-bold">Active sessions (${data.sessions.length})</h4><div class="mt-2 overflow-x-auto"><table class="w-full min-w-[760px] text-left text-sm"><thead><tr class="border-b border-slate-200 dark:border-white/10 text-slate-500"><th class="p-3">Admin</th><th class="p-3">IP / browser</th><th class="p-3">Last seen / expiry</th><th class="p-3">Action</th></tr></thead><tbody>${sessionRows || '<tr><td colspan="4" class="p-3 text-slate-500">No active sessions.</td></tr>'}</tbody></table></div>`;
          roster.querySelectorAll('[data-admin-role-form]').forEach((form) => form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const values = new FormData(form);
            const reason = String(values.get('reason') || '').trim();
            if (reason.length < 8) { inviteMessage.textContent = 'Provide an admin role-change reason of at least 8 characters.'; return; }
            const button = form.querySelector('button');
            button.disabled = true;
            try {
              await adminRequest('admin-admin-role-update', {
                userId: form.dataset.userId, role: String(values.get('role')),
                isActive: form.elements.isActive.checked, reason
              });
              inviteMessage.textContent = 'Admin role updated and audit recorded.';
              await loadRoster(viewReason);
            } catch (error) {
              inviteMessage.textContent = error?.message || 'Could not update admin role.';
              button.disabled = false;
            }
          }));
          roster.querySelectorAll('[data-revoke-session]').forEach((button) => button.addEventListener('click', async () => {
            const reason = window.prompt('Why are you revoking this admin session? The reason will be audited.');
            if (!reason || reason.trim().length < 8) { inviteMessage.textContent = 'A session-revocation reason of at least 8 characters is required.'; return; }
            if (!window.confirm('Revoke this session now? Its next admin request will be denied.')) return;
            button.disabled = true;
            try {
              await adminRequest('admin-admin-session-revoke', { sessionId: button.dataset.revokeSession, reason: reason.trim() });
              if (button.dataset.current === 'true') { window.location.replace(ADMIN_ACCESS_PATH); return; }
              inviteMessage.textContent = 'Admin session revoked and audit recorded.';
              await loadRoster(viewReason);
            } catch (error) { inviteMessage.textContent = error?.message || 'Could not revoke session.'; button.disabled = false; }
          }));
        };
        inviteForm.addEventListener('submit', async (event) => {
          event.preventDefault();
          const values = new FormData(inviteForm);
          inviteMessage.textContent = 'Sending invite…';
          try {
            const result = await adminRequest('admin-admin-invite', {
              email: String(values.get('email') || ''), role: String(values.get('role') || ''), reason: String(values.get('reason') || '')
            });
            inviteMessage.textContent = `Invite sent to ${result.email} as ${roleLabel(result.role)}.`;
            inviteForm.reset();
          } catch (error) { inviteMessage.textContent = error?.message || 'Could not send invite.'; }
        });
        rosterForm.addEventListener('submit', async (event) => {
          event.preventDefault();
          const viewReason = String(new FormData(rosterForm).get('viewReason') || '').trim();
          if (viewReason.length < 8) { roster.innerHTML = errorMessage('A view reason of at least 8 characters is required.'); return; }
          roster.innerHTML = '<p class="text-sm text-slate-500">Loading admin accounts and sessions…</p>';
          try { await loadRoster(viewReason); } catch (error) { roster.innerHTML = errorMessage(error?.message || 'Could not load the admin roster.'); }
        });
      } else {
        const data = await adminRequest('admin-audit-list', { page: 1, perPage: 100 });
        host.innerHTML = `<div><h2 class="text-xl font-extrabold">Admin audit</h2><p class="mt-1 text-sm text-slate-500">Append-only administrative activity. Read operations and sensitive-content view reasons are recorded here.</p><div class="mt-4 overflow-x-auto"><table class="w-full min-w-[1100px] text-left text-sm"><thead><tr class="border-b border-slate-200 dark:border-white/10 text-slate-500"><th class="p-3">When</th><th class="p-3">Admin ID</th><th class="p-3">Action</th><th class="p-3">Target</th><th class="p-3">Reason / metadata</th><th class="p-3">IP / browser</th></tr></thead><tbody>${data.logs.map((log) => `<tr class="border-b border-slate-100 dark:border-white/5 align-top"><td class="p-3">${esc(new Date(log.created_at).toLocaleString())}</td><td class="p-3">${esc(log.admin_id || 'Deleted admin')}</td><td class="p-3">${esc(log.action)}</td><td class="p-3">${esc([log.target_table, log.target_id].filter(Boolean).join(' · ') || '—')}</td><td class="p-3"><pre class="max-w-[420px] whitespace-pre-wrap break-words text-xs">${esc(JSON.stringify(log.metadata || {}, null, 2))}</pre></td><td class="p-3 text-xs">${esc(log.ip || 'Unknown')}<p class="mt-1 max-w-[240px] break-words text-slate-400">${esc(log.user_agent || '')}</p></td></tr>`).join('') || '<tr><td colspan="6" class="p-4 text-slate-500">No admin actions recorded yet.</td></tr>'}</tbody></table></div></div>`;
      }
    } catch (error) {
      host.innerHTML = errorMessage(error?.message || 'Admin data could not be loaded.');
    }
  }
  document.querySelectorAll('.admin-nav').forEach((button) => button.addEventListener('click', () => show(button.dataset.page)));
  await show('overview');
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED' && session?.access_token) saveAdminSession(session).catch(() => {});
  });
}

export async function mountAdmin() {
  const supabase = await window.yereSupabaseReady;
  if (!supabase) {
    renderLogin('Cloud authentication is unavailable. Try again later.');
    return;
  }
  if (window.location.pathname === ADMIN_ACCESS_PATH) return mountLogin(supabase);
  try {
    await mountDashboard(supabase);
  } catch (error) {
    console.error('Admin interface failed:', error);
    renderLogin('Your admin session needs attention. Sign in again.');
  }
}
