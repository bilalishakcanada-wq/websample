/**
 * Provjera kvaliteta slike dokumenta — u pregledniku, prije slanja.
 *
 * Zašto ovdje a ne na serveru: korisnik dobije odgovor odmah ("slika je mutna")
 * umjesto da čeka 24 sata pa bude odbijen. Moderator time dobija samo slike koje
 * se uopšte mogu pročitati.
 *
 * Sve radi nad canvasom, bez ijedne biblioteke.
 */

const MAX_STRANA = 1600   // veće se smanjuje prije analize i slanja

/** Učita sliku u canvas, uz smanjivanje — velike slike inače gutaju memoriju na telefonu. */
async function uCanvas(file, maxStrana = MAX_STRANA) {
  const bitmap = await createImageBitmap(file)
  // dimenzije se moraju pročitati PRIJE close() — poslije zatvaranja bitmap je
  // odspojen i width/height postanu 0 (zbog toga je svaka slika ispadala "premala")
  const izvorna = { w: bitmap.width, h: bitmap.height }
  const omjer = Math.min(1, maxStrana / Math.max(izvorna.w, izvorna.h))
  const w = Math.round(izvorna.w * omjer)
  const h = Math.round(izvorna.h * omjer)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  return { canvas, ctx, w, h, izvorna }
}

const uSivo = (data, i) => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]

/**
 * Oštrina preko varijanse Laplacijana: mutna slika ima male razlike između
 * susjednih piksela, pa je varijansa niska. Standardni pristup iz obrade slike.
 */
function ostrina(ctx, w, h) {
  const { data } = ctx.getImageData(0, 0, w, h)
  const vrijednosti = []
  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      const i = (y * w + x) * 4
      const lap = 4 * uSivo(data, i)
        - uSivo(data, i - 4) - uSivo(data, i + 4)
        - uSivo(data, i - w * 4) - uSivo(data, i + w * 4)
      vrijednosti.push(lap)
    }
  }
  const sredina = vrijednosti.reduce((a, b) => a + b, 0) / vrijednosti.length
  return vrijednosti.reduce((a, b) => a + (b - sredina) ** 2, 0) / vrijednosti.length
}

/** Osvjetljenje i udio prepaljenih piksela (odsjaj blica preko podataka). */
function svjetlo(ctx, w, h) {
  const { data } = ctx.getImageData(0, 0, w, h)
  let zbir = 0
  let prepaljeni = 0
  let tamni = 0
  const n = w * h
  for (let i = 0; i < data.length; i += 4) {
    const g = uSivo(data, i)
    zbir += g
    if (g > 250) prepaljeni += 1
    if (g < 12) tamni += 1
  }
  return { prosjek: zbir / n, prepaljeno: prepaljeni / n, tamno: tamni / n }
}

/**
 * Otisak izgleda slike (dHash u oba pravca).
 *
 * Klasični dHash poredi samo vodoravno susjedne piksele, pa slika sa čisto
 * vodoravnom strukturom (npr. redovi teksta preko cijele širine) ispadne bez
 * ijednog postavljenog bita. Zato se uzima 9x9 i računa 32 bita vodoravno +
 * 32 bita uspravno — svaka slika sa ikakvom strukturom daje signal.
 *
 * Ista fotografija (i blago prerađena) daje isti ili vrlo blizak otisak, pa se
 * hvata ista lična karta poslana s dva naloga.
 */
