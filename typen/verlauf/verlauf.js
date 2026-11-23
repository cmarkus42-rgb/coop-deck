/* Verlauf der Rückmeldungen (KO-11): offen und erledigt, vorher und nachher. Nur lesend. */
(function () {
  const { el, pid, beiAenderung, t, gebiet } = window.coop
  const aid = location.pathname.split('/').filter(Boolean)[3] || ''
  // Anzeigename eines Status (`typ.status.<wert>`); ein unbekannter Wert bleibt, wie er gespeichert ist.
  const statusName = (s) => { const k = 'typ.status.' + s; const x = t(k); return x === k ? s : x }
  let filter = 'alle'
  let gross = null

  const datum = (z) => new Date(z).toLocaleString(gebiet, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  function bild(url, titel) {
    if (!url) return el('figure', { class: 'bild leer' }, el('figcaption', { class: 'pixel', text: titel }), el('div', { class: 'leise', text: t('typ.verlauf.keinBild') }))
    return el('figure', { class: 'bild' }, el('figcaption', { class: 'pixel', text: titel }),
      el('img', { src: url, alt: titel, loading: 'lazy', title: t('typ.verlauf.gross'), onclick: () => { gross = url; zeichne() } }))
  }

  function karte(r) {
    const bezug = (m) => (m.bezug && (m.bezug.label || m.bezug.ref || m.bezug.inhalt)) || ''
    return el('article', { class: `rm s-${r.status}`, 'data-coop-ref': `rueckmeldung:${r.id}`, 'data-coop-label': t('typ.verlauf.marke', { datum: datum(r.zeit) }) },
      el('header', {},
        el('span', { class: `stand pixel s-${r.status}`, text: statusName(r.status) }),
        el('span', { class: 'zeit', text: datum(r.zeit) }),
        !aid && r.artefakt ? el('span', { class: 'leise', text: t('typ.verlauf.zuArtefakt', { titel: r.artefakt.titel }) }) : null,
        r.zielTitel ? el('span', { class: 'leise', text: t('typ.verlauf.anZiel', { titel: r.zielTitel }) }) : null,
        el('span', { class: 'mono leise kennung', text: r.id })),
      (r.notiz || '').trim() ? el('p', { class: 'notiz', text: r.notiz.trim() }) : null,
      (r.marken || []).length ? el('ol', { class: 'marken' }, r.marken.map((m) => el('li', { value: m.nr }, m.text || t('typ.verlauf.ohneText'), bezug(m) ? el('span', { class: 'leise', text: ` — ${bezug(m)}${m.bezug.unsicher ? t('typ.verlauf.geschaetzt') : ''}` }) : null))) : null,
      r.erledigt ? el('div', { class: 'erledigt' }, el('b', { class: 'pixel', text: t('typ.verlauf.erledigtAm', { datum: datum(r.erledigt.zeit) }) }), r.erledigt.notiz ? el('p', { text: r.erledigt.notiz }) : el('p', { class: 'leise', text: t('typ.verlauf.ohneNotiz') })) : null,
      r.bildUrl || r.nachherUrl ? el('div', { class: 'bilder' }, bild(r.bildUrl, t('typ.verlauf.vorher')), r.status === 'erledigt' ? bild(r.nachherUrl, t('typ.verlauf.nachher')) : null) : null)
  }

  async function zeichne() {
    const stand = await (await fetch(`/api/p/${pid}/rueckmeldungen/${encodeURIComponent(aid)}`, { cache: 'no-store' })).json()
    const alle = stand.rueckmeldungen || []
    const offen = alle.filter((r) => r.status !== 'erledigt')
    const liste = filter === 'offen' ? offen : filter === 'erledigt' ? alle.filter((r) => r.status === 'erledigt') : alle
    const titel = t('typ.verlauf.titel', { name: stand.artefakt ? stand.artefakt.titel : stand.projekt ? stand.projekt.name : '' })
    document.title = titel
    const wahl = (id, name, n) => el('button', { class: `knopf${filter === id ? ' an' : ''}`, text: `${name} ${n}`, onclick: () => { filter = id; zeichne() } })
    const wurzel = el('main', { class: 'blatt weit' },
      el('h1', { text: titel }),
      el('div', { class: 'wahl' }, wahl('alle', t('typ.verlauf.alle'), alle.length), wahl('offen', t('typ.status.offen'), offen.length), wahl('erledigt', t('typ.status.erledigt'), alle.length - offen.length)),
      liste.length ? liste.map(karte) : el('p', { class: 'leise', text: alle.length ? t('typ.verlauf.nichts') : t('typ.verlauf.leer') }))
    const y = scrollY
    document.body.replaceChildren(wurzel, gross ? el('div', { class: 'gross', title: t('typ.verlauf.schliessen'), onclick: () => { gross = null; zeichne() } }, el('img', { src: gross, alt: '' })) : '')
    scrollTo(0, y)
  }

  addEventListener('keydown', (e) => { if (e.key === 'Escape' && gross) { gross = null; zeichne() } })
  let timer = null
  beiAenderung(() => { clearTimeout(timer); timer = setTimeout(zeichne, 300) })
  zeichne()
})()
