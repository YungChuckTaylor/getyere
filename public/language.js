/* Shared, dependency-free language module for web, installed apps and legal pages.
 * Translates only explicitly marked, source-authored UI. Never walks arbitrary text,
 * changes form values, translates user content or sends text to a remote service.
 */
(() => {
  'use strict';
  const messages = globalThis.YERE_MESSAGES || { en: {}, fr: {} };
  const keyFor = new Map(Object.entries(messages.en).map(([key, value]) => [value, key]));
  // Legal/support language is independent of the app UI. Do not reuse the old
  // global Yere.language key: it could have been written on either surface.
  const documentPath = location.pathname.replace(/^\/(en|fr)(?=\/)/, '').replace(/\/$/, '');
  const legalDocument = ['/privacy-policy', '/termsofuse', '/support.html', '/privacy.html', '/privacy-fr.html', '/terms.html', '/terms-fr.html', '/support-en.html'].includes(documentPath);
  const storageKey = legalDocument ? 'Yere.legalLanguage' : 'Yere.appLanguage';
  const defaultLanguage = legalDocument ? 'fr' : 'en';
  const valid = value => value === 'en' || value === 'fr';
  const stored = () => { try { return localStorage.getItem(storageKey); } catch { return null; } };
  const internalAdmin = /^\/admin(?:\/|$|-access$)/.test(location.pathname);
  const explicit = legalDocument ? (/^\/(en|fr)\//.exec(location.pathname)?.[1] || null) : null;
  let language = internalAdmin ? 'en' : explicit || (valid(stored()) ? stored() : defaultLanguage);
  const save = value => { try { localStorage.setItem(storageKey, value); } catch { /* Session preference still works. */ } };
  if (explicit) save(language);
  document.documentElement.lang = language;
  document.documentElement.classList.add('yere-language-loading');
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lookup = source => keyFor.get(source) || keyFor.get(String(source).replaceAll('&amp;','&'));
  const text = (source, params = {}) => {
    const key = lookup(source) || source;
    const value = messages[language]?.[key] ?? messages.en[key] ?? source;
    return String(value).replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (match, name) => Object.hasOwn(params, name) ? String(params[name]) : match);
  };
  const html = (source, params = {}) => {
    const key = lookup(source);
    return key ? `<span data-i18n="${key}" data-i18n-params="${escape(JSON.stringify(params))}">${escape(text(source, params))}</span>` : escape(source);
  };
  const option = (value, label, selected = false) => {
    const key = lookup(label);
    return `<option value="${escape(value)}"${selected ? ' selected' : ''}${key ? ` data-i18n="${key}"` : ''}>${escape(text(label))}</option>`;
  };
  const bindAttribute = (element, attr, source) => {
    if (!element || !['placeholder','title','aria-label'].includes(attr)) return;
    const key = lookup(source);
    if (key) element.setAttribute(`data-i18n-${attr}`,key);
    element.setAttribute(attr,text(source));
  };
  const bindText = (element, source) => {
    if (!element) return;
    const key = keyFor.get(source);
    if (key) element.setAttribute('data-i18n', key); else element.removeAttribute('data-i18n');
    element.textContent = text(source);
  };
  function apply(root = document) {
    const selector = '[data-i18n], [data-i18n-placeholder], [data-i18n-title], [data-i18n-aria-label]';
    const nodes = [...(root.matches?.(selector) ? [root] : []), ...(root.querySelectorAll?.(selector) || [])];
    for (const element of nodes) {
      const key = element.getAttribute('data-i18n');
      // A translation never replaces controls, nested markup, or editable content.
      if (key && messages.en[key] !== undefined && !element.children.length && !element.isContentEditable) {
        let params = {};
        try { params = JSON.parse(element.getAttribute('data-i18n-params') || '{}'); if (!params || typeof params !== 'object' || Array.isArray(params)) params = {}; } catch { /* No dynamic substitution. */ }
        const value = text(messages.en[key],params);
        if (element.textContent !== value) element.textContent = value;
      }
      for (const attr of ['placeholder', 'title', 'aria-label']) {
        const attrKey = element.getAttribute(`data-i18n-${attr}`);
        if (attrKey && messages.en[attrKey] !== undefined) {
          const value = messages[language]?.[attrKey] ?? messages.en[attrKey];
          if (element.getAttribute(attr) !== value) element.setAttribute(attr, value);
        }
      }
    }
    for (const select of document.querySelectorAll('[data-language-select]')) select.value = language;
  }
  const legalPath = () => { const path=location.pathname.replace(/^\/(en|fr)(?=\/)/, '').replace(/\/$/, ''); return ({'/privacy.html':'/privacy-policy','/privacy-fr.html':'/privacy-policy','/terms.html':'/termsofuse','/terms-fr.html':'/termsofuse','/support-en.html':'/support.html'})[path] || path; };
  const isLegal = () => Boolean(document.body?.dataset.legalLanguage);
  function legalDestination(value) {
    const path = legalPath();
    if (!['/privacy-policy', '/termsofuse', '/support.html'].includes(path)) return null;
    return `${value === 'en' ? '/en' : '/fr'}${path}${location.search}${location.hash}`;
  }
  function setLanguage(value, { persist = true, navigate = true } = {}) {
    if (!valid(value) || (internalAdmin && value !== 'en')) return false;
    language = value;
    if (persist) save(value);
    if (navigate && isLegal() && document.body.dataset.legalLanguage !== value) {
      const destination = legalDestination(value);
      if (destination) { location.assign(destination); return true; }
    }
    document.documentElement.lang = value;
    apply();
    document.dispatchEvent(new CustomEvent('yere:languagechange', { detail: { language: value } }));
    return true;
  }
  function mountSelector() {
    if (document.getElementById('yere-language-bar')) return;
    const bar = document.createElement('nav'); bar.id = 'yere-language-bar'; bar.className = 'yere-language-bar';
    bar.setAttribute('aria-label', 'Langue / Language');
    const label = document.createElement('label'); label.htmlFor = 'yere-language-select'; label.textContent = 'Langue / Language';
    const select = document.createElement('select'); select.id = 'yere-language-select'; select.setAttribute('data-language-select', '');
    for (const [value, name] of [['fr', 'Français'], ['en', 'English']]) {
      const option = document.createElement('option'); option.value = value; option.lang = value; option.textContent = name; select.append(option);
    }
    select.value = language;
    bar.append(label, select); document.body.prepend(bar);
    const measure = () => document.documentElement.style.setProperty('--yere-language-height', `${bar.getBoundingClientRect().height}px`);
    measure();
    if (typeof ResizeObserver === 'function') new ResizeObserver(measure).observe(bar); else addEventListener('resize', measure);
  }
  // A small grammar bridge, not a translation of the stored reminder. Always review
  // the proposed date/time in the existing confirmation form before saving.
  function frenchDateInput(raw) {
    return String(raw)
      .replace(/après[- ]demain/gi, 'in 2 days').replace(/aujourd[’']hui/gi, 'today')
      .replace(/\bdemain\b/gi, 'tomorrow').replace(/\bce soir\b/gi, 'this evening')
      .replace(/\b(tous les|toutes les|chaque)\s+/gi, 'every ')
      .replace(/\bdans\s+(\d+)\s+(minutes?|heures?|jours?|semaines?)\b/gi, (_, n, unit) => `in ${n} ${{minute:'minutes',heure:'hours',jour:'days',semaine:'weeks'}[unit.toLowerCase().replace(/s$/, '')]}`)
      .replace(/\b(lundis?|mardis?|mercredis?|jeudis?|vendredis?|samedis?|dimanches?)\b/gi, value => ({lundi:'monday',mardi:'tuesday',mercredi:'wednesday',jeudi:'thursday',vendredi:'friday',samedi:'saturday',dimanche:'sunday'}[value.toLowerCase().replace(/s$/, '')]))
      .replace(/\bpremier\b/gi, 'first').replace(/\bdu mois\b/gi, 'of the month')
      .replace(/\b(\d{1,2})\s*h\s*(\d{2})?\b/gi, (_, hour, minute) => `${hour}:${minute || '00'}`)
      .replace(/\bà\s+(?=\d)/gi, 'at ').replace(/(^|\s)à\s+(?=\d)/gi, '$1at ');
  }
  globalThis.YERE_I18N = { text, html, option, bindText, bindAttribute, apply, setLanguage, frenchDateInput, get language() { return language; }, get locale() { return language === 'fr' ? 'fr-CA' : 'en-CA'; } };
  document.addEventListener('DOMContentLoaded', () => {
    try {
      if (internalAdmin) return; // The owner console has its own English interface.
      if (isLegal() && !explicit && document.body.dataset.legalLanguage !== language) {
        const destination = legalDestination(language);
        if (destination) { location.replace(destination); return; }
      }
      mountSelector(); apply();
      document.addEventListener('change', event => { if (event.target.matches?.('[data-language-select]')) setLanguage(event.target.value); });
      const observer = new MutationObserver(records => {
        for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 1) apply(node);
      });
      observer.observe(document.body, { childList: true, subtree: true });
    } finally { document.documentElement.classList.remove('yere-language-loading'); }
  }, { once: true });
  addEventListener('storage', event => { if (event.key === storageKey && valid(event.newValue) && event.newValue !== language) setLanguage(event.newValue, { persist: false }); });
})();
