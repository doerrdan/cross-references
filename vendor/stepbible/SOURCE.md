# STEPBible-Data (Auszug)

Quelle: <https://github.com/STEPBible/STEPBible-Data>, Commit `5de0a47f35f0fc13dfe1430d104e5db8a4285f9c`
(2026-11-02), heruntergeladen am 2026-11-19.

| Datei | Pfad im Repository | SHA-256 |
| --- | --- | --- |
| `TAGNT Mat-Jhn - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt` | `Translators Amalgamated OT+NT/` | `d4c0c820fdf9f2b450c9f96ce6103d6875028affd2e44094d753f1329ca1fd85` |
| `TAGNT Act-Rev - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt` | `Translators Amalgamated OT+NT/` | `122040eeeaeba50d6abbf67b39cacaff687211bda69b080e5d53927c830d9968` |
| `TBESG - Translators Brief lexicon of Extended Strongs for Greek - STEPBible.org CC BY.txt` | `Lexicons/` | `734a5b64a1152f67604bf09d32f15c0ba537151961752fcf168087b41b4d93ea` |
| `TEGMC - Translators Expansion of Greek Morphhology Codes - STEPBible.org CC BY.txt` | `Morphology codes/` | `9e8443fd4759f112253d7a1858c0687a8cf833f4d537e8fda97bfff74ea4c168` |
| `README-STEPBible.md` | `README.md` | `261d5157c0ffeadeedad3f734db945a4c3642e3e4ce5fa28002985b6c52437b1` |

## Lizenz

CC BY 4.0, laut `README-STEPBible.md` (Abschnitt „This licence allows…“) und den Kopfzeilen von TAGNT,
TBESG und TEGMC. Der Commit enthält keine eigene Lizenzdatei; die Angaben stehen nur dort.

- README: „Credit it to "STEP Bible" linked to www.STEPBible.org“.
- TAGNT-Kopf: Namensnennung „Tyndale House and STEPBible.org“ mit Link auf
  <https://STEPBible.github.io/STEPBible-Data>; Änderungen sollen vermerkt werden; die Bitte, keine
  Kopien der Datei an anderer Stelle zu veröffentlichen.

Wegen dieser Bitte sind die Rohdateien git-ignoriert (`vendor/stepbible/*.txt`, `*.md` außer dieser
Datei). Sie werden mit den Befehlen unten wiederhergestellt.

## Wiederherstellen

```sh
SHA=5de0a47f35f0fc13dfe1430d104e5db8a4285f9c
B="https://raw.githubusercontent.com/STEPBible/STEPBible-Data/$SHA"
cd vendor/stepbible
curl -fLo "TAGNT Mat-Jhn - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt" "$B/Translators%20Amalgamated%20OT%2BNT/TAGNT%20Mat-Jhn%20-%20Translators%20Amalgamated%20Greek%20NT%20-%20STEPBible.org%20CC-BY.txt"
curl -fLo "TAGNT Act-Rev - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt" "$B/Translators%20Amalgamated%20OT%2BNT/TAGNT%20Act-Rev%20-%20Translators%20Amalgamated%20Greek%20NT%20-%20STEPBible.org%20CC-BY.txt"
curl -fLo "TBESG - Translators Brief lexicon of Extended Strongs for Greek - STEPBible.org CC BY.txt" "$B/Lexicons/TBESG%20-%20Translators%20Brief%20lexicon%20of%20Extended%20Strongs%20for%20Greek%20-%20STEPBible.org%20CC%20BY.txt"
curl -fLo "TEGMC - Translators Expansion of Greek Morphhology Codes - STEPBible.org CC BY.txt" "$B/Morphology%20codes/TEGMC%20-%20Translators%20Expansion%20of%20Greek%20Morphhology%20Codes%20-%20STEPBible.org%20CC%20BY.txt"
curl -fLo README-STEPBible.md "$B/README.md"
shasum -a 256 *.txt *.md   # mit der Tabelle oben vergleichen
```

Die Rohdateien werden nicht verändert, nur gelesen.

## Änderungen in `public/data/greek/` gegenüber der Quelle

`scripts/build_greek.py` formt die Daten um. Inhaltlich geändert wird dabei Folgendes:

1. Übernommen werden nur Wörter, die in NA28 oder im TR (Scrivener 1894) stehen. 333 Wörter, die nur
   in anderen Ausgaben vorkommen (Byz, SBL, WH, Treg, Tyn), entfallen.
2. „NA“ bedeutet NA28. Die 130 Wörter, in denen NA27 und NA28 sich unterscheiden, werden nicht eigens
   gezeigt.
3. Die Umschrift in Klammern und das Absatzzeichen „¶“ werden aus dem griechischen Wort entfernt; „¶“
   wird als Absatzmarke (`par`) gespeichert.
4. Buchstaben mit kombinierendem Iota subscriptum (U+0345) werden in ihre vorkomponierte Form
   umgesetzt, weil die Schrift Literata U+0345 nicht enthält. Sonst bleibt die Normalisierung der
   Quelle erhalten (Oxia, Ano Teleia, griechisches Fragezeichen).
5. Die Wortfolge des TR wird aus den Verschiebungsmarkern (`TR»N`, `TR«N`) als eigene Reihenfolge
   berechnet; Verschiebungen in einen anderen Vers (z. B. `Byz«14.24`) werden nicht abgebildet.
6. Morphologie-Codes werden über TEGMC und `scripts/morph_de.json` ins Deutsche übersetzt; Lemma und
   Grundbedeutung kommen aus TBESG (für G3700G und G3700H, die dort fehlen, aus der TAGNT-Spalte
   „Dictionary form“).
8. Die englischen Kurzbedeutungen aus TBESG (5.579 Strong-Nummern) sind ins Deutsche übersetzt
   (`scripts/lexicon_de/*.tsv`, Feld `d` in `lexicon.json`). Die Übersetzung ist maschinell
   (Claude, 2026-11-19), erstellt mit dem griechischen Lemma und den häufigsten TAGNT-Kontextglossen
   des Wortes; sie ist nicht von Fachleuten geprüft. Eigennamen folgen der Schreibweise der
   Elberfelder 1905. Wo TBESG offensichtlich fehlerhaft ist (G1212 δῆλος „Urim“), steht die
   übliche Bedeutung („offenbar, deutlich“). Die englische Fassung bleibt im Feld `e` erhalten;
   die englische Kontextglosse (`gl`) wird unverändert angezeigt.
9. Versnummern folgen der Elberfelder 1905: Lk 17,36 (Elb) erhält TAGNT Luk.17.37; TAGNT Luk.17.36
   (nur TR) wird nach Lk 17,35 mit Hinweis gezeigt (`scripts/verse_map.json`).
