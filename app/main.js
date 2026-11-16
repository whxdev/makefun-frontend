/* EXSALA HERMES MOD · powered by Gienetic */
/* Hash router + app behaviour. Only #app is swapped; header/footer persist. */

import { clearCache } from './api.js';
import { esc, timeLeft } from './format.js';
import { boardView, bountyView, leaderboardView, profileView } from './views.js';

const ROUTES = {
  /* args() unwraps route.params into the positional arguments each view takes. */
  board: {
    view: boardView,
    args: () => [],
    title: () => 'make.fun · open bounties',
  },
  bounty: {
    view: bountyView,
    args: (p) => [p.slug],
    title: (p) => `${p.slug} · make.fun`,
  },
  leaderboard: {
    view: leaderboardView,
    args: (p) => [p.slug],
    title: (p) => `Leaderboard · ${p.slug} · make.fun`,
  },
  profile: {
    view: profileView,
    args: (p) => [p.handle],
    title: (p) => `@${p.handle} · make.fun`,
  },
};

/* ---------------------------------------------------------------- routing */

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** '#/bounty/foo/leaderboard' -> { name: 'leaderboard', params: {...} } */
function parseRoute(hash) {
  const raw = String(hash || '').replace(/^#/, '').split('?')[0];
  const parts = raw.split('/').filter(Boolean);

  if (parts[0] === 'bounty' && parts[1]) {
    const slug = safeDecode(parts[1]);
    if (parts[2] === 'leaderboard') return { name: 'leaderboard', params: { slug } };
    return { name: 'bounty', params: { slug } };
  }

  if (parts[0] === 'u' && parts[1]) {
    return { name: 'profile', params: { handle: safeDecode(parts[1]) } };
  }

  return { name: 'board', params: {} };
}

function normPath(hash) {
  const raw = String(hash || '').replace(/^#/, '').split('?')[0].replace(/\/+$/, '');
  return raw || '/';
}

/* ------------------------------------------------------------- chrome i18n */

function skeleton(route) {
  const cards = route.name === 'board' ? 3 : 2;
  const card = '<div class="sk-card"></div>'.repeat(cards);
  return `<div class="skeleton" aria-busy="true" aria-live="polite">
      <div class="sk-bar sk-title"></div>
      <div class="sk-bar"></div>
      <div class="sk-bar sk-short"></div>
      ${card}
    </div>`;
}

function errorMarkup(err) {
  const message = (err && (err.message || err.status)) || 'Something went wrong';
  return `<div class="error" role="alert">
      <h2>Could not load this view</h2>
      <p>${esc(message)}</p>
      <button type="button" class="btn" data-retry>Retry</button>
    </div>`;
}

function updateNav(route) {
  const current = parseRoute(location.hash);
  const currentPath = normPath(location.hash);

  document.querySelectorAll('[data-nav]').forEach((el) => {
    const raw = el.dataset.nav || el.getAttribute('href') || '';
    const targetPath = normPath(raw);
    const target = parseRoute(raw);

    const sameRoute =
      target.name === current.name &&
      JSON.stringify(target.params) === JSON.stringify(current.params);
    const nested = targetPath !== '/' && currentPath.startsWith(targetPath + '/');
    const active = sameRoute || nested;

    el.classList.toggle('active', active);
    if (active) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });

  void route;
}

/* -------------------------------------------------------------- rendering */

let runId = 0;

async function navigate() {
  const id = ++runId;
  const route = parseRoute(location.hash);
  const def = ROUTES[route.name] || ROUTES.board;
  const root = document.getElementById('app');

  window.__shotReady = false;
  updateNav(route);
  document.title = def.title(route.params);
  window.scrollTo(0, 0);

  if (!root) return;
  root.innerHTML = skeleton(route);

  try {
    const html = await def.view(...def.args(route.params));
    if (id !== runId) return; // superseded by a newer navigation
    root.innerHTML = html === null || html === undefined ? '' : String(html);
  } catch (err) {
    if (id !== runId) return;
    console.error('[router]', route.name, err);
    root.innerHTML = errorMarkup(err);
  }

  window.scrollTo(0, 0);
  tickDeadlines();
  window.__shotReady = true;
}

function rerun(target) {
  if (typeof target === 'string' && target) {
    if (normPath(location.hash) === normPath(target)) return navigate();
    location.hash = target;
    return undefined;
  }
  return navigate();
}

/* --------------------------------------------------------------- ticking */

function tickDeadlines() {
  document.querySelectorAll('[data-deadline]').forEach((el) => {
    const iso = el.dataset.deadline;
    if (!iso) return;

    const next = timeLeft(iso);
    const node = el.firstChild;

    if (node && node.nodeType === 3) {
      if (node.nodeValue !== next) node.nodeValue = next;
    } else if (el.textContent !== next) {
      el.textContent = next;
    }
  });
}

/* ---------------------------------------------------------------- header */

function wireHeader() {
  const form = document.getElementById('profile-jump');

  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = form.querySelector('input');
      const value = String((input && input.value) || '')
        .trim()
        .replace(/^@+/, '')
        .replace(/^\/+|\/+$/g, '');

      if (!value) return;
      if (input) input.blur();

      const next = `#/u/${encodeURIComponent(value)}`;
      if (location.hash === next) navigate();
      else location.hash = next;
    });
  }

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const retry = target.closest('[data-retry]');
    if (retry) {
      event.preventDefault();
      clearCache();
      navigate();
      return;
    }

    const nav = target.closest('[data-nav]');
    if (nav && nav.tagName !== 'A') {
      const href = nav.dataset.nav || nav.getAttribute('href');
      if (!href) return;
      event.preventDefault();
      rerun(href);
    }
  });
}

/* ------------------------------------------------------------------ boot */

function boot() {
  window.__shotReady = false;
  wireHeader();

  window.addEventListener('hashchange', navigate);
  window.addEventListener('popstate', navigate);

  setInterval(tickDeadlines, 30_000);

  navigate();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
