import { createContext, useContext, useEffect, useState } from 'react'
import { publicSettingsApi } from '../api/services'

const ThemeContext = createContext(null)

// Fallback values used until the /settings/public fetch resolves (or if it
// fails) — keep these identical to the original hardcoded indigo scale so
// there's no visible flash/flicker on first load.
const DEFAULT_BRANDING = {
  app_name: 'Credits',
  primary_color: '#4f46e5',
  periods_per_day: 5,
  day_order_max: 6,
}

// --- Tiny hex <-> HSL helpers, just enough to derive a 5-shade scale from
// one base color without pulling in a color library for this one feature. ---

function hexToHsl(hex) {
  let r = 0, g = 0, b = 0
  const clean = hex.replace('#', '')
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16)
    g = parseInt(clean[1] + clean[1], 16)
    b = parseInt(clean[2] + clean[2], 16)
  } else if (clean.length === 6) {
    r = parseInt(clean.slice(0, 2), 16)
    g = parseInt(clean.slice(2, 4), 16)
    b = parseInt(clean.slice(4, 6), 16)
  } else {
    return null // not a recognizable hex string; caller falls back to defaults
  }
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  const d = max - min
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    switch (max) {
      case r: h = ((g - b) / d) % 6; break
      case g: h = (b - r) / d + 2; break
      default: h = (r - g) / d + 4
    }
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s, l }
}

function hslToHex(h, s, l) {
  s = Math.min(1, Math.max(0, s))
  l = Math.min(1, Math.max(0, l))
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x; b = 0 }
  else if (h < 120) { r = x; g = c; b = 0 }
  else if (h < 180) { r = 0; g = c; b = x }
  else if (h < 240) { r = 0; g = x; b = c }
  else if (h < 300) { r = x; g = 0; b = c }
  else { r = c; g = 0; b = x }
  const toHex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

// Lightness targets chosen to visually match the original indigo scale's
// own shade spacing (50 very light, 900 very dark, 600 as the "base" tone).
const SHADE_LIGHTNESS = { 50: 0.95, 100: 0.9, 500: 0.6, 600: 0.5, 700: 0.4, 900: 0.15 }

function deriveShades(baseHex) {
  const hsl = hexToHsl(baseHex)
  if (!hsl) return null
  const shades = {}
  for (const [shade, lightness] of Object.entries(SHADE_LIGHTNESS)) {
    // Keep saturation reasonably strong for the lighter tints so they
    // don't wash out to gray, and slightly reduce it for the darkest
    // shade so 900 doesn't look neon.
    const s = shade === '900' ? Math.min(hsl.s, 0.6) : hsl.s
    shades[shade] = hslToHex(hsl.h, s, lightness)
  }
  return shades
}

function applyTheme(branding) {
  const shades = deriveShades(branding.primary_color) || deriveShades(DEFAULT_BRANDING.primary_color)
  if (shades) {
    const root = document.documentElement
    for (const [key, hex] of Object.entries(shades)) {
      root.style.setProperty(`--color-primary-${key}`, hex)
    }
  }
  if (branding.app_name) {
    document.title = branding.app_name
  }
}

export function ThemeProvider({ children }) {
  const [branding, setBranding] = useState(DEFAULT_BRANDING)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    publicSettingsApi.get()
      .then(r => {
        const merged = { ...DEFAULT_BRANDING, ...r.data }
        setBranding(merged)
        applyTheme(merged)
      })
      .catch(() => {
        // Network/auth hiccup on a public, non-critical endpoint — keep
        // the safe defaults rather than blocking the app on this.
        applyTheme(DEFAULT_BRANDING)
      })
      .finally(() => setLoaded(true))
  }, [])

  return (
    <ThemeContext.Provider value={{ ...branding, loaded }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