function otisak(file, ctx0) {
  const N = 9
  const canvas = document.createElement('canvas')
  canvas.width = N
  canvas.height = N
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(ctx0.canvas, 0, 0, N, N)
  const { data } = ctx.getImageData(0, 0, N, N)
  const g = (x, y) => uSivo(data, (y * N + x) * 4)

  let bitovi = ''
  for (let y = 0; y < 8; y += 1) {           // 32 bita: vodoravne razlike
    for (let x = 0; x < 4; x += 1) bitovi += g(x * 2, y) > g(x * 2 + 1, y) ? '1' : '0'
  }
  for (let x = 0; x < 8; x += 1) {           // 32 bita: uspravne razlike
    for (let y = 0; y < 4; y += 1) bitovi += g(x, y * 2) > g(x, y * 2 + 1) ? '1' : '0'
  }

  // Otisak bez informacije (jednolična slika) bi lažno izgledao isto kao svaka
  // druga jednolična slika — takav se NE koristi.
  const jedinica = [...bitovi].filter((b) => b === '1').length
  if (Math.min(jedinica, 64 - jedinica) < 6) return null

  return bitovi.match(/.{8}/g).map((b) => parseInt(b, 2).toString(16).padStart(2, '0')).join('')
}

/** Smanjena slika za slanje — manje podataka putuje i manje se čuva. */
async function uBlob(canvas, kvalitet = 0.86) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', kvalitet))
}

/**
 * Glavna provjera. Vraća ocjenu, listu problema na našem jeziku, otisak i
 * pripremljenu (smanjenu) sliku za slanje.
 */
export async function provjeriDokument(file) {
  if (!file?.type?.startsWith('image/')) {
    return { ok: false, problemi: ['Datoteka nije slika.'], upozorenja: [] }
  }
  if (file.size > 12 * 1024 * 1024) {
    return { ok: false, problemi: ['Slika je veća od 12 MB. Smanji je ili slikaj ponovo.'], upozorenja: [] }
  }

  let priprema
  try {
    priprema = await uCanvas(file)
  } catch {
    // neispravan ili nepodržan format (npr. HEIC na starijem pregledniku)
    return { ok: false, upozorenja: [], problemi: ['Ova slika se ne može otvoriti. Slikaj ponovo ili izaberi JPG/PNG.'] }
  }
  const { canvas, ctx, w, h, izvorna } = priprema
  const problemi = []
  const upozorenja = []

  if (izvorna.w < 640 || izvorna.h < 400) {
    problemi.push('Slika je premala — dokument mora biti bar 640×400 piksela.')
  }

  const s = ostrina(ctx, w, h)
  if (s < 55) problemi.push('Slika je mutna. Očisti objektiv, drži telefon mirno i slikaj ponovo.')
  else if (s < 110) upozorenja.push('Slika je na granici oštrine — provjeri da se sva slova vide.')

  const sv = svjetlo(ctx, w, h)
  if (sv.prosjek < 45) problemi.push('Slika je pretamna. Slikaj uz jače svjetlo.')
  if (sv.prosjek > 225) problemi.push('Slika je presvijetla. Skloni izvor svjetla ili isključi blic.')
  if (sv.prepaljeno > 0.06) problemi.push('Odsjaj prekriva dio dokumenta. Slikaj pod drugim uglom, bez blica.')
  if (sv.tamno > 0.55) upozorenja.push('Veliki dio slike je taman — provjeri da je cijeli dokument u kadru.')

  const omjer = Math.max(w, h) / Math.min(w, h)
  if (omjer > 2.6) upozorenja.push('Neuobičajen oblik slike — provjeri da nije odsječen dio dokumenta.')

  const fp = otisak(file, ctx)
  const blob = await uBlob(canvas)

  return {
    ok: problemi.length === 0,
    problemi,
    upozorenja,
    otisak: fp,
    mjere: {
      ostrina: Math.round(s),
      svjetlo: Math.round(sv.prosjek),
      prepaljeno: Number(sv.prepaljeno.toFixed(4)),
      sirina: izvorna.w,
      visina: izvorna.h,
    },
    // smanjena slika: ide umjesto originala
    datoteka: blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file,
  }
}

/** Razlika dva otiska (Hammingova udaljenost). ≤ 8 bitova = praktično ista slika. */
export function razlikaOtisaka(a, b) {
  if (!a || !b || a.length !== b.length) return 64
  let d = 0
  for (let i = 0; i < a.length; i += 1) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16)
    while (x) { d += x & 1; x >>= 1 }
  }
  return d
}
