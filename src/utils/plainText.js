// Notification texts written by the database still carry long dashes and party emoji from older
// SQL; the app shows them in the site's plain style ("Posao — tekst 🎉" -> "Posao, tekst").
export const plainText = (text) => (typeof text === 'string'
  ? text.replace(/\s*—\s*/g, ', ').replace(/\s*\p{Extended_Pictographic}️?/gu, '').trim()
  : text)

export const plainNotice = (row) => (row ? { ...row, title: plainText(row.title), message: plainText(row.message) } : row)
