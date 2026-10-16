// Regenerates vocabulary.js from vocabulary.json and sanity-checks the data.
// Works from the project root OR from inside the data/ folder:   node build-data.js
// (vocabulary.js is what the app loads, so run this after every edit to vocabulary.json)
const fs = require('fs'), path = require('path');

const dir = [__dirname, path.join(__dirname, 'data')].find(d => fs.existsSync(path.join(d, 'vocabulary.json')));
if (!dir) { console.error('vocabulary.json not found next to this script or in ./data'); process.exit(1); }

let data;
try { data = JSON.parse(fs.readFileSync(path.join(dir, 'vocabulary.json'), 'utf8')); }
catch (e) { console.error('vocabulary.json is not valid JSON: ' + e.message); process.exit(1); }
if (!Array.isArray(data)) { console.error('vocabulary.json must contain a list of entries'); process.exit(1); }

const errors = [], warnings = [], count = {};
if (data.length !== 333) warnings.push(`expected 333 entries, found ${data.length}`);
data.forEach((w, i) => {
  const name = w.word || `entry ${i + 1}`;
  if (w.id !== i + 1) errors.push(`${name}: id should be ${i + 1} but is ${w.id}`);
  if (!w.word || !w.word.trim()) errors.push(`entry ${i + 1}: missing word`);
  if (!w.sourceDefinition || !w.sourceDefinition.trim()) errors.push(`${name}: empty sourceDefinition`);
  if (!w.pos) warnings.push(`${name}: no part of speech (pos)`);
  if (w.example && w.word) {
    const stem = w.word.toLowerCase().slice(0, Math.max(4, w.word.length - 3));
    if (!w.example.toLowerCase().includes(stem)) warnings.push(`${name}: example does not contain the word, so the cloze question cannot blank it`);
  }
  count[w.word] = (count[w.word] || 0) + 1;
});
const repeated = Object.keys(count).filter(k => count[k] > 1);
if (repeated.length) warnings.push(`repeated spellings (fine if they are separate senses): ${repeated.join(', ')}`);

warnings.forEach(m => console.warn('Warning: ' + m));
if (errors.length) { errors.forEach(m => console.error('Error: ' + m)); console.error('vocabulary.js NOT written.'); process.exit(1); }

fs.writeFileSync(path.join(dir, 'vocabulary.js'),
  '/* Generated from vocabulary.json (bundled so the app works from file://) */\n' +
  'window.VOCAB=' + JSON.stringify(data) + ';\n');
console.log(`Wrote ${path.join(dir, 'vocabulary.js')} with ${data.length} entries (${data.filter(w => w.example).length} with examples).`);
