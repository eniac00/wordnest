/* UI, storage, question generation and sessions. Logic lives in engine.js. */
const $ = s => document.querySelector(s), app = $('#app'), V = window.VOCAB, E = window.GRE;
const KEY = 'grevm.v1';
const defS = () => ({ v: 1, p: {}, xp: 0, streak: 0, day: '', pairs: {}, hist: [], set: { n: 12, hints: true, exact: false, mast: true, expert: false } });
const okS = x => x && x.v === 1 && x.p && typeof x.p === 'object' && Array.isArray(x.hist) && x.set;
let S; try { const x = JSON.parse(localStorage.getItem(KEY)); S = okS(x) ? Object.assign(defS(), x) : defS(); } catch (e) { S = defS(); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } };
const R = id => S.p[id] || E.blank(), W = id => S.p[id] || (S.p[id] = E.blank());
const sh = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0;[a[i], a[j]] = [a[j], a[i]] } return a };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const LV = ['Unseen', 'Learning', 'Familiar', 'Practiced', 'Strong', 'Mastered'];
const LVREQ = ['Not studied yet.', 'Encountered, cannot reliably recall.', '2+ correct answers (any format).', '2+ unaided correct in 2+ modes.', '3+ unaided in 2+ modes on 2+ days, few spelling errors.', '5+ unaided in 3+ modes on 3+ days, review interval ≥ 7 days. Two misses in a row demote a word.'];
const MODES = { recall: 'Meaning recall', rev: 'Definition → word', cloze: 'Context cloze', conf: 'Confusable pair', sent: 'Use in a sentence', syn: 'Synonym precision', spell: 'Spelling lab', fix: 'Error diagnosis' };
const EX = {}; V.forEach(w => { if (w.example) EX[w.id] = w.example; });
const byWord = {}; V.forEach(w => byWord[w.word.toLowerCase()] = w);
const PAIRS = [['Abate', 'Alleviate'], ['Aggregate', 'Amalgamate'], ['Ambiguous', 'Anomalous'], ['Ambivalence', 'Antipathy'], ['Ameliorate', 'Alleviate'], ['Apprise', 'Approbation'], ['Assuage', 'Appease'], ['Loquacious', 'Garrulous'], ['Obdurate', 'Intractable'], ['Mitigate', 'Mollify'], ['Placate', 'Propitiate'], ['Disinterested', 'Indifferent']].map(p => p.map(x => byWord[x.toLowerCase()])).filter(p => p[0] && p[1]);
const partner = w => { const p = PAIRS.find(p => p.includes(w)); if (p) return p[0] === w ? p[1] : p[0]; const k = E.toks(w.sourceDefinition); return sh(V.filter(x => x !== w)).map(x => [x, E.toks(x.sourceDefinition).filter(t => k.includes(t)).length]).sort((a, b) => b[1] - a[1])[0][0]; };
const others = (w, n) => { const p = partner(w); return [p, ...sh(V.filter(x => x !== w && x !== p && x.word !== w.word)).slice(0, n)].slice(0, n); };
const first = d => d.split(/[;,]/)[0].replace(/\(.*?\)/g, '').trim();
const pk = (a, b) => [a.id, b.id].sort((x, y) => x - y).join('-');

