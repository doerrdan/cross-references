/**
 * Hand-curated bridge between today's German and the vocabulary of the Elberfelder.
 * Keys and values are plain words; they are stemmed at runtime. A query word that matches a key
 * is also searched as each listed word (weight VOCAB_WEIGHT in search.ts).
 */
export const VOCAB: Record<string, string[]> = {
  // God, persons, spirits
  herr: ["jehova", "herr"], jahwe: ["jehova"], jhwh: ["jehova"], gottes: ["gott"],
  messias: ["christus", "gesalbter", "messias"], heiland: ["heiland", "retter", "erretter"],
  erlöser: ["erlöser", "löser", "erlösen"], teufel: ["teufel", "satan", "widersacher"],
  satan: ["satan", "teufel"], dämon: ["dämon", "teufel", "unreiner geist"], engel: ["engel", "boten"],
  // church and practice (Elb renders ekklesia as "Versammlung")
  kirche: ["versammlung"], gemeinde: ["versammlung"], gemeinschaft: ["gemeinschaft", "versammlung"],
  gottesdienst: ["dienst", "anbetung", "versammlung"], taufe: ["taufe", "taufen"],
  abendmahl: ["brot brechen", "tisch des herrn", "kelch"], ostern: ["passah"], pfingsten: ["pfingsten"],
  gebet: ["beten", "gebet", "flehen", "anrufen"], beten: ["beten", "flehen", "anrufen"],
  lobpreis: ["loben", "preisen", "lobsingen", "rühmen"], anbetung: ["anbeten", "huldigen", "niederwerfen"],
  dank: ["danken", "danksagung", "dank"], fasten: ["fasten"], opfer: ["opfer", "opfern", "darbringen"],
  // salvation
  vergebung: ["vergeben", "vergebung", "erlassen", "sühnen", "bedecken"], vergeben: ["vergeben", "erlassen"],
  erlösung: ["erlösung", "erlösen", "loskaufen", "lösegeld"], rettung: ["rettung", "retten", "erretten", "heil"],
  sünde: ["sünde", "missetat", "übertretung", "ungerechtigkeit", "frevel"], schuld: ["schuld", "missetat", "verschuldung"],
  gnade: ["gnade", "gunst", "huld"], barmherzigkeit: ["barmherzigkeit", "erbarmen", "barmherzig"],
  gerechtigkeit: ["gerechtigkeit", "gerecht", "rechtfertigen"], rechtfertigung: ["rechtfertigen", "gerechtigkeit"],
  glaube: ["glauben", "glaube", "vertrauen"], vertrauen: ["vertrauen", "trauen", "zuversicht", "harren"],
  hoffnung: ["hoffnung", "hoffen", "harren"], zweifel: ["zweifeln", "zweifel", "ungläubig"],
  umkehr: ["buße", "umkehren", "bekehren"], buße: ["buße", "umkehren"], bekehrung: ["bekehren", "umkehren", "buße"],
  auferstehung: ["auferstehung", "auferstehen", "auferwecken"], ewig: ["ewig", "ewiglich", "immerdar"],
  himmel: ["himmel", "himmlisch"], hölle: ["hölle", "hades", "scheol", "feuersee", "gehenna"],
  gericht: ["gericht", "richten", "vergelten"], wiederkunft: ["ankunft", "wiederkommen", "erscheinung"],
  endzeit: ["letzte tage", "ende", "zukunft"], segen: ["segen", "segnen"], fluch: ["fluch", "verfluchen"],
  bund: ["bund"], gesetz: ["gesetz", "gebot", "satzung", "rechte"], gebote: ["gebot", "satzung", "gesetz"],
  // emotions and life
  angst: ["furcht", "fürchten", "bange", "schrecken", "zagen"], furcht: ["furcht", "fürchten"],
  sorge: ["sorge", "sorgen", "kummer"], trauer: ["trauer", "trauern", "klage", "weinen", "betrübt"],
  traurig: ["betrübt", "traurig", "trauern"], depression: ["betrübt", "niedergebeugt", "verzagt", "seele"],
  einsamkeit: ["allein", "verlassen", "einsam"], einsam: ["einsam", "allein", "verlassen"],
  trost: ["trost", "trösten", "tröster"], freude: ["freude", "freuen", "frohlocken", "jubel"],
  frieden: ["friede", "frieden"], liebe: ["liebe", "lieben"], hass: ["hassen", "haß", "feind"],
  zorn: ["zorn", "grimm", "wut", "zürnen"], wut: ["zorn", "grimm"], neid: ["neid", "eifersucht", "beneiden"],
  stolz: ["hochmut", "hoffart", "stolz", "übermut"], hochmut: ["hochmut", "hoffart", "übermut"],
  demut: ["demut", "demütig", "niedrig", "erniedrigen"], geduld: ["geduld", "ausharren", "langmut"],
  lüge: ["lüge", "lügen", "falsch", "trug"], ehrlichkeit: ["wahrheit", "aufrichtig", "redlich"],
  dankbarkeit: ["danken", "dank", "danksagung"], vergeltung: ["rache", "vergelten", "rächen"],
  rache: ["rache", "rächen", "vergelten"], versuchung: ["versuchung", "versuchen", "prüfung"],
  leid: ["leiden", "trübsal", "drangsal", "bedrängnis"], leiden: ["leiden", "trübsal", "drangsal"],
  krankheit: ["krank", "krankheit", "gebrechen", "schwach", "seuche"], heilung: ["heilen", "gesund", "genesen"],
  tod: ["tod", "sterben", "entschlafen"], sterben: ["sterben", "tod", "entschlafen"],
  // people and family
  frau: ["weib", "frau"], ehefrau: ["weib"], mann: ["mann"], ehe: ["weib", "heiraten", "freien", "ehe"],
  heirat: ["heiraten", "freien", "weib nehmen"], hochzeit: ["hochzeit"], scheidung: ["entlassen", "scheidebrief"],
  ehebruch: ["ehebrechen", "ehebruch", "hurerei"], sex: ["erkennen", "beiwohnen", "liegen"],
  unzucht: ["hurerei", "unzucht"], kind: ["kind", "knabe", "kindlein"], kinder: ["kinder", "söhne", "kindlein"],
  eltern: ["vater", "mutter", "eltern"], jugend: ["jugend", "jüngling", "jung"], alter: ["greis", "alter", "alt"],
  freund: ["freund", "genosse", "nächster"], nachbar: ["nächster"], nächstenliebe: ["nächster", "lieben"],
  feinde: ["feind", "hasser", "widersacher"], fremde: ["fremdling", "fremd"], flüchtling: ["fremdling", "beisasse"],
  arme: ["arm", "elend", "dürftig"], armut: ["arm", "armut", "dürftig"], witwe: ["witwe"], waise: ["waise"],
  // work and goods
  geld: ["geld", "silber", "mammon"], reichtum: ["reichtum", "reich", "schätze"], arbeit: ["arbeit", "arbeiten", "mühe", "werk"],
  faulheit: ["faul", "träge", "faulheit"], essen: ["essen", "speise"], trinken: ["trinken", "trank"],
  alkohol: ["wein", "starkes getränk", "trunkenheit"], betrunken: ["trunken", "trunkenheit", "berauschen"],
  krieg: ["krieg", "streit", "schlacht", "kampf"], gewalt: ["gewalttat", "gewalt"], mord: ["mord", "töten", "totschlagen"],
  regierung: ["obrigkeit", "könig", "gewalt"], staat: ["obrigkeit"], steuern: ["steuer", "zoll", "zins"],
  schöpfung: ["schaffen", "schöpfer", "schöpfung"], natur: ["schöpfung", "erde", "himmel"],
  weisheit: ["weisheit", "weise", "verstand", "einsicht"], wissen: ["erkenntnis", "wissen", "erkennen"],
  wahrheit: ["wahrheit", "wahrhaftig", "treue"], treue: ["treue", "treu", "zuverlässig"],
  dass: ["daß"], tür: ["tür", "pforte", "tor"], strafe: ["strafe", "züchtigen", "züchtigung"],
  erziehung: ["züchtigung", "zucht", "unterweisen"], schlaf: ["schlafen", "schlaf", "ruhe"], ruhe: ["ruhe", "sabbath", "rasten"],
  sonntag: ["erster tag der woche"], sabbat: ["sabbath"], prophezeiung: ["weissagung", "weissagen", "prophet"],
  wunder: ["wunder", "zeichen", "machttat"], heiligkeit: ["heilig", "heiligkeit", "heiligen"],
};

/** Words removed from free-text questions before searching. */
export const STOPWORDS = new Set(
  `a ab aber alle allem allen aller alles als also am an ander andere anderen auch auf aus bei beim
   bibel bibelstelle bibelstellen bibelvers bibelverse bin bis bist bitte da dabei damit dann das dass dein deine
   dem den denn der des dessen die dies diese diesem diesen dieser dieses doch dort du durch ein eine einem einen
   einer eines er es etwas euch euer für gegen geht gibt gibts gilt hab habe haben hat hatte ich ihm ihn ihnen ihr
   ihre im in ist ja jemand kann kannst kein keine man mehr mein meine mich mir mit muss nach nicht noch nun nur
   ob oder ohne passage schreibt sagt sagen sein seine sich sie sind so soll sollen spricht sprechen stehen steht
   stelle stellen text thema über um und uns unser unter vers verse viel vom von vor war warum was weil welche
   welchem welchen welcher welches wenn wer werden wie wieso wird wo woher wohin wurde zu zum zur zwischen
   erzählt erzählen geschrieben handelt redet reden lehrt erwähnt finde finden suche suchen zeig zeige`
    .split(/\s+/)
    .filter(Boolean),
);
