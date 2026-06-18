// One-shot icon generator. Run once locally:
//   cd frontend
//   node scripts/generate-app-icon.mjs
// Produces ./assets/icon.png (1024x1024, no alpha), ./assets/splash.png
// (1284x2778, black background), and ./assets/adaptive-icon.png
// (1024x1024, foreground only, used on Android).
//
// This script is a convenience — designers should replace the outputs
// with real brand assets before App Store submission.

import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const OUT = path.resolve("./assets");
if (!existsSync(OUT)) await mkdir(OUT, { recursive: true });

// Build the smallest valid 1024x1024 PNG with no alpha channel.
// We use a black background and a centered white wordmark "DRYP" rendered
// as 1px-on-1px-off bitmap text (so the file stays tiny). The point of
// this file is to give Expo a valid icon to ship — replace it with the
// real design before App Store submission.
const W = 1024, H = 1024;

// 5x7 bitmap font for "DRYP"
const FONT = {
  D: ["01110","10001","10001","10001","10001","10001","01110"],
  R: ["11110","10001","10001","11110","10100","10010","10001"],
  Y: ["10001","10001","01010","00100","00100","00100","00100"],
  P: ["11110","10001","10001","11110","10000","10000","10000"],
};
function glyph(ch) { return FONT[ch]; }

const scale = 18;        // px per font pixel
const gap   = scale * 2; // px between letters
const word  = "DRYP";
const wordW = word.length * (5 * scale) + (word.length - 1) * gap;
const wordH = 7 * scale;
const x0 = Math.floor((W - wordW) / 2);
const y0 = Math.floor((H - wordH) / 2);

// Build raw RGBA buffer (no alpha used; we set A=255 throughout).
const stride = W * 4;
const raw = Buffer.alloc(H * (stride + 1));
for (let y = 0; y < H; y++) {
  raw[y * (stride + 1)] = 0; // filter byte
  for (let x = 0; x < W; x++) {
    let on = false;
    for (let li = 0; li < word.length; li++) {
      const gx = x0 + li * (5 * scale + gap);
      const gy = y0;
      if (x >= gx && x < gx + 5 * scale && y >= gy && y < gy + 7 * scale) {
        const lx = Math.floor((x - gx) / scale);
        const ly = Math.floor((y - gy) / scale);
        if (FONT[word[li]][ly]?.[lx] === "1") on = true;
      }
    }
    const o = y * (stride + 1) + 1 + x * 4;
    raw[o]     = on ? 255 : 0;   // R
    raw[o + 1] = on ? 255 : 0;   // G
    raw[o + 2] = on ? 255 : 0;   // B
    raw[o + 3] = 255;            // A
  }
}

function crc32(buf) {
  let c;
  if (!crc32.table) {
    crc32.table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      crc32.table[n] = c >>> 0;
    }
  }
  c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crc32.table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function pngFromRGBA(width, height, rgba) {
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace
  const idat = zlib.deflateSync(rgba);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

const png = pngFromRGBA(W, H, raw);
await writeFile(path.join(OUT, "icon.png"), png);

// Splash: same wordmark on a 1284x2778 black canvas (iPhone Pro Max).
const SW = 1284, SH = 2778;
const sStride = SW * 4;
const sRaw = Buffer.alloc(SH * (sStride + 1));
for (let y = 0; y < SH; y++) {
  sRaw[y * (sStride + 1)] = 0;
  for (let x = 0; x < SW; x++) {
    const o = y * (sStride + 1) + 1 + x * 4;
    sRaw[o] = sRaw[o+1] = sRaw[o+2] = 0; sRaw[o+3] = 255;
  }
}
// center wordmark
const sScale = 26;
const sGap   = sScale * 2;
const sWordW = word.length * (5 * sScale) + (word.length - 1) * sGap;
const sWordH = 7 * sScale;
const sx0 = Math.floor((SW - sWordW) / 2);
const sy0 = Math.floor((SH - sWordH) / 2);
for (let y = 0; y < SH; y++) {
  for (let x = 0; x < SW; x++) {
    let on = false;
    for (let li = 0; li < word.length; li++) {
      const gx = sx0 + li * (5 * sScale + sGap);
      const gy = sy0;
      if (x >= gx && x < gx + 5 * sScale && y >= gy && y < gy + 7 * sScale) {
        const lx = Math.floor((x - gx) / sScale);
        const ly = Math.floor((y - gy) / sScale);
        if (FONT[word[li]][ly]?.[lx] === "1") on = true;
      }
    }
    if (on) {
      const o = y * (sStride + 1) + 1 + x * 4;
      sRaw[o] = sRaw[o+1] = sRaw[o+2] = 255;
    }
  }
}
await writeFile(path.join(OUT, "splash.png"), pngFromRGBA(SW, SH, sRaw));
await writeFile(path.join(OUT, "adaptive-icon.png"), png); // Android reuses icon

console.log("Wrote assets/icon.png, assets/splash.png, assets/adaptive-icon.png");
