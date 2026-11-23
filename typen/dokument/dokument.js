/* Dokument und Projektblatt — Markdown lesbar, jeder Block mit Datei und Zeile als Bezug. */
(function () {
  const { el, laden, fehlerZeigen, t } = window.coop

  function zeilenBis(text, n) {
    let z = 1
    for (let i = 0; i < n && i < text.length; i++) if (text.charCodeAt(i) === 10) z++
    return z
  }

  function kurz(html) {
    const d = el('div', {})
    d.innerHTML = html
    return (d.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 70)
  }

  /**
   * Markdown darf HTML enthalten, und die Datei kommt aus dem Projekt. Diese Seite hat Zugang
   * zum Deck, also bleibt nur Unverfängliches: keine Skripte, Rahmen, Formulare oder Stile,
   * keine Ereignis-Attribute, keine fremden Bezüge (`data-coop-*`), keine `javascript:`-Adressen.
   */
  function saeubern(html) {
    const v = document.createElement('template')
    v.innerHTML = html
    for (const n of v.content.querySelectorAll('script, iframe, frame, object, embed, form, input, button, textarea, select, link, meta, style, base, svg, math')) n.remove()
    for (const n of v.content.querySelectorAll('*')) {
      for (const a of [...n.attributes]) {
        const name = a.name.toLowerCase()
        const wert = a.value.replace(/[\s\u0000-\u001f]/g, '').toLowerCase()
        if (name.startsWith('on') || name.startsWith('data-coop') || name === 'style' || name === 'srcdoc' || name === 'formaction') n.removeAttribute(a.name)
        else if ((name === 'href' || name === 'src' || name === 'xlink:href') && /^(javascript|data|vbscript):/.test(wert)) n.removeAttribute(a.name)
      }
    }
    return v.innerHTML
  }

  async function zeichne() {
    const stand = await laden()
    fehlerZeigen(stand.fehler)
    const datei = (stand.artefakt && stand.artefakt.quelle) || stand.datenPfad || ''
    const text = stand.daten || ''
    const tokens = window.marked.lexer(text)
    const wurzel = el('main', { class: 'blatt dok' })
    let pos = 0
    for (const tok of tokens) {
      const start = pos
      pos += tok.raw.length
      if (tok.type === 'space') continue
      const zeile = zeilenBis(text, start)
      const block = el('div', { class: `block b-${tok.type}` })
      block.innerHTML = saeubern(window.marked.parser([tok]))
      const bezug = (knoten, z, label) => {
        knoten.setAttribute('data-coop-ref', `datei:${datei}:${z}`)
        knoten.setAttribute('data-coop-label', label || kurz(knoten.innerHTML))
        knoten.setAttribute('data-coop-datei', datei)
        knoten.setAttribute('data-coop-zeile', String(z))
      }
      if (tok.type === 'list') {
        // Listenpunkte einzeln ansprechbar: Vorgaben und offene Punkte stehen meist in Listen.
        const lis = block.querySelectorAll(':scope > ul > li, :scope > ol > li')
        let ip = start
        tok.items.forEach((item, i) => {
          if (lis[i]) bezug(lis[i], zeilenBis(text, ip))
          ip += item.raw.length
        })
      } else if (tok.type === 'table') {
        const zeilen = block.querySelectorAll('tbody tr')
        zeilen.forEach((tr, i) => bezug(tr, zeile + 2 + i))
        bezug(block, zeile, t('typ.dokument.tabelle', { kopf: kurz(block.querySelector('thead') ? block.querySelector('thead').innerHTML : '') }))
      } else {
        bezug(block, zeile)
      }
      wurzel.append(block)
    }
    if (!tokens.length) wurzel.append(el('p', { class: 'leise', text: t('typ.dokument.leer') }))
    wurzel.append(el('footer', { class: 'leise mono', text: datei }))
    const h1 = wurzel.querySelector('h1')
    document.title = h1 ? h1.textContent : (stand.artefakt && stand.artefakt.titel) || t('typ.dokument.titel')
    const y = scrollY
    document.body.replaceChildren(wurzel)
    scrollTo(0, y)
  }

  let timer = null
  window.coop.beiAenderung(() => { clearTimeout(timer); timer = setTimeout(zeichne, 200) })
  zeichne()
})()
