/* Pure logic: answer evaluation, mastery, weakness, scheduling. No DOM. Testable in Node. */
(function (g) {
  const DAY = 864e5, MIN = 6e4;
  const STOP = new Set('the a an of to and or in on for with that this which is are be by as from it its one who whom into than not out'.split(' '));
  const stem = w => w.replace(/(ing|ed|es|ly|s)$/, '');
  function lev(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  const toks = s => [...new Set((String(s).toLowerCase().match(/[a-z]+/g) || []).filter(w => w.length > 2 && !STOP.has(w)).map(stem))];
  /* Free-text meaning check. Returns 'correct' | 'wrong' | 'unsure' (unsure => ask the learner to self-rate). */
  function evalMeaning(ans, def) {
    const k = toks(def), a = toks(ans);
    if (!a.length || !k.length) return 'wrong';
    let m = 0;
    k.forEach(x => { if (a.some(y => y === x || (x.length > 4 && lev(x, y) <= 1))) m++; });
    if (m / k.length >= .34 || m >= 2) return 'correct';
    return (m > 0 || a.length >= 3) ? 'unsure' : 'wrong';
  }
  const blank = () => ({ n: 0, ok: 0, bad: 0, uOk: 0, days: [], modes: {}, mAcc: {}, consec: 0, cbad: 0, spell: 0, hint: 0, guess: 0, ms: 0, t: 0, iv: 10 * MIN, due: 0, pairs: {} });
  /* o: {mode, ok, unaided, hinted, ms, spell, pair, conf, now} */
  function update(r, o) {
    const now = o.now || Date.now();
    r.n++; r.t = now;
    const m = r.mAcc[o.mode] || (r.mAcc[o.mode] = [0, 0]); m[1]++;
    if (o.ok) {
      r.ok++; r.consec++; r.cbad = 0; m[0]++;
      if (o.unaided) { r.uOk++; r.modes[o.mode] = 1; const d = new Date(now).toDateString(); if (!r.days.includes(d)) r.days.push(d); }
    } else { r.bad++; r.cbad++; r.consec = 0; if (o.pair) r.pairs[o.pair] = (r.pairs[o.pair] || 0) + 1; }
    if (o.spell) r.spell++;
    if (o.hinted) r.hint++;
    if (o.conf === 'guess') r.guess++;
    r.ms = r.n > 1 ? (r.ms * (r.n - 1) + (o.ms || 0)) / r.n : (o.ms || 0);
    /* Adaptive interval: unaided success x2.2, aided success x1.3, failure shrinks to 30% (min 5 min). */
    r.iv = o.ok ? Math.min(60 * DAY, r.iv * (o.unaided ? 2.2 : 1.3)) : Math.max(5 * MIN, r.iv * .3);
    r.due = now + r.iv;
    return r;
  }
  /* Mastery levels (see LEVELS in app for UI text). Lapses (consecutive misses) demote. */
  function level(r) {
    if (!r || !r.n) return 0;
    const dm = Object.keys(r.modes).length, d = r.days.length;
    let l = 1;
    if (r.ok >= 2) l = 2;
    if (r.uOk >= 2 && dm >= 2) l = 3;
    if (r.uOk >= 3 && dm >= 2 && d >= 2 && r.spell <= 2) l = 4;
    if (r.uOk >= 5 && dm >= 3 && d >= 3 && r.iv >= 7 * DAY) l = 5;
    if (r.cbad >= 3) return 1;
    if (r.cbad >= 2) l = Math.max(1, l - 1);
    return l;
  }
  /* Weakness score. Weights: unaided recall misses x3, contextual misses x2.5, confusion-pair misses x2,
     spelling errors x1.5, other-mode misses x1, +2 forgotten after >3 days overdue, +1 slow (>15s avg),
     +2 per consecutive miss, minus 0.8 per unaided success (max -4). Returns {s, why}. */
  function weakness(r, now) {
    now = now || Date.now();
    if (!r || !r.n) return { s: 0, why: '' };
    const f = m => { const x = r.mAcc[m] || [0, 0]; return x[1] - x[0]; };
    const parts = [
      [3 * (f('recall') + f('rev')), 'misses in unaided recall'],
      [2.5 * (f('cloze') + f('sent') + f('fix')), 'misuse in context'],
      [2 * Object.values(r.pairs).reduce((a, b) => a + b, 0), 'confused with a similar word'],
      [1.5 * r.spell, 'spelling errors'],
      [f('syn') + f('conf') + f('spell'), 'misses in recognition tests'],
      [r.now_forgot || 0, ''], [now - r.due > 3 * DAY && r.bad ? 2 : 0, 'forgotten after a long gap'],
      [r.ms > 15000 ? 1 : 0, 'slow responses'], [2 * r.cbad, 'repeated recent mistakes']
    ];
    let s = parts.reduce((a, p) => a + p[0], 0) - Math.min(4, r.uOk * .8);
    const top = parts.sort((a, b) => b[0] - a[0])[0];
    return { s: Math.max(0, s), why: top[0] > 0 ? top[1] : '' };
  }
  function validate(vocab) {
    const errs = [], ids = new Set(), words = {};
    vocab.forEach((w, i) => {
      if (ids.has(w.id)) errs.push('duplicate id ' + w.id); ids.add(w.id);
      if (w.id !== i + 1) errs.push('id/position mismatch at ' + (i + 1));
      if (!w.sourceDefinition || !w.sourceDefinition.trim()) errs.push('empty definition: ' + w.word);
      words[w.word] = (words[w.word] || 0) + 1;
    });
    if (vocab.length !== 333) errs.push('expected 333 entries, found ' + vocab.length);
    return { errs, entries: vocab.length, uniqueWords: Object.keys(words).length, repeated: Object.keys(words).filter(k => words[k] > 1) };
  }
  const api = { lev, toks, evalMeaning, blank, update, level, weakness, validate, DAY, MIN };
  if (typeof module !== 'undefined') module.exports = api; else g.GRE = api;
})(typeof window !== 'undefined' ? window : globalThis);
