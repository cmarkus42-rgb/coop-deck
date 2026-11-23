/**
 * Texte der Typseiten unter `typen/`. Alle Schlüssel beginnen mit `typ.`. Der Server liefert
 * sie in der gewählten Sprache als `/lib/texte.js` aus; die Seiten lesen sie mit `coop.t(…)`.
 *
 * Statuswerte sind Kennungen und bleiben in den Datendateien deutsch. Übersetzt wird nur ihre
 * Anzeige: `typ.status.<wert>` ist der Anzeigename (Auswahlfelder, Filter), `typ.statuswert.<wert>`
 * und `typ.sitzung.<zustand>` stehen im Fließtext; dort zeigt Deutsch den Wert selbst.
 */
export const de = {
  // --- Gemeinsames
  'typ.allg.speichernFehl': 'Speichern fehlgeschlagen.',
  'typ.allg.datenFehler': 'Die Daten dieses Artefakts haben Fehler:',
  'typ.allg.keinJson': 'Kein gültiges JSON: {grund}',
  'typ.allg.sitzungStarten': 'Session starten',
  'typ.allg.vorschlag': 'Vorschlag: ',
  'typ.allg.nutzer': 'Nutzer',

  // --- Anzeigenamen der Statuswerte (Roadmap, Review, Verlauf)
  'typ.status.offen': 'Offen',
  'typ.status.in-arbeit': 'In Arbeit',
  'typ.status.pruefen': 'Prüfen',
  'typ.status.erledigt': 'Erledigt',
  'typ.status.verworfen': 'Verworfen',
  'typ.status.behoben': 'Behoben',
  'typ.status.abgelehnt': 'Abgelehnt',
  'typ.status.zugestellt': 'Bei der Session',

  // --- Statuswerte der Roadmap im Fließtext
  'typ.statuswert.offen': 'offen',
  'typ.statuswert.in-arbeit': 'in-arbeit',
  'typ.statuswert.pruefen': 'pruefen',
  'typ.statuswert.erledigt': 'erledigt',
  'typ.statuswert.verworfen': 'verworfen',

  // --- Zustände einer Session im Fließtext
  'typ.sitzung.arbeitet': 'arbeitet',
  'typ.sitzung.wartet': 'wartet',
  'typ.sitzung.ruhig': 'ruhig',
  'typ.sitzung.beendet': 'beendet',

  // --- Schwere eines Befunds
  'typ.schwere.kritisch': 'Kritisch',
  'typ.schwere.hoch': 'Hoch',
  'typ.schwere.mittel': 'Mittel',
  'typ.schwere.niedrig': 'Niedrig',

  // --- Dokument und Projektblatt
  'typ.dokument.titel': 'Dokument',
  'typ.dokument.tabelle': 'Tabelle: {kopf}',
  'typ.dokument.leer': 'Die Datei ist leer.',

  // --- Fragebogen
  'typ.fragebogen.titel': 'Fragebogen',
  'typ.fragebogen.antwort': 'Deine Antwort',
  'typ.fragebogen.marke': 'Frage {id}: {frage}',
  'typ.fragebogen.uebernehmen': 'Übernehmen',
  'typ.fragebogen.leer': 'Noch keine Fragen. Der Agent trägt sie in die Datendatei ein.',
  'typ.fragebogen.beantwortet': '{n} von {von} beantwortet',
  'typ.fragebogen.senden': 'Antworten an die Session senden',

  // --- Review
  'typ.review.titel': 'Review',
  'typ.review.offen': '{n} von {von} offen',
  'typ.review.nurOffene': 'Nur offene zeigen',
  'typ.review.alle': 'Alle zeigen',
  'typ.review.marke': 'Befund {id}: {titel}',
  'typ.review.startenTitel': 'Startet eine Session mit diesem Befund als Auftrag',
  'typ.review.leer': 'Noch keine Befunde. Der Agent trägt sie in die Datendatei ein.',

  // --- Roadmap
  'typ.roadmap.balken': '{n} von {von} erledigt',
  'typ.roadmap.wartetAuf': 'wartet auf {liste}',
  'typ.roadmap.sitzung': 'Session „{titel}“: {zustand}',
  'typ.roadmap.startenTitel': 'Startet eine Session, die diesen Punkt und seinen Zusammenhang kennt',
  'typ.roadmap.schlaegtVor': '{von} schlägt vor: {status}',
  'typ.roadmap.bestaetigen': 'Bestätigen',
  'typ.roadmap.nochNicht': 'Noch nicht',
  'typ.roadmap.notiz': 'Notiz ergänzen und mit Eingabe speichern',
  'typ.roadmap.beschreibung': 'Beschreibung',
  'typ.roadmap.abnahme': 'Abnahmekriterien, eines je Zeile',
  'typ.roadmap.haengtAb': 'Hängt ab von: {liste}',
  'typ.roadmap.dateien': 'Dateien: {liste}',
  'typ.roadmap.neuerPunkt': 'Neuer Punkt: Titel und Eingabe',
  'typ.roadmap.titelMarke': 'Titel der Roadmap',
  'typ.roadmap.punkteErledigt': '{n} von {von} Punkten erledigt',
  'typ.roadmap.ungemeldet': 'Noch nicht an die Session gemeldet',
  'typ.roadmap.sendenAn': 'An „{liste}“ senden',
  'typ.roadmap.sendenTrenner': '“, „',
  'typ.roadmap.sendenAnTitel': 'Geht an die Sessions, die an diesen Punkten arbeiten',
  'typ.roadmap.sendenVorn': 'An die Session vorn senden',
  'typ.roadmap.sendenVornTitel': 'An keinem dieser Punkte arbeitet eine Session: geht an die, die links gerade offen ist',
  'typ.roadmap.nichtMelden': 'Nicht melden',
  'typ.roadmap.meilensteinMarke': 'Meilenstein {titel}',
  'typ.roadmap.ohneMeilenstein': 'Ohne Meilenstein',
  'typ.roadmap.punkte': 'Punkte',
  'typ.roadmap.neuerMeilenstein': 'Neuer Meilenstein: Titel und Eingabe',

  // --- Übergabe
  'typ.uebergabe.titel': 'Übergabe',
  'typ.uebergabe.hinweis': 'Die neueste Übergabe steht im Briefing jeder neuen Session dieses Projekts.',
  'typ.uebergabe.marke': 'Übergabe {id}',
  'typ.uebergabe.von': 'von „{von}“',
  'typ.uebergabe.weiter': 'Hier weitermachen',
  'typ.uebergabe.weiterTitel': 'Startet eine Session, die mit dieser Übergabe beginnt',
  'typ.uebergabe.stand': 'Stand',
  'typ.uebergabe.offen': 'Offen',
  'typ.uebergabe.naechster': 'Nächster Schritt: ',
  'typ.uebergabe.leer': 'Noch keine Übergabe. Eine Session schreibt sie am Ende mit dem Befehl coop uebergabe.',

  // --- Variantenwahl
  'typ.variantenwahl.titel': 'Variantenwahl',
  'typ.variantenwahl.grund': 'Warum diese? Was soll aus den anderen übernommen werden?',
  'typ.variantenwahl.marke': 'Variante {id}: {titel}',
  'typ.variantenwahl.gewaehlt': 'Gewählt',
  'typ.variantenwahl.waehlen': 'Diese wählen',
  'typ.variantenwahl.leer': 'Noch keine Varianten. Der Agent trägt sie in die Datendatei ein.',
  'typ.variantenwahl.senden': 'Wahl an die Session senden',

  // --- Verlauf der Rückmeldungen
  'typ.verlauf.titel': 'Verlauf: {name}',
  'typ.verlauf.keinBild': 'Kein Bild',
  'typ.verlauf.gross': 'Groß ansehen',
  'typ.verlauf.schliessen': 'Schließen',
  'typ.verlauf.marke': 'Rückmeldung vom {datum}',
  'typ.verlauf.zuArtefakt': 'zu „{titel}“',
  'typ.verlauf.anZiel': 'an „{titel}“',
  'typ.verlauf.ohneText': '(ohne Text)',
  'typ.verlauf.geschaetzt': ' (geschätzt)',
  'typ.verlauf.erledigtAm': 'Erledigt am {datum}',
  'typ.verlauf.ohneNotiz': 'Ohne Notiz gemeldet.',
  'typ.verlauf.vorher': 'Vorher',
  'typ.verlauf.nachher': 'Nachher',
  'typ.verlauf.alle': 'Alle',
  'typ.verlauf.nichts': 'Nichts in dieser Auswahl.',
  'typ.verlauf.leer': 'Noch keine Rückmeldungen. Markiere in einer Ansicht und sende; hier steht dann, was daraus wurde.',
}

