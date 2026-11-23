/* Fragebogen — der Agent fragt mit Vorschlag je Punkt, der Mensch antwortet im Artefakt. */
(function () {
  const { el, laden, aendern, aktion, fehlerZeigen, t } = window.coop

  async function setze(fid, patch) {
    fehlerZeigen(await aendern((d) => Object.assign(d.fragen.find((f) => f.id === fid), patch)))
  }

  async function zeichne() {
    const stand = await laden()
    fehlerZeigen(stand.fehler)
    let d
    try { d = JSON.parse(stand.daten || '{}') } catch (e) { return fehlerZeigen([t('typ.allg.keinJson', { grund: e.message })]) }
    d.fragen = d.fragen || []
    document.title = d.titel || t('typ.fragebogen.titel')
    const beantwortet = d.fragen.filter((f) => (f.antwort || '').trim()).length
    const wurzel = el('main', { class: 'blatt' }, el('h1', { text: d.titel || t('typ.fragebogen.titel') }), d.einleitung ? el('p', { class: 'leise', text: d.einleitung }) : null)
    for (const f of d.fragen) {
      const feld = el('textarea', { class: 'feld', rows: 2, placeholder: t('typ.fragebogen.antwort'), value: f.antwort || '', onchange: (e) => setze(f.id, { antwort: e.target.value }).then(zeichne) })
      wurzel.append(el('section', { class: `frage${(f.antwort || '').trim() ? ' beantwortet' : ''}`, 'data-coop-ref': `frage:${f.id}`, 'data-coop-label': t('typ.fragebogen.marke', { id: f.id, frage: f.frage }), 'data-coop-datei': stand.datenPfad },
        el('h2', {}, el('span', { class: 'id', text: f.id + ' ' }), f.frage),
        f.kontext ? el('p', { class: 'leise', text: f.kontext }) : null,
        (f.optionen || []).length ? el('div', { class: 'optionen' }, f.optionen.map((o) => el('button', { class: `knopf${f.antwort === o ? ' an' : ''}`, text: o, onclick: () => setze(f.id, { antwort: o }).then(zeichne) }))) : null,
        f.vorschlag ? el('div', { class: 'vorschlag' }, el('span', {}, el('b', { class: 'pixel', text: t('typ.allg.vorschlag') }), f.vorschlag), el('button', { class: 'knopf', text: t('typ.fragebogen.uebernehmen'), onclick: () => setze(f.id, { antwort: f.vorschlag }).then(zeichne) })) : null,
        feld))
    }
    if (!d.fragen.length) wurzel.append(el('p', { class: 'leise', text: t('typ.fragebogen.leer') }))
    wurzel.append(el('footer', { class: 'senden' },
      el('span', { class: 'leise', text: t('typ.fragebogen.beantwortet', { n: beantwortet, von: d.fragen.length }) }),
      el('button', { class: 'knopf haupt', text: t('typ.fragebogen.senden'), disabled: !beantwortet, onclick: () =>
        aktion({ art: 'antworten', artefakt: window.coop.aid }) })))
    const y = scrollY
    document.body.replaceChildren(wurzel)
    scrollTo(0, y)
  }

  let timer = null
  window.coop.beiAenderung(() => {
    if (document.activeElement && document.activeElement.tagName === 'TEXTAREA') return
    clearTimeout(timer); timer = setTimeout(zeichne, 200)
  })
  zeichne()
})()
