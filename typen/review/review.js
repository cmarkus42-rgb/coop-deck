/* Review — Befunde mit Schwere, Fundstelle und Zustand; je Befund startet eine Session (AT-07, RM-07). */
(function () {
  const { el, laden, aendern, aktion, fehlerZeigen, t } = window.coop
  // Gespeicherte Werte; angezeigt wird `typ.schwere.<wert>` und `typ.status.<wert>`.
  const SCHWERE = ['kritisch', 'hoch', 'mittel', 'niedrig']
  const STATUS = ['offen', 'in-arbeit', 'behoben', 'abgelehnt']
  let alleZeigen = true

  async function zeichne() {
    const stand = await laden()
    fehlerZeigen(stand.fehler)
    let d
    try { d = JSON.parse(stand.daten || '{}') } catch (e) { return }
    const befunde = (d.befunde || []).filter((b) => b && b.id)
    document.title = d.titel || t('typ.review.titel')
    const rang = (b) => { const i = SCHWERE.indexOf(b.schwere); return i < 0 ? 2 : i }
    const zu = (b) => b.status === 'behoben' || b.status === 'abgelehnt'
    const offen = befunde.filter((b) => !zu(b))
    const liste = (alleZeigen ? befunde : offen).slice().sort((a, b) => Number(zu(a)) - Number(zu(b)) || rang(a) - rang(b))
    const wurzel = el('main', { class: 'blatt' },
      el('h1', { text: d.titel || t('typ.review.titel') }),
      d.gegenstand ? el('p', { class: 'leise', text: d.gegenstand }) : null,
      el('div', { class: 'kopfzahlen' },
        el('span', { text: t('typ.review.offen', { n: offen.length, von: befunde.length }) }),
        SCHWERE.map((v) => { const n = offen.filter((b) => (b.schwere || 'mittel') === v).length; return n ? el('span', { class: 'leise', text: `${t('typ.schwere.' + v)}: ${n}` }) : null }),
        el('button', { class: `knopf${alleZeigen ? '' : ' an'}`, text: alleZeigen ? t('typ.review.nurOffene') : t('typ.review.alle'), onclick: () => { alleZeigen = !alleZeigen; zeichne() } })),
      liste.map((b) => {
        const w = SCHWERE.includes(b.schwere) ? b.schwere : 'mittel'
        const s = STATUS.includes(b.status) ? b.status : 'offen'
        return el('article', { class: `befund w-${w} s-${s}${zu(b) ? ' zu' : ''}`, 'data-coop-ref': `befund:${b.id}`, 'data-coop-label': t('typ.review.marke', { id: b.id, titel: b.titel }), 'data-coop-datei': stand.datenPfad },
          el('header', {},
            el('span', { class: 'id pixel', text: b.id }),
            el('span', { class: 'titel', text: b.titel || '' }),
            el('span', { class: `schwere pixel w-${w}`, text: t('typ.schwere.' + w) }),
            el('select', { class: 'feld', onchange: (e) => aendern((x) => { x.befunde.find((y) => y.id === b.id).status = e.target.value }).then((f) => { fehlerZeigen(f); zeichne() }) },
              STATUS.map((v) => el('option', { value: v, selected: v === s, text: t('typ.status.' + v) }))),
            zu(b) ? null : el('button', { class: 'knopf', text: t('typ.allg.sitzungStarten'), title: t('typ.review.startenTitel'), onclick: () => aktion({ art: 'sitzung-starten', artefakt: window.coop.aid, punkt: b.id }) })),
          b.fundstelle ? el('div', { class: 'mono leise', text: b.fundstelle }) : null,
          b.beschreibung ? el('p', { text: b.beschreibung }) : null,
          b.vorschlag ? el('p', { class: 'vorschlag' }, el('b', { text: t('typ.allg.vorschlag') }), b.vorschlag) : null)
      }),
      befunde.length ? null : el('p', { class: 'leise', text: t('typ.review.leer') }))
    const y = scrollY
    document.body.replaceChildren(wurzel)
    scrollTo(0, y)
  }

  let timer = null
  window.coop.beiAenderung(() => { clearTimeout(timer); timer = setTimeout(zeichne, 200) })
  zeichne()
})()
