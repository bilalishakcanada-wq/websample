// The site can live under a sub-path (e.g. GitHub Pages /websample/). React Router
// gets the base through its `basename`; raw hrefs and redirects go through here.
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')

export const withBase = (path) => `${BASE}${path.startsWith('/') ? path : `/${path}`}`
