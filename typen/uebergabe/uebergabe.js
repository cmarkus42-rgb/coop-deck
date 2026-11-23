/* Übergabe — Stand, Offenes, nächster Schritt am Sessionende (AT-11). Geschrieben wird mit `coop uebergabe`. */
(function () {
  const { el, laden, aktion, fehlerZeigen, t, gebiet } = window.coop
  const datum = (z) => new Date(z).toLocaleString(gebiet, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  async function zeichne() {
    const stand = await laden()
    fehlerZeigen(stand.fehler)
    let d
    try { d = JSON.parse(stand.daten || '{}') } catch (e) { return fehlerZeigen([t('typ.allg.keinJson', { grund: e.message })]) }
    const eintraege = (d.eintraege || []).filter((e) => e && e.id)
    document.title = d.titel || t('typ.uebergabe.titel')
    const wurzel = el('main', { class: 'blatt' }, el('h1', { text: d.titel || t('typ.uebergabe.titel') }),
      el('p', { class: 'leise', text: t('typ.uebergabe.hinweis') }),
      eintraege.map((e, i) => el('article', { class: `ue${i === 0 ? ' neu' : ''}`, 'data-coop-ref': `uebergabe:${e.id}`, 'data-coop-label': t('typ.uebergabe.marke', { id: e.id }), 'data-coop-datei': stand.datenPfad },
        el('header', {}, el('span', { class: 'id pixel', text: e.id }), el('span', { class: 'zeit', text: e.zeit ? datum(e.zeit) : '' }), e.von ? el('span', { class: 'leise', text: t('typ.uebergabe.von', { von: e.von }) }) : null,
          el('button', { class: `knopf${i === 0 ? ' haupt' : ''}`, text: t('typ.uebergabe.weiter'), title: t('typ.uebergabe.weiterTitel'), onclick: () => aktion({ art: 'sitzung-starten', artefakt: window.coop.aid, punkt: e.id }) })),
        el('h3', { text: t('typ.uebergabe.stand') }), el('p', { text: e.stand || '' }),
        (e.offen || []).length ? [el('h3', { text: t('typ.uebergabe.offen') }), el('ul', {}, e.offen.map((o) => el('li', { text: o })))] : null,
        e.naechster ? el('div', { class: 'naechster' }, el('b', { text: t('typ.uebergabe.naechster') }), e.naechster) : null)),
      eintraege.length ? null : el('p', { class: 'leise', text: t('typ.uebergabe.leer') }))
    const y = scrollY
    document.body.replaceChildren(wurzel)
    scrollTo(0, y)
  }

  let timer = null
  window.coop.beiAenderung(() => { clearTimeout(timer); timer = setTimeout(zeichne, 200) })
  zeichne()
})()
