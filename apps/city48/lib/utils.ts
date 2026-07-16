import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

import type { Rgb } from './shaders'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 0..1 RGB (what the shaders take) to the #RRGGBB a colour input wants. */
export function rgbToHex(c: Rgb): string {
  return (
    '#' +
    c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('')
  )
}

/**
 * Inverse of rgbToHex. Returns null for anything that is not a full #RRGGBB, so
 * a half-typed hex in the text field cannot blank the colour mid-keystroke.
 */
export function hexToRgb(hex: string): Rgb | null {
  const n = hex.trim().replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(n)) return null
  return [
    Number.parseInt(n.slice(0, 2), 16) / 255,
    Number.parseInt(n.slice(2, 4), 16) / 255,
    Number.parseInt(n.slice(4, 6), 16) / 255,
  ]
}
