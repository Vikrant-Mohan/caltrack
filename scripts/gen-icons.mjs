/**
 * Generates Caltrack's PWA icons (pure Node, no dependencies):
 * a green rounded square with the white calorie-ring "C" mark.
 *
 *   node scripts/gen-icons.mjs
 *
 * Writes to public/icons/:
 *   icon-192.png, icon-512.png, icon-512-maskable.png, apple-touch-icon.png
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

// ---------------------------------------------------------------- PNG writer

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------- drawing

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const mix = (a, b, t) => a + (b - a) * t;

/** Inside the rounded-square background? (inset 0, corner radius 22%) */
function inRoundedRect(x, y, s) {
  const r = 0.22 * s;
  const half = s / 2;
  const qx = Math.abs(x - half) - (half - r);
  const qy = Math.abs(y - half) - (half - r);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r <= 0;
}

/**
 * Inside the white ring "C": a thick arc (rounded ends) leaving a gap toward
 * the right, mirroring the dashboard's calorie ring.
 */
function inArcC(x, y, s) {
  const cx = s / 2;
  const cy = s / 2;
  const meanR = 0.3 * s;
  const halfW = 0.085 * s;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.hypot(dx, dy);

  // Round end caps at the two arc tips (46° above/below the right gap).
  for (const deg of [46, -46]) {
    const rad = (deg * Math.PI) / 180;
    const capX = cx + meanR * Math.cos(rad);
    const capY = cy + meanR * Math.sin(rad);
    if (Math.hypot(x - capX, y - capY) <= halfW) return true;
  }
  if (Math.abs(dist - meanR) > halfW) return false;
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  return deg >= 46 || deg <= -46; // skip the 92° opening on the right
}

const BG_TOP = [40, 210, 132]; // #28d284
const BG_BOTTOM = [0, 153, 92]; // #00995c

function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const SS = 4; // 4x4 supersampling for smooth edges
  const step = 1 / SS;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bgHits = 0;
      let whiteHits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = px + (sx + 0.5) * step;
          const y = py + (sy + 0.5) * step;
          if (inRoundedRect(x, y, size)) {
            bgHits++;
            if (inArcC(x, y, size)) whiteHits++;
          }
        }
      }
      const samples = SS * SS;
      const idx = (py * size + px) * 4;
      const bgAlpha = bgHits / samples;
      const whiteAlpha = whiteHits / samples;
      if (bgAlpha === 0) {
        rgba[idx + 3] = 0;
        continue;
      }
      const t = clamp01(py / size);
      const bg = [
        mix(BG_TOP[0], BG_BOTTOM[0], t),
        mix(BG_TOP[1], BG_BOTTOM[1], t),
        mix(BG_TOP[2], BG_BOTTOM[2], t),
      ];
      // Composite white mark over the background, then apply bg coverage.
      const a = whiteAlpha / bgAlpha; // white coverage within the shape
      rgba[idx] = Math.round(mix(bg[0], 255, a));
      rgba[idx + 1] = Math.round(mix(bg[1], 255, a));
      rgba[idx + 2] = Math.round(mix(bg[2], 255, a));
      rgba[idx + 3] = Math.round(255 * bgAlpha);
    }
  }
  return rgba;
}

const targets = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "icon-512-maskable.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
];

mkdirSync(OUT_DIR, { recursive: true });
for (const { file, size } of targets) {
  const rgba = render(size);
  writeFileSync(join(OUT_DIR, file), encodePng(size, rgba));
  console.log(`wrote ${file} (${size}x${size})`);
}
