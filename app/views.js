/* EXSALA HERMES MOD · powered by Gienetic
 * app/views.js — board / bounty / leaderboard / profile views.
 *
 * Contract: every view is async and returns an HTML string. The hash router
 * swaps it into #app. Fetches are NOT wrapped in try/catch for the primary
 * request, so any rejection propagates to the router's error state. Views that
 * need interactivity (board search/sort, leaderboard paging) bind their own
 * listeners on the next animation frame, after the router has swapped innerHTML.
 *
 * No external assets. All interpolated text goes through esc().
 */
import { getBounties, getBounty, getLeaderboard, getProfile } from './api.js';
import { esc, money, date, timeLeft, shortWallet } from './format.js';

const HOUR = 3.6e6;
const LB_PAGE = 100;

/* ------------------------------------------------------------------ utils */

const str = (v) => (v == null ? '' : String(v));

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function cash(v) {
  const n = num(v);
  if (n == null) return '—';
  try {
    const s = money(n);
    return s == null || s === '' ? '—' : String(s);
  } catch {
    return '—';
  }
}

function when(iso) {
  try {
    const s = date(iso);
    return s == null || s === '' ? '—' : String(s);
  } catch {
    return '—';
  }
}

function left(iso) {
  try {
    const s = timeLeft(iso);
    return s == null || s === '' ? '—' : String(s);
  } catch {
    return '—';
  }
}

function msLeft(iso) {
  const t = Date.parse(str(iso));
  return Number.isFinite(t) ? t - Date.now() : null;
}

function urgency(iso) {
  const ms = msLeft(iso);
  if (ms == null || ms <= 0) return '';
  if (ms < 6 * HOUR) return ' urgent';
  if (ms < 48 * HOUR) return ' soon';
  return '';
}

/** Deadline chip — always carries data-deadline so the router ticker can refresh it. */
function chipTime(iso) {
  if (!iso) return '';
  return `<span class="chip chip-time${urgency(iso)}" data-deadline="${esc(str(iso))}">${esc(left(iso))}</span>`;
}

function count(n, one, many) {
  const v = num(n) ?? 0;
  return `${v} ${v === 1 ? one : many}`;
}

function empty(msg) {
  return `<div class="empty"><p>${esc(msg)}</p></div>`;
}