export const en: Record<keyof typeof de, string> = {
  // --- Shared
  'typ.allg.speichernFehl': 'Saving failed.',
  'typ.allg.datenFehler': 'The data of this artifact has errors:',
  'typ.allg.keinJson': 'Not valid JSON: {grund}',
  'typ.allg.sitzungStarten': 'Start session',
  'typ.allg.vorschlag': 'Proposal: ',
  'typ.allg.nutzer': 'User',

  // --- Display names of the status values (roadmap, review, history)
  'typ.status.offen': 'Open',
  'typ.status.in-arbeit': 'In progress',
  'typ.status.pruefen': 'To review',
  'typ.status.erledigt': 'Done',
  'typ.status.verworfen': 'Dropped',
  'typ.status.behoben': 'Fixed',
  'typ.status.abgelehnt': 'Rejected',
  'typ.status.zugestellt': 'With the session',

  // --- Status values of the roadmap in running text
  'typ.statuswert.offen': 'open',
  'typ.statuswert.in-arbeit': 'in progress',
  'typ.statuswert.pruefen': 'to review',
  'typ.statuswert.erledigt': 'done',
  'typ.statuswert.verworfen': 'dropped',

  // --- States of a session in running text
  'typ.sitzung.arbeitet': 'working',
  'typ.sitzung.wartet': 'waiting',
  'typ.sitzung.ruhig': 'idle',
  'typ.sitzung.beendet': 'ended',

  // --- Severity of a finding
  'typ.schwere.kritisch': 'Critical',
  'typ.schwere.hoch': 'High',
  'typ.schwere.mittel': 'Medium',
  'typ.schwere.niedrig': 'Low',

  // --- Document and project sheet
  'typ.dokument.titel': 'Document',
  'typ.dokument.tabelle': 'Table: {kopf}',
  'typ.dokument.leer': 'The file is empty.',

  // --- Questionnaire
  'typ.fragebogen.titel': 'Questionnaire',
  'typ.fragebogen.antwort': 'Your answer',
  'typ.fragebogen.marke': 'Question {id}: {frage}',
  'typ.fragebogen.uebernehmen': 'Accept',
  'typ.fragebogen.leer': 'No questions yet. The agent enters them in the data file.',
  'typ.fragebogen.beantwortet': '{n} of {von} answered',
  'typ.fragebogen.senden': 'Send answers to the session',

  // --- Review
  'typ.review.titel': 'Review',
  'typ.review.offen': '{n} of {von} open',
  'typ.review.nurOffene': 'Show open only',
  'typ.review.alle': 'Show all',
  'typ.review.marke': 'Finding {id}: {titel}',
  'typ.review.startenTitel': 'Starts a session with this finding as its task',
  'typ.review.leer': 'No findings yet. The agent enters them in the data file.',

  // --- Roadmap
  'typ.roadmap.balken': '{n} of {von} done',
  'typ.roadmap.wartetAuf': 'waiting for {liste}',
  'typ.roadmap.sitzung': 'Session “{titel}”: {zustand}',
  'typ.roadmap.startenTitel': 'Starts a session that knows this item and its context',
  'typ.roadmap.schlaegtVor': '{von} proposes: {status}',
  'typ.roadmap.bestaetigen': 'Confirm',
  'typ.roadmap.nochNicht': 'Not yet',
  'typ.roadmap.notiz': 'Add a note; press Enter to save',
  'typ.roadmap.beschreibung': 'Description',
  'typ.roadmap.abnahme': 'Acceptance criteria, one per line',
  'typ.roadmap.haengtAb': 'Depends on: {liste}',
  'typ.roadmap.dateien': 'Files: {liste}',
  'typ.roadmap.neuerPunkt': 'New item: type a title, press Enter',
  'typ.roadmap.titelMarke': 'Roadmap title',
  'typ.roadmap.punkteErledigt': '{n} of {von} items done',
  'typ.roadmap.ungemeldet': 'Not yet reported to the session',
  'typ.roadmap.sendenAn': 'Send to “{liste}”',
  'typ.roadmap.sendenTrenner': '”, “',
  'typ.roadmap.sendenAnTitel': 'Goes to the sessions working on these items',
  'typ.roadmap.sendenVorn': 'Send to the active session',
  'typ.roadmap.sendenVornTitel': 'No session is working on any of these items: goes to the one currently open on the left',
  'typ.roadmap.nichtMelden': 'Do not report',
  'typ.roadmap.meilensteinMarke': 'Milestone {titel}',
  'typ.roadmap.ohneMeilenstein': 'No milestone',
  'typ.roadmap.punkte': 'Items',
  'typ.roadmap.neuerMeilenstein': 'New milestone: type a title, press Enter',

  // --- Handover
  'typ.uebergabe.titel': 'Handover',
  'typ.uebergabe.hinweis': 'The latest handover appears in the briefing of every new session of this project.',
  'typ.uebergabe.marke': 'Handover {id}',
  'typ.uebergabe.von': 'from “{von}”',
  'typ.uebergabe.weiter': 'Continue here',
  'typ.uebergabe.weiterTitel': 'Starts a session that begins with this handover',
  'typ.uebergabe.stand': 'State',
  'typ.uebergabe.offen': 'Open',
  'typ.uebergabe.naechster': 'Next step: ',
  'typ.uebergabe.leer': 'No handover yet. A session writes it at the end with the command coop uebergabe.',

  // --- Variant choice
  'typ.variantenwahl.titel': 'Variant choice',
  'typ.variantenwahl.grund': 'Why this one? What should be carried over from the others?',
  'typ.variantenwahl.marke': 'Variant {id}: {titel}',
  'typ.variantenwahl.gewaehlt': 'Chosen',
  'typ.variantenwahl.waehlen': 'Choose this one',
  'typ.variantenwahl.leer': 'No variants yet. The agent enters them in the data file.',
  'typ.variantenwahl.senden': 'Send choice to the session',

  // --- History of feedback
  'typ.verlauf.titel': 'History: {name}',
  'typ.verlauf.keinBild': 'No image',
  'typ.verlauf.gross': 'View full size',
  'typ.verlauf.schliessen': 'Close',
  'typ.verlauf.marke': 'Feedback from {datum}',
  'typ.verlauf.zuArtefakt': 'on “{titel}”',
  'typ.verlauf.anZiel': 'to “{titel}”',
  'typ.verlauf.ohneText': '(no text)',
  'typ.verlauf.geschaetzt': ' (estimated)',
  'typ.verlauf.erledigtAm': 'Done on {datum}',
  'typ.verlauf.ohneNotiz': 'Reported without a note.',
  'typ.verlauf.vorher': 'Before',
  'typ.verlauf.nachher': 'After',
  'typ.verlauf.alle': 'All',
  'typ.verlauf.nichts': 'Nothing in this selection.',
  'typ.verlauf.leer': 'No feedback yet. Mark something in a view and send it; this page then shows what came of it.',
}
