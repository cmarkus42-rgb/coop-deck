/* Coop Deck — Schnittstelle für Artefaktseiten. Klassisches Skript, keine Abhängigkeiten. */
(function () {
  // Texte der Typseiten kommen aus `/lib/texte.js` (vor dieser Datei eingebunden). Fehlt das Skript,
  // etwa in einem freien Artefakt, gibt `t` den Schlüssel zurück und das Gebiet ist Deutsch.
  const TEXTE = window.COOP_TEXTE || {}
  const gebiet = TEXTE.gebiet || 'de-DE'
  if (TEXTE.sprache) document.documentElement.lang = TEXTE.sprache

  /** Text zum Schlüssel in der gewählten Sprache; `{name}` wird aus `werte` gefüllt. Fehlt der Schlüssel, kommt er selbst zurück. */
  function t(schluessel, werte) {
    const texte = TEXTE.texte || {}
    const vorlage = Object.prototype.hasOwnProperty.call(texte, schluessel) ? String(texte[schluessel]) : schluessel
    if (!werte) return vorlage
    return vorlage.replace(/\{(\w+)\}/g, (ganz, name) => (name in werte ? String(werte[name] ?? '') : ganz))
  }

  function springe(ref) {
    const el = [...document.querySelectorAll('[data-coop-ref]')].find((e) => e.getAttribute('data-coop-ref') === ref)
    if (!el) return false
    el.scrollIntoView({ block: 'center', behavior: 'auto' })
    el.classList.add('coop-blick')
    setTimeout(() => el.classList.remove('coop-blick'), 3200)
    return true
  }
  window.coopSpringe = springe
  // Freie Artefakte laufen abgeschottet (/u/…): Sie können sich zeigen lassen, aber die Schnittstelle des Decks nicht benutzen.
  if (location.pathname.startsWith('/u/')) return

  const teile = location.pathname.split('/').filter(Boolean) // p, <pid>, a|md, …
  const pid = teile[1]
  const art = teile[2]
  const rest = teile.slice(3).join('/')
  const aid = art === 'a' ? teile[3] : null
  const api = art === 'a' ? `/api/p/${pid}/a/${aid}` : `/api/p/${pid}/md/${rest}`
  const hoerer = []

  async function laden() {
    const res = await fetch(api, { cache: 'no-store' })
    return res.json()
  }

  /** Schreibt die Datendatei. Liefert die Liste der Fehler (leer = gespeichert). */
  async function speichern(daten) {
    const text = typeof daten === 'string' ? daten : JSON.stringify(daten, null, 2) + '\n'
    const res = await fetch(`${api}/daten`, { method: 'PUT', body: text })
    const j = await res.json().catch(() => ({ fehler: [t('typ.allg.speichernFehl')] }))
    return j.fehler || []
  }

  /** Lesen, ändern, schreiben in einem Zug: so überschreibt die Seite keine Änderung des Agenten. */
  async function aendern(fn) {
    const stand = await laden()
    const daten = JSON.parse(stand.daten || '{}')
    fn(daten)
    return speichern(daten)
  }

  function aktion(a) {
    return fetch(`/api/p/${pid}/aktion`, { method: 'POST', body: JSON.stringify(a) })
  }

  function fehlerZeigen(fehler) {
    let kasten = document.getElementById('coop-fehler')
    if (!fehler || !fehler.length) { if (kasten) kasten.remove(); return }
    if (!kasten) {
      kasten = document.createElement('div')
      kasten.id = 'coop-fehler'
      kasten.className = 'fehlerkasten'
      document.body.prepend(kasten)
    }
    kasten.replaceChildren(Object.assign(document.createElement('b'), { textContent: t('typ.allg.datenFehler') }),
      ...fehler.map((f) => Object.assign(document.createElement('div'), { textContent: f })))
  }

  function el(tag, attr, ...kinder) {
    const n = document.createElement(tag)
    for (const [k, v] of Object.entries(attr || {})) {
      if (v === undefined || v === null || v === false) continue
      if (k === 'class') n.className = v
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v)
      else if (k === 'text') n.textContent = v
      else if (k === 'value') n.value = v
      else n.setAttribute(k, v === true ? '' : v)
    }
    for (const k of kinder.flat()) if (k !== null && k !== undefined && k !== false) n.append(k)
    return n
  }

  function ereignis(m) {
    if (m.art === 'dateien') hoerer.forEach((fn) => fn(m.was))
    if (m.art === 'springe' && (!m.artefakt || m.artefakt === aid)) springe(m.ref)
  }
  // Eine Live-Verbindung je Projekt, nicht je Ansicht: Der Browser lässt nur sechs Verbindungen zu einer
  // Adresse zu, und jede Dauerverbindung belegt eine. Mit sechs offenen Ansichten bekäme die nächste
  // keine mehr und bliebe leer. Die Ansicht, die die Sperre hält, horcht und gibt an die anderen weiter;
  // schließt sie, übernimmt die nächste.
  try {
    const name = `coop-ereignisse-${pid}`
    const kanal = new BroadcastChannel(name)
    kanal.onmessage = (e) => ereignis(e.data)
    const horchen = () => new Promise(() => {
      const es = new EventSource(`/api/p/${pid}/ereignisse`)
      es.onmessage = (e) => {
        const m = JSON.parse(e.data)
        ereignis(m)
        kanal.postMessage(m)
      }
    })
    if (navigator.locks) void navigator.locks.request(name, horchen)
    else void horchen()
  } catch (e) { /* ohne Live-Verbindung bleibt die Seite benutzbar */ }

  window.coop = { pid, aid, laden, speichern, aendern, aktion, springe, fehlerZeigen, el, t, gebiet, beiAenderung: (fn) => hoerer.push(fn) }
})()
