/* Variantenwahl — Entwürfe nebeneinander, wählen und begründen. */
(function () {
  const { el, laden, aendern, aktion, fehlerZeigen, t } = window.coop

  async function zeichne() {
    const stand = await laden()
    fehlerZeigen(stand.fehler)
    let d
    try { d = JSON.parse(stand.daten || '{}') } catch (e) { return fehlerZeigen([t('typ.allg.keinJson', { grund: e.message })]) }
    d.varianten = d.varianten || []
    document.title = d.titel || t('typ.variantenwahl.titel')
    const grund = el('textarea', { class: 'feld', rows: 2, placeholder: t('typ.variantenwahl.grund'), value: d.begruendung || '', onchange: (e) => aendern((x) => { x.begruendung = e.target.value }) })
    const wurzel = el('main', { class: 'blatt weit' }, el('h1', { text: d.titel || t('typ.variantenwahl.titel') }), d.frage ? el('p', { class: 'leise', text: d.frage }) : null,
      el('div', { class: 'varianten', style: `grid-template-columns: repeat(${Math.min(Math.max(d.varianten.length, 1), 3)}, 1fr)` }, d.varianten.map((v) =>
        el('section', { class: `variante${d.wahl === v.id ? ' gewaehlt' : ''}`, 'data-coop-ref': `variante:${v.id}`, 'data-coop-label': t('typ.variantenwahl.marke', { id: v.id, titel: v.titel }), 'data-coop-datei': stand.datenPfad },
          el('h2', {}, el('span', { class: 'id', text: v.id + ' ' }), v.titel),
          // Bilder und HTML der Varianten sind Inhalt des Projekts: abgeschottet laden, nie mit Zugang zum Deck.
          v.bild ? el('img', { src: stand.fremdBasis + encodeURI(String(v.bild)), alt: v.titel }) : null,
          v.html ? el('iframe', { src: stand.fremdBasis + encodeURI(String(v.html)), title: v.titel, loading: 'lazy', sandbox: 'allow-scripts' }) : null,
          v.beschreibung ? el('p', { text: v.beschreibung }) : null,
          el('button', { class: `knopf${d.wahl === v.id ? ' an' : ''}`, text: d.wahl === v.id ? t('typ.variantenwahl.gewaehlt') : t('typ.variantenwahl.waehlen'), onclick: () => aendern((x) => { x.wahl = x.wahl === v.id ? null : v.id }).then(zeichne) })))),
      d.varianten.length ? null : el('p', { class: 'leise', text: t('typ.variantenwahl.leer') }),
      el('footer', { class: 'senden' }, grund, el('button', { class: 'knopf haupt', text: t('typ.variantenwahl.senden'), disabled: !d.wahl, onclick: () => aktion({ art: 'wahl', artefakt: window.coop.aid }) })))
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
