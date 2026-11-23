/* Seite fürs Handy: Anfragen der Sessions beliefern (CP-12). Keine Abhängigkeiten. */
(() => {
  const T = (window.COOP_TEXTE && window.COOP_TEXTE.texte) || {}
  const gebiet = window.COOP_TEXTE && window.COOP_TEXTE.sprache === 'de' ? 'de-DE' : 'en-GB'
  document.documentElement.lang = (window.COOP_TEXTE && window.COOP_TEXTE.sprache) || 'de'
  const t = (k, werte) => (T['handy.' + k] || k).replace(/\{(\w+)\}/g, (ganz, n) => (werte && n in werte ? String(werte[n]) : ganz))
  const $ = (id) => document.getElementById(id)
  const liste = $('liste'), lage = $('lage')
  const merk = {}            // Kennung → { notiz, stand, standArt }: bleibt über das Neuzeichnen erhalten
  let aufnahme = null        // laufende Tonaufnahme
  let projekte = []
  const kannAufnehmen = !!(navigator.mediaDevices && window.MediaRecorder)

  $('titel').textContent = t('titel')
  $('leer').textContent = t('leer')
  $('wartetTitel').textContent = t('wartet')
  $('lieferTitel').textContent = t('fotosUndTon')
  $('frei').textContent = t('frei')
  $('freiTitelText').textContent = t('freiTitel')
  $('freiProjektText').textContent = t('freiProjekt')
  $('freiSitzungText').textContent = t('freiSitzung')
  $('freiAbbrechen').textContent = t('abbrechen')
  $('freiAnlegen').textContent = t('freiAnlegen')

  async function api(pfad, koerper, kopf) {
    const r = await fetch(pfad, koerper === undefined ? { credentials: 'same-origin' } : { method: 'POST', credentials: 'same-origin', body: koerper, headers: Object.assign({ 'x-coop-handy': '1' }, kopf || {}) })
    if (!r.ok) throw new Error(String(r.status))
    return r.json()
  }
  const ziel = (a) => 'p=' + encodeURIComponent(a.projektId) + '&id=' + encodeURIComponent(a.id)
  const schluessel = (a) => a.projektId + '/' + a.id

  function el(tag, attr, ...kinder) {
    const e = document.createElement(tag)
    for (const [k, v] of Object.entries(attr || {})) {
      if (k === 'class') e.className = v
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v)
      else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v)
    }
    for (const k of kinder) if (k != null) e.append(k)
    return e
  }
  function melde(a, text, art) {
    const k = schluessel(a)
    merk[k] = Object.assign(merk[k] || {}, { stand: text, standArt: art || '' })
    const s = document.querySelector('[data-stand="' + CSS.escape(k) + '"]')
    if (s) { s.textContent = text; s.className = 'stand ' + (art || '') }
  }

  async function hochladen(a, dateien) {
    let n = 0
    for (const d of dateien) {
      n++
      melde(a, t('laedt', { n, alle: dateien.length }))
      try { await api('api/hochladen?' + ziel(a) + '&name=' + encodeURIComponent(d.name || 'datei'), d, { 'content-type': d.type || 'application/octet-stream' }) }
      catch (e) { melde(a, t('ladenFehler'), 'warn'); return }
    }
    melde(a, t(dateien.length === 1 ? 'angekommen.eins' : 'angekommen.viele', { n: dateien.length }))
    laden(true)
  }
  function wahl(a, text, accept, capture, mehrere) {
    const i = el('input', { type: 'file', accept, capture, multiple: mehrere, onchange: (e) => { const f = [...e.target.files]; e.target.value = ''; if (f.length) hochladen(a, f) } })
    return el('label', { class: 'knopf' }, text, i)
  }
  async function ton(a, knopf) {
    if (aufnahme) { aufnahme.rekorder.stop(); return }
    try {
      const strom = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rekorder = new MediaRecorder(strom), teile = []
      rekorder.ondataavailable = (e) => teile.push(e.data)
      rekorder.onstop = () => {
        strom.getTracks().forEach((s) => s.stop())
        aufnahme = null
        hochladen(a, [new File(teile, 'aufnahme', { type: (rekorder.mimeType || 'audio/mp4').split(';')[0] })])
      }
      rekorder.start()
      aufnahme = { rekorder }
      knopf.textContent = t('tonBeenden')
      knopf.classList.add('laeuft')
      melde(a, t('nimmtAuf'), 'warn')
    } catch (e) { melde(a, t('keinMikrofon'), 'warn') }
  }

  function karte(a) {
    const k = schluessel(a)
    const z = merk[k] || (merk[k] = {})
    const geliefert = a.status === 'geliefert'
    const wo = [a.projekt, a.frei ? t('eigene') : a.sitzung ? t('vonSitzung', { sitzung: a.sitzung }) : null].filter(Boolean).join(' · ')
    const wann = new Date(a.zeit).toLocaleTimeString(gebiet, { hour: '2-digit', minute: '2-digit' }) + (geliefert ? ' · ' + t('abgeschickt') : '')
    const c = el('section', { class: 'karte ' + (geliefert ? 'geliefert' : 'offen') })
    c.append(el('div', { class: 'kopf' }, el('span', { class: 'wo' }, wo), el('span', { class: 'wann' }, wann)))
    c.append(el('h2', {}, a.titel))
    if (a.text) c.append(el('p', { class: 'text' }, a.text))
    const kn = el('div', { class: 'knoepfe' })
    if (a.art !== 'ton') kn.append(wahl(a, t('fotoAufnehmen'), 'image/*', 'environment', false), wahl(a, t('mediathek'), 'image/*,video/*', null, true))
    if (a.art !== 'foto') {
      if (kannAufnehmen) { const b = el('button', { class: 'knopf', type: 'button' }, t('tonAufnehmen')); b.addEventListener('click', () => ton(a, b)); kn.append(b) }
      kn.append(wahl(a, t('tonDatei'), 'audio/*,.m4a,.mp3,.wav', null, true))
    }
    c.append(kn)
    if (a.dateien.length) {
      const d = el('div', { class: 'dateien' })
      for (const f of a.dateien) {
        const inhalt = f.art === 'bild' && !/\.hei[cf]$/.test(f.name)
          ? el('img', { src: 'api/datei?' + ziel(a) + '&name=' + encodeURIComponent(f.name), alt: '', loading: 'lazy' })
          : f.art === 'ton' || f.art === 'video' ? (f.wartet ? t('tonWirdText') : t(f.art)) : f.art === 'bild' ? f.name.slice(-4).toUpperCase().replace('.', '') : t('datei')
        d.append(el('div', { class: 'datei' }, inhalt,
          el('button', { class: 'knopf weg', type: 'button', 'aria-label': t('entfernen'), onclick: async () => { try { await api('api/loeschen?' + ziel(a), JSON.stringify({ name: f.name })) } catch (e) { /* zeigt das Neuladen */ } laden(true) } }, '×')))
      }
      c.append(d)
      for (const f of a.dateien) {
        if (f.text) c.append(el('p', { class: 'gesprochen' }, '„' + f.text + '“'))
        if (f.fehler) c.append(el('p', { class: 'gesprochen warnung' }, t('ohneText', { grund: f.fehler })))
      }
    }
    const notiz = el('textarea', { placeholder: t('notiz'), rows: 1, 'aria-label': t('notiz') })
    notiz.value = z.notiz !== undefined ? z.notiz : a.notiz
    notiz.addEventListener('input', () => { z.notiz = notiz.value })
    c.append(notiz)
    const s = el('button', { class: 'knopf haupt', type: 'button' }, geliefert ? t('nochmal') : t('senden'))
    s.addEventListener('click', async () => {
      s.disabled = true
      try { await api('api/senden?' + ziel(a), JSON.stringify({ notiz: notiz.value })); melde(a, t(a.frei && !a.sitzung ? 'gesendetOhne' : 'gesendet'), 'gut'); laden(true) }
      catch (e) { melde(a, t('sendenFehler'), 'warn'); s.disabled = false }
    })
    c.append(el('div', { class: 'knoepfe' }, s))
    c.append(el('div', { class: 'stand ' + (z.standArt || ''), 'data-stand': k, role: 'status' }, z.stand || ''))
    return c
  }

  // --- Eingang des Decks: lesen, eine Option wählen, abhaken
  function posten(e) {
    const k = 'e/' + e.projektId + '/' + e.kennung
    const z = merk[k] || (merk[k] = {})
    const wo = [e.projekt, e.sitzung ? t('vonSitzung', { sitzung: e.sitzung }) : null].filter(Boolean).join(' · ')
    const wann = new Date(e.zeit).toLocaleTimeString(gebiet, { hour: '2-digit', minute: '2-digit' })
    const c = el('section', { class: 'karte posten ' + e.art })
    c.append(el('div', { class: 'kopf' }, el('span', { class: 'wo' }, t('art.' + e.art) + ' · ' + wo), el('span', { class: 'wann' }, wann)))
    c.append(el('h2', {}, e.titel))
    if (e.text && e.text !== e.titel) c.append(el('p', { class: 'text' }, e.text))
    if (e.ergebnis) c.append(el('p', { class: 'gesprochen' }, e.ergebnis))
    const stand = el('div', { class: 'stand ' + (z.standArt || ''), role: 'status' }, z.stand || '')
    const melde = (text, art) => { z.stand = text; z.standArt = art || ''; stand.textContent = text; stand.className = 'stand ' + (art || '') }
    const ziel = 'p=' + encodeURIComponent(e.projektId) + '&id=' + encodeURIComponent(e.kennung)
    if (e.art === 'frage') {
      if (!e.optionen.length) c.append(el('p', { class: 'text leise' }, t('nurAmDeck')))
      const kn = el('div', { class: 'optionen' })
      for (const o of e.optionen) {
        const b = el('button', { class: 'knopf option', type: 'button' }, el('b', {}, o.id), el('span', {}, o.titel, o.beschreibung ? el('small', {}, o.beschreibung) : null))
        b.addEventListener('click', async () => {
          for (const x of kn.querySelectorAll('button')) x.disabled = true
          try { await api('api/antwort?' + ziel, JSON.stringify({ option: o.id })); melde(t('beantwortet', { option: o.id + ' — ' + o.titel }), 'gut'); laden(true) }
          catch (err) { melde(t('antwortFehler'), 'warn'); for (const x of kn.querySelectorAll('button')) x.disabled = false }
        })
        kn.append(b)
      }
      c.append(kn)
      if (e.optionen.length) c.append(el('p', { class: 'text leise klein' }, t('nurOptionen')))
    } else {
      const b = el('button', { class: 'knopf', type: 'button' }, t('gesehen'))
      b.addEventListener('click', async () => {
        b.disabled = true
        try { await api('api/gesehen?' + ziel, JSON.stringify({ art: e.art })); laden(true) } catch (err) { b.disabled = false }
      })
      c.append(el('div', { class: 'knoepfe' }, b))
    }
    c.append(stand)
    return c
  }

  let zuletzt = ''
  async function laden(sofort) {
    if (aufnahme) return
    let l
    try { l = await api('api/lage') } catch (e) { lage.textContent = t('keineVerbindung'); return }
    lage.textContent = ''
    projekte = l.projekte
    const bild = JSON.stringify([l.eingang, l.anfragen])
    if (bild === zuletzt) return
    // Nicht unter dem Tippen neu zeichnen: die Notiz verlöre den Fokus.
    if (!sofort && document.activeElement && document.activeElement.tagName === 'TEXTAREA') return
    zuletzt = bild
    $('eingang').replaceChildren(...(l.eingang || []).map(posten))
    liste.replaceChildren(...l.anfragen.map(karte))
    const wartet = (l.eingang || []).length > 0
    $('wartetTitel').hidden = !wartet
    $('lieferTitel').hidden = !(wartet && l.anfragen.length > 0)
    $('leer').hidden = wartet || l.anfragen.length > 0
  }

  // --- Etwas ohne Anfrage schicken
  function sitzungenFuellen() {
    const p = projekte.find((x) => x.id === $('freiProjekt').value)
    $('freiSitzung').replaceChildren(...(p ? p.sitzungen : []).map((s) => el('option', { value: s.id }, s.titel)), el('option', { value: '' }, t('freiOhneSitzung')))
  }
  $('frei').addEventListener('click', () => {
    $('freiProjekt').replaceChildren(...projekte.map((p) => el('option', { value: p.id }, p.name)))
    sitzungenFuellen()
    $('freiForm').hidden = false
    $('frei').hidden = true
    $('freiTitel').focus()
  })
  $('freiProjekt').addEventListener('change', sitzungenFuellen)
  const freiZu = () => { $('freiForm').hidden = true; $('frei').hidden = false; $('freiTitel').value = '' }
  $('freiAbbrechen').addEventListener('click', freiZu)
  $('freiForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    const titel = $('freiTitel').value.trim()
    if (!titel || !$('freiProjekt').value) return
    try { await api('api/neu', JSON.stringify({ titel, projekt: $('freiProjekt').value, sitzung: $('freiSitzung').value })); freiZu(); laden(true) }
    catch (err) { lage.textContent = t('keineVerbindung') }
  })

  laden(true)
  setInterval(laden, 4000)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && laden())
})()
