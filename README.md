# Elberfelder Cross-References

A static website: the text of the Elberfelder translation with the cross-references from
[OpenBible.info](https://www.openbible.info/labs/cross-references/) and a search that understands
Bible references and freely worded questions. No server, no language model, no external API.

## Commands

```
npm install
npm run dev       # development server
npm run build     # type check + static build into dist/
npm test          # stemmer and reference parser
npm run data      # regenerate the data (Python 3, Node ≥ 23)
```

`dist/` can be copied to any web host; `base: "./"` also allows subdirectories.

## Data

| File                         | Source                                                                    | Script                       |
| ---------------------------- | ------------------------------------------------------------------------- | ---------------------------- |
| `public/data/bible.json`     | `data/Elberfelder_1905_*.pdf`, via `pdftotext -layout` into `data/elb1905_*.layout.txt` | `scripts/parse_bible.py`     |
| `public/data/xrefs.json`     | `raw/openbible/cross_references.txt` (CC BY)                              | `scripts/build_xrefs.py`     |
| `public/data/thesaurus.json` | `raw/openthesaurus/openthesaurus.txt` (LGPL 2.1)                          | `scripts/build_thesaurus.ts` |

`bible.json` contains 31,105 verses. Footnotes `{…}` are separated from the text and stored with their
position; psalm superscriptions are in the field `h`.

**Versification.** OpenBible uses the King James Version numbering; the Elberfelder follows the Hebrew
numbering in about 20 chapters (e.g. Mi 5,1 = KJV Mic 5:2; 3. Mose 5,20–26 = KJV Lev 6:1–7; Joel and
Malachi, by contrast, follow the KJV). `kjv_to_elb()` in `build_xrefs.py` converts between them. Verses
that are combined in one numbering and split in the other are mapped to the nearest corresponding verse.
Luke 17:36 (KJV) does not exist in the Elberfelder and is dropped. The mapping has been checked against
the chapter lengths; after conversion, 343,586 of 344,799 references remain (the rest have negative
votes or are lost through merged verses).

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
