// Die Anleitung des Decks: Kapitel aus /api/hilfe, links das Inhaltsverzeichnis.
(async () => {
  const inhalt = document.getElementById('inhalt')
  const haupt = document.getElementById('kapitel')
  const hole = async (pfad) => (await fetch(pfad, { credentials: 'same-origin' })).json()
  const { sprache, kapitel } = await hole('/api/hilfe')
  document.documentElement.lang = sprache
  const aktuell = () => decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] || '') || kapitel[0]?.datei

  async function zeige(datei, merken) {
    const nr = kapitel.findIndex((k) => k.datei === datei)
    if (nr < 0) return
    if (merken) history.pushState(null, '', `/hilfe/${encodeURIComponent(datei)}`)
    const { text } = await hole(`/api/hilfe/${encodeURIComponent(datei)}`)
    haupt.innerHTML = marked.parse(text)
    const fuss = document.createElement('div')
    fuss.className = 'weiter'
    for (const [k, pfeil] of [[kapitel[nr - 1], '← '], [kapitel[nr + 1], ' →']]) {
      const a = document.createElement(k ? 'a' : 'span')
      if (k) { a.href = k.datei; a.textContent = pfeil === '← ' ? pfeil + k.titel : k.titel + pfeil }
      fuss.append(a)
    }
    haupt.append(fuss)
    document.title = kapitel[nr].titel
    for (const a of inhalt.children) a.classList.toggle('aktiv', a.dataset.datei === datei)
    scrollTo(0, 0)
  }

  for (const k of kapitel) {
    const a = document.createElement('a')
    a.href = `/hilfe/${encodeURIComponent(k.datei)}`
    a.dataset.datei = k.datei
    a.textContent = k.titel
    inhalt.append(a)
  }
  // Verweise zwischen Kapiteln bleiben in der Seite; alles andere öffnet das Deck wie jeden Link.
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href]')
    const ziel = a && decodeURIComponent(a.getAttribute('href').split('/').pop().split('#')[0])
    if (!ziel || !kapitel.some((k) => k.datei === ziel)) return
    e.preventDefault()
    void zeige(ziel, true)
  })
  addEventListener('popstate', () => void zeige(aktuell(), false))
  await zeige(aktuell(), false)
})()
