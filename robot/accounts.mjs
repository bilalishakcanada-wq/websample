// Test logins the robot signs in with. The defaults are the LOCAL test database accounts
// (robot/local-db/setup.sh); never put real passwords here, pass them as env vars instead.
const pw = process.env.ROBOT_PASSWORD || 'Test12345!'

export const ACCOUNTS = {
  client: { email: process.env.ROBOT_CLIENT_EMAIL || 'klijent@test.poso', password: process.env.ROBOT_CLIENT_PASSWORD || pw },
  provider: { email: process.env.ROBOT_PROVIDER_EMAIL || 'izvodjac@test.poso', password: process.env.ROBOT_PROVIDER_PASSWORD || pw },
  admin: { email: process.env.ROBOT_ADMIN_EMAIL || 'admin@test.poso', password: process.env.ROBOT_ADMIN_PASSWORD || pw },
  newbie: { email: process.env.ROBOT_NEWBIE_EMAIL || 'novi@test.poso', password: process.env.ROBOT_NEWBIE_PASSWORD || pw },
}
