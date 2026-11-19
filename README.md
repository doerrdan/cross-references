# Elberfelder Cross-References

A static website: the text of the Elberfelder translation with the cross-references from
[OpenBible.info](https://www.openbible.info/labs/cross-references/) and a search that understands
Bible references and freely worded questions. No server, no language model, no external API.

## Commands

```
npm install
npm run dev       # development server
npm run build     # type check + static build into dist/
npm test          # stemmer, reference parser and password check
npm run worker    # build + run the Worker locally with password check
npm run deploy    # build + deploy to Cloudflare
npm run data      # regenerate the data (Python 3, Node ≥ 23)
```

`dist/` can be copied to any web host; `base: "./"` also allows subdirectories.

## Deployment and password protection (Cloudflare Workers)

`wrangler.jsonc` deploys the site as a Worker with static assets. `worker/index.ts` runs before every
request (`run_worker_first`) and requires HTTP Basic Auth, including for the JSON data.

1. Cloudflare build settings: build command `npm run build`, deploy command `npx wrangler deploy`.
2. In the Worker: **Settings → Variables and Secrets**, add `BASIC_AUTH_USER` and
   `BASIC_AUTH_PASSWORD` as type *Secret* (or `npx wrangler secret put BASIC_AUTH_PASSWORD`).
3. Without both secrets the Worker answers 500 instead of serving the site unprotected.
4. Local test: copy `.dev.vars.example` to `.dev.vars` (git-ignored), then `npm run worker`.

Other static hosts ignore `worker/` and serve `dist/` without a password.

## Data

| File                         | Source                                                                    | Script                       |
| ---------------------------- | ------------------------------------------------------------------------- | ---------------------------- |
| `public/data/bible.json`     | `data/Elberfelder_1905_*.pdf`, via `pdftotext -layout` into `data/elb1905_*.layout.txt` | `scripts/parse_bible.py`     |
| `public/data/xrefs.json`     | `raw/openbible/cross_references.txt` (CC BY)                              | `scripts/build_xrefs.py`     |
| `public/data/thesaurus.json` | `raw/openthesaurus/openthesaurus.txt` (LGPL 2.1)                          | `scripts/build_thesaurus.ts` |
| `public/data/greek/`         | `vendor/stepbible/` TAGNT, TBESG, TEGMC (STEPBible, CC BY 4.0)            | `scripts/build_greek.py`     |

`bible.json` contains 31,105 verses. Footnotes `{…}` are separated from the text and stored with their
position; psalm superscriptions are in the field `h`.

**Versification.** OpenBible uses the King James Version numbering; the Elberfelder follows the Hebrew
numbering in about 20 chapters (e.g. Mi 5,1 = KJV Mic 5:2; 3. Mose 5,20–26 = KJV Lev 6:1–7; Joel and
Malachi, by contrast, follow the KJV). `kjv_to_elb()` in `build_xrefs.py` converts between them. Verses
that are combined in one numbering and split in the other are mapped to the nearest corresponding verse.
Luke 17:36 (KJV) does not exist in the Elberfelder and is dropped. The mapping has been checked against
the chapter lengths; after conversion, 343,586 of 344,799 references remain (the rest have negative
votes or are lost through merged verses).

## Greek New Testament

Selecting an NT verse shows the Greek text below the Elberfelder text, as NA28, as TR (Scrivener 1894),
or both with the words of only one edition marked. Each word opens a popover with lemma, Strong number,
German morphology, German lexicon meaning and the English context gloss. STEPBible has no German
meanings: the 5,579 TBESG glosses were machine-translated (`scripts/lexicon_de/`), using the Greek lemma
and the word's context glosses; the popover says so. The translation has not been reviewed by a scholar. Search hits in the NT have a
„Griechisch“ button. The search itself does not use the Greek.

```
npm run greek     # uv run scripts/build_greek.py, then the Python tests
```

The raw files are git-ignored: the TAGNT licence asks not to post copies elsewhere.
`vendor/stepbible/SOURCE.md` records the commit, the checksums, how to download the files again, and
every change made to the data. `scripts/inspect_tagnt.py` prints the file structure.

**Format (from the inspection).** One tab-separated line per word: reference with word number and word
type (`Mat.2.3#05=NKO`), Greek with transliteration, English gloss, `dStrong=morphology`
(joined words such as κἀγώ carry two pairs), `lemma=gloss`, editions
(`NA28+NA27+Tyn+SBL+WH+Treg+TR+Byz`), then variants and further fields. Every word of every major
edition appears once; the edition list says where it occurs. `TR«3` / `TR»1` mean that in the TR the
word stands directly after word number (own number − 3) or (own number + 1); the build script turns this
into a separate TR word order (927 verses). Meaning variants are separate words with their own editions.

**Verse alignment.** TAGNT counts by NRSV, and the Elberfelder 1905 follows the same numbering in the NT:
7,957 of 7,958 verses match. The exception is Luke 17: Elberfelder 17,36 is TAGNT 17.37, and TAGNT 17.36
(TR only) is shown after 17,35 with a note (`scripts/verse_map.json`). `scripts/check_verses.py` runs
before every build, writes `reports/verse_mismatch.md` and stops the build on a new difference.

**Size.** 10.2 MB for 260 chapter files (largest: Matthew 26, 89 kB), lexicon 274 kB, morphology 88 kB.
A chapter file is loaded only when one of its verses is opened.

**Decisions.** „NA“ is NA28; the 130 words where NA27 and NA28 differ are not shown separately. The
source keeps its Unicode normalisation (oxia rather than tonos), except that U+0345 is composed because
Literata lacks it.

## Search

The input is first parsed as a Bible reference (`Joh 3,16`, `1. Mose 1:1-3`, `Röm 3,23; 6,23`,
`Ps 23`). Otherwise the question search runs (`src/search.ts`):

1. **Analysis.** Question words and filler words are removed. Scope phrases are recognized and applied
   as filters: „im AT/NT“ (in the OT/NT), „Evangelien“ (Gospels), „bei Paulus“ (Pauline epistles),
   „in den Psalmen“, „Propheten“ (Prophets), „in Jesaja“ (a single book). „Was sagt Jesus …“
   (“What does Jesus say …”) favours the Gospels. Text in quotation marks must occur verbatim.
2. **Expansion** of each search word, with decreasing weight: the word's own stem (Snowball; umlauts
   and ß are folded, so daß = dass) 1.0; curated vocabulary (`src/vocab.ts`, e.g.
   Gemeinde → Versammlung, Frau → Weib, Angst → Furcht) 0.85; typo correction 0.7; related forms
   (sorgen → besorgt, Morgen → morgenden) and parts of compound words 0.6; synonyms from
   OpenThesaurus 0.4.
3. **Ranking.** BM25 per variant; each search word counts with its best variant. The sum is weighted by
   the square of the share of search words a verse covers. Bonuses: search words in input order and
   close together (×1.3), a verbatim match of the whole input, and up to +25 % for verses with many
   cross-reference votes.
4. **Reference network.** The 40 best hits pass weight along their cross-references (weighted by
   votes). Verses referenced by several hits rise; verses without the search words appear under
   „Verwandte Stellen“ (related passages).

The results page shows which terms and variants were searched for.

## Limitations

- The search does not understand sentence meaning. It finds verses through words, word forms, synonyms
  and the reference network. It performs poorly on questions whose answers share no words with them.
- OpenThesaurus is a general-purpose dictionary and ambiguous („vergeben“ also in the sense of
  „verheiratet“, i.e. “forgive” vs. “taken/married”); hence its low weight. `src/vocab.ts` offers the
  greatest leverage.
- The PDF source contains occasional errors; `parse_bible.py` reports six unterminated footnotes.
