import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // truecolour with alpha
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0 // no filter
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const mix = (a, b, t) => a.map((value, i) => Math.round(value + (b[i] - value) * t))

/** A cooking pot in [-1, 1] space (y up): bowl, rim, two handles, a lid knob and steam. */
function insidePot(x, y) {
  const bowl = y <= 0.05 && y >= -0.75 && (x * x) / 0.81 + ((y + 0.05) * (y + 0.05)) / 0.49 <= 1
  const rim = Math.abs(x) <= 1.0 && y > 0.05 && y <= 0.2
  const handles = Math.abs(x) > 0.9 && Math.abs(x) <= 1.18 && y > -0.12 && y <= 0.02
  const knob = Math.hypot(x, y - 0.33) <= 0.13
  const steam = [-0.42, 0, 0.42].some((cx) => y > 0.55 && y < 1.0 && Math.abs(x - cx - 0.07 * Math.sin((y - 0.55) * 14)) < 0.055)
  return bowl || rim || handles || knob || steam
}

function draw(size, { maskable }) {
  const rgba = Buffer.alloc(size * size * 4)
  const inset = maskable ? 0.72 : 0.9 // maskable icons need a safe zone
  const radius = maskable ? size / 2 : size * 0.22

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const u = x / (size - 1)
      const v = y / (size - 1)

      // Rounded-square (or full-bleed) mask.
      const dx = Math.max(radius - x, 0, x - (size - 1 - radius))
      const dy = Math.max(radius - y, 0, y - (size - 1 - radius))
      const outside = Math.hypot(dx, dy) > radius
      if (!maskable && outside) continue

      const bg = mix([196, 74, 28], [240, 150, 60], (u + v) / 2)
      rgba[i] = bg[0]
      rgba[i + 1] = bg[1]
      rgba[i + 2] = bg[2]
      rgba[i + 3] = 255

      // Pot, centred, scaled into the safe zone.
      const hx = ((x / (size - 1)) * 2 - 1) / (inset * 0.7)
      const hy = -(((y / (size - 1)) * 2 - 1) / (inset * 0.7)) + 0.12
      if (insidePot(hx, hy)) {
        rgba[i] = 255
        rgba[i + 1] = 248
        rgba[i + 2] = 240
        rgba[i + 3] = 255
      }
    }
  }
  return encodePng(size, size, rgba)
}

const files = [
  ['icon-192.png', 192, { maskable: false }],
  ['icon-512.png', 512, { maskable: false }],
  ['icon-maskable-512.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, { maskable: true }],
]

for (const [name, size, options] of files) {
  writeFileSync(join(out, name), draw(size, options))
  console.log(`wrote public/${name}`)
}
