/*
 * Central place for the backend URL.
 *
 * Instead of hardcoding "localhost:3000" everywhere,
 * we build the URL from whatever host the browser is
 * currently using to load the app.
 *
 * - On your laptop:  http://localhost:5173  -> API_URL = http://localhost:3000
 * - On your phone:   http://192.168.1.5:5173 -> API_URL = http://192.168.1.5:3000
 *
 * This way it works automatically on any device on the
 * same network, without editing code per device.
 */
export const API_URL =
  import.meta.env.VITE_API_URL ||
  `http://${window.location.hostname}:3000`


/*
 * `crypto.randomUUID()` only works in "secure contexts"
 * (https:// or localhost). When the app is opened on a
 * phone via a plain http:// LAN IP (e.g. http://192.168.1.5),
 * it's undefined and throws "not a function".
 *
 * This generates an equivalent random ID using
 * `crypto.getRandomValues`, which IS available in
 * non-secure contexts, with a plain Math.random fallback
 * just in case.
 */
export function generateId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }

  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  ) {
    const bytes = crypto.getRandomValues(new Uint8Array(16))

    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80

    const hex = Array.from(bytes, (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('')

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