/* ---------- question generation (no answer evaluation here beyond judge closures) ---------- */
function gen(mode, w) {
  const d = w.sourceDefinition, wl = w.word.toLowerCase();
  if (mode === 'cloze' && !EX[w.id]) mode = 'rev';
  const mc = (prompt, right, wrong, why, pair) => { const o = sh([right, ...wrong]); return { mode, w, kind: 'mc', prompt, opts: o, judge: i => ({ res: o[i] === right ? 'correct' : 'wrong', pair: o[i] !== right && pair ? pk(w, pair) : null }), why }; };
  const typed = (prompt, label, ans, extra) => ({ mode, w, kind: 'type', prompt, label, hint: () => w.word[0] + '…', judge: a => { a = a.trim().toLowerCase(); const dd = E.lev(a, ans); if (!dd) return { res: 'correct' }; if (dd <= 2 && a.length > 3) return { res: S.set.exact ? 'wrong' : 'correct', spell: 1, msg: 'Right word, spelling: ' + w.word }; return { res: 'wrong' }; }, why: extra });
  if (mode === 'recall') return { mode, w, kind: 'long', prompt: `<span class="word">${w.word} <span class="pos">${w.pos}</span></span>`, label: 'Type the meaning in your own words (no choices):', hint: () => 'Starts with: ' + first(d).slice(0, 3) + '…', judge: a => ({ res: E.evalMeaning(a, d) }) };
  if (mode === 'rev') return typed(esc(d), 'Type the word:', wl);
  if (mode === 'cloze') { const re = new RegExp(w.word.slice(0, Math.max(4, w.word.length - 3)) + '\\w*', 'i'); const o = others(w, 3); return mc(esc(EX[w.id].replace(re, '______')), w.word, o.map(x => x.word), `“${w.word}”: ${d}. The others (${o.map(x => x.word).join(', ')}) do not fit: ${o.map(x => x.word + ' = ' + first(x.sourceDefinition)).join('; ')}.`, o[0]); }
  if (mode === 'conf') { const p = partner(w), o = others(w, 3); return mc(`Which word best matches: <b>${esc(d)}</b>`, w.word, [p.word, ...o.filter(x => x !== p).slice(0, 2).map(x => x.word)], `${w.word} = ${d}. Often mixed up with ${p.word} = ${p.sourceDefinition}.`, p); }
  if (mode === 'syn') { const o = others(w, 3); return mc(`Closest in meaning to <span class="word">${w.word} <span class="pos">${w.pos}</span></span>?`, first(d), o.map(x => first(x.sourceDefinition)), `${w.word}: ${d}.`, o[0]); }
  if (mode === 'sent') return { mode, w, kind: 'long', prompt: `Write your own sentence using <span class="word">${w.word} <span class="pos">${w.pos}</span></span> correctly.<br><small>Meaning: ${esc(d)}</small>`, label: 'Your sentence:', hint: () => 'Example idea: ' + (EX[w.id] || first(d)), judge: a => (new RegExp(w.word.slice(0, Math.max(4, w.word.length - 3)), 'i').test(a) && a.trim().split(/\s+/).length >= 6) ? { res: 'unsure', msg: 'Heuristics passed (word used, sentence long enough). Rubric: (1) meaning fits, (2) grammar, (3) context makes the meaning clear.' } : { res: 'wrong', msg: 'Use the word in a full sentence (6+ words).' }, why: EX[w.id] ? 'Model: ' + EX[w.id] : '' };
  if (mode === 'fix') { const y = others(w, 1)[0]; return typed(`Someone calls <i>${esc(first(y.sourceDefinition))}</i> by the name “<b>${w.word}</b>”, which is wrong. Type the word that really means “${esc(first(y.sourceDefinition))}”:`, 'Correct word:', y.word.toLowerCase(), `“${w.word}” means ${d}.`); }
  if (mode === 'spell') {
    const v = ['missing', 'scramble', 'fixit'][Math.random() * 3 | 0], L = [...wl];
    if (v === 'missing') { const idx = sh(L.map((_, i) => i).slice(1)).slice(0, Math.ceil(L.length * .4)); return typed(`${esc(d)}<br><span class="word">${L.map((c, i) => idx.includes(i) ? '_' : c).join(' ')}</span>`, 'Type the full word:', wl); }
    if (v === 'scramble') { let s; do s = sh(L).join(''); while (s === wl); return typed(`${esc(d)}<br><span class="word">${s}</span>`, 'Unscramble:', wl); }
    const i = 1 + (Math.random() * (L.length - 3) | 0), bad = [...L]; [bad[i], bad[i + 1]] = [bad[i + 1], bad[i]]; const b = bad.join(''); return typed(`Correct the spelling of <span class="word">${b === wl ? wl + 'x' : b}</span><br><small>${esc(d)}</small>`, 'Type it correctly:', wl);
  }
}
const pool = l => l <= 1 ? ['syn', 'conf', 'spell', 'rev'] : l === 2 ? ['rev', 'recall', 'cloze', 'spell'] : l === 3 ? ['conf', 'cloze', 'fix', 'rev', 'sent'] : ['recall', 'rev', 'sent', 'fix', 'cloze', 'spell'];
const pickMode = w => { const l = E.level(R(w.id)); return sh(S.set.expert ? pool(4) : pool(l))[0]; };

