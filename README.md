# WordNest

Open `index.html` in a browser. No server, account, or internet needed (vocabulary is bundled in `data/vocabulary.js`;
`data/vocabulary.json` is the same data). Progress autosaves to LocalStorage (`grevm.v1`, schema version 1), separate from the vocabulary.
Export/import/reset are under **Settings**. Tests: `node test/test.js`.

## Data
333 entries extracted from the Barron's PDF with their original wording in `sourceDefinition`. "Strut" appears twice in the source (two senses), so there are 333 unique IDs but 332 unique spellings.
`example` fields are supplemental (marked `supplemental: true`) and exist for only 12 words so far; context modes fall back to other formats for the rest.

## Hosting on GitHub Pages
Push the project root to a GitHub repo and enable Pages (Settings → Pages → Deploy from branch → main, / (root)). The app is online-only: there is no service worker or offline cache. The only data stored in the browser is your progress (LocalStorage key `grevm.v1`, a few hundred KB at most). Clear it via Settings → Reset, or Chrome → Site settings → your github.io site → Clear & reset.

`pos` (part of speech) is given for all words; `posSrc` says whether it came from the PDF (19 words) or was added by me (`supplemental`). Words can have several (e.g. `v., n.`).
