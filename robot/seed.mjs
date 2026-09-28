// Fills a LOCAL test database with realistic jobs, offers, questions and a paid job with chat,
// so the robot has real pages to explore. Refuses to run against anything but localhost.
//   ROBOT_SUPABASE_URL=http://127.0.0.1:54321 ROBOT_SUPABASE_ANON_KEY=... node robot/seed.mjs
import { createClient } from '@supabase/supabase-js'
import { ACCOUNTS } from './accounts.mjs'

const url = process.env.ROBOT_SUPABASE_URL || 'http://127.0.0.1:54321'
const anon = process.env.ROBOT_SUPABASE_ANON_KEY
if (!anon) throw new Error('ROBOT_SUPABASE_ANON_KEY is missing')
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) throw new Error(`seed.mjs only runs against a local database, not ${url}`)

const as = async (who) => {
  const client = createClient(url, anon, { auth: { persistSession: false } })
  const { data, error } = await client.auth.signInWithPassword(ACCOUNTS[who])
  if (error) throw new Error(`login ${who}: ${error.message}`)
  return { db: client, id: data.user.id }
}

const must = (label) => ({ data, error }) => {
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}

const client = await as('client')
const worker = await as('provider')

const TAG = '[Robot]'
const { data: old } = await client.db.from('listings').select('id').like('title', `${TAG}%`)
if (old?.length) {
  console.log(`seed: ${old.length} robot jobs already exist, keeping them`)
  process.exit(0)
}

const jobs = [
  { title: `${TAG} Popravka curenja ispod sudopera`, description: 'Curi voda ispod sudopera u kuhinji, treba zamijeniti sifon i provjeriti spojeve. Imam osnovni alat.', category: 'Vodoinstalater', location: 'Sarajevo', price: 80 },
  { title: `${TAG} Dizajn logotipa za malu pekaru`, description: 'Treba mi jednostavan logo i vizit karta za pekaru u Tuzli. Rad na daljinu, dostava u PDF i PNG formatu.', category: 'Dizajn', location: 'Online', price: 300 },
  { title: `${TAG} Generalno čišćenje stana 60 m²`, description: 'Čišćenje stana nakon renoviranja: prašina, prozori, kupatilo i kuhinja. Sredstva za čišćenje su obezbijeđena.', category: 'Čišćenje', location: 'Mostar', price: null },
  { title: `${TAG} Pomoć pri selidbi — dva kreveta i ormar`, description: 'Treba prenijeti dva kreveta i jedan ormar sa trećeg sprata bez lifta u kombi. Sve je rastavljeno.', category: 'Selidba', location: 'Sarajevo', price: 60 },
  { title: `${TAG} Montaža rasvjete u dnevnom boravku`, description: 'Postaviti tri nove lampe na plafon i jednu zidnu. Instalacija postoji, samo treba spojiti i učvrstiti.', category: 'Električar', location: 'Sarajevo', price: 150 },
]

const created = []
for (const job of jobs) {
  const row = must(`listing ${job.title}`)(await client.db.from('listings').insert({ ...job, user_id: client.id, currency: 'BAM', status: 'published' }).select('id, title').single())
  created.push(row)
}
console.log(`seed: ${created.length} jobs`)

// questions under the first job, with an answer
const question = await worker.db.from('listing_questions').insert({ listing_id: created[0].id, user_id: worker.id, body: 'Da li je sifon plastični ili metalni? Da ponesem odgovarajući dio.' }).select('id').single()
if (question.error) console.log('seed: question skipped:', question.error.message)

// offers from the worker on jobs 1, 2 and 5
const bid = async (listing, amount, message) =>
  must(`bid on ${listing.title}`)(await worker.db.from('bids').insert({ listing_id: listing.id, bidder_id: worker.id, amount, message }).select('id, amount').single())
await bid(created[0], 75, 'Mogu doći danas poslije 16h, imam sve dijelove sa sobom. Garancija na rad 6 mjeseci.')
const funded = await bid(created[4], 150, 'Električar sa 10 godina iskustva, licenca i osiguranje. Završavam za 2 sata.')
await bid(created[1], 280, 'Dizajner sa portfoliom od 40+ logotipa. Tri prijedloga i dvije runde izmjena.')

// the client accepts and funds the lighting job, so a chat and a job in progress exist
const accepted = await client.db.rpc('accept_offer_and_fund', { p_bid_id: funded.id, p_expected_amount: funded.amount })
if (accepted.error) console.log('seed: accept skipped:', accepted.error.message)
else {
  const { data: conv } = await client.db.from('conversations').select('id').eq('listing_id', created[4].id).maybeSingle()
  if (conv) {
    await client.db.from('messages').insert({ conversation_id: conv.id, sender_id: client.id, receiver_id: worker.id, content: 'Zdravo! Da li vam odgovara sutra u 10h?' })
    await worker.db.from('messages').insert({ conversation_id: conv.id, sender_id: worker.id, receiver_id: client.id, content: 'Odgovara, vidimo se sutra u 10h.' })
  }
  console.log('seed: one job accepted and paid, chat started')
}
console.log('seed: done')
