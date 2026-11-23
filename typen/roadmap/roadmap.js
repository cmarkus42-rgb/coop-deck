/* Roadmap — Betrachter und Bearbeitung. Die Wahrheit ist die JSON-Datei; diese Seite bietet sie lesbar an (E5). */
(function () {
  const { el, laden, aendern, aktion, fehlerZeigen, t } = window.coop
  // Gespeicherte Werte; angezeigt wird `typ.status.<wert>`.
  const STATUS = ['offen', 'in-arbeit', 'pruefen', 'erledigt', 'verworfen']
  // Anzeige eines Werts im Fließtext; ein unbekannter Wert bleibt, wie er in der Datei steht.
  const wort = (vorsatz, wert) => { const k = vorsatz + wert; const x = t(k); return x === k ? String(wert) : x }
  const offen = new Set()
  let stand = null
  let datenPfad = ''

  async function schreibe(fn) {
    const fehler = await aendern(fn)
    fehlerZeigen(fehler)
    await zeichne()
  }

  function naechsteId(r) {
    return 'R-' + (r.punkte.reduce((m, p) => Math.max(m, Number((/^R-(\d+)$/.exec(p.id) || [])[1] || 0)), 0) + 1)
  }

  function balken(punkte) {
    return el('div', { class: 'balken', title: t('typ.roadmap.balken', { n: punkte.filter((p) => p.status === 'erledigt').length, von: punkte.length }) },
      punkte.map((p) => el('i', { class: `s-${p.status}` })))
  }

  function punktZeile(r, p, sitzungen) {
    const auf = offen.has(p.id)
    const meine = sitzungen.filter((s) => s.punkt === p.id)
    const braucht = (p.abhaengig || []).map((a) => r.punkte.find((x) => x.id === a)).filter(Boolean)
    const blockiert = braucht.some((x) => x.status !== 'erledigt' && x.status !== 'verworfen')
    const kopf = el('div', { class: 'kopf', onclick: (e) => { if (e.target.closest('button, select, input, textarea')) return; auf ? offen.delete(p.id) : offen.add(p.id); zeichne() } },
      el('span', { class: 'id pixel', text: p.id }),
      el('span', { class: 'titel' }, p.titel,
        blockiert ? el('span', { class: 'marke warn pixel', text: t('typ.roadmap.wartetAuf', { liste: braucht.filter((x) => x.status !== 'erledigt' && x.status !== 'verworfen').map((x) => x.id).join(', ') }) }) : null),
      meine.map((s) => el('span', { class: 'sitzung', title: t('typ.roadmap.sitzung', { titel: s.titel, zustand: wort('typ.sitzung.', s.zustand) }) + (s.ergebnis ? ' — ' + s.ergebnis : '') }, el('span', { class: `led ${s.zustand}` }))),
      el('select', { class: `feld status s-${p.status}`, onchange: (e) => schreibe((d) => { const x = d.punkte.find((y) => y.id === p.id); x.status = e.target.value; delete x.vorschlag }) },
        STATUS.map((v) => el('option', { value: v, selected: v === p.status, text: t('typ.status.' + v) }))),
      el('button', { class: 'knopf', text: t('typ.allg.sitzungStarten'), title: t('typ.roadmap.startenTitel'), onclick: () => aktion({ art: 'sitzung-starten', artefakt: window.coop.aid, punkt: p.id, titel: p.titel }) }))

    const vorschlag = p.vorschlag ? el('div', { class: 'vorschlag' },
      el('span', {}, el('b', { class: 'pixel', text: t('typ.roadmap.schlaegtVor', { von: p.vorschlag.von, status: wort('typ.statuswert.', p.vorschlag.status) }) }), p.vorschlag.notiz ? ` — ${p.vorschlag.notiz}` : ''),
      el('button', { class: 'knopf haupt', text: t('typ.roadmap.bestaetigen'), onclick: () => schreibe((d) => { const x = d.punkte.find((y) => y.id === p.id); x.status = x.vorschlag.status; delete x.vorschlag }) }),
      el('button', { class: 'knopf', text: t('typ.roadmap.nochNicht'), onclick: () => schreibe((d) => { const x = d.punkte.find((y) => y.id === p.id); delete x.vorschlag; x.status = 'in-arbeit' }) })) : null

    let rumpf = null
    if (auf) {
      const notiz = el('input', { class: 'feld', placeholder: t('typ.roadmap.notiz'), onkeydown: (e) => {
        if (e.key !== 'Enter' || !e.target.value.trim()) return
        const text = e.target.value.trim()
        schreibe((d) => { const x = d.punkte.find((y) => y.id === p.id); (x.notizen = x.notizen || []).push({ zeit: new Date().toISOString(), von: stand.nutzer || t('typ.allg.nutzer'), text }) })
      } })
      rumpf = el('div', { class: 'rumpf' },
        el('textarea', { class: 'feld', rows: 3, placeholder: t('typ.roadmap.beschreibung'), value: p.beschreibung || '', onchange: (e) => schreibe((d) => { d.punkte.find((y) => y.id === p.id).beschreibung = e.target.value }) }),
        el('label', { class: 'leise', text: t('typ.roadmap.abnahme') }),
        el('textarea', { class: 'feld', rows: Math.max(2, (p.abnahme || []).length), value: (p.abnahme || []).join('\n'), onchange: (e) => schreibe((d) => { d.punkte.find((y) => y.id === p.id).abnahme = e.target.value.split('\n').map((z) => z.trim()).filter(Boolean) }) }),
        braucht.length ? el('div', { class: 'leise', text: t('typ.roadmap.haengtAb', { liste: braucht.map((x) => `${x.id} ${x.titel} (${wort('typ.statuswert.', x.status)})`).join('; ') }) }) : null,
        (p.dateien || []).length ? el('div', { class: 'leise mono', text: t('typ.roadmap.dateien', { liste: p.dateien.join(', ') }) }) : null,
        meine.length ? el('div', { class: 'sitzungen' }, meine.map((s) => el('div', {}, el('span', { class: `led ${s.zustand}` }), ` ${s.titel}`, s.ergebnis ? el('span', { class: 'leise', text: ` — ${s.ergebnis}` }) : null))) : null,
        (p.notizen || []).length ? el('ul', { class: 'notizen' }, p.notizen.slice(-8).map((n) => el('li', {}, el('span', { class: 'leise', text: `${String(n.zeit).slice(0, 10)} ${n.von}: ` }), n.text))) : null,
        notiz)
    }
    return el('article', { class: `punkt s-${p.status}${auf ? ' auf' : ''}`, 'data-coop-ref': `roadmap:${p.id}`, 'data-coop-label': `${p.id} ${p.titel}`, 'data-coop-datei': datenPfad }, kopf, !auf && p.beschreibung ? el('div', { class: 'kurz leise', text: p.beschreibung }) : null, vorschlag, rumpf)
  }

  function neuerPunkt(meilenstein) {
    const feld = el('input', { class: 'feld', placeholder: t('typ.roadmap.neuerPunkt'), onkeydown: (e) => {
      if (e.key !== 'Enter' || !e.target.value.trim()) return
      const titel = e.target.value.trim()
      schreibe((d) => { d.punkte = d.punkte || []; d.punkte.push({ id: naechsteId(d), titel, status: 'offen', meilenstein: meilenstein || undefined }) })
    } })
    return el('div', { class: 'neu' }, feld)
  }

  async function zeichne() {
    stand = await laden()
    datenPfad = stand.datenPfad || ''
    fehlerZeigen(stand.fehler)
    let r
    try { r = JSON.parse(stand.daten || '{}') } catch (e) { return }
    r.punkte = r.punkte || []
    r.meilensteine = r.meilensteine || []
    document.title = r.titel || stand.artefakt.titel
    const alle = r.punkte.filter((p) => p.status !== 'verworfen')
    const wurzel = el('main', { class: 'blatt' },
      el('header', { class: 'titel' }, el('h1', { text: r.titel || stand.artefakt.titel, 'data-coop-ref': 'roadmap:titel', 'data-coop-label': t('typ.roadmap.titelMarke'), 'data-coop-datei': datenPfad }), el('div', { class: 'leise' }, t('typ.roadmap.punkteErledigt', { n: alle.filter((p) => p.status === 'erledigt').length, von: alle.length }), el('span', { class: 'mono', text: `  ${datenPfad}` })), balken(alle)))
    const u = stand.ungemeldet
    if (u && u.zeilen.length) {
      const sende = (art) => aktion({ art, artefakt: window.coop.aid }).then(zeichne)
      wurzel.append(el('div', { class: 'ungemeldet' },
        el('div', {}, el('b', { class: 'pixel', text: t('typ.roadmap.ungemeldet') }),
          el('ul', {}, u.zeilen.map((z) => el('li', { text: z })))),
        el('div', { class: 'knoepfe' },
          el('button', { class: 'knopf haupt', text: u.an.length ? t('typ.roadmap.sendenAn', { liste: u.an.join(t('typ.roadmap.sendenTrenner')) }) : t('typ.roadmap.sendenVorn'), title: u.an.length ? t('typ.roadmap.sendenAnTitel') : t('typ.roadmap.sendenVornTitel'), onclick: () => sende('aenderungen-senden') }),
          el('button', { class: 'knopf', text: t('typ.roadmap.nichtMelden'), onclick: () => sende('aenderungen-verwerfen') }))))
    }
    const gruppen = [...r.meilensteine, null]
    for (const m of gruppen) {
      const ps = r.punkte.filter((p) => (m ? p.meilenstein === m.id : !r.meilensteine.some((x) => x.id === p.meilenstein)))
      if (!m && !ps.length && r.meilensteine.length) continue
      wurzel.append(el('section', { 'data-coop-ref': m ? `roadmap:meilenstein:${m.id}` : undefined, 'data-coop-label': m ? t('typ.roadmap.meilensteinMarke', { titel: m.titel }) : undefined, 'data-coop-datei': m ? datenPfad : undefined },
        el('div', { class: 'meilenstein' }, el('h2', { text: m ? m.titel : r.meilensteine.length ? t('typ.roadmap.ohneMeilenstein') : t('typ.roadmap.punkte') }), m && m.ziel ? el('span', { class: 'leise', text: m.ziel }) : null, ps.length ? balken(ps) : null),
        ps.map((p) => punktZeile(r, p, stand.sitzungen || [])),
        neuerPunkt(m && m.id)))
    }
    const neuerMs = el('input', { class: 'feld', placeholder: t('typ.roadmap.neuerMeilenstein'), onkeydown: (e) => {
      if (e.key !== 'Enter' || !e.target.value.trim()) return
      const titel = e.target.value.trim()
      schreibe((d) => { d.meilensteine = d.meilensteine || []; d.meilensteine.push({ id: 'M' + (d.meilensteine.length + 1), titel }) })
    } })
    wurzel.append(el('div', { class: 'neu ms' }, neuerMs))
    const y = scrollY
    document.body.replaceChildren(wurzel)
    scrollTo(0, y)
  }

  let timer = null
  window.coop.beiAenderung(() => {
    // Nicht neu zeichnen, während jemand in einem Feld schreibt.
    if (document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName) && document.activeElement.value) return
    clearTimeout(timer)
    timer = setTimeout(zeichne, 200)
  })
  zeichne()
})()
