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
| `public/data/bible.json`     | `data/Elberfelder_1905_*.pdf`, via `pdftotext -layout` into `data/elb1905_*.layout.txt`; numbering from STEPBible TVTMS (CC BY 4.0) | `scripts/parse_bible.py`, `scripts/renumber.py` |
| `public/data/xrefs.json`     | `raw/openbible/cross_references.txt` (CC BY)                              | `scripts/build_xrefs.py`     |
| `public/data/thesaurus.json` | `raw/openthesaurus/openthesaurus.txt` (LGPL 2.1)                          | `scripts/build_thesaurus.ts` |
| `public/data/greek/`         | `vendor/stepbible/` TAGNT, TBESG, TEGMC (STEPBible, CC BY 4.0)            | `scripts/build_greek.py`     |

`bible.json` contains 31,169 verses. Footnotes `{…}` are separated from the text and stored with their
position.

**Modern Versification.** The text is the Elberfelder 1905, but chapters and verses are numbered
as in other modern German Bibles: Hebrew numbering in the OT with psalm titles as
verses, Nestle-Aland numbering in the NT. A printed Elberfelder 1905 therefore differs in places, e.g.
Joel 3,1 here is Joel 2,28 there, Maleachi has 3 chapters instead of 4, and Ps 51,3 is Ps 51,1.

The Elberfelder 1905 mixes traditions (Hebrew in about 20 chapters such as Lev 5 and Mic 4, KJV in
others such as Gen 31/32, Joel and Malachi, psalm titles not counted). `scripts/renumber.py` converts it
once, in place:

1. `scripts/versification.py` reads STEPBible TVTMS (`vendor/stepbible/`), finds for every section which
   tradition the Elberfelder follows (using the section's tests) and maps it onto the Hebrew/Greek column:
   1,872 verses renumbered, 52 joined to a neighbouring verse (short psalm titles go into verse 1;
   Neh 7,68–69; Jes 63,19/64,1; Apg 19,40–41).
2. `scripts/verse_splits.json` holds what TVTMS cannot decide for this text: six verses or titles cut
   into two at the Hebrew verse boundary (1 Chr 12,4–5, Hiob 41,1–2, Ps 51/52/54/60 titles), Ps 13 and Ps 98, the „Lobet den HERRN“ that the Elberfelder sets apart as a title in eight
   psalms, Num 30 and Dtn 29 (where the Elberfelder divides a KJV verse itself), and Lk 17,36.
   Deliberate deviations from Luther 2017: Num 26,1 is not split (Num 25 has 18 verses, not 19).
   Text corrections ("edits"): Ps 53,1 without the editorial remark „Vergleiche Ps. 14, auch bezüglich
   der Anmerkungen“, Ps 60,1 „Miktam“ instead of „Gedicht“.
3. The TVTMS tests are run again on the result; the script writes nothing unless every section then
   matches the Luther column (`reports/versification_after.md`). `scripts/renumber_log.json` lists every
   old Elberfelder reference with its new number.

The text is only cut, joined and renumbered, never reworded. Verses that modern editions mark as
missing but the Elberfelder contains (e.g. Mt 18,11, Apg 8,37) keep their number. Luke 17,36 does not
exist (the Elberfelder never had it); 17,35 is followed by 17,37. Luther 2017 itself could not be
checked here: the mapping is TVTMS's Hebrew/Greek column, which the Loccum guidelines followed by Luther
2017 are based on.

OpenBible uses KJV numbering; `build_xrefs.py` converts it with the same TVTMS data (`kjv_map()`).
`xrefs.json` addresses verses by their position in `bible.json`, so it must be rebuilt after every change
to the verse list; it records the list it was built for, and `npm test` fails if that no longer matches.
343,586 of 344,799 references remain (the rest have negative votes or are lost through merged verses).

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

**Verse alignment.** TAGNT counts by NRSV, which in the NT equals the Luther 2017 numbering of
`bible.json` except for two places (`scripts/verse_map.json`): Apg 19,40 gets the words of TAGNT 19.40
and 19.41, and TAGNT Luk.17.36 (TR only) is shown after Lk 17,35 with a note. `scripts/check_verses.py` runs
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