/* ---------- sessions ---------- */
let ss;
const due = () => V.filter(w => R(w.id).n && R(w.id).due <= Date.now());
const seen = () => V.filter(w => R(w.id).n);
const byWeak = a => [...a].sort((x, y) => E.weakness(R(y.id)).s - E.weakness(R(x.id)).s);
function start(type) {
  const n = S.set.n; let ws = [], intro = [], modes = null, hints = S.set.hints;
  const incl = a => S.set.mast ? a : a.filter(w => E.level(R(w.id)) < 5);
  if (type === 'learn') { intro = V.filter(w => !R(w.id).n).slice(0, 6); ws = intro; }
  else if (type === 'daily') ws = byWeak(incl(due())).slice(0, n);
  else if (type === 'weak') ws = byWeak(incl(seen())).filter(w => E.weakness(R(w.id)).s > 0).slice(0, n);
  else if (type === 'clinic') { const ps = Object.entries(S.pairs).sort((a, b) => b[1] - a[1]).slice(0, 6).map(e => e[0].split('-').map(i => V[i - 1])); ws = (ps.length ? ps.flat() : PAIRS.flat()).slice(0, n); modes = ['conf']; }
  else if (type === 'spell') { ws = byWeak(seen()).slice(0, n); if (ws.length < 4) ws = sh(V).slice(0, n); modes = ['spell']; }
  else if (type === 'context') { ws = sh(V.filter(w => EX[w.id])); modes = ['cloze', 'sent']; }
  else if (type === 'boss' || type === 'exam') { const c = type === 'exam' ? 50 : Math.max(25, n), s = seen(); ws = sh([...byWeak(s).slice(0, c * .4 | 0), ...sh(due()).slice(0, c * .3 | 0), ...sh(s.length > 10 ? s : V)]).filter((w, i, a) => a.indexOf(w) === i).slice(0, c); hints = false; }
  else ws = sh(V).slice(0, n);
  if (!ws.length) { app.innerHTML = `<div class="card"><h2>Nothing to do here yet</h2><p>Learn some words first (or nothing is due yet).</p></div><button class="big go" onclick="home()">Back</button>`; return; }
  let q = [];
  ws.forEach(w => { const l = type === 'learn' ? 1 : 0; const m = modes ? sh(modes)[0] : pickMode(w); q.push(gen(m, w)); if (type === 'learn') q.push(gen(sh(pool(1).filter(x => x !== m))[0], w)); });
  if (type === 'boss' || type === 'exam') S.set.expert || (q = q.map(x => x));
  ss = { q: type === 'learn' ? q : sh(q), k: 0, xp: 0, ok: 0, tot: 0, ms: 0, sp: 0, miss: new Set(), pairs: {}, type, hints, intro, byMode: {} };
  intro.length ? card(0) : ask();
}
function card(i) {
  const w = ss.intro[i];
  app.innerHTML = `<div class="top"><span class="lbl">New word ${i + 1}/${ss.intro.length}</span><button class="x" aria-label="Quit" onclick="home()">✕</button></div>
  <div class="card"><div class="word">${w.word} <span class="pos">${w.pos}</span></div><div class="q">${esc(w.sourceDefinition)}</div>${w.example ? `<div class="lbl">Example</div><p><i>${esc(w.example)}</i></p>` : ''}</div>
  <button class="big go" id="nx">${i + 1 < ss.intro.length ? 'Next word' : 'Start the test'}</button><p class="lbl" style="text-align:center">Answers are hidden once testing starts.</p>`;
  $('#nx').onclick = () => i + 1 < ss.intro.length ? card(i + 1) : ask();
}
function ask() {
  if (ss.k >= ss.q.length) return finish();
  const q = ss.q[ss.k]; ss.t0 = Date.now(); q.hinted = false;
  let h = `<div class="top" style="gap:12px"><button class="x" aria-label="Quit" onclick="home()">✕</button><div class="bar" style="flex:1"><i style="width:${ss.k / ss.q.length * 100}%"></i></div></div><div class="lbl" style="margin-top:18px">${MODES[q.mode]}</div><div class="q">${q.prompt}</div>`;
  if (q.kind === 'mc') h += q.opts.map((o, i) => `<button class="opt" data-i="${i}">${i + 1}. ${esc(o)}</button>`).join('');
  else { h += `<p class="lbl">${q.label}</p>` + (q.kind === 'long' ? '<textarea id="in" rows="3" style="height:auto;font-size:17px"></textarea>' : '<input type="text" id="in" autocomplete="off" autocapitalize="off" spellcheck="false">') + `<div id="hint" class="lbl"></div><button class="big go" id="chk">Check (Enter)</button><button class="ghost" id="dk">I don't know</button>${ss.hints ? '<button class="ghost" id="hb">Hint (counts as aided)</button>' : ''}`; }
  app.innerHTML = h;
  if (q.kind === 'mc') app.querySelectorAll('.opt').forEach(b => b.onclick = () => { const r = q.judge(+b.dataset.i); app.querySelectorAll('.opt').forEach(x => { x.disabled = true; if (q.opts[x.dataset.i] === q.opts[+b.dataset.i]) x.classList.add(r.res === 'correct' ? 'ok' : 'no'); else if (r.res !== 'correct' && q.judge(+x.dataset.i).res === 'correct') x.classList.add('ok'); }); commit(q, r); });
  else {
    const inp = $('#in'); inp.focus();
    const go = v => { inp.disabled = true; const r = v === null ? { res: 'wrong' } : q.judge(v); r.res === 'unsure' ? rate(q, r) : commit(q, r); };
    $('#chk').onclick = () => go(inp.value); $('#dk').onclick = () => go(null);
    inp.onkeydown = e => { if (e.key === 'Enter' && (q.kind === 'type' || !e.shiftKey)) { e.preventDefault(); go(inp.value) } };
    if ($('#hb')) $('#hb').onclick = () => { q.hinted = true; $('#hint').textContent = q.hint(); };
  }
}
function rate(q, r) {
  const d = q.w.sourceDefinition;
  bar(null, `<b>Can't judge this automatically.</b> ${r.msg || ''}<br>Source meaning: ${esc(d)}${q.why ? '<br>' + esc(q.why) : ''}<br>Rate yourself honestly:`, [['Got it', () => commit(q, { res: 'correct' }, 1)], ['Partly', () => commit(q, { res: 'wrong' }, 1)], ['Missed', () => commit(q, { res: 'wrong' }, 1)]]);
}
function commit(q, r, self) {
  const ok = r.res === 'correct', un = ok && !q.hinted, w = W(q.w.id), ms = Date.now() - ss.t0;
  E.update(w, { mode: q.mode, ok, unaided: un && (q.kind !== 'mc'), hinted: q.hinted, ms, spell: r.spell, pair: r.pair });
  if (r.pair) S.pairs[r.pair] = (S.pairs[r.pair] || 0) + 1;
  const g = ok ? (un ? (q.kind === 'mc' ? 5 : 12) : 3) : 0; S.xp += g; ss.xp += g; ss.tot++; ss.ms += ms; if (ok) ss.ok++; else { ss.miss.add(q.w.word); if (!q.again && ss.type !== 'boss' && ss.type !== 'exam') ss.q.push({ ...gen(q.mode, q.w), again: 1 }); } if (r.spell) ss.sp++; if (r.pair) ss.pairs[r.pair] = 1;
  const m = ss.byMode[q.mode] || (ss.byMode[q.mode] = [0, 0]); m[1]++; if (ok) m[0]++;
  save();
  bar(ok, `${ok ? '✅ Correct' : '❌ Not quite'}${q.hinted ? ' (hint used)' : ''}${r.msg ? ' · ' + esc(r.msg) : ''}<br><small><b>${q.w.word}</b> <span class="pos">${q.w.pos}</span>: ${esc(q.w.sourceDefinition)}${q.why && !ok ? '<br>' + esc(q.why) : ''}${q.why && ok && q.kind === 'mc' ? '<br>' + esc(q.why) : ''}</small>`, [['Continue (Enter)', () => { ss.k++; ask(); }]]);
}
function bar(ok, html, btns) {
  const o = $('.fb'); if (o) o.remove(); const d = document.createElement('div'); d.className = 'fb ' + (ok === null ? '' : ok ? 'ok' : 'no');
  d.innerHTML = `<div role="status">${html}<div style="display:flex;gap:8px">${btns.map((b, i) => `<button class="big ${ok === false ? '' : 'go'}" data-b="${i}">${b[0]}</button>`).join('')}</div></div>`;
  document.body.appendChild(d); d.querySelectorAll('button').forEach(b => b.onclick = () => { d.remove(); btns[b.dataset.b][1](); }); d.querySelector('button').focus();
}
function finish() {
  const t = new Date().toDateString(), y = new Date(Date.now() - 864e5).toDateString();
  if (S.day !== t) { S.streak = S.day === y ? S.streak + 1 : 1; S.day = t; }
  const acc = ss.tot ? Math.round(ss.ok / ss.tot * 100) : 0, avg = ss.tot ? Math.round(ss.ms / ss.tot / 1000) : 0;
  S.hist.unshift({ t: Date.now(), type: ss.type, acc, n: ss.tot }); S.hist = S.hist.slice(0, 30); save();
  const pr = Object.keys(ss.pairs).map(k => k.split('-').map(i => V[i - 1].word).join(' ↔ '));
  app.innerHTML = `<div style="text-align:center;margin-top:24px"><div style="font-size:56px">🎯</div><h1>Session report</h1></div>
  <div class="stats"><div><b>${acc}%</b><span>Accuracy</span></div><div><b>+${ss.xp}</b><span>XP</span></div><div><b>${avg}s</b><span>Avg time</span></div></div>
  <div class="card"><p>Spelling errors: <b>${ss.sp}</b></p><p>By mode: ${Object.entries(ss.byMode).map(([k, v]) => `${MODES[k]} ${v[0]}/${v[1]}`).join(' · ')}</p>
  <p>Confusion pairs: ${pr.join(', ') || 'none'}</p><p>Revise: ${[...ss.miss].join(', ') || 'nothing — nice!'}</p></div>
  <button class="big go" onclick="start('${ss.type}')">Again</button><button class="big" onclick="home()">Home</button>`;
}

