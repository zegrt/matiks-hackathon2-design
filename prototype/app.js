// Dispatch prototype. One state object, one render, event delegation via data-act.
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode: in-memory only */ } },
  };

  const S = {
    view: 'queue', tab: 'review', cohort: 'all',
    filters: { channel: [], category: [], mode: [], lang: [] },
    sel: null, mask: true, offline: false, showOff: false, showFull: false,
    overlay: null, anchor: null, dlg: {}, palQ: '', palI: 0,
    editing: false, editText: '', hot: null, openStep: null,
    toast: null, onSince: Date.now(), icohort: 'all', evalFails: false,
    actor: store.get('dispatch.actor'),
  };

  // ── theme ──
  const sysDark = () => matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = () => store.get('dispatch.theme') || (sysDark() ? 'dark' : 'light');
  const applyTheme = () => { document.documentElement.dataset.theme = theme(); };
  applyTheme();

  // ── formatting ──
  const maskUser = u => u.length <= 4 ? u[0] + '••' : u.slice(0, 2) + '••••' + u.slice(-2);
  const maskEmail = e => { const [l, d] = e.split('@'); const [dn, ...tld] = d.split('.'); return l[0] + '•••@' + dn[0] + '•••.' + tld.join('.'); };
  const maskPhone = p => '••••• ••' + p.replace(/\D/g, '').slice(-3);
  const masked = (raw, kind) => !S.mask ? raw : kind === 'email' ? maskEmail(raw) : kind === 'phone' ? maskPhone(raw) : maskUser(raw);
  const pii = (raw, kind) => raw ? `<span class="pii">${esc(masked(raw, kind))}</span>` : '';
  const whoKey = t => t.reporter.username ? [t.reporter.username, 'user'] : t.reporter.email ? [t.reporter.email, 'email'] : [t.reporter.phone, 'phone'];
  const who = t => pii(...whoKey(t));
  const bodyHTML = s => esc(s).replace(/\{phone:([^}]+)\}/g, (_, p) => pii(p, 'phone'));
  const bodyText = s => s.replace(/\{phone:([^}]+)\}/g, (_, p) => masked(p, 'phone'));
  const money = x => '$' + x.toFixed(4);
  const ageShort = m => m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`;
  const ageLong = m => m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)} days ago`;
  const received = m => new Date(NOW - m * 60000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
  const waitBig = m => m >= 1440 ? `${Math.floor(m / 1440)}d ${String(Math.floor(m % 1440 / 60)).padStart(2, '0')}h` : m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
  const secs = s => s < 60 ? `0:${String(s).padStart(2, '0')}` : s < 600 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${Math.round(s / 60)}m`;

  // ── ticket helpers ──
  const T = id => TICKETS.find(t => t.id === id);
  const cat = t => (t.issue || '').split('.')[0];
  const label = t => t.issue ? LEAF[t.issue] : `Untriaged${t.hint ? ' · ' + t.hint : ''}`;
  const isPinned = t => t.status === 'triaged' && t.mode === 'escalate' && (t.issue || '').startsWith('safety.') && !t.handedOff;
  const preview = t => t.subject || t.body[0];
  const cohortText = t => {
    if (!t.cohort.resolved) return 'Unmatched';
    return [t.cohort.paying && 'Paying', t.cohort.streak >= 100 && `${t.cohort.streak}d streak`].filter(Boolean).join(' · ');
  };
  const byPrio = (a, b) => b.score - a.score || b.ageMin - a.ageMin;

  function passes(t) {
    const c = t.cohort, f = S.filters;
    if (S.cohort === 'paying' && !(c.resolved && c.paying)) return false;
    if (S.cohort === 'streak' && !(c.resolved && c.streak >= 100)) return false;
    if (f.channel.length && !f.channel.includes(t.channel)) return false;
    if (f.category.length && !f.category.includes(cat(t))) return false;
    if (f.mode.length && !f.mode.includes(t.mode)) return false;
    if (f.lang.length && !f.lang.includes(t.lang)) return false;
    return true;
  }

  function groups() {
    if (S.tab === 'review') {
      const all = TICKETS.filter(t => t.status === 'triaged' && passes(t));
      const live = all.filter(t => !t.handedOff);
      const auto = t => t.mode === 'auto' && !t.rejected;
      return [
        { key: 'crit', title: 'Critical', items: live.filter(isPinned).sort(byPrio), aside: 'pinned' },
        { key: 'prio', title: 'By priority', items: live.filter(t => !isPinned(t) && !auto(t)).sort(byPrio), aside: 'score, then oldest' },
        { key: 'auto', title: 'Auto-ready', items: live.filter(auto).sort(byPrio) },
        { key: 'off', title: 'Handed off', items: all.filter(t => t.handedOff).sort(byPrio) },
      ].filter(g => g.items.length);
    }
    if (S.tab === 'agent') {
      const open = TICKETS.filter(t => t.status === 'open' && passes(t));
      return [
        { key: 'run', title: 'Working', items: open.filter(t => t.run.status === 'running') },
        { key: 'fail', title: 'Failed · retrying', items: open.filter(t => t.run.status === 'failed') },
      ].filter(g => g.items.length);
    }
    const items = TICKETS.filter(t => t.status === S.tab && passes(t)).sort((a, b) => a.ageMin - b.ageMin);
    return items.length ? [{ key: S.tab, title: S.tab === 'replied' ? 'Most recent first' : 'Most recent first', items }] : [];
  }
  const order = () => groups().flatMap(g => g.key === 'off' && !S.showOff ? [] : g.items).map(t => t.id);
  const counts = () => ({
    review: TICKETS.filter(t => t.status === 'triaged' && !t.handedOff).length,
    replied: TICKETS.filter(t => t.status === 'replied').length,
    closed: TICKETS.filter(t => t.status === 'closed').length,
    running: TICKETS.filter(t => t.status === 'open' && t.run.status === 'running').length,
    failed: TICKETS.filter(t => t.status === 'open' && t.run.status === 'failed').length,
  });
  function rankOf(t) { // where the score alone would place it
    const pool = TICKETS.filter(x => x.status === 'triaged' && !x.handedOff).sort(byPrio);
    return pool.indexOf(t) + 1;
  }
  function ensureSel() {
    const o = order();
    if (!o.includes(S.sel)) select(o[0] || null);
  }
  function select(id) {
    if (S.sel !== id) { S.onSince = Date.now(); S.editing = false; S.showFull = false; S.hot = null; }
    S.sel = id;
  }

  // ── render ──
  function render() {
    applyTheme();
    if (S.view === 'queue') ensureSel();
    const app = $('#app');
    app.innerHTML = topHTML() + (S.offline ? bannerHTML() : '<div></div>') +
      (S.view === 'queue' ? workHTML() : S.view === 'insights' ? insightsHTML() : evalsHTML());
    $('#ov').innerHTML = overlayHTML() + toastHTML();
    tick();
    const ta = $('#editor'); if (ta && document.activeElement !== ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    const pin = $('#palin'); if (pin) pin.focus();
    const din = $('#dlgin'); if (din && document.activeElement !== din) din.focus();
  }

  function topHTML() {
    const k = INSIGHTS.kpi;
    const chOk = !S.offline;
    return `<header class="top">
      <div class="brand"><i></i>Dispatch</div>
      <nav class="nav">${[['queue', 'Queue'], ['insights', 'Insights'], ['evals', 'Evals']].map(([v, l]) =>
        `<button class="${S.view === v ? 'on' : ''}" data-act="view" data-v="${v}">${l}</button>`).join('')}</nav>
      <button class="search" data-act="palette" title="Jump to ticket or user (⌘K)"><span class="txt">Jump to ticket or user</span><kbd>⌘K</kbd></button>
      <div class="stats">
        <button class="stat" data-act="view" data-v="insights" title="Median time from the user writing in to the first human action (assist mode, last 7 days)"><b>${k.firstAction}</b><span class="lbl">to first action</span></button>
        <button class="stat" data-act="view" data-v="insights" title="Total LLM cost ÷ replied or closed tickets, last 7 days"><b>${money(k.costPerResolved)}</b><span class="lbl">per resolved</span></button>
        <div class="sep"></div>
        <div class="sys">
          <button class="live ${chOk ? '' : 'off'}" data-act="channels"><i></i><span class="txt">${chOk ? '3 channels live' : 'Offline'}</span></button>
          <button class="mask" data-act="mask" title="Mask names, emails and phone numbers (M)"><span class="sw ${S.mask ? 'on' : ''}"></span><span class="txt">Mask PII</span></button>
          <span class="dry" title="Approving only records a decision. No code path sends mail, posts to ClickUp or messages a user."><i></i>Dry-run</span>
          <button class="iconbtn" data-act="theme" title="${theme() === 'dark' ? 'Light' : 'Dark'} mode">${theme() === 'dark' ? sunSvg : moonSvg}</button>
          <button class="iconbtn" data-act="keys" title="Keyboard shortcuts (?)">?</button>
          <button class="me" data-act="name" title="${esc(S.actor || 'Set your name')}">${esc(initials(S.actor))}</button>
        </div>
      </div>
    </header>`;
  }
  const initials = n => n ? n.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';
  const sunSvg = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const moonSvg = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
  const bannerHTML = () => `<div class="banner"><b>Offline.</b> Showing data from 14:52. Actions you take are queued and saved when the connection returns.<button class="ext" data-act="offline" style="margin-left:auto">Retry now</button></div>`;

  // ── queue column ──
  function workHTML() {
    const t = S.sel && T(S.sel);
    return `<main class="work">${queueHTML()}${t ? ticketHTML(t) + factsHTML(t) : emptyPaneHTML()}</main>`;
  }
  function emptyPaneHTML() {
    const c = counts();
    return `<section class="c" style="justify-content:center;align-items:center;text-align:center">
      <div class="title" style="font-size:22px">All clear</div>
      <p class="calm" style="margin-top:8px">Nothing in this view needs you. The agent is working on ${c.running} ticket${c.running === 1 ? '' : 's'}${c.failed ? ` and retrying ${c.failed}` : ''}.</p>
    </section><aside class="f"></aside>`;
  }
  function queueHTML() {
    const c = counts(), gs = groups();
    const nf = Object.values(S.filters).reduce((a, x) => a + x.length, 0);
    const chips = Object.entries(S.filters).flatMap(([k, vs]) => vs.map(v =>
      `<span class="chip">${esc(filterLabel(k, v))}<button data-act="unfilter" data-k="${k}" data-v="${v}" aria-label="Remove">×</button></span>`)).join('');
    const list = gs.length ? gs.map(groupHTML).join('') : `<div class="empty"><b>Nothing here</b>${emptyWhy()}</div>`;
    return `<section class="q">
      <div class="tabs">${[['review', 'To review', c.review], ['replied', 'Replied', c.replied], ['closed', 'Closed', c.closed]].map(([k, l, n]) =>
        `<button class="${S.tab === k ? 'on' : ''}" data-act="tab" data-v="${k}"><b>${n}</b>${l}</button>`).join('')}</div>
      <div class="frow">
        <div class="seg">${[['all', 'All'], ['paying', 'Paying'], ['streak', '100+<span class="pw"> streak</span>']].map(([k, l]) =>
          `<button class="${S.cohort === k ? 'on' : ''}" data-act="cohort" data-v="${k}" ${k === 'streak' ? 'title="100+ day streak"' : ''}>${l}</button>`).join('')}</div>
        <button class="fbtn ${nf ? 'on' : ''}" data-act="filter">Filter${nf ? `<em>${nf}</em>` : ''}</button>
      </div>
      ${nf ? `<div class="chips">${chips}<button class="chip" data-act="clearf" style="padding-right:8px">Clear</button></div>` : ''}
      <div class="list">${list}</div>
      <button class="agentq ${S.tab === 'agent' ? 'on' : ''}" data-act="tab" data-v="agent">
        <span class="spin"></span>Agent working on ${c.running}${c.failed ? `<span class="failn">· ${c.failed} failed</span>` : ''}<span class="go">›</span>
      </button>
    </section>`;
  }
  function emptyWhy() {
    if (S.cohort === 'paying') return 'No paying users are waiting. Only 57 users have an active subscription, so this list is often empty.';
    if (S.cohort === 'streak') return 'No one with a 100+ day streak is waiting.';
    if (Object.values(S.filters).some(x => x.length)) return 'No tickets match these filters.';
    return S.tab === 'review' ? 'Every ticket has been handled.' : 'No tickets yet.';
  }
  function groupHTML(g) {
    let aside = `<span class="aside">${esc(g.aside || '')}</span>`;
    if (g.key === 'auto') aside = `<button class="aside" data-act="approveAll">Approve all · ⇧A</button>`;
    if (g.key === 'off') aside = `<button class="aside" data-act="toggleOff">${S.showOff ? 'Hide' : 'Show'}</button>`;
    const head = `<div class="grp ${g.key === 'crit' || g.key === 'fail' ? 'crit' : ''}"><span>${g.title} · ${g.items.length}</span>${aside}</div>`;
    if (g.key === 'off' && !S.showOff) return head;
    return head + g.items.map(rowHTML).join('');
  }
  function rowHTML(t) {
    const sel = t.id === S.sel, pin = isPinned(t);
    const cls = ['row', t.mode === 'escalate' && !t.handedOff && t.status === 'triaged' ? 'esc' : '', pin ? 'crit' : '', sel ? 'sel' : '', t.isNew ? 'new' : ''].join(' ');
    const name = pin ? `<span class="sev"><span class="pdot"></span>Safety</span>${esc(label(t))}` : esc(label(t));
    const meta = [];
    const ct = cohortText(t); if (ct) meta.push(`<span class="co">${ct}</span>`);
    if (t.status === 'open') meta.push(t.run.status === 'failed' ? '<span class="e">Agent failed</span>' : `<span>${esc(t.run.steps.find(s => s.status === 'now')?.step || 'queued')}…</span>`);
    else if (t.handedOff) meta.push(`<span>→ ${esc(t.handedOff.to)}</span>`);
    else if (t.rejected) meta.push('<span>Draft rejected</span>');
    else if (t.status === 'triaged' && t.mode === 'escalate') meta.push('<span class="e">Escalate</span>');
    else if (t.status === 'triaged' && t.mode === 'auto') meta.push(`<span class="a">Auto ${t.confidence.toFixed(2)}</span>`);
    meta.push(sel ? '<span class="ch on-it"><i></i><span data-timer>0:00</span> on it</span>' : `<span class="ch">${CHANNEL[t.channel]}</span>`);
    return `<button class="${cls}" data-act="sel" data-id="${t.id}">
      <span class="r1"><b>${name}</b>${sel ? '' : `<span class="age">${ageShort(t.ageMin)}</span>`}</span>
      <span class="prev">${esc(bodyText(preview(t)))}</span>
      <span class="meta">${meta.join('')}</span>
    </button>`;
  }

  // ── ticket pane ──
  function ticketHTML(t) {
    const o = order(), i = o.indexOf(t.id);
    const pos = i >= 0 ? `<div class="pos"><span>${i + 1} of ${o.length}</span><kbd>K</kbd><span class="pw">prev</span><kbd>J</kbd><span class="pw">next</span></div>` : '<span></span>';
    const sub = [who(t), CHANNEL[t.channel], t.lang && LANG[t.lang], t.appVersion && 'v' + t.appVersion, t.screen && t.screen + ' screen',
      t.channel === 'gmail' && t.ageMin > 120 ? 'received ' + received(t.ageMin) : ageLong(t.ageMin)].filter(Boolean).join(' · ');
    const alarm = isPinned(t);
    const head = `<div class="chead"><h1 class="title">${esc(label(t))}</h1>${modeChip(t)}<div class="sub">${sub}</div>${pos}</div>`;
    const band = alarm ? `<div class="alarmband"><span class="pdot"></span><div><div class="t">Safety report · person only</div><div class="d">The agent will not reply. Read it, then reply or hand it off.</div></div><div class="w"><b>${waitBig(t.ageMin)}</b><span>waiting${t.ageMin === Math.max(...TICKETS.filter(x => x.status === 'triaged').map(x => x.ageMin)) ? ' · oldest open ticket' : ''}</span></div></div>` : '';
    const notes = (t.notes || []).map(n => `<div class="note"><b>Note · ${esc(n.by)}</b> ${esc(n.text)}</div>`).join('');
    const srcWarn = t.sourceStatus === 'in progress' && t.status === 'triaged' ? `<div class="warnbox" style="margin:16px 0 0"><b>Already in progress in ClickUp.</b> Someone at Matiks may be handling this task. Check before you approve.</div>` : '';
    let body = '';
    if (t.status === 'open') body = agentStateHTML(t);
    else if (t.status === 'replied' || t.status === 'closed') body = inboundHTML(t) + notes + resolvedHTML(t);
    else if (t.handedOff) body = inboundHTML(t) + notes + `<div class="note" style="border-left-color:var(--tx)"><b>Handed off to ${esc(t.handedOff.to)}</b> by ${esc(t.handedOff.by)}${t.handedOff.text ? ' · “' + esc(t.handedOff.text) + '”' : ''}. It stays open until someone replies or closes it.</div>` + (S.editing ? editorPanel(t) : actionsOnly(t, [btn('Write reply', 'E', 'write', true), btn('···', '', 'more', false, 'more')]));
    else if (t.mode === 'escalate') body = (alarm ? '' : `<div class="note" style="border-left-color:var(--red);margin-top:18px"><b>${escNotice(t)}</b> Reply yourself, or hand it to ${esc(t.routing)}.</div>`) + notes + (S.editing ? inboundHTML(t) + editorPanel(t) : messageHTML(t));
    else body = inboundHTML(t) + notes + draftPanel(t);
    return `<section class="c ${alarm ? 'alarm' : ''}">${band}${head}${srcWarn}${body}</section>`;
  }
  const escNotice = t => cat(t) === 'payment' ? 'Payments always go to a person.' : cat(t) === 'merch' ? 'Physical goods always go to a person.' : 'This one goes to a person.';
  function modeChip(t) {
    if (t.status === 'open') return t.run.status === 'failed' ? '<div class="mode esc">Agent failed</div>' : '<div class="mode">Agent working</div>';
    if (t.status === 'replied') return '<div class="mode done">Replied · not sent</div>';
    if (t.status === 'closed') return '<div class="mode done">Closed</div>';
    if (t.handedOff) return `<div class="mode">Handed off</div>`;
    if (t.mode === 'escalate') return isPinned(t) ? '<span></span>' : '<div class="mode esc">Escalate · person only</div>';
    if (t.rejected) return '<div class="mode">Draft rejected</div>';
    if (t.mode === 'auto') return '<div class="mode auto">Auto · ready to send</div>';
    return '<div class="mode">Assist · needs approval</div>';
  }
  const extLink = t => t.channel === 'file' ? '' : `<a class="ext" href="#" data-act="ext">Open in ${CHANNEL[t.channel]} ↗</a>`;
  const attHTML = t => (t.attachments || []).map(a => `<span class="att">${esc(a.name)}<span>${esc(a.note)}</span></span>`).join('');
  function inboundHTML(t) {
    return `<div class="inb"><div class="inlab"><span class="lab">They wrote · <span class="mono" style="letter-spacing:0;text-transform:none">${t.ext}</span></span>${extLink(t)}</div>
      ${t.subject ? `<b style="color:var(--tx);font-weight:600">${esc(t.subject)}</b><br>` : ''}${t.body.map(bodyHTML).join('<br>')}
      ${t.attachments ? `<div>${attHTML(t)}</div>` : ''}</div>`;
  }
  function messageHTML(t) {
    const long = t.body.join(' ').length > 420;
    const from = t.channel === 'gmail' ? `From <b>${pii(t.reporter.email, 'email')}</b>` : t.channel === 'file' ? `WhatsApp export · <b>${who(t)}</b>` : `ClickUp form · <b>${who(t)}</b>`;
    return `<div class="panel mail ${isPinned(t) ? 'edge' : ''}" style="margin-top:${isPinned(t) ? 16 : 14}px">
      <div class="phead"><span class="from">${from}</span><span style="display:flex;gap:12px;align-items:baseline"><span class="mono" style="font-size:11px;color:var(--tx3)">${t.ext}</span>${extLink(t)}</span></div>
      ${t.subject ? `<div class="subj">${esc(t.subject)}</div>` : ''}
      <div class="mbody ${long && !S.showFull ? 'clip' : ''}">${t.body.map(p => `<p>${bodyHTML(p)}</p>`).join('')}</div>
      <div class="more">${long ? `<button data-act="full">${S.showFull ? 'Show less' : 'Show full message'}</button><kbd>Space</kbd>` : ''}<span style="margin-left:auto;display:flex;gap:6px">${attHTML(t)}</span></div>
      ${actionsOnly(t, [btn('Write reply', 'E', 'write', true), btn(`Hand off<span class="rt"> → ${esc(t.routing)}</span>`, 'X', 'handoff'), btn('···', '', 'more', false, 'more')])}
    </div>`;
  }
  const btn = (text, key, act, pri = false, cls = '') => `<button class="btn ${pri ? 'pri' : ''} ${cls}" data-act="${act}">${text.includes('<span') ? text : esc(text)}${key ? ` <kbd>${key}</kbd>` : ''}</button>`;
  const actionsOnly = (t, btns, hint = '') => `<div class="act">${btns.join('')}${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;

  function draftPanel(t) {
    if (S.editing) return editorPanel(t);
    const d = t.draft;
    const segs = d.body.map(([txt, ev]) => ev === undefined ? esc(txt) : `<span class="mv ${S.hot === ev ? 'hot' : ''}" data-ev="${ev}">${esc(txt)}</span>`).join('');
    const n = d.body.filter(s => s[1] !== undefined).length;
    const right = n ? `<span class="ok">${n} value${n > 1 ? 's' : ''} match evidence</span>` : '<span class="sub">No numbers to check</span>';
    const routing = d.routing ? `Escalate<span class="rt"> → ${esc(d.routing)}</span>` : 'Escalate';
    const btns = t.rejected
      ? [btn('Write reply', 'E', 'write', true), btn(routing, 'X', 'handoff', false, 'esc'), btn('···', '', 'more', false, 'more')]
      : [btn('Approve', 'A', 'approve', true), btn('Edit', 'E', 'edit'), btn('Reject', 'R', 'reject'), btn(routing, 'X', 'handoff', false, 'esc'), btn('···', '', 'more', false, 'more')];
    return `<div class="panel">
      <div class="phead"><span class="lab">Draft reply · ${LANG[d.lang]}</span>${right}</div>
      ${t.rejected ? `<div class="rejected">Rejected by ${esc(t.rejected.by)}${t.rejected.reason ? ' · ' + esc(t.rejected.reason) : ''}. The ticket stays here until someone replies, hands it off or closes it.</div>` : ''}
      <div class="dtext" style="${t.rejected ? 'opacity:.55' : ''}">${segs}<span class="sig">— Team Matiks</span></div>
      ${actionsOnly(t, btns)}
    </div>`;
  }
  const plain = t => t.draft ? t.draft.body.map(s => s[0]).join('') : '';
  function editorPanel(t) {
    const fresh = !t.draft || t.rejected || t.mode === 'escalate' || t.handedOff;
    return `<div class="panel">
      <div class="phead"><span class="lab">${fresh ? 'Your reply' : 'Editing draft'} · ${LANG[t.lang] || 'English'}</span><span class="sub">Signed “— Team Matiks” automatically</span></div>
      <div class="editor"><textarea id="editor" placeholder="Write the reply. Any number you use is checked against the evidence.">${esc(S.editText)}</textarea>
        <div class="checks" id="checks">${checksHTML(t, S.editText)}</div></div>
      ${actionsOnly(t, [btn(fresh ? 'Save reply' : 'Save & approve', '⌘↵', 'save', true), btn('Cancel', 'Esc', 'cancel', false, 'quiet')], 'Recorded as an edit · sends nothing')}
    </div>`;
  }
  function checksHTML(t, text) {
    const ok = new Set();
    (t.draft?.evidence || []).forEach(e => { (e.values || []).forEach(v => ok.add(v)); (e.fact.match(/\d+(\.\d+)?/g) || []).forEach(v => ok.add(v)); });
    const nums = [...new Set(text.match(/\d+(\.\d+)?/g) || [])];
    const bad = nums.filter(n => !ok.has(n));
    const sentences = text.split(/[.!?।]+(\s|$)/).filter(s => s && s.trim().length > 1).length;
    return [
      !nums.length ? '<span>No numbers to check</span>' : bad.length ? `<span class="w">▲ ${bad.join(', ')} not in the evidence</span>` : `<span class="g">✓ ${nums.length} number${nums.length > 1 ? 's' : ''} match evidence</span>`,
      sentences <= 5 ? `<span class="g">✓ ${sentences} of 5 sentences</span>` : `<span class="w">▲ ${sentences} sentences · the style guide allows 5</span>`,
      /\b(will be fixed|refund will|by tomorrow|guarantee)/i.test(text) ? '<span class="w">▲ Sounds like a promise · the style guide forbids dates and refunds</span>' : '<span class="g">✓ No promises</span>',
    ].join('');
  }

  function agentStateHTML(t) {
    const r = t.run, failed = r.status === 'failed';
    const names = ['classify', 'enrich', 'decide', 'draft', 'guardrail'];
    const steps = names.map(n => {
      const s = r.steps.find(x => x.step === n);
      const cls = s ? (s.status === 'fail' ? 'fail' : s.status === 'now' ? 'now' : 'done') : '';
      const em = s ? (s.status === 'fail' ? 'failed' : s.status === 'now' ? 'running…' : (s.ms / 1000).toFixed(1) + 's') : '';
      return `<span class="${cls}">${n[0].toUpperCase() + n.slice(1)}<em>${em}</em></span>`;
    }).join('');
    return `<div class="steps">${steps}</div>${inboundHTML(t)}
      ${failed ? `<div class="err">${esc(r.error)}</div><p class="calm">The ticket stays open and the agent retries on its next pass (attempt ${r.attempt} of 3). Nothing is lost.</p>`
               : '<p class="calm">The draft appears here when the agent finishes. You don’t have to wait for it.</p>'}
      ${S.editing ? editorPanel(t) : `<div style="display:flex;gap:8px">${btn('Write reply yourself', 'E', 'write')}${btn('Open trace', 'T', 'trace')}</div>`}`;
  }

  function resolvedHTML(t) {
    const steps = [`<li><i></i><span>User wrote via ${CHANNEL[t.channel]}</span><span>${received(t.ageMin)}</span></li>`,
      ...t.history.map(h => `<li class="${h.h ? 'h' : ''}"><i></i><span>${h.who === 'agent' ? 'Agent' : `<b>${esc(h.who)}</b>`} ${esc(h.act)}${h.body ? ' · “' + esc(h.body) + '”' : ''}</span><span>+${esc(h.after)}</span></li>`)].join('');
    const btns = t.status === 'closed' ? [btn('Reopen', 'O', 'reopen', true), btn('Add note', 'N', 'note')] : [btn('Close', 'C', 'close'), btn('Add note', 'N', 'note')];
    return `<div class="panel">
      <div class="phead"><span class="lab">${t.final ? 'Reply recorded · not sent (dry-run)' : 'Closed without a reply'}</span><span class="sub">${t.final ? LANG[t.lang] : ''}</span></div>
      ${t.final ? `<div class="final">${esc(t.final)}</div>` : ''}
      <div class="phead" style="border-top:1px solid var(--line)"><span class="lab">History</span><span class="sub">from <span class="mono">actions</span></span></div>
      <ul class="tl">${steps}</ul>
      ${actionsOnly(t, btns)}
    </div>`;
  }

  // ── facts column ──
  function factsHTML(t) {
    return `<aside class="f">${userHTML(t)}${t.status === 'triaged' ? (t.mode === 'escalate' && !t.draft ? whyHTML(t) : evidenceHTML(t) + decisionHTML(t)) : ''}${t.status === 'replied' || t.status === 'closed' ? resolutionHTML(t) : ''}${traceLine(t)}</aside>`;
  }
  function userHTML(t) {
    const c = t.cohort;
    const head = c.resolved
      ? `<div class="uhead"><span class="lab">User</span><span class="match">by ${c.by} · looked up ${c.lookedUpH ? c.lookedUpH + 'h ago' : 'just now'}</span></div>`
      : `<div class="uhead"><span class="lab">User</span><span class="match warn">no match</span></div>`;
    const cells = `<div class="cells">
      <div class="cell ${c.resolved && c.streak >= 100 ? 'q' : ''}"><div class="k">Streak ${c.resolved && c.streak >= 100 ? '<span class="tag">100+</span>' : ''}</div><div class="v">${c.resolved ? `${c.streak}<small>days</small>` : '—'}</div></div>
      <div class="cell ${c.resolved && c.paying ? 'q' : ''}"><div class="k">Paying</div><div class="v">${c.resolved ? (c.paying ? 'Yes' : 'No') : '—'}</div></div></div>`;
    const [key, kind] = whoKey(t);
    const nomatch = !c.resolved ? `<div class="warnbox"><b>No account matches ${esc(masked(key, kind))}.</b> ${c.by === 'phone' ? 'Lookups work on email or username; this report only has a phone number.' : 'Cohort unknown, never “not paying”.'} The draft can’t use account facts.</div>` : '';
    const claim = t.claim && t.status === 'triaged' ? `<div class="warnbox"><b>Says ${t.claim.said}${t.claim.what ? ' ' + t.claim.what : ' days'}.</b> The database shows ${t.claim.db}; the draft uses ${t.claim.db}.</div>` : '';
    const other = `<div class="other"><span>Earlier tickets</span><b>${t.others ? '1 · Sep 12, closed' : 'None'}</b></div>`;
    return `<div>${head}${cells}${nomatch}${claim}${other}${t.status === 'triaged' ? prioHTML(t) : ''}</div>`;
  }
  function prioHTML(t) {
    const c = t.cohort;
    if (isPinned(t)) return `<div class="prio"><div class="h"><span><b class="r">Pinned</b> · priority score</span><span class="n">${t.score}</span></div>
      <div class="pinned">Score alone would put it at <b>#${rankOf(t)}</b>. Safety reports are pinned above the ranking.</div></div>`;
    const parts = [c.resolved && c.paying && [200, 'paying'], c.resolved && c.streak >= 100 && [100, '100+ streak'], c.resolved && Math.min(Math.floor(c.streak / 10), 99) && [Math.min(Math.floor(c.streak / 10), 99), 'streak ÷ 10', 'w']].filter(Boolean);
    const o = order(), rank = o.indexOf(t.id) + 1;
    if (!t.score) return `<div class="prio"><div class="h"><span><b>#${rank || '–'}</b> · priority score</span><span class="n">0</span></div><div class="pinned" style="color:var(--tx3)">No priority group, so it’s ranked by wait time.</div></div>`;
    return `<div class="prio"><div class="h"><span><b>#${rank || '–'}</b> · priority score</span><span class="n">${t.score}</span></div>
      <div class="stack">${parts.map(([v, , w]) => `<i class="${w || ''}" style="flex:${v}"></i>`).join('')}</div>
      <div class="legend">${parts.map(([v, l]) => `<span><b>+${v}</b> ${l}</span>`).join('')}</div></div>`;
  }
  function evidenceHTML(t) {
    const ev = t.draft.evidence;
    return `<div class="ev"><span class="lab">Evidence · ${ev.length}</span>${ev.map((e, i) => {
      const inDraft = t.draft.body.some(s => s[1] === i);
      return `<div class="r ${S.hot === i ? 'hot' : ''}" data-evrow="${i}"><span class="k">${esc(e.fact)}</span>${e.verified ? '<span class="ver">verified</span>' : inDraft ? '<span class="ind">in draft</span>' : '<span></span>'}<span class="src">${esc(e.src)}</span></div>`;
    }).join('')}</div>`;
  }
  function whyHTML(t) {
    return `<div class="ev"><span class="lab">Why a person handles it</span>${t.why.map(w =>
      `<div class="r"><span class="k">${esc(w.k)}</span><span class="val" ${w.v === 'hard rule' ? 'style="font:500 11.5px Archivo;color:var(--tx2)"' : ''}>${esc(w.v)}</span><span class="src">${esc(w.src)}</span></div>`).join('')}</div>`;
  }
  function decisionHTML(t) {
    const d = t.draft, auto = t.mode === 'auto';
    return `<div class="dec"><span class="lab">Decision</span>
      <div class="line"><b>${auto ? 'Auto' : 'Assist'}</b><span class="n">${d.confidence.toFixed(2)}</span></div>
      <div class="conf"><i style="width:${d.confidence * 100}%"></i><u></u></div>
      <div class="conflab"><span>confidence</span><span>auto needs 0.90</span></div>
      <div class="sugg">${auto ? '<b>On the auto-resolve list</b> and above 0.90. One key approves it.' : d.suggested ? `<b>Suggests:</b> ${esc(d.suggested)}` : 'Not on the auto-resolve list, so a person approves.'}</div></div>`;
  }
  function resolutionHTML(t) {
    const first = t.history.find(h => h.h);
    return `<div class="dec"><span class="lab">Resolution</span>
      <div class="line"><span style="color:var(--tx2)">First human action</span><span class="n">+${esc(first?.after || '–')}</span></div>
      <div class="line"><span style="color:var(--tx2)">Cost</span><span class="n">${money(t.run.cost || 0)}</span></div>
      <div class="sugg" style="color:var(--tx3)">Counted in time-to-first-action and cost per resolved ticket.</div></div>`;
  }
  function traceLine(t) {
    const r = t.run;
    const what = r.status === 'running' ? 'running…' : r.status === 'failed' ? '<span style="color:var(--red)">failed</span>' : r.stoppedAt ? `stopped at ${r.stoppedAt}` : `${r.steps.length} steps`;
    const time = r.ms ? ` · <b>${(r.ms / 1000).toFixed(1)}s</b>` : '';
    return `<button class="trace" data-act="trace"><span>Pipeline ${r.version} · ${what}${time}</span><span><b>${r.cost ? money(r.cost) : ''}</b> ›</span></button>`;
  }

  // ── insights ──
  function insightsHTML() {
    const I = INSIGHTS, c = counts();
    const issues = I.topIssues[S.icohort], max = Math.max(...issues.map(x => x[2]));
    const bars = issues.map(([k, l, n, e]) => {
      const h = (n - e) / max * 100, w = e / max * 100;
      return `<button class="bar" data-act="issue" data-v="${k}" data-tip="${esc(l)}: ${n} tickets · ${e} escalated · click to see them in the queue">
        <span class="l">${esc(l)}</span>
        <span class="t">${h ? `<i style="width:${h}%;${e ? 'border-radius:0' : ''}"></i>` : ''}${e ? `<i class="esc" style="left:calc(${h}% + ${h ? 2 : 0}px);width:${w}%"></i>` : ''}</span>
        <span class="v">${n}</span></button>`;
    }).join('');
    const lg = s => (Math.log10(s) - 1) / (Math.log10(3600) - 1) * 100;
    const ttr = I.ttr.map(([m, s, n]) => `<div class="r" data-tip="${m}: median ${secs(s)} from the user writing to the first human action · ${n} tickets">
      <span class="m">${m}</span><span class="track"><u style="width:${lg(s)}%"></u><i style="left:${lg(s)}%"></i></span><span class="v">${secs(s)}</span><span class="n">n=${n}</span></div>`).join('');
    const cmax = Math.max(...I.costDays.map(d => d[1]));
    const cols = I.costDays.map(([d, v], i) => {
      const lab = v === cmax || i === I.costDays.length - 1;
      return `<div data-tip="${d}: $${v.toFixed(3)} total LLM cost${i === I.costDays.length - 1 ? ' (so far today)' : ''}">${lab ? `<span>$${v.toFixed(3)}</span>` : ''}<i class="${i === I.costDays.length - 1 ? 'today' : ''}" style="height:${v / cmax * 100}%"></i></div>`;
    }).join('');
    const total = I.costSteps.reduce((a, x) => a + x[2], 0), smax = Math.max(...I.costSteps.map(x => x[2]));
    const steps = I.costSteps.map(([s, m, v]) => `<div class="bar" data-tip="${s}: ${money(v)} · ${Math.round(v / total * 100)}% of the week’s cost">
      <span class="l">${s}<small>${m}</small></span><span class="t"><i style="width:${v / smax * 100}%"></i></span><span class="v">$${v.toFixed(2)}</span></div>`).join('');
    const chmax = Math.max(...I.channels.map(x => x[1]));
    const chans = I.channels.map(([n, v]) => `<button class="bar" data-act="chanf" data-v="${n.toLowerCase()}" data-tip="${n}: ${v} tickets this week · click to filter the queue">
      <span class="l">${n}</span><span class="t"><i style="width:${v / chmax * 100}%"></i></span><span class="v">${v}</span></button>`).join('');
    const F = flowNow(c);
    const flow = F.map(([k, n, s]) => `<div><span class="k">${k}</span><b>${n}</b><span class="mono" style="font-size:10.5px">${s}</span></div>`).join('');
    return `<section class="page"><div class="inner">
      <div class="phd"><div><h1>Insights</h1><p>Last 7 days, all channels. Each number is one query on the support database, so it matches what the judges can check.</p></div>
        <div class="seg" style="flex:none;width:260px"><button>Today</button><button class="on">7 days</button><button>All time</button></div></div>
      <div class="kpis">
        <div class="kpi"><div class="k">Median to first action · assist</div><div class="v">${I.kpi.firstAction}</div><div class="s">Auto 0:41 · escalate 41m</div></div>
        <div class="kpi"><div class="k">Cost per resolved ticket</div><div class="v">${money(I.kpi.costPerResolved)}</div><div class="s">${F[3][1] + F[4][1]} resolved · $${total.toFixed(2)} total</div></div>
        <div class="kpi"><div class="k">Resolved</div><div class="v">${F[3][1] + F[4][1]}<small>of ${F.reduce((a, x) => a + x[1], 0)}</small></div><div class="s">${Math.round((F[3][1] + F[4][1]) / F.reduce((a, x) => a + x[1], 0) * 100)}% of what came in this week</div></div>
        <div class="kpi"><div class="k">Waiting now</div><div class="v">${c.review}<small>to review</small></div><div class="s">${c.running} with the agent${c.failed ? ` · ${c.failed} failed` : ''}</div></div>
      </div>
      <div class="grid2">
        <div class="card"><h3>Top issues<span class="seg" style="flex:none;width:250px">${[['all', 'All'], ['streak', '100+ streak'], ['paying', 'Paying']].map(([k, l]) =>
          `<button class="${S.icohort === k ? 'on' : ''}" data-act="icohort" data-v="${k}">${l}</button>`).join('')}</span></h3>
          <p>By category. Click one to open those tickets in the queue.</p>
          <div class="legend" style="margin-top:10px"><span><i style="display:inline-block;width:10px;height:8px;background:var(--bar);margin-right:5px"></i>handled with the agent</span><span><i style="display:inline-block;width:10px;height:8px;background:var(--red);margin-right:5px"></i>escalated to a person</span></div>
          <div class="bars">${bars}</div></div>
        <div class="card"><h3>Time to first action<span class="aside">median, by mode</span></h3>
          <p>From the moment the user wrote to the first human action. Log scale.</p>
          <div class="ttr">${ttr}</div><div class="ttr"><div class="axis"><span>10s</span><span>1m</span><span>10m</span><span>1h</span></div></div>
          <p style="margin-top:14px;font-size:12px;color:var(--tx3)">Auto assumes one approve click (open question to the devs). If the API approves auto drafts itself, that row becomes seconds.</p></div>
      </div>
      <div class="grid2">
        <div class="card"><h3>LLM cost per day<span class="aside">token_log · USD</span></h3><p>Today, so far, is the highlighted column.</p>
          <div class="cols7">${cols}</div><div class="colx">${I.costDays.map(d => `<span>${d[0]}</span>`).join('')}</div>
          <p style="margin-top:12px;font-size:12px">Prompt caching saved $${I.cacheSaved.toFixed(2)} this week.</p></div>
        <div class="card"><h3>Where the cost goes<span class="aside">by pipeline step</span></h3><p>Drafting with Sonnet is ${Math.round(I.costSteps[0][2] / total * 100)}% of it; escalations stop before the draft step and cost almost nothing.</p>
          <div class="bars">${steps}</div></div>
      </div>
      <div class="grid2">
        <div class="card"><h3>Where tickets are now<span class="aside">this week · status</span></h3><p>Every ticket that came in, by where it ended up.</p><div class="flow">${flow}</div>
          <p style="margin-top:14px;font-size:12px">Agent: ${I.agent.runs} runs · ${I.agent.failed} failed (${(I.agent.failed / I.agent.runs * 100).toFixed(1)}%) · ${I.agent.retriedOk} recovered on retry · ${(I.agent.avgMs / 1000).toFixed(1)}s average.</p></div>
        <div class="card"><h3>By channel<span class="aside">all healthy</span></h3><p>Click a channel to filter the queue. File was added today with one new adapter.</p>
          <div class="bars">${chans}</div></div>
      </div>
    </div></section>`;
  }

  function flowNow(c) {
    const B = INSIGHTS.flowBase, off = TICKETS.filter(t => t.status === 'triaged' && t.handedOff).length;
    return [['With the agent', c.running + c.failed, 'open'], ['To review', c.review, 'triaged'], ['Handed off', B.handed + off, 'triaged + escalate'],
            ['Replied', B.replied + c.replied, 'replied'], ['Closed', B.closed + c.closed, 'closed']];
  }

  // ── evals ──
  function evalsHTML() {
    const rows = EVALS, n = rows.length;
    const modeOk = rows.filter(r => r.expected === r.actual).length;
    const saidOk = rows.filter(r => r.said).length, notOk = rows.filter(r => r.notSaid).length;
    const mustEsc = rows.filter(r => r.expected === 'escalate'), escOk = mustEsc.filter(r => r.actual === 'escalate').length;
    const avg = rows.reduce((a, r) => a + r.cost, 0) / n;
    const shown = S.evalFails ? rows.filter(r => r.expected !== r.actual || !r.said || !r.notSaid) : rows;
    const ck = b => b ? '<span class="pass">✓</span>' : '<span class="fail">✗</span>';
    return `<section class="page"><div class="inner">
      <div class="phd"><div><h1>Evals <span class="sample">sample data</span></h1><p>30 hand-labelled tickets from <span class="mono">knowledge-base/evals/tickets.yaml</span>, run on pipeline v0.3. Where results are stored is still an open question for the devs.</p></div>
        <button class="fbtn ${S.evalFails ? 'on' : ''}" data-act="evalFails">${S.evalFails ? 'Showing failures' : 'Show failures only'}</button></div>
      <div class="kpis">
        <div class="kpi"><div class="k">Mode accuracy</div><div class="v">${modeOk}<small>of ${n}</small></div><div class="s">auto / assist / escalate as labelled</div></div>
        <div class="kpi"><div class="k">Must-escalate caught</div><div class="v">${escOk}<small>of ${mustEsc.length}</small></div><div class="s">safety, payments, merch, deletion, lost streaks</div></div>
        <div class="kpi"><div class="k">Fact compliance</div><div class="v">${Math.min(saidOk, notOk)}<small>of ${n}</small></div><div class="s">must-say ${saidOk}/${n} · must-not-say ${notOk}/${n}</div></div>
        <div class="kpi"><div class="k">Cost per ticket</div><div class="v">${money(avg)}</div><div class="s">escalations stop before drafting</div></div>
      </div>
      <table class="tbl"><thead><tr><th>#</th><th>Ticket</th><th>Expected leaf</th><th>Expected</th><th>Got</th><th>Must say</th><th>Must not say</th><th style="text-align:right">Cost</th></tr></thead>
      <tbody>${shown.map(r => `<tr class="${r.expected !== r.actual || !r.said || !r.notSaid ? 'fl' : ''}"><td class="mono">${r.n}</td><td>${esc(r.text)}</td><td class="mono">${r.leaf}</td><td>${r.expected}</td><td>${r.expected === r.actual ? r.actual : `<span class="fail">${r.actual}</span>`}</td><td>${ck(r.said)}</td><td>${ck(r.notSaid)}</td><td class="mono" style="text-align:right">${money(r.cost)}</td></tr>`).join('')}</tbody></table>
    </div></section>`;
  }

  // ── overlays ──
  function overlayHTML() {
    const o = S.overlay; if (!o) return '';
    const a = S.anchor || { left: 300, top: 120, right: 600, bottom: 140 };
    const t = S.sel && T(S.sel);
    if (o === 'palette') return `<div class="scrim" data-act="close"></div><div class="pop palette"><input id="palin" placeholder="Ticket id, username, email or words from the message" value="${esc(S.palQ)}" autocomplete="off"><ul id="palres">${palResults()}</ul><div class="foot"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>Esc</kbd> close</span><span style="margin-left:auto">Searches unmasked values</span></div></div>`;
    if (o === 'filter') return `<div class="scrim" style="background:transparent" data-act="close"></div><div class="pop filterpop" style="top:${a.bottom + 6}px;left:${Math.max(8, Math.min(innerWidth - 352, a.left))}px">${filterGroups()}</div>`;
    if (o === 'channels') return `<div class="scrim" style="background:transparent" data-act="close"></div><div class="pop chanpop" style="top:${a.bottom + 8}px;right:${innerWidth - a.right}px">
      <h5>Channels</h5><p class="sm" style="margin-bottom:8px">Polled every 2 minutes. A cursor only advances after every row in a page is stored.</p>
      ${CHANNELS.map(c => `<div class="chan"><i class="${S.offline ? 'w' : ''}"></i><b>${CHANNEL[c.name]}</b><span class="n">${c.today} this week</span><span class="s">${esc(c.kind)} · last success ${S.offline ? 'unknown' : c.lastSuccess}</span>${c.note ? `<span class="s" style="color:var(--tx2)">${esc(c.note)}</span>` : ''}</div>`).join('')}</div>`;
    if (o === 'more') return `<div class="scrim" style="background:transparent" data-act="close"></div><div class="pop menu" style="bottom:${innerHeight - a.top + 6}px;left:${a.right - 210}px">
      ${t.status === 'closed' ? '' : `<button data-act="close-t">Close without replying<kbd>C</kbd></button>`}<button data-act="note">Add internal note<kbd>N</kbd></button><button data-act="trace">Open pipeline trace<kbd>T</kbd></button>${t.channel !== 'file' ? `<button data-act="ext">Open in ${CHANNEL[t.channel]} ↗</button>` : ''}</div>`;
    if (o === 'trace') return `<div class="scrim" data-act="close"></div>${traceDrawer(t)}`;
    if (o === 'keys') return `<div class="scrim" data-act="close"></div><div class="pop keys"><h5>Keyboard</h5><p class="sm">Everything in the queue works without a mouse.</p><div class="cols">${[
      ['Next / previous ticket', 'J / K'], ['Approve', 'A'], ['Edit or write reply', 'E'], ['Reject draft', 'R'], ['Escalate / hand off', 'X'], ['Close ticket', 'C'], ['Add note', 'N'], ['Reopen', 'O'],
      ['Undo last action', 'Z'], ['Approve all auto-ready', '⇧A'], ['Pipeline trace', 'T'], ['Show full message', 'Space'], ['Jump to anything', '⌘K'], ['Filters', 'F'], ['Mask PII', 'M'], ['Queue / Insights / Evals', '1 2 3'],
      ['Save in editor', '⌘↵'], ['Close or cancel', 'Esc'], ['Demo: simulate offline', '⇧O'], ['This sheet', '?']].map(([l, k]) => `<div class="k"><span>${l}</span><kbd>${k}</kbd></div>`).join('')}</div><p class="sm" style="margin-top:14px"><a href="flow.html" style="color:var(--tx)">See the whole admin flow, touchpoint by touchpoint →</a></p></div>`;
    return `<div class="scrim" ${o === 'name' && !S.actor ? '' : 'data-act="close"'}></div><div class="pop modal dialog">${dialogHTML(o, t)}</div>`;
  }
  function dialogHTML(o, t) {
    const opts = (list) => `<div class="opts">${list.map(x => `<button class="${S.dlg.reason === x ? 'on' : ''}" data-act="reason" data-v="${esc(x)}">${esc(x)}</button>`).join('')}</div>`;
    const foot = (label, extra = '') => `<div class="row2">${extra}<button class="btn quiet" data-act="close">Cancel</button><button class="btn pri" data-act="confirm">${label} <kbd>↵</kbd></button></div>`;
    if (o === 'name') return `<h5>What should we call you?</h5><p class="sm">Your name goes on every decision you make here, so the team can see who approved what. There are no logins; it’s sent as <span class="mono">X-Actor</span>.</p><input type="text" id="dlgin" value="${esc(S.actor || '')}" placeholder="Your name">${foot('Continue')}`;
    if (o === 'reject') return `<h5>Reject this draft?</h5><p class="sm">The ticket stays in To review. Pick what was wrong; it’s saved with the rejection.</p>${opts(['Wrong facts', 'Wrong tone', 'Wrong language', 'Should be escalated', 'Other'])}<textarea id="dlgin" placeholder="Anything else (optional)">${esc(S.dlg.text || '')}</textarea>${foot('Reject draft')}`;
    if (o === 'handoff') { const to = t.draft?.routing || t.routing || 'the owning team';
      return `<h5>Hand off to ${esc(to)}</h5><p class="sm">Records an escalation. The ticket leaves your list and waits under Handed off. Nothing is sent to the user.</p><textarea id="dlgin" placeholder="Note for them (optional)">${esc(S.dlg.text || '')}</textarea>${foot('Hand off')}`; }
    if (o === 'close') return `<h5>Close without replying?</h5><p class="sm">The user gets nothing. Use this for spam, duplicates and messages that need no answer.</p>${opts(['Spam', 'Duplicate', 'Resolved elsewhere', 'No reply needed'])}${foot('Close ticket')}`;
    if (o === 'note') return `<h5>Internal note</h5><p class="sm">Only people using this console see it. It’s saved as a <span class="mono">note</span> action and doesn’t change the status.</p><textarea id="dlgin" placeholder="What should the next person know?">${esc(S.dlg.text || '')}</textarea>${foot('Save note')}`;
    if (o === 'approveAll') { const auto = groups().find(g => g.key === 'auto')?.items || [];
      return `<h5>Approve ${auto.length} auto-ready repl${auto.length === 1 ? 'y' : 'ies'}?</h5><p class="sm">Each draft is on the auto-resolve list with confidence 0.90 or higher. They’re recorded as approved by you. Nothing is sent.</p><ul class="tl" style="padding:10px 0 0">${auto.map(x => `<li><i></i><span>${esc(label(x))} · ${who(x)}</span><span>${x.confidence.toFixed(2)}</span></li>`).join('')}</ul>${foot('Approve all')}`; }
    return '';
  }
  function filterGroups() {
    const G = [['channel', 'Channel', [['clickup', 'ClickUp'], ['gmail', 'Gmail'], ['file', 'File']]],
      ['category', 'Category', [['streak', 'Streak'], ['account', 'Account'], ['gameplay', 'Gameplay'], ['rating', 'Rating'], ['subscription', 'Subscription'], ['payment', 'Payment'], ['merch', 'Merch'], ['safety', 'Safety'], ['suggestion', 'Suggestion']]],
      ['mode', 'Mode', [['assist', 'Assist'], ['escalate', 'Escalate'], ['auto', 'Auto']]],
      ['lang', 'Language', [['en', 'English'], ['hi-Latn', 'Hinglish'], ['hi', 'Hindi']]]];
    return G.map(([k, l, os]) => `<div class="fg"><span class="lab">${l}</span><div class="opts">${os.map(([v, n]) =>
      `<button class="${S.filters[k].includes(v) ? 'on' : ''}" data-act="togglef" data-k="${k}" data-v="${v}">${n}</button>`).join('')}</div></div>`).join('');
  }
  function filterLabel(k, v) {
    const m = { clickup: 'ClickUp', gmail: 'Gmail', file: 'File', en: 'English', 'hi-Latn': 'Hinglish', hi: 'Hindi' };
    return m[v] || v[0].toUpperCase() + v.slice(1);
  }
  function palMatches() {
    const q = S.palQ.trim().toLowerCase();
    const cmds = [['cmd:insights', 'Go to Insights', 'Page'], ['cmd:evals', 'Go to Evals', 'Page'], ['cmd:theme', `Switch to ${theme() === 'dark' ? 'light' : 'dark'} mode`, 'Command'], ['cmd:mask', `${S.mask ? 'Unmask' : 'Mask'} PII`, 'Command']];
    const tk = TICKETS.filter(t => !q || [t.ext, label(t), t.reporter.username, t.reporter.email, t.reporter.phone, t.subject, ...t.body].filter(Boolean).join(' ').toLowerCase().includes(q));
    const cm = cmds.filter(c => !q || c[1].toLowerCase().includes(q));
    return [...tk.slice(0, 7).map(t => ({ id: t.id, t })), ...cm.map(([id, l, k]) => ({ id, l, k }))];
  }
  function palResults() {
    const m = palMatches(); if (S.palI >= m.length) S.palI = Math.max(0, m.length - 1);
    if (!m.length) return '<li><span>No matches</span></li>';
    return m.map((x, i) => x.t
      ? `<li class="${i === S.palI ? 'on' : ''}" data-act="palgo" data-id="${x.id}"><b>${esc(label(x.t))}</b><span class="st">${x.t.status === 'triaged' ? 'to review' : x.t.status === 'open' ? 'with agent' : x.t.status}</span><span>${who(x.t)} · ${CHANNEL[x.t.channel]} · <span class="mono">${x.t.ext}</span></span><span></span></li>`
      : `<li class="${i === S.palI ? 'on' : ''}" data-act="palgo" data-id="${x.id}"><b>${esc(x.l)}</b><span class="st">${x.k}</span></li>`).join('');
  }
  function traceDrawer(t) {
    const r = t.run, steps = r.steps, mx = Math.max(...steps.map(s => s.ms || 0), 1);
    const tokIn = steps.reduce((a, s) => a + (s.inTok || 0), 0), tokOut = steps.reduce((a, s) => a + (s.outTok || 0), 0);
    const calls = steps.filter(s => s.model && s.model !== 'tools' && s.inTok).length;
    return `<aside class="drawer"><header><div><h5 style="font:600 16px Archivo">Pipeline run</h5><p class="sm"><span class="mono">${r.version}</span> · ${t.ext} · ${r.status}${r.stoppedAt ? ' · stopped at ' + r.stoppedAt : ''}</p></div><button class="btn quiet" data-act="close">Close <kbd>Esc</kbd></button></header>
      <div class="body">
        <div class="sum"><div>Time<b>${r.ms ? (r.ms / 1000).toFixed(1) + 's' : '–'}</b></div><div>Cost<b>${r.cost ? money(r.cost) : '–'}</b></div><div>Tokens in / out<b>${tokIn.toLocaleString()} / ${tokOut}</b></div><div>Model calls<b>${calls}</b></div></div>
        ${steps.map((s, i) => `<div class="step ${s.status === 'fail' ? 'fail' : ''}"><button data-act="step" data-i="${i}"><span class="ix">${String(i + 1).padStart(2, '0')}</span>
          <span class="nm">${s.step[0].toUpperCase() + s.step.slice(1)}<small>${s.model}</small></span><span class="ms">${s.status === 'now' ? 'running…' : s.status === 'fail' ? 'failed' : s.ms + ' ms'}</span><span class="co">${s.cost ? money(s.cost) : s.model === 'tools' ? 'no LLM' : ''}</span></button>
          ${s.ms ? `<div class="tb"><i style="width:${s.ms / mx * 100}%"></i></div>` : ''}
          ${S.openStep === i ? `<pre>input   ${esc(s.input || '(not recorded)')}\noutput  ${esc(s.output || '(not recorded)')}${s.inTok ? `\ntokens  ${s.inTok} in · ${s.outTok} out` : ''}</pre>` : ''}
          ${s.status === 'fail' ? `<pre style="border-color:var(--red-edge)">${esc(r.error)}</pre>` : ''}</div>`).join('')}
        <p class="sm" style="margin-top:14px">Each row is one step from <span class="mono">agent_runs.trace</span>, joined with its <span class="mono">token_log</span> rows. Click a step for its input and output.</p>
      </div></aside>`;
  }
  const toastHTML = () => S.toast ? `<div class="toast"><span>${S.toast.msg}</span>${S.toast.undo ? '<button data-act="undo">Undo</button><kbd>Z</kbd>' : ''}</div>` : '';

  // ── actions (each maps to one row in `actions`) ──
  let toastTimer;
  function toast(msg, undo) { S.toast = { msg, undo }; clearTimeout(toastTimer); toastTimer = setTimeout(() => { S.toast = null; renderOv(); }, 6000); }
  const renderOv = () => { $('#ov').innerHTML = overlayHTML() + toastHTML(); };
  const snap = t => JSON.parse(JSON.stringify(t));
  function record(t, act, extra = {}) {
    const mins = Math.max(1, Math.round((Date.now() - S.onSince) / 60000));
    t.history.push({ who: S.actor || 'console', act, after: `${t.ageMin + mins}m`, h: true, ...extra });
  }
  function moveOn(id) { // select the next ticket after an action removes this one from the list
    const before = S._order || [];
    const o = order();
    if (o.includes(id)) return;
    const i = before.indexOf(id);
    select(before.slice(i + 1).find(x => o.includes(x)) || o[o.length - 1] || null);
  }
  function act(kind, t, extra = {}) {
    S._order = order();
    const before = snap(t), who = S.actor || 'console';
    if (kind === 'approve') { t.status = 'replied'; t.final = plain(t) + ' — Team Matiks'; record(t, t.mode === 'auto' ? 'approved (auto)' : 'approved'); toast(`Approved · moved to Replied · nothing sent`, { id: t.id, before }); }
    if (kind === 'save') {
      const text = S.editText.trim(); if (!text) return;
      t.status = 'replied'; t.final = text + ' — Team Matiks'; record(t, t.draft && !t.rejected && t.mode !== 'escalate' ? 'edited and approved' : 'wrote a reply'); S.editing = false;
      toast('Reply saved · moved to Replied · nothing sent', { id: t.id, before });
    }
    if (kind === 'reject') { t.rejected = { by: who, reason: [S.dlg.reason, S.dlg.text].filter(Boolean).join(' · ') }; record(t, 'rejected the draft'); toast('Draft rejected · the ticket stays in To review', { id: t.id, before }); }
    if (kind === 'handoff') { const to = t.draft?.routing || t.routing || 'the owning team'; t.handedOff = { to, by: who, text: S.dlg.text }; record(t, `handed off to ${to}`); toast(`Handed off to ${esc(to)} · moved to Handed off`, { id: t.id, before }); }
    if (kind === 'close') { t.status = 'closed'; t.closedReason = S.dlg.reason; record(t, `closed${S.dlg.reason ? ' · ' + S.dlg.reason.toLowerCase() : ''}`); toast('Closed · nothing sent', { id: t.id, before }); }
    if (kind === 'note') { if (!S.dlg.text?.trim()) return; (t.notes = t.notes || []).push({ by: who, text: S.dlg.text.trim() }); record(t, 'added a note'); toast('Note saved'); }
    if (kind === 'reopen') { t.status = t.issue ? 'triaged' : 'open'; t.handedOff = null; record(t, 'reopened'); S.tab = 'review'; toast('Reopened · back in To review', { id: t.id, before }); select(t.id); }
    S.overlay = null; S.dlg = {};
    if (kind !== 'reopen' && kind !== 'note') moveOn(t.id);
    render();
  }
  function approveAll() {
    const auto = groups().find(g => g.key === 'auto')?.items || [];
    S._order = order();
    const before = auto.map(snap);
    auto.forEach(t => { t.status = 'replied'; t.final = plain(t) + ' — Team Matiks'; record(t, 'approved (auto batch)'); });
    S.overlay = null; toast(`Approved ${auto.length} auto-ready repl${auto.length === 1 ? 'y' : 'ies'} · nothing sent`, { batch: before });
    if (auto.some(t => t.id === S.sel)) moveOn(S.sel);
    render();
  }
  function undo() {
    const u = S.toast?.undo; if (!u) return;
    (u.batch || [u.before]).forEach(b => { const i = TICKETS.findIndex(x => x.id === b.id); TICKETS[i] = b; });
    select((u.before || u.batch[0]).id);
    S.tab = 'review'; S.toast = { msg: 'Undone · recorded as a reopen' }; clearTimeout(toastTimer); toastTimer = setTimeout(() => { S.toast = null; renderOv(); }, 3000);
    render();
  }

  // ── opening overlays ──
  function open(kind, el) {
    const r = (el || document.querySelector(`[data-act="${kind}"]`))?.getBoundingClientRect();
    S.anchor = r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null;
    S.overlay = kind; S.dlg = {}; if (kind === 'palette') { S.palQ = ''; S.palI = 0; }
    renderOv(); afterOv();
  }
  function afterOv() {
    const pin = $('#palin'); if (pin) pin.focus();
    const din = $('#dlgin'); if (din) { din.focus(); din.setSelectionRange?.(din.value.length, din.value.length); }
  }
  const cur = () => S.view === 'queue' && S.sel ? T(S.sel) : null;
  const canDraftActs = t => t && t.status === 'triaged' && !t.handedOff && t.draft && t.mode !== 'escalate';
  function startEdit(t, blank) { S.editing = true; S.editText = blank ? '' : plain(t); render(); }

  // ── events ──
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const a = el.dataset.act, v = el.dataset.v, t = cur();
    if (a !== 'ext') e.preventDefault();
    switch (a) {
      case 'view': S.view = v; S.overlay = null; render(); break;
      case 'tab': S.tab = v; S.showOff = false; render(); break;
      case 'cohort': S.cohort = v; render(); break;
      case 'sel': select(el.dataset.id); S.tab = S.tab; render(); break;
      case 'filter': open('filter', el); break;
      case 'togglef': { const L = S.filters[el.dataset.k]; L.includes(v) ? L.splice(L.indexOf(v), 1) : L.push(v); render(); afterOv(); break; }
      case 'unfilter': { const L = S.filters[el.dataset.k]; L.splice(L.indexOf(v), 1); render(); break; }
      case 'clearf': Object.values(S.filters).forEach(L => L.splice(0)); render(); break;
      case 'toggleOff': S.showOff = !S.showOff; render(); break;
      case 'channels': open('channels', el); break;
      case 'mask': S.mask = !S.mask; render(); break;
      case 'theme': store.set('dispatch.theme', theme() === 'dark' ? 'light' : 'dark'); render(); break;
      case 'keys': open('keys'); break;
      case 'name': open('name'); break;
      case 'palette': open('palette'); break;
      case 'palgo': palGo(el.dataset.id); break;
      case 'offline': S.offline = false; render(); break;
      case 'close': if (S.overlay === 'name' && !S.actor) break; S.overlay = null; S.openStep = null; renderOv(); break;
      case 'approve': if (canDraftActs(t) && !t.rejected) act('approve', t); break;
      case 'edit': if (canDraftActs(t)) startEdit(t, false); break;
      case 'write': if (t) startEdit(t, true); break;
      case 'save': if (t) act('save', t); break;
      case 'cancel': S.editing = false; render(); break;
      case 'reject': if (canDraftActs(t) && !t.rejected) open('reject'); break;
      case 'handoff': if (t && t.status === 'triaged' && !t.handedOff) open('handoff'); break;
      case 'more': open('more', el); break;
      case 'close-t': S.overlay = null; open('close'); break;
      case 'note': S.overlay = null; open('note'); break;
      case 'reopen': if (t && t.status === 'closed') act('reopen', t); break;
      case 'trace': if (t) { S.openStep = null; S.overlay = null; open('trace'); } break;
      case 'step': S.openStep = S.openStep === +el.dataset.i ? null : +el.dataset.i; renderOv(); break;
      case 'reason': { const d = $('#dlgin'); if (d) S.dlg.text = d.value; S.dlg.reason = S.dlg.reason === v ? null : v; renderOv(); afterOv(); break; }
      case 'confirm': confirmDlg(); break;
      case 'approveAll': open('approveAll'); break;
      case 'undo': undo(); break;
      case 'full': S.showFull = !S.showFull; render(); break;
      case 'ext': e.preventDefault(); toast(`Opens the ${t ? CHANNEL[t.channel] : 'source'} link in a new tab (external_url)`); renderOv(); break;
      case 'icohort': S.icohort = v; render(); break;
      case 'issue': S.view = 'queue'; S.tab = 'review'; S.cohort = 'all'; Object.values(S.filters).forEach(L => L.splice(0)); S.filters.category.push(v); render(); break;
      case 'chanf': S.view = 'queue'; S.tab = 'review'; Object.values(S.filters).forEach(L => L.splice(0)); S.filters.channel.push(v); render(); break;
      case 'evalFails': S.evalFails = !S.evalFails; render(); break;
    }
  });
  function confirmDlg() {
    const o = S.overlay, t = cur(), din = $('#dlgin');
    if (din) S.dlg.text = din.value;
    if (o === 'name') { const n = (din?.value || '').trim(); if (!n) return; S.actor = n; store.set('dispatch.actor', n); S.overlay = null; render(); return; }
    if (o === 'approveAll') return approveAll();
    if (!t) return;
    ({ reject: () => act('reject', t), handoff: () => act('handoff', t), close: () => act('close', t), note: () => act('note', t) })[o]?.();
  }
  function palGo(id) {
    S.overlay = null;
    if (id.startsWith('cmd:')) {
      const c = id.slice(4);
      if (c === 'insights' || c === 'evals') S.view = c;
      if (c === 'theme') store.set('dispatch.theme', theme() === 'dark' ? 'light' : 'dark');
      if (c === 'mask') S.mask = !S.mask;
      return render();
    }
    const t = T(id); S.view = 'queue'; S.cohort = 'all'; Object.values(S.filters).forEach(L => L.splice(0));
    S.tab = t.status === 'triaged' ? 'review' : t.status === 'open' ? 'agent' : t.status;
    if (t.handedOff) S.showOff = true;
    select(id); render();
  }

  document.addEventListener('input', e => {
    if (e.target.id === 'editor') { S.editText = e.target.value; const c = $('#checks'); if (c) c.innerHTML = checksHTML(cur(), S.editText); }
    if (e.target.id === 'palin') { S.palQ = e.target.value; S.palI = 0; $('#palres').innerHTML = palResults(); }
  });

  // evidence ↔ draft linking without a re-render
  document.addEventListener('mouseover', e => {
    const m = e.target.closest('[data-ev],[data-evrow]');
    const i = m ? +(m.dataset.ev ?? m.dataset.evrow) : null;
    if (i === S.hot) return;
    S.hot = i;
    document.querySelectorAll('.mv').forEach(x => x.classList.toggle('hot', +x.dataset.ev === i));
    document.querySelectorAll('.ev .r[data-evrow]').forEach(x => x.classList.toggle('hot', +x.dataset.evrow === i));
  });

  // chart tooltips
  const tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true; document.body.append(tip);
  document.addEventListener('mousemove', e => {
    const el = e.target.closest('[data-tip]');
    if (!el) { tip.hidden = true; return; }
    tip.textContent = el.dataset.tip; tip.hidden = false;
    const x = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8);
    tip.style.left = x + 'px'; tip.style.top = (e.clientY + 16) + 'px';
  });

  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA)$/.test(e.target.tagName);
    const k = e.key, t = cur(), mod = e.metaKey || e.ctrlKey;
    if (mod && k.toLowerCase() === 'k') { e.preventDefault(); return open('palette'); }
    if (S.overlay === 'palette') {
      const m = palMatches();
      if (k === 'ArrowDown') { e.preventDefault(); S.palI = Math.min(S.palI + 1, m.length - 1); $('#palres').innerHTML = palResults(); }
      if (k === 'ArrowUp') { e.preventDefault(); S.palI = Math.max(S.palI - 1, 0); $('#palres').innerHTML = palResults(); }
      if (k === 'Enter' && m[S.palI]) palGo(m[S.palI].id);
      if (k === 'Escape') { S.overlay = null; renderOv(); }
      return;
    }
    if (k === 'Escape') {
      if (S.overlay) { if (S.overlay === 'name' && !S.actor) return; S.overlay = null; S.openStep = null; return renderOv(); }
      if (S.editing) { S.editing = false; return render(); }
      return;
    }
    if (S.overlay && ['name', 'reject', 'handoff', 'close', 'note', 'approveAll'].includes(S.overlay)) {
      if (k === 'Enter' && (mod || e.target.tagName !== 'TEXTAREA')) { e.preventDefault(); confirmDlg(); }
      return;
    }
    if (mod && k === 'Enter' && S.editing && t) { e.preventDefault(); return act('save', t); }
    if (typing || mod || e.altKey) return;
    if (S.overlay && !['more', 'filter', 'channels', 'trace', 'keys'].includes(S.overlay)) return;
    if ('jkaAerxcnotzfm?123O '.includes(k)) e.preventDefault(); // shortcuts never type into the field they open
    const go = d => { const o = order(); if (!o.length) return; const i = o.indexOf(S.sel); select(o[Math.max(0, Math.min(o.length - 1, i + d))]); render(); };
    switch (k) {
      case 'j': if (S.view === 'queue') go(1); break;
      case 'k': if (S.view === 'queue') go(-1); break;
      case 'a': if (canDraftActs(t) && !t.rejected && !S.editing) act('approve', t); break;
      case 'A': if (S.view === 'queue' && groups().some(g => g.key === 'auto')) open('approveAll'); break;
      case 'e': if (t && !S.editing) { e.preventDefault(); canDraftActs(t) && !t.rejected ? startEdit(t, false) : (t.status === 'triaged' || t.status === 'open') && startEdit(t, true); } break;
      case 'r': if (canDraftActs(t) && !t.rejected) open('reject'); break;
      case 'x': if (t && t.status === 'triaged' && !t.handedOff) open('handoff'); break;
      case 'c': if (t && (t.status === 'triaged' || t.status === 'replied')) { S.overlay = null; open('close'); } break;
      case 'n': if (t) { S.overlay = null; open('note'); } break;
      case 'o': if (t && t.status === 'closed') act('reopen', t); break;
      case 't': if (t) { S.overlay = null; S.openStep = null; open('trace'); } break;
      case 'z': undo(); break;
      case 'f': if (S.view === 'queue') open('filter'); break;
      case 'm': S.mask = !S.mask; render(); break;
      case ' ': if (t && !S.editing) { e.preventDefault(); S.showFull = !S.showFull; render(); } break;
      case '1': S.view = 'queue'; render(); break;
      case '2': S.view = 'insights'; render(); break;
      case '3': S.view = 'evals'; render(); break;
      case '?': open('keys'); break;
      case 'O': S.offline = !S.offline; render(); break;
    }
  });

  // live clock for the ticket being handled
  function tick() {
    const s = Math.floor((Date.now() - S.onSince) / 1000);
    document.querySelectorAll('[data-timer]').forEach(x => { x.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; });
  }
  setInterval(tick, 1000);

  // the agent finishes t10 live, the way an SSE update would land
  const t10 = T('t10');
  const stepIn = (name, ms) => { const s = t10.run.steps.find(x => x.status === 'now'); if (s) { s.status = 'done'; s.ms = ms; } if (name) t10.run.steps.push({ step: name, status: 'now', model: STEP_MODEL[name] }); };
  const refresh = () => { if (!S.overlay && !S.editing) render(); };
  setTimeout(() => { stepIn('decide', 540); refresh(); }, 2500);
  setTimeout(() => { stepIn('draft', 160); refresh(); }, 4000);
  setTimeout(() => { stepIn('guardrail', 2050); refresh(); }, 6500);
  setTimeout(() => {
    stepIn(null, 460);
    Object.assign(t10, t10.becomes, { isNew: true });
    t10.run = { version: 'v0.3', status: 'succeeded', steps: t10.run.steps.map(s => ({ ...s, cost: s.step === 'draft' ? 0.0031 : s.model === 'tools' ? 0 : 0.0002 })), ms: 3610, cost: 0.0037 };
    if (S.sel === 't10' && S.tab === 'agent') S.tab = 'review';
    refresh();
    setTimeout(() => { t10.isNew = false; }, 1700);
  }, 8000);

  if (!S.actor) S.overlay = 'name';
  render();
})();