function itemsOf(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function potOf(it) {
  return num(it?.potUsd ?? it?.rewardAmount);
}

function entriesOf(it) {
  const n = num(it?.submissionCount);
  if (n != null) return n;
  return Array.isArray(it?.submissions) ? it.submissions.length : 0;
}

/** Run fn after the router has swapped innerHTML; retry a few frames if the DOM is not there yet. */
function frame(fn) {
  let attempts = 0;
  const tick = () => {
    attempts += 1;
    let ok = false;
    try {
      ok = fn() !== false;
    } catch (err) {
      console.error(err);
    }
    if (!ok && attempts < 30) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ------------------------------------------------------------------ board */

const SORTERS = {
  pot: (a, b) => (potOf(b) ?? -1) - (potOf(a) ?? -1),
  soon: (a, b) => (msLeft(a?.deadline) ?? Infinity) - (msLeft(b?.deadline) ?? Infinity),
  entries: (a, b) => entriesOf(b) - entriesOf(a),
};

function cardHTML(it) {
  const slug = str(it?.slug);
  const fee = num(it?.entryFeeUsd) ?? 0;
  const feeChip =
    fee > 0
      ? `<span class="chip chip-fee">${esc(cash(fee))} entry fee</span>`
      : `<span class="chip chip-free">Free entry</span>`;
  const catChip = it?.category ? `<span class="chip chip-cat">${esc(str(it.category))}</span>` : '';

  return `<a class="card" href="#/bounty/${encodeURIComponent(slug)}">
      <h3 class="card-title">${esc(str(it?.title) || 'Untitled bounty')}</h3>
      <p class="card-summary">${esc(str(it?.summary))}</p>
      <div class="pot">${esc(cash(potOf(it)))}<span class="pot-label"> pot</span></div>
      <div class="chips">${feeChip}${chipTime(it?.deadline)}${catChip}</div>
      <div class="card-meta">
        <span class="card-meta-entries">${esc(count(entriesOf(it), 'entry', 'entries'))}</span>
        <span class="card-meta-dot">·</span>
        <span class="card-meta-status">${esc(str(it?.status) || 'open')}</span>
      </div>
    </a>`;
}

function gridHTML(state) {
  const q = state.q.trim().toLowerCase();
  const rows = state.items
    .filter((it) => !q || `${str(it?.title)} ${str(it?.summary)}`.toLowerCase().includes(q))
    .slice()
    .sort(SORTERS[state.sort] || SORTERS.pot);

  if (!rows.length) {
    return state.items.length
      ? empty(`No bounties match "${str(state.q).trim()}".`)
      : empty('No open bounties right now — check back soon.');
  }
  return rows.map(cardHTML).join('');
}

export async function boardView() {
  const items = itemsOf(await getBounties()).filter(Boolean);

  const totalPot = items.reduce((sum, it) => sum + (potOf(it) ?? 0), 0);
  const closing = items.filter((it) => {
    const ms = msLeft(it?.deadline);
    return ms != null && ms > 0 && ms < 48 * HOUR;
  }).length;
  const totalEntries = items.reduce((sum, it) => sum + entriesOf(it), 0);

  const state = { items, q: '', sort: 'pot' };

  const html = `<section class="view view-board">
      <div class="hero">
        <h1 class="hero-title">Open bounties</h1>
        <p class="hero-sub">Ship good work, get paid from the pot.</p>
        <div class="hero-stats">
          <div class="hero-stat"><span class="hero-stat-value">${esc(cash(totalPot))}</span><span class="hero-stat-label">Live pot</span></div>
          <div class="hero-stat"><span class="hero-stat-value">${esc(String(items.length))}</span><span class="hero-stat-label">Open bounties</span></div>
          <div class="hero-stat"><span class="hero-stat-value">${esc(String(closing))}</span><span class="hero-stat-label">Closing in 48h</span></div>
          <div class="hero-stat"><span class="hero-stat-value">${esc(String(totalEntries))}</span><span class="hero-stat-label">Total entries</span></div>
        </div>
      </div>
      <div class="controls">
        <input id="board-search" class="search" type="search" placeholder="Search bounties…" autocomplete="off" spellcheck="false" aria-label="Search bounties" />
        <select id="board-sort" class="select" aria-label="Sort bounties">
          <option value="pot">Biggest pot</option>
          <option value="soon">Ending soon</option>
          <option value="entries">Most entries</option>
        </select>
      </div>
      <div class="grid" id="board-grid">${gridHTML(state)}</div>
    </section>`;

  frame(() => {
    const grid = document.getElementById('board-grid');
    const search = document.getElementById('board-search');
    const sort = document.getElementById('board-sort');
    if (!grid || !search || !sort) return false;

    const paint = () => {
      grid.innerHTML = gridHTML(state);
    };
    let queued = 0;

    search.addEventListener('input', () => {
      state.q = search.value;
      if (queued) cancelAnimationFrame(queued);
      queued = requestAnimationFrame(() => {
        queued = 0;
        paint();
      });
    });
    sort.addEventListener('change', () => {
      state.sort = sort.value;
      paint();
    });
    return true;
  });

  return html;
}

/* ----------------------------------------------------------------- bounty */

function rewardRows(source) {
  let rows = [];

  if (Array.isArray(source)) {
    rows = source
      .filter((r) => r && typeof r === 'object')
      .map((r, i) => {
        const place = num(r.place) ?? i + 1;
        const feeShare = num(r.feeShareUsd) ?? 0;
        const note = feeShare > 0 ? `base ${money(r.baseUsd)} + ${money(r.feeShareUsd)} entry fees` : '';
        return { place, amount: r.amountUsd ?? r.amount ?? r.usd, note };
      });
  } else if (source && typeof source === 'object') {
    rows = Object.entries(source).map(([place, value]) => ({
      place: num(place),
      amount: value,
      note: '',
    }));
  }

  rows = rows.filter((r) => r.place != null).sort((a, b) => a.place - b.place);
  if (!rows.length) return '';

  return rows
    .map(
      (r) =>
        `<tr><td>#${esc(String(r.place))}</td><td class="num">${esc(cash(r.amount))}</td><td>${esc(r.note)}</td></tr>`,
    )
    .join('');
}

function metaCell(label, value) {
  return `<div class="meta"><span class="meta-label">${esc(label)}</span><span class="meta-value">${value}</span></div>`;
}

/** Description → paragraphs. Escaped, never HTML. */
function prose(text) {
  const body = str(text).replace(/\r\n?/g, '\n').trim();
  if (!body) return `<div class="prose"><p>No description provided.</p></div>`;
  const paragraphs = body
    .split(/\n{2,}/)
    .map((block) => `<p>${esc(block.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('');
  return `<div class="prose">${paragraphs}</div>`;
}

export async function bountyView(slug) {
  const raw = await getBounty(slug);
  const b = raw?.competition ?? raw?.bounty ?? raw ?? {};
  const key = str(b.slug) || str(slug);

  const deadline = str(b.deadline);
  const fee = num(b.entryFeeUsd) ?? 0;
  const status = str(b.status) || 'open';

  const sponsor = b.sponsor;
  const sponsorTxt =
    typeof sponsor === 'string'
      ? sponsor
      : str(sponsor?.name ?? sponsor?.handle ?? sponsor?.title ?? '');

  const rewards =
    Array.isArray(b.rewardsNow) && b.rewardsNow.length
      ? b.rewardsNow
      : b.rewards && typeof b.rewards === 'object' && !Array.isArray(b.rewards)
        ? b.rewards
        : null;
  const rewardBody = rewardRows(rewards);

  const cells = [
    metaCell('Pot (live)', esc(cash(b.potUsd ?? b.rewardAmount))),
    metaCell('Entry fee', esc(fee > 0 ? cash(fee) : 'Free')),
    metaCell('Deadline', deadline ? `${esc(when(deadline))} ${chipTime(deadline)}` : '—'),
    metaCell('Entries', esc(str(entriesOf(b)))),
    metaCell('Category', esc(str(b.category) || '—')),
  ];
  if (sponsorTxt) cells.push(metaCell('Sponsor', esc(sponsorTxt)));

  return `<section class="view view-bounty">
      <a class="crumb" href="#/">← All bounties</a>
      <div class="detail-head">
        <div class="detail-title-row">
          <h1 class="detail-title">${esc(str(b.title) || 'Bounty')}</h1>
          <span class="pill">${esc(status)}</span>
        </div>
        <p class="detail-summary">${esc(str(b.summary))}</p>
      </div>
      <div class="meta-grid">${cells.join('')}</div>
      ${
        rewardBody
          ? `<div class="section">
        <h2 class="section-title">Rewards</h2>
        <table class="tbl">
          <thead><tr><th>Place</th><th class="num">Amount</th><th>Note</th></tr></thead>
          <tbody>${rewardBody}</tbody>
        </table>
      </div>`
          : ''
      }
      <div class="section">
        <h2 class="section-title">About this bounty</h2>
        ${prose(b.description)}
      </div>
      <div class="actions">
        <a class="btn-primary" href="#/bounty/${encodeURIComponent(key)}/leaderboard">View leaderboard</a>
        <a class="btn-ghost" href="https://make.fun/bounty/${encodeURIComponent(key)}" target="_blank" rel="noopener noreferrer">Enter on make.fun</a>
      </div>
    </section>`;
}

/* ------------------------------------------------------------ leaderboard */

function prizeMap(rewards) {
  const map = new Map();
  if (!Array.isArray(rewards)) return null;
  for (const r of rewards) {
    const place = num(r?.place ?? r?.rank);
    const amount = num(r?.amount ?? r?.usd);
    if (place != null && amount != null) map.set(place, amount);
  }
  return map.size ? map : null;
}

function lbRow(entry, prizes) {
  const rank = num(entry?.rank);
  const medal = rank === 1 ? ' medal-1' : rank === 2 ? ' medal-2' : rank === 3 ? ' medal-3' : '';
  const rankCell =
    rank == null
      ? '<span class="rank">—</span>'
      : `<span class="rank${medal}">${esc(String(rank))}</span>`;

  const image = str(entry?.image);
  const handle = str(entry?.handle);
  const avatar = image
    ? `<img class="avatar-20" src="${esc(image)}" alt="" width="20" height="20" loading="lazy" style="width:20px;height:20px;border-radius:50%;object-fit:cover" />`
    : '';
  const who = handle
    ? `<a class="handle" href="#/u/${encodeURIComponent(handle)}">${esc(handle)}</a>`
    : '<span class="muted">Anonymous</span>';

  const prizeRank = num(entry?.prize_rank);
  let prize = '—';
  if (prizeRank != null) {
    prize = prizes && prizes.has(prizeRank) ? cash(prizes.get(prizeRank)) : `#${prizeRank} prize`;
  }

  return `<tr>
      <td class="rank-cell">${rankCell}</td>
      <td class="entrant-cell"><span class="entrant">${avatar}<span class="entrant-name">${who}</span></span></td>
      <td class="entry-cell">${esc(str(entry?.title) || '—')}</td>
      <td class="prize-cell">${esc(prize)}</td>
      <td class="status-cell">${esc(str(entry?.status) || '—')}</td>
    </tr>`;
}

export async function leaderboardView(slug) {
  const [raw, bountyRaw] = await Promise.all([
    getLeaderboard(slug),
    getBounty(slug).catch(() => null),
  ]);

  const comp = raw?.competition ?? {};
  const phase = raw?.phase ?? {};
  const entries = Array.isArray(raw?.entries) ? raw.entries : [];
  const key = str(comp.slug) || str(slug);

  const b = bountyRaw?.competition ?? bountyRaw?.bounty ?? bountyRaw ?? {};
  const prizes = prizeMap(
    Array.isArray(b.rewardsNow) && b.rewardsNow.length ? b.rewardsNow : b.rewards,
  );

  const phaseEnds = str(phase.ends_at) || '';

  if (entries.length > LB_PAGE) mountLeaderboard(entries, prizes);

  return `<section class="view view-leaderboard">
      <a class="crumb" href="#/bounty/${encodeURIComponent(key)}">← Back to bounty</a>
      <div class="lb-head">
        <h1 class="lb-title">${esc(str(comp.title) || str(b.title) || 'Leaderboard')}</h1>
        <div class="lb-phase">
          <span class="pill">${esc(str(phase.title) || 'Leaderboard')}</span>
          ${phaseEnds ? `${chipTime(phaseEnds)}` : ''}
        </div>
      </div>
      ${raw?.metrics_withheld ? '<p class="note">Some metrics are withheld until the heat ends.</p>' : ''}
      ${
        entries.length
          ? `<table class="tbl tbl-lb">
        <thead><tr><th>Rank</th><th>Entrant</th><th>Entry</th><th>Prize</th><th>Status</th></tr></thead>
        <tbody id="lb-rows">${entries.slice(0, LB_PAGE).map((e) => lbRow(e, prizes)).join('')}</tbody>
      </table>
      <div class="lb-foot">${entries.length > LB_PAGE ? `<button class="btn-ghost show-more" id="lb-more" type="button">Show ${Math.min(LB_PAGE, entries.length - LB_PAGE)} more</button>` : ''}<span class="muted lb-count">${esc(count(entries.length, 'entry', 'entries'))}</span></div>`
          : empty('No entries yet — the board is wide open.')
      }
    </section>`;
}

/** Paging is wired here (not in the template string) — the router owns innerHTML. */
export function mountLeaderboard(entries, prizes) {
  frame(() => {
    const body = document.getElementById('lb-rows');
    const more = document.getElementById('lb-more');
    if (!body || !more) return false;

    let shown = body.children.length;
    more.addEventListener('click', () => {
      const slice = entries.slice(shown, shown + LB_PAGE);
      body.insertAdjacentHTML('beforeend', slice.map((e) => lbRow(e, prizes)).join(''));
      shown += slice.length;
      if (shown >= entries.length) more.remove();
      else more.textContent = `Show ${Math.min(LB_PAGE, entries.length - shown)} more`;
    });
    return true;
  });
}

/* --------------------------------------------------------------- profile */

function walletAddress(p) {
  const w = p?.wallet;
  if (!w) return '';
  if (typeof w === 'string') return w.trim();
  return str(w.address ?? w.addr ?? '');
}

function walletShort(addr) {
  try {
    const s = shortWallet(addr);
    return s == null || s === '' ? addr : String(s);
  } catch {
    return addr;
  }
}

function socialLink(kind, value) {
  const v = str(value).trim();
  if (!v) return '';
  const label = kind === 'x' ? 'X' : kind === 'github' ? 'GitHub' : 'Discord';
  const isUrl = /^https?:\/\//i.test(v);
  let href = '';
  if (isUrl) href = v;
  else if (kind === 'github') href = `https://github.com/${v.replace(/^@/, '')}`;
  else if (kind === 'x') href = `https://x.com/${v.replace(/^@/, '')}`;
  return href
    ? `<a class="link link-${esc(kind)}" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`
    : `<span class="link link-${esc(kind)}">${esc(label)}: ${esc(v)}</span>`;
}

function statCells(p) {
  const cells = [];
  const used = new Set();
  const pick = (keys, label, fmt) => {
    if (used.has(label)) return;
    for (const k of keys) {
      const v = p?.[k];
      if (v == null || v === '') continue;
      used.add(label);
      cells.push(metaCell(label, esc(fmt(v))));
      return;
    }
  };
  pick(['wins', 'total_wins', 'totalWins'], 'Wins', (v) => str(v));
  pick(['earnings', 'total_earnings', 'totalEarnings', 'payoutsUsd'], 'Earnings', cash);
  pick(['rank', 'global_rank'], 'Rank', (v) => `#${str(v)}`);
  pick(['entryCount', 'entries_count', 'entriesCount'], 'Entries', (v) => str(v));
  pick(['submissionCount', 'submissions_count'], 'Submissions', (v) => str(v));
  return cells;
}

function activityRows(list) {
  return list
    .map((it) => {
      const slug = str(
        it?.competition_slug ?? it?.bounty_slug ?? it?.slug ?? it?.competition?.slug ?? '',
      );
      const title = str(
        it?.title ?? it?.competition?.title ?? it?.competition_title ?? it?.competition?.name ?? '',
      );
      const label = title || slug || 'Bounty';
      const cell = slug
        ? `<a class="handle" href="#/bounty/${encodeURIComponent(slug)}">${esc(label)}</a>`
        : esc(label);
      return `<tr><td>${cell}</td><td>${esc(str(it?.status) || '—')}</td></tr>`;
    })
    .join('');
}

export async function profileView(handle) {
  const raw = await getProfile(handle);
  const p = raw?.profile ?? raw ?? {};
  const h = str(p.handle) || str(handle);
  const name = str(p.display_name) || h || 'Anonymous';
  const bio = str(p.bio);
  const image = str(p.image);
  const addr = walletAddress(p);

  const links = [
    socialLink('github', p.github_login),
    socialLink('x', p.x),
    socialLink('discord', p.discord),
  ]
    .filter(Boolean)
    .join('');

  const avatar = image
    ? `<img class="avatar-72" src="${esc(image)}" alt="" width="72" height="72" loading="lazy" style="width:72px;height:72px;border-radius:50%;object-fit:cover" />`
    : '';

  const stats = statCells(p);
  const list = Array.isArray(p.entries)
    ? p.entries
    : Array.isArray(p.submissions)
      ? p.submissions
      : [];
  const rows = activityRows(list);

  const activity = rows
    ? `<div class="section">
        <h2 class="section-title">Activity</h2>
        <table class="tbl">
          <thead><tr><th>Bounty</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
    : stats.length
      ? ''
      : empty('No public activity yet.');

  return `<section class="view view-profile">
      <a class="crumb" href="#/">← All bounties</a>
      <div class="profile-head">
        ${avatar}
        <div class="profile-id">
          <h1 class="profile-name">${esc(name)}</h1>
          <div class="profile-handle">@${esc(h)}</div>
          ${bio ? `<p class="profile-bio">${esc(bio)}</p>` : ''}
          ${links ? `<div class="profile-links">${links}</div>` : ''}
          ${
            addr
              ? `<div class="wallet" title="${esc(addr)}"><span class="wallet-label">Wallet</span> <code class="wallet-addr">${esc(walletShort(addr))}</code></div>`
              : ''
          }
        </div>
      </div>
      ${stats.length ? `<div class="meta-grid">${stats.join('')}</div>` : ''}
      ${activity}
    </section>`;
}