/* ---------- screens ---------- */
function home() {
  const cnt = [0, 0, 0, 0, 0, 0]; V.forEach(w => cnt[E.level(R(w.id))]++);
  const enc = 333 - cnt[0], dueN = due().length, mast = cnt[5];
  const acc = ms => { let a = 0, b = 0; V.forEach(w => ms.forEach(m => { const x = R(w.id).mAcc[m]; if (x) { a += x[0]; b += x[1]; } })); return b ? Math.round(a / b * 100) + '%' : '–'; };
  const wk = byWeak(seen()).filter(w => E.weakness(R(w.id)).s > 0).slice(0, 6);
  const pr = Object.entries(S.pairs).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const s = (t, l, c) => `<button class="big ${c || ''}" onclick="start('${t}')">${l}</button>`;
  app.innerHTML = `<div class="hd"><h1>🪺 WordNest</h1><div class="pills"><span class="pill">🔥 ${S.streak}</span><span class="pill">⚡ ${S.xp}</span></div></div>
  <div class="card"><b style="font-size:19px">Mastered ${mast} / 333</b>
  <div class="bar" style="display:flex;margin:10px 0">${cnt.slice(1).map((c, i) => `<i title="${LV[i + 1]}" style="width:${c / 3.33}%;background:hsl(${[40, 30, 200, 140, 120][i]},70%,${[60, 55, 55, 45, 40][i]}%);border-right:1px solid var(--card)"></i>`).join('')}</div>
  <div class="row kv"><span>Encountered</span><b>${enc}</b></div><div class="row kv"><span>Never studied</span><b>${cnt[0]}</b></div><div class="row kv"><span>Due for review</span><b>${dueN}</b></div>
  <div class="lbl" style="margin:12px 0 2px">By level</div>
  ${cnt.slice(1).map((c, i) => `<div class="row kv"><span><i class="sw" style="background:hsl(${[40, 30, 200, 140, 120][i]},70%,${[60, 55, 55, 45, 40][i]}%)"></i>${LV[i + 1]}</span><b>${c}</b></div>`).join('')}
  <div class="stats"><div><b>${acc(['recall', 'rev'])}</b><span>Unaided recall</span></div><div><b>${acc(['cloze', 'sent', 'fix'])}</b><span>Context</span></div><div><b>${acc(['spell'])}</b><span>Spelling</span></div></div></div>
  ${s('learn', 'Learn 6 new words', 'go')}${s('daily', `Daily review / delayed recall (${dueN} due)`, 'bl')}${s('weak', '🎯 Weak-word workout')}${s('clinic', '🔀 Confusion clinic')}${s('spell', '✏️ Spelling lab')}${s('context', '📖 Context master')}${s('boss', '👹 Boss battle (25+)')}${s('exam', '📝 Exam simulation (50)')}${s('surprise', '🎲 Surprise review')}
  <div class="card"><b>Weakest words</b>${wk.map(w => `<div class="row"><b>${w.word}</b><small>${E.weakness(R(w.id)).why}</small></div>`).join('') || '<p class="lbl">None yet.</p>'}<b>Most confused pairs</b>${pr.map(([k, c]) => `<div class="row"><span>${k.split('-').map(i => V[i - 1].word).join(' ↔ ')}</span><small>${c}×</small></div>`).join('') || '<p class="lbl">None yet.</p>'}
  <b>Recent sessions</b>${S.hist.slice(0, 5).map(h => `<div class="row"><span>${h.type}</span><small>${h.acc}% of ${h.n} · ${new Date(h.t).toLocaleDateString()}</small></div>`).join('') || '<p class="lbl">None yet.</p>'}</div>
  <div class="foot"><button class="ghost" onclick="settings()">⚙ Settings, levels &amp; data</button> <button class="ghost" onclick="list()">All words</button> <button class="ghost" onclick="document.documentElement.dataset.theme=document.documentElement.dataset.theme=='dark'?'light':'dark'">Theme</button></div>`;
}
let LF = { q: '', lv: -1 };
function list() {
  app.innerHTML = `<div class="top"><h2>All words</h2><button class="x" aria-label="Close" onclick="home()">✕</button></div>
  <input type="text" id="sq" placeholder="Search words or meanings…" value="${esc(LF.q)}" aria-label="Search">
  <div class="chips">${['All', ...LV].map((c, i) => `<button class="chip ${LF.lv === i - 1 ? 'on' : ''}" data-l="${i - 1}">${c}</button>`).join('')}</div><div id="res"></div>`;
  const draw = () => {
    const q = LF.q.toLowerCase(), r = V.filter(w => (LF.lv < 0 || E.level(R(w.id)) === LF.lv) && (!q || w.word.toLowerCase().includes(q) || w.sourceDefinition.toLowerCase().includes(q)));
    $('#res').innerHTML = `<p class="lbl">${r.length} word${r.length == 1 ? '' : 's'}</p>` + r.map(w => { const s = R(w.id), l = E.level(s); return `<div class="wr"><span class="num">${w.id}</span><div class="wm"><b>${w.word}</b> <span class="pos">${w.pos}</span><div class="wd">${esc(w.sourceDefinition)}</div></div><div class="wl"><span class="tag t${l}">${LV[l]}</span>${s.n ? `<small>✓${s.ok} ✗${s.bad}</small>` : ''}</div></div>`; }).join('');
  };
  draw();
  $('#sq').oninput = e => { LF.q = e.target.value; draw(); };
  app.querySelectorAll('.chip').forEach(b => b.onclick = () => { LF.lv = +b.dataset.l; app.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b)); draw(); });
}
function settings() {
  const t = S.set, c = (k, l) => `<label class="row"><span>${l}</span><input type="checkbox" ${t[k] ? 'checked' : ''} onchange="S.set.${k}=this.checked;save()"></label>`;
  app.innerHTML = `<div class="top"><h2>Settings</h2><button class="x" onclick="home()">✕</button></div><div class="card">
  <label class="row"><span>Questions per session</span><input type="number" min="5" max="60" value="${t.n}" style="width:70px" onchange="S.set.n=Math.max(5,Math.min(60,+this.value||12));save()"></label>
  ${c('hints', 'Allow hints')}${c('exact', 'Spelling must be exact')}${c('mast', 'Include mastered words in reviews')}${c('expert', 'Expert mode (typed recall first)')}</div>
  <div class="card"><b>Mastery levels</b>${LV.map((l, i) => `<div class="row"><b>${l}</b><small>${LVREQ[i]}</small></div>`).join('')}</div>
  <div class="card"><b>Data</b><p class="lbl">Progress autosaves in this browser. Export a backup regularly.</p>
  <button class="big bl" onclick="exp()">⬇ Export progress (JSON)</button><input type="file" id="imp" accept=".json" style="margin:8px 0"><div id="msg"></div>
  <button class="big" onclick="if(confirm('Erase ALL progress?')){S=defS();save();home()}">Reset progress</button></div>`;
  $('#imp').onchange = e => { const f = e.target.files[0]; if (!f) return; f.text().then(x => { try { const j = JSON.parse(x); if (!okS(j)) throw 0; S = Object.assign(defS(), j); save(); home(); } catch (_) { $('#msg').textContent = 'Invalid backup file — nothing was changed.'; } }); };
}
function exp() { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' })); a.download = 'gre-progress-' + new Date().toISOString().slice(0, 10) + '.json'; a.click(); }
document.addEventListener('keydown', e => { if (/^[1-4]$/.test(e.key) && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { const b = app.querySelector(`.opt[data-i="${e.key - 1}"]`); if (b && !b.disabled) b.click(); } });
/* every screen change starts at the top */
new MutationObserver(() => window.scrollTo(0, 0)).observe(app, { childList: true });
home();
