"use strict";
const letterbox = require("./chunks/letterbox-dccgT3Ub.js");
const fs = require("fs");
const fs$1 = require("fs/promises");
const path = require("path");
const cvImport = require("@techstark/opencv-js");
const module$1 = require("module");
const ort = require("onnxruntime-node");
const os = require("os");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const ort__namespace = /* @__PURE__ */ _interopNamespaceDefault(ort);
const os__namespace = /* @__PURE__ */ _interopNamespaceDefault(os);
function isChargeTeal(r, g, b) {
  if (g < 95) return false;
  if (g < r + 25) return false;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 35) return false;
  if (max < 90) return false;
  return g >= 110 && b >= 70;
}
const READY_BAR_MIN_G_OVER_B = 20;
const READY_BAR_MIN_G_OVER_R = 60;
const READY_BAR_MIN_G = 190;
function isReadyBarColor(meanR, meanG, meanB) {
  return meanG - meanB >= READY_BAR_MIN_G_OVER_B && meanG - meanR >= READY_BAR_MIN_G_OVER_R;
}
const BAND_ROW_RATIO = 0.5;
const COLUMN_FILL_MIN = 0.6;
function analyzeChargeBand(img) {
  const { width: w, height: h } = img;
  const { minWidth, minHeight, maxHeight, width: refW, height: refH } = letterbox.VALORANT_SKILL_ENERGY;
  const minSegW = Math.max(3, Math.round(minWidth * (w / refW)));
  const bandMin = Math.max(2, Math.round(minHeight * (h / refH)));
  const bandMax = Math.max(bandMin, Math.round(maxHeight * (h / refH)));
  const empty = {
    minSegW,
    bandMin,
    bandMax,
    bandTop: -1,
    bandBot: -1,
    bandH: 0,
    totalTeal: 0,
    columns: [],
    segments: [],
    charges: 0
  };
  if (w < 4 || h < 4) return empty;
  const teal = new Uint8Array(w * h);
  const rowTeal = new Uint16Array(h);
  let totalTeal = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (isChargeTeal(img.data[i], img.data[i + 1], img.data[i + 2])) {
        teal[y * w + x] = 1;
        rowTeal[y]++;
        totalTeal++;
      }
    }
  }
  empty.totalTeal = totalTeal;
  let peakRow = 0;
  for (let y = 1; y < h; y++) {
    if (rowTeal[y] > rowTeal[peakRow]) peakRow = y;
  }
  if (rowTeal[peakRow] < minSegW) return empty;
  const rowThr = Math.max(2, Math.ceil(rowTeal[peakRow] * BAND_ROW_RATIO));
  let bandTop = peakRow;
  let bandBot = peakRow;
  while (bandBot - bandTop + 1 < bandMax) {
    const upOk = bandTop > 0 && rowTeal[bandTop - 1] >= rowThr;
    const dnOk = bandBot < h - 1 && rowTeal[bandBot + 1] >= rowThr;
    if (!upOk && !dnOk) break;
    if (upOk && (!dnOk || rowTeal[bandTop - 1] >= rowTeal[bandBot + 1])) bandTop--;
    else bandBot++;
  }
  const bandH = bandBot - bandTop + 1;
  if (bandH < Math.max(2, Math.round(bandMin / 2))) return empty;
  const colMinHit = Math.max(2, Math.round(bandH * COLUMN_FILL_MIN));
  const columns = new Array(w);
  for (let x = 0; x < w; x++) {
    let hit = 0;
    let sr = 0;
    let sg = 0;
    let sb = 0;
    for (let y = bandTop; y <= bandBot; y++) {
      if (!teal[y * w + x]) continue;
      const i = (y * w + x) * 4;
      hit++;
      sr += img.data[i];
      sg += img.data[i + 1];
      sb += img.data[i + 2];
    }
    const meanR = hit > 0 ? sr / hit : 0;
    const meanG = hit > 0 ? sg / hit : 0;
    const meanB = hit > 0 ? sb / hit : 0;
    const active = hit >= colMinHit && meanG >= READY_BAR_MIN_G && isReadyBarColor(meanR, meanG, meanB);
    columns[x] = {
      x,
      hit,
      meanR: Math.round(meanR),
      meanG: Math.round(meanG),
      meanB: Math.round(meanB),
      active
    };
  }
  const segments = [];
  let charges = 0;
  let start = -1;
  const flush = (endX) => {
    if (start < 0) return;
    const width = endX - start + 1;
    let cnt = 0;
    let sr = 0;
    let sg = 0;
    let sb = 0;
    for (let x = start; x <= endX; x++) {
      const c = columns[x];
      cnt += c.hit;
      sr += c.meanR * c.hit;
      sg += c.meanG * c.hit;
      sb += c.meanB * c.hit;
    }
    const counted = width >= minSegW;
    if (counted) charges++;
    segments.push({
      start,
      end: endX,
      width,
      meanR: cnt > 0 ? Math.round(sr / cnt) : 0,
      meanG: cnt > 0 ? Math.round(sg / cnt) : 0,
      meanB: cnt > 0 ? Math.round(sb / cnt) : 0,
      counted
    });
    start = -1;
  };
  for (let x = 0; x < w; x++) {
    if (columns[x].active) {
      if (start < 0) start = x;
    } else {
      flush(x - 1);
    }
  }
  flush(w - 1);
  return {
    minSegW,
    bandMin,
    bandMax,
    bandTop,
    bandBot,
    bandH,
    totalTeal,
    columns,
    segments,
    charges: Math.min(charges, 3)
  };
}
function detectEnergyBarCharges(img) {
  const { charges } = analyzeChargeBand(img);
  return { charges, available: charges > 0 };
}
const ULT_READY_COVERAGE = 0.5;
function detectUltimateChargeFromBar(img) {
  const maxCharges = letterbox.VALORANT_ULTIMATE_MAX_POINTS;
  const { width: w, height: h } = img;
  if (w < 4 || h < 4) {
    return { charges: 0, available: false, maxCharges };
  }
  const rowThreshold = Math.max(2, Math.floor(h * 0.25));
  let activeCols = 0;
  for (let x = 0; x < w; x++) {
    let hit = 0;
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4;
      if (isChargeTeal(img.data[i], img.data[i + 1], img.data[i + 2])) hit++;
    }
    if (hit >= rowThreshold) activeCols++;
  }
  const coverage = activeCols / w;
  const available = coverage >= ULT_READY_COVERAGE;
  const charges = available ? maxCharges : Math.max(0, Math.min(maxCharges - 1, Math.round(coverage * maxCharges)));
  return { charges, available, maxCharges };
}
function detectAbilityEnergy(barImage, key) {
  if (key === "X") {
    return detectUltimateChargeFromBar(barImage);
  }
  return detectEnergyBarCharges(barImage);
}
function analyzeEnergyBar(img) {
  const a = analyzeChargeBand(img);
  return {
    width: img.width,
    height: img.height,
    minSegW: a.minSegW,
    bandMin: a.bandMin,
    bandMax: a.bandMax,
    bandTop: a.bandTop,
    bandBot: a.bandBot,
    bandH: a.bandH,
    charges: a.charges,
    available: a.charges > 0,
    totalTeal: a.totalTeal,
    columns: a.columns,
    segments: a.segments
  };
}
let cvReady = null;
function diag(cv) {
  try {
    return JSON.stringify({
      typeofCv: typeof cv,
      hasDefault: typeof cvImport?.default !== "undefined",
      Mat: typeof cv?.Mat,
      onRuntimeInitialized: typeof cv?.onRuntimeInitialized,
      calledRun: cv?.calledRun,
      isThenable: typeof cv?.then === "function",
      hasHEAPU8: typeof cv?.HEAPU8 !== "undefined",
      keys: cv && typeof cv === "object" ? Object.keys(cv).length : 0
    });
  } catch (e) {
    return `diag-failed: ${e instanceof Error ? e.message : String(e)}`;
  }
}
function detachThenable(cv) {
  if (cv && typeof cv.then === "function") {
    try {
      delete cv.then;
    } catch {
    }
    if (typeof cv.then === "function") {
      try {
        cv.then = void 0;
      } catch {
      }
    }
  }
  return cv;
}
function loadCv() {
  if (!cvReady) {
    cvReady = (async () => {
      const t0 = Date.now();
      console.error("[cvLoader] enter loadCv");
      const cv = cvImport?.default ?? cvImport;
      console.error("[cvLoader] initial state", diag(cv));
      if (typeof cv.Mat === "function") {
        console.error("[cvLoader] Mat already ready (no wait needed)", Date.now() - t0, "ms");
        return detachThenable(cv);
      }
      console.error("[cvLoader] Mat not ready, waiting for runtime init...");
      await new Promise((resolve, reject) => {
        let settled = false;
        const finish = (reason) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          clearInterval(poll);
          console.error(
            `[cvLoader] runtime init done via ${reason} in`,
            Date.now() - t0,
            "ms; final state",
            diag(cv)
          );
          resolve();
        };
        const timeout = setTimeout(() => {
          if (settled) return;
          settled = true;
          clearInterval(poll);
          console.error(
            "[cvLoader] runtime init TIMEOUT after",
            Date.now() - t0,
            "ms; last state",
            diag(cv)
          );
          reject(new Error("opencv-js runtime init timeout"));
        }, 12e4);
        cv.onRuntimeInitialized = () => finish("onRuntimeInitialized");
        if (typeof cv.then === "function") {
          try {
            cv.then(
              () => finish("thenable"),
              (e) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                clearInterval(poll);
                console.error(
                  "[cvLoader] thenable rejected",
                  e instanceof Error ? e.message : String(e)
                );
                reject(e instanceof Error ? e : new Error(String(e)));
              }
            );
          } catch (e) {
            console.error(
              "[cvLoader] cv.then() threw",
              e instanceof Error ? e.message : String(e)
            );
          }
        }
        let ticks = 0;
        const poll = setInterval(() => {
          ticks += 1;
          if (typeof cv.Mat === "function") {
            finish("poll");
            return;
          }
          if (ticks % 20 === 0) {
            console.error("[cvLoader] still waiting...", Date.now() - t0, "ms", diag(cv));
          }
        }, 100);
      });
      return detachThenable(cv);
    })();
  }
  return cvReady;
}
let resourcesRoot = null;
function computeDefaultResourcesRoot() {
  const primary = path.join(__dirname, "..", "..", "resources");
  if (fs.existsSync(primary)) {
    return primary;
  }
  const unpacked = path.join(process.resourcesPath, "app.asar.unpacked", "resources");
  if (fs.existsSync(unpacked)) {
    return unpacked;
  }
  return process.resourcesPath;
}
function configureResourcesRoot(root) {
  if (root && fs.existsSync(path.join(root, "templates"))) {
    resourcesRoot = root;
    return;
  }
  const fallback = computeDefaultResourcesRoot();
  if (root && root !== fallback) {
    console.error(
      `[resolveResource] 传入的 resourcesRoot 无效("${root}")，回退为自算路径 "${fallback}"`
    );
  }
  resourcesRoot = fallback;
}
function getRoot() {
  if (!resourcesRoot) {
    resourcesRoot = computeDefaultResourcesRoot();
  }
  return resourcesRoot;
}
function resolveResource(relPath) {
  const normalized = relPath.replace(/^\/+/, "").replace(/^resources\//, "");
  return path.join(getRoot(), normalized);
}
function toUnpackedNativePath(p) {
  if (p.includes("app.asar.unpacked")) return p;
  return p.replace(/([\\/])app\.asar([\\/])/, "$1app.asar.unpacked$2");
}
function resolveModelPath(modelPath) {
  const p = modelPath.replace(/^\/+/, "");
  const resolved = p.startsWith("models/") || p.startsWith("templates/") ? resolveResource(p) : resolveResource(`models/${p}`);
  return toUnpackedNativePath(resolved);
}
function resolveTemplatePath(urlPath) {
  const p = urlPath.replace(/^\/+/, "");
  if (p.startsWith("templates/")) {
    return resolveResource(p);
  }
  return resolveResource(`templates/${p}`);
}
const requireCjs$1 = module$1.createRequire(__filename);
const IMAGENET_MEAN = [0.485, 0.456, 0.406];
const IMAGENET_STD = [0.229, 0.224, 0.225];
function cropRgbaFrame(frame, roi) {
  const x = Math.max(0, Math.min(roi.x, frame.width - 1));
  const y = Math.max(0, Math.min(roi.y, frame.height - 1));
  const w = Math.min(roi.width, frame.width - x);
  const h = Math.min(roi.height, frame.height - y);
  const out = new Uint8Array(w * h * 4);
  for (let row = 0; row < h; row++) {
    const srcStart = ((y + row) * frame.width + x) * 4;
    const dstStart = row * w * 4;
    out.set(frame.data.subarray(srcStart, srcStart + w * 4), dstStart);
  }
  return { data: out, width: w, height: h };
}
function valueChannelFrame(frame) {
  const { data, width, height } = frame;
  const out = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const p = i * 4;
    const v = Math.max(data[p], data[p + 1], data[p + 2]);
    out[p] = v;
    out[p + 1] = v;
    out[p + 2] = v;
    out[p + 3] = 255;
  }
  return { data: out, width, height };
}
function coverResizeGrayMat(cv, srcGray, tmplWidth, tmplHeight) {
  const gray = srcGray;
  const scale = Math.max(tmplWidth / gray.cols, tmplHeight / gray.rows);
  const scaledW = Math.max(tmplWidth, Math.round(gray.cols * scale));
  const scaledH = Math.max(tmplHeight, Math.round(gray.rows * scale));
  const scaled = new cv.Mat();
  cv.resize(gray, scaled, new cv.Size(scaledW, scaledH), 0, 0, cv.INTER_LINEAR);
  return scaled;
}
async function resizeRgbaFrame(frame, targetWidth, targetHeight) {
  const cv = await loadCv();
  const src = cv.matFromImageData({
    data: frame.data,
    width: frame.width,
    height: frame.height
  });
  const dst = new cv.Mat();
  const dsize = new cv.Size(targetWidth, targetHeight);
  cv.resize(src, dst, dsize, 0, 0, cv.INTER_LINEAR);
  const out = matToRgba(dst);
  src.delete();
  dst.delete();
  return out;
}
function matToRgba(mat) {
  const channels = mat.channels();
  const w = mat.cols;
  const h = mat.rows;
  if (channels === 4) {
    return { data: new Uint8Array(mat.data), width: w, height: h };
  }
  const out = new Uint8Array(w * h * 4);
  if (channels === 3) {
    for (let i = 0, j = 0; i < mat.data.length; i += 3, j += 4) {
      out[j] = mat.data[i];
      out[j + 1] = mat.data[i + 1];
      out[j + 2] = mat.data[i + 2];
      out[j + 3] = 255;
    }
  } else if (channels === 1) {
    for (let i = 0, j = 0; i < mat.data.length; i++, j += 4) {
      const g = mat.data[i];
      out[j] = g;
      out[j + 1] = g;
      out[j + 2] = g;
      out[j + 3] = 255;
    }
  }
  return { data: out, width: w, height: h };
}
async function encodePngDataUrl(frame) {
  const { createCanvas } = requireCjs$1("@napi-rs/canvas");
  const canvas = createCanvas(frame.width, frame.height);
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(frame.width, frame.height);
  imageData.data.set(frame.data);
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}
async function preprocessImage(frame, options) {
  const { targetSize, normalize = "0-1", toCHW = true, keepAspectRatio = false, padColor = [0, 0, 0] } = options;
  const [targetWidth, targetHeight] = targetSize;
  let resized;
  if (keepAspectRatio) {
    const cv = await loadCv();
    const src = cv.matFromImageData({
      data: frame.data,
      width: frame.width,
      height: frame.height
    });
    const scale = Math.min(targetWidth / frame.width, targetHeight / frame.height);
    const scaledW = Math.round(frame.width * scale);
    const scaledH = Math.round(frame.height * scale);
    const scaled = new cv.Mat();
    cv.resize(src, scaled, new cv.Size(scaledW, scaledH), 0, 0, cv.INTER_LINEAR);
    const padded = new cv.Mat(targetHeight, targetWidth, cv.CV_8UC4);
    padded.setTo(new cv.Scalar(padColor[0], padColor[1], padColor[2], 255));
    const ox = Math.floor((targetWidth - scaledW) / 2);
    const oy = Math.floor((targetHeight - scaledH) / 2);
    const roi = padded.roi(new cv.Rect(ox, oy, scaledW, scaledH));
    scaled.copyTo(roi);
    roi.delete();
    resized = matToRgba(padded);
    src.delete();
    scaled.delete();
    padded.delete();
  } else {
    resized = await resizeRgbaFrame(frame, targetWidth, targetHeight);
  }
  return normalizeAndConvert(resized, normalize, toCHW);
}
function normalizeAndConvert(frame, normalize = "0-1", toCHW = true) {
  const { width, height, data } = frame;
  const pixelCount = width * height;
  const result = new Float32Array(pixelCount * 3);
  if (toCHW) {
    for (let i = 0; i < pixelCount; i++) {
      const srcIdx = i * 4;
      let r = data[srcIdx];
      let g = data[srcIdx + 1];
      let b = data[srcIdx + 2];
      switch (normalize) {
        case "0-1":
          r /= 255;
          g /= 255;
          b /= 255;
          break;
        case "-1-1":
          r = r / 127.5 - 1;
          g = g / 127.5 - 1;
          b = b / 127.5 - 1;
          break;
        case "imagenet":
          r = (r / 255 - IMAGENET_MEAN[0]) / IMAGENET_STD[0];
          g = (g / 255 - IMAGENET_MEAN[1]) / IMAGENET_STD[1];
          b = (b / 255 - IMAGENET_MEAN[2]) / IMAGENET_STD[2];
          break;
      }
      result[i] = r;
      result[pixelCount + i] = g;
      result[pixelCount * 2 + i] = b;
    }
  } else {
    for (let i = 0; i < pixelCount; i++) {
      const srcIdx = i * 4;
      const dstIdx = i * 3;
      let r = data[srcIdx];
      let g = data[srcIdx + 1];
      let b = data[srcIdx + 2];
      switch (normalize) {
        case "0-1":
          r /= 255;
          g /= 255;
          b /= 255;
          break;
        case "-1-1":
          r = r / 127.5 - 1;
          g = g / 127.5 - 1;
          b = b / 127.5 - 1;
          break;
        case "imagenet":
          r = (r / 255 - IMAGENET_MEAN[0]) / IMAGENET_STD[0];
          g = (g / 255 - IMAGENET_MEAN[1]) / IMAGENET_STD[1];
          b = (b / 255 - IMAGENET_MEAN[2]) / IMAGENET_STD[2];
          break;
      }
      result[dstIdx] = r;
      result[dstIdx + 1] = g;
      result[dstIdx + 2] = b;
    }
  }
  return result;
}
function softmax(logits) {
  const maxLogit = Math.max(...logits);
  const exps = Array.from(logits).map((x) => Math.exp(x - maxLogit));
  const sumExp = exps.reduce((a, b) => a + b, 0);
  return exps.map((x) => x / sumExp);
}
function topK(probabilities, k) {
  return probabilities.map((prob, index) => ({ index, probability: prob })).sort((a, b) => b.probability - a.probability).slice(0, k);
}
function computeRoiFingerprint(frame, cols = 8, rows = 4, channel = "luma") {
  const { data, width, height } = frame;
  const cells = new Float32Array(cols * rows);
  const counts = new Int32Array(cols * rows);
  for (let y = 0; y < height; y++) {
    const cy = Math.min(rows - 1, Math.floor(y * rows / height));
    for (let x = 0; x < width; x++) {
      const cx = Math.min(cols - 1, Math.floor(x * cols / width));
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const intensity = channel === "value" ? Math.max(r, g, b) : 0.299 * r + 0.587 * g + 0.114 * b;
      const cell = cy * cols + cx;
      cells[cell] += intensity;
      counts[cell]++;
    }
  }
  for (let i = 0; i < cells.length; i++) {
    if (counts[i] > 0) cells[i] /= counts[i];
  }
  return cells;
}
function fingerprintChanged(a, b, threshold) {
  if (a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > threshold) return true;
  }
  return false;
}
const requireCjs = module$1.createRequire(__filename);
const ABILITY_MATCH_SCALES = [1, 0.75, 0.62, 0.52, 0.44, 0.37, 0.31];
const MENU_MATCH_SCALES = [1.15, 1, 0.87, 0.75];
const ROLE_MATCH_SCALES = [1, 0.75, 0.52, 0.44];
function sobelMagnitude(cv, gray) {
  const gx = new cv.Mat();
  const gy = new cv.Mat();
  const mag = new cv.Mat();
  cv.Sobel(gray, gx, cv.CV_32F, 1, 0, 3);
  cv.Sobel(gray, gy, cv.CV_32F, 0, 1, 3);
  cv.magnitude(gx, gy, mag);
  gx.delete();
  gy.delete();
  return mag;
}
class TemplateMatcherNode {
  templates = /* @__PURE__ */ new Map();
  async loadTemplate(name, srcPath, scales = ABILITY_MATCH_SCALES) {
    const cv = await loadCv();
    const diskPath = resolveTemplatePath(srcPath);
    const bytes = await fs$1.readFile(diskPath);
    const napiCanvas = requireCjs("@napi-rs/canvas");
    const { loadImage } = napiCanvas;
    const img = await loadImage(bytes);
    const canvas = napiCanvas.createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#1a1a1e";
    ctx.fillRect(0, 0, img.width, img.height);
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    const rgba = new Uint8Array(imageData.data);
    const mat = cv.matFromImageData({ data: rgba, width: img.width, height: img.height });
    const gray = new cv.Mat();
    cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);
    const variants = scales.map((scale) => {
      const vw = Math.max(8, Math.round(img.width * scale));
      const vh = Math.max(8, Math.round(img.height * scale));
      const vgray = new cv.Mat();
      cv.resize(gray, vgray, new cv.Size(vw, vh), 0, 0, scale < 1 ? cv.INTER_AREA : cv.INTER_LINEAR);
      const vgrad = sobelMagnitude(cv, vgray);
      return { width: vw, height: vh, scale, gray: vgray, grad: vgrad };
    });
    this.templates.set(name, { width: img.width, height: img.height, gray, variants });
    mat.delete();
  }
  async loadTemplates(items, concurrency = 8) {
    const results = [];
    const limit = Math.max(1, concurrency);
    for (let i = 0; i < items.length; i += limit) {
      const batch = items.slice(i, i + limit);
      const batchResults = await Promise.allSettled(
        batch.map((t) => this.loadTemplate(t.name, t.src, t.scales))
      );
      results.push(...batchResults);
      const done = Math.min(i + limit, items.length);
      console.error(`[TemplateMatcherNode] progress ${done}/${items.length}`);
    }
    const failed = results.map(
      (r, i) => r.status === "rejected" ? { name: items[i].name, src: items[i].src, reason: r.reason } : null
    ).filter((x) => x !== null);
    if (failed.length > 0) {
      console.warn(
        `[TemplateMatcherNode] ${failed.length} templates failed: ${failed.map((f) => f.name).join(", ")}`
      );
      const first = failed[0];
      const reason = first.reason;
      const message = reason instanceof Error ? reason.stack ?? reason.message : String(reason);
      console.warn(`[TemplateMatcherNode] first failure (${first.name} <- ${first.src}):
${message}`);
    }
  }
  /** 覆盖式等比缩放 ROI（≥模板尺寸）后用 matchTemplate 滑窗，返回 TM_CCOEFF_NORMED 峰值（不过滤阈值） */
  async matchTemplateScore(source, templateName) {
    const tmpl = this.templates.get(templateName);
    if (!tmpl) {
      throw new Error(`模板 "${templateName}" 未加载`);
    }
    const cv = await loadCv();
    if (source.width < 1 || source.height < 1) {
      return 0;
    }
    const srcRgba = cv.matFromImageData({
      data: source.data,
      width: source.width,
      height: source.height
    });
    const srcGray = new cv.Mat();
    cv.cvtColor(srcRgba, srcGray, cv.COLOR_RGBA2GRAY);
    srcRgba.delete();
    const fitted = coverResizeGrayMat(cv, srcGray, tmpl.width, tmpl.height);
    srcGray.delete();
    const result = new cv.Mat();
    cv.matchTemplate(fitted, tmpl.gray, result, cv.TM_CCOEFF_NORMED);
    const minMax = cv.minMaxLoc(result);
    fitted.delete();
    result.delete();
    const score = minMax.maxVal;
    return typeof score === "number" && Number.isFinite(score) ? score : 0;
  }
  /**
   * 多尺度技能图标匹配：源保持原始裁剪尺寸，用一系列等比缩小的模板在其上滑窗取 NCC 峰值。
   * 解决「模板图标填满 64×64，而 HUD 实拍图标偏小且带留白」的尺度问题；并在**梯度幅值**上
   * 比对（见 sobelMagnitude），规避模板与实拍明暗极性相反导致的负相关塌缩。
   * 返回峰值分数与命中的缩放档（用于诊断实际匹配尺度）。
   */
  async matchTemplateScoreMultiScale(source, templateName) {
    const srcGrad = await this.prepareSourceGradient(source);
    if (!srcGrad) return { score: 0, scale: 0 };
    try {
      return await this.matchTemplateScoreMultiScaleWithSource(srcGrad, templateName);
    } finally {
      this.releaseSourceGradient(srcGrad);
    }
  }
  /**
   * 预计算源 ROI 的灰度 + Sobel 梯度幅值，供同一 ROI 对多个英雄模板复用。
   * 返回的句柄持有 cv.Mat，使用完必须调用 releaseSourceGradient 释放，否则泄漏。
   */
  async prepareSourceGradient(source, targetSize) {
    if (source.width < 1 || source.height < 1) return null;
    const cv = await loadCv();
    const srcRgba = cv.matFromImageData({
      data: source.data,
      width: source.width,
      height: source.height
    });
    let srcGray = new cv.Mat();
    cv.cvtColor(srcRgba, srcGray, cv.COLOR_RGBA2GRAY);
    srcRgba.delete();
    if (targetSize && targetSize.width >= 1 && targetSize.height >= 1 && (srcGray.cols !== targetSize.width || srcGray.rows !== targetSize.height)) {
      const resized = new cv.Mat();
      const shrinking = targetSize.width * targetSize.height < srcGray.cols * srcGray.rows;
      cv.resize(
        srcGray,
        resized,
        new cv.Size(targetSize.width, targetSize.height),
        0,
        0,
        shrinking ? cv.INTER_AREA : cv.INTER_LINEAR
      );
      srcGray.delete();
      srcGray = resized;
    }
    const gradNative = sobelMagnitude(cv, srcGray);
    const dims = srcGray;
    return { gray: srcGray, gradNative, cols: dims.cols, rows: dims.rows };
  }
  releaseSourceGradient(handle) {
    if (!handle) return;
    handle.gray?.delete?.();
    handle.gradNative?.delete?.();
  }
  /**
   * 用预计算的源梯度（prepareSourceGradient）对单个模板做多尺度匹配。
   * 与 matchTemplateScoreMultiScale 等价，但源侧灰度/梯度已复用，避免逐英雄重复计算。
   */
  async matchTemplateScoreMultiScaleWithSource(srcGrad, templateName) {
    const tmpl = this.templates.get(templateName);
    if (!tmpl) {
      throw new Error(`模板 "${templateName}" 未加载`);
    }
    const cv = await loadCv();
    let best = -1;
    let bestScale = 0;
    for (const v of tmpl.variants) {
      let srcGradMat = srcGrad.gradNative;
      let temp = null;
      if (srcGrad.cols < v.width || srcGrad.rows < v.height) {
        const s = Math.max(v.width / srcGrad.cols, v.height / srcGrad.rows);
        const w = Math.max(v.width, Math.round(srcGrad.cols * s));
        const h = Math.max(v.height, Math.round(srcGrad.rows * s));
        const enlarged = new cv.Mat();
        cv.resize(srcGrad.gray, enlarged, new cv.Size(w, h), 0, 0, cv.INTER_LINEAR);
        srcGradMat = sobelMagnitude(cv, enlarged);
        enlarged.delete();
        temp = srcGradMat;
      }
      const result = new cv.Mat();
      cv.matchTemplate(srcGradMat, v.grad, result, cv.TM_CCOEFF_NORMED);
      const minMax = cv.minMaxLoc(result);
      result.delete();
      if (temp) temp.delete();
      const score = minMax.maxVal;
      if (typeof score === "number" && Number.isFinite(score) && score > best) {
        best = score;
        bestScale = v.scale;
      }
    }
    return { score: best < 0 ? 0 : best, scale: bestScale };
  }
  async matchTemplate(source, templateName, options = {}) {
    const threshold = options.threshold ?? 0.8;
    const maxResults = options.maxResults ?? 10;
    const confidence = await this.matchTemplateScore(source, templateName);
    if (confidence < threshold) {
      return [];
    }
    return [
      {
        x: 0,
        y: 0,
        confidence,
        templateName
      }
    ].slice(0, maxResults);
  }
  /** 用 jett C 模板自匹配，正常应 >0.9；过低说明 OpenCV 灰度/尺寸链路异常 */
  async runSelfTest() {
    const name = "ability_jett_C";
    if (!this.templates.has(name)) return -1;
    const diskPath = resolveTemplatePath("templates/valorant/hero/jett/1.png");
    const bytes = await fs$1.readFile(diskPath);
    const napiCanvas = requireCjs("@napi-rs/canvas");
    const img = await napiCanvas.loadImage(bytes);
    const canvas = napiCanvas.createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#1a1a1e";
    ctx.fillRect(0, 0, img.width, img.height);
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, img.width, img.height);
    return this.matchTemplateScore(
      { data: new Uint8Array(data), width: img.width, height: img.height },
      name
    );
  }
  clearCache() {
    for (const tmpl of this.templates.values()) {
      tmpl.gray?.delete?.();
      for (const v of tmpl.variants) {
        v.gray?.delete?.();
        v.grad?.delete?.();
      }
    }
    this.templates.clear();
  }
  getLoadedTemplates() {
    return Array.from(this.templates.keys());
  }
}
const templateMatcherNode = new TemplateMatcherNode();
function hpClassIndexToDigit(classIndex) {
  if (classIndex === 0) return null;
  if (classIndex >= 1 && classIndex <= 9) return classIndex;
  if (classIndex === 10) return 0;
  return null;
}
function formatHpClassLabel(classIndex) {
  if (classIndex === 0) return "空";
  if (classIndex >= 1 && classIndex <= 9) return String(classIndex);
  if (classIndex === 10) return "0";
  return `?${classIndex}`;
}
function parseHpDigitsFromSlots(slots) {
  const digits = [];
  for (const s of slots) {
    if (s.digit !== null) digits.push(s.digit);
  }
  let hp = 0;
  for (const d of digits) {
    hp = hp * 10 + d;
  }
  return hp;
}
function parseHpFromOcrText(text) {
  const digits = text.replace(/\D/g, "");
  if (digits.length === 0) return null;
  const hp = Number.parseInt(digits, 10);
  if (!Number.isFinite(hp) || hp < 0 || hp > 150) return null;
  return hp;
}
function shouldTryHpOcrFallback(slots, e2eHp) {
  if (slots.length === 0) return true;
  const filled = slots.filter((s) => s.digit !== null);
  if (filled.length <= 1 && e2eHp <= 9) return true;
  const d2Empty = slots.find((s) => s.slot === "d2")?.classIndex === 0;
  const d3Empty = slots.find((s) => s.slot === "d3")?.classIndex === 0;
  if (filled.length === 1 && d2Empty && d3Empty && e2eHp <= 9) return true;
  return false;
}
function shouldPublishE2eHp(slots, e2eHp) {
  if (!Number.isFinite(e2eHp) || e2eHp <= 0 || e2eHp > 150) return false;
  return !shouldTryHpOcrFallback(slots, e2eHp);
}
const HP_OCR_MIN_CONFIDENCE = 0.6;
function shouldAdoptOcrHp(ocrHp, ocrConfidence, minConfidence = HP_OCR_MIN_CONFIDENCE) {
  if (ocrHp === null) return false;
  return ocrConfidence >= minConfidence;
}
class OnnxEngineNode {
  models = /* @__PURE__ */ new Map();
  async loadModel(config) {
    if (this.models.has(config.id)) return;
    const modelPath = resolveModelPath(config.path);
    const intraOpNumThreads = Math.max(2, Math.min(4, os__namespace.cpus().length - 1));
    const session = await ort__namespace.InferenceSession.create(modelPath, {
      executionProviders: ["cpu"],
      graphOptimizationLevel: "all",
      intraOpNumThreads,
      executionMode: "sequential"
    });
    let labels;
    if (config.custom?.ocrCharset === "ppocr" && config.labelsPath) {
      labels = await this.loadPpocrCharset(config.labelsPath);
    } else if (config.labelsPath) {
      labels = await this.loadLabels(config.labelsPath);
    }
    this.models.set(config.id, { session, config, labels });
    console.log(`[OnnxEngineNode] loaded ${config.id}`);
  }
  async loadLabels(labelsPath) {
    const path2 = resolveModelPath(labelsPath);
    const text = await fs$1.readFile(path2, "utf-8");
    return text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
  }
  async loadPpocrCharset(labelsPath) {
    const path2 = resolveModelPath(labelsPath);
    const text = await fs$1.readFile(path2, "utf-8");
    const lines = text.split("\n").map((l) => l.replace(/\r$/, ""));
    if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    return ["", ...lines, " "];
  }
  async infer(modelId, input) {
    const model = this.models.get(modelId);
    if (!model) {
      return this.createErrorResult(modelId, `模型 ${modelId} 未加载`);
    }
    const startTime = performance.now();
    try {
      const inputTensor = await this.prepareInput(input, model.config);
      const inputName = model.session.inputNames[0];
      const feeds = { [inputName]: inputTensor };
      const results = await model.session.run(feeds);
      const inferenceTime = performance.now() - startTime;
      return this.parseOutput(results, model, inferenceTime);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return this.createErrorResult(modelId, errMsg);
    }
  }
  async prepareInput(input, config) {
    if (input instanceof Float32Array) {
      const tensorShape2 = config.actualInputShape ?? config.inputShape;
      return new ort__namespace.Tensor("float32", input, tensorShape2);
    }
    const [, channels, height, cfgWidth] = config.inputNHWC ? [config.inputShape[0], config.inputShape[3], config.inputShape[1], config.inputShape[2]] : config.inputShape;
    const custom = config.custom ?? {};
    const dynamicWidth = custom.dynamicWidth === true;
    let width = cfgWidth;
    if (dynamicWidth) {
      const minW = custom.minWidth ?? 16;
      const maxW = custom.maxWidth ?? 512;
      width = Math.min(maxW, Math.max(minW, Math.round(height * (input.width / input.height))));
    }
    let data = await preprocessImage(input, {
      targetSize: [width, height],
      normalize: config.normalize || "0-1",
      toCHW: !config.inputNHWC,
      keepAspectRatio: !dynamicWidth && custom.keepAspectRatio === true,
      padColor: custom.padColor ?? [0, 0, 0]
    });
    if (channels === 1 && data.length > 0) {
      const pixelCount = height * width;
      const grayscale = new Float32Array(pixelCount);
      for (let i = 0; i < pixelCount; i++) {
        grayscale[i] = 0.299 * data[i] + 0.587 * data[pixelCount + i] + 0.114 * data[pixelCount * 2 + i];
      }
      data = grayscale;
    }
    const tensorShape = dynamicWidth ? config.inputNHWC ? [1, height, width, channels] : [1, channels, height, width] : config.actualInputShape ?? config.inputShape;
    return new ort__namespace.Tensor("float32", data, tensorShape);
  }
  parseOutput(results, model, inferenceTime) {
    const outputName = model.session.outputNames[0];
    const output = results[outputName];
    let data = output.data;
    const dims = output.dims;
    const batchSize = dims[0] ?? 1;
    if (batchSize > 1 && dims.length > 1) {
      const batchElements = Math.floor(data.length / batchSize);
      data = data.slice(0, batchElements);
    }
    switch (model.config.outputType) {
      case "ocr":
        return this.parseOCR(results, model, inferenceTime);
      case "features":
        return this.parseFeatures(results, model, inferenceTime);
      case "hp_digits":
        return this.parseHpDigits(results, model, inferenceTime);
      default:
        return this.parseClassification(data, model, inferenceTime);
    }
  }
  parseClassification(data, model, inferenceTime) {
    const probabilities = softmax(data);
    const top = topK(probabilities, 1)[0];
    return {
      type: "classification",
      modelId: model.config.id,
      inferenceTime,
      success: true,
      classIndex: top.index,
      label: model.labels?.[top.index] || `class_${top.index}`,
      confidence: top.probability,
      probabilities
    };
  }
  parseFeatures(results, model, inferenceTime) {
    const outputName = model.session.outputNames[0];
    const output = results[outputName];
    const values = output.data;
    return {
      type: "features",
      modelId: model.config.id,
      inferenceTime,
      success: true,
      values: values.slice()
    };
  }
  parseHpDigits(results, model, inferenceTime) {
    const digitNames = ["d1", "d2", "d3"];
    const slots = [];
    const digits = [];
    for (const name of digitNames) {
      const tensor = results[name];
      if (!tensor) continue;
      const d = tensor.data;
      let maxIdx = 0;
      let maxVal = -Infinity;
      for (let i = 0; i < d.length; i++) {
        if (d[i] > maxVal) {
          maxVal = d[i];
          maxIdx = i;
        }
      }
      const digit = hpClassIndexToDigit(maxIdx);
      slots.push({ slot: name, classIndex: maxIdx, digit });
      if (digit !== null) digits.push(digit);
    }
    const hp = parseHpDigitsFromSlots(slots);
    return {
      type: "hp_digits",
      modelId: model.config.id,
      inferenceTime,
      success: true,
      hp,
      digits,
      slots
    };
  }
  parseOCR(results, model, inferenceTime) {
    const outputName = model.session.outputNames[0];
    const output = results[outputName];
    const data = output.data;
    const dims = output.dims;
    const numClasses = dims[dims.length - 1];
    const timeSteps = dims.length >= 2 ? dims[dims.length - 2] : Math.floor(data.length / numClasses);
    const charList = model.labels || [];
    const alreadySoftmax = model.config.custom?.alreadySoftmax === true;
    let text = "";
    let prevIdx = -1;
    let totalConfidence = 0;
    let charCount = 0;
    for (let t = 0; t < timeSteps; t++) {
      const base = t * numClasses;
      let maxProb = -Infinity;
      let maxIdx = 0;
      for (let c = 0; c < numClasses; c++) {
        const prob = data[base + c];
        if (prob > maxProb) {
          maxProb = prob;
          maxIdx = c;
        }
      }
      if (maxIdx !== prevIdx && maxIdx !== 0) {
        const char = charList[maxIdx] || "";
        if (char) {
          text += char;
          totalConfidence += alreadySoftmax ? maxProb : Math.exp(maxProb);
          charCount++;
        }
      }
      prevIdx = maxIdx;
    }
    return {
      type: "ocr",
      modelId: model.config.id,
      inferenceTime,
      success: true,
      text: text.trim(),
      confidence: charCount > 0 ? totalConfidence / charCount : 0
    };
  }
  createErrorResult(modelId, error) {
    return {
      type: "classification",
      modelId,
      inferenceTime: 0,
      success: false,
      error,
      classIndex: -1,
      label: "",
      confidence: 0,
      probabilities: []
    };
  }
  unload(modelId) {
    if (modelId) {
      this.models.delete(modelId);
    } else {
      this.models.clear();
    }
  }
  isLoaded(modelId) {
    return this.models.has(modelId);
  }
  getLoadedModels() {
    return Array.from(this.models.keys());
  }
}
const onnxEngineNode = new OnnxEngineNode();
async function detectSkillHudGate(frame, frameWidth, frameHeight) {
  const roi = letterbox.mapPixelRect(letterbox.getSkillHudGatePixelRect(), frameWidth, frameHeight);
  const crop = cropRgbaFrame(frame, roi);
  if (crop.width < 4 || crop.height < 4) {
    return { visible: false, edgeRatio: 0 };
  }
  const cv = await loadCv();
  const src = cv.matFromImageData({
    data: crop.data,
    width: crop.width,
    height: crop.height
  });
  const gray = new cv.Mat();
  const edges = new cv.Mat();
  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.Canny(
      gray,
      edges,
      letterbox.VALORANT_SKILL_HUD_GATE.cannyLow,
      letterbox.VALORANT_SKILL_HUD_GATE.cannyHigh,
      letterbox.VALORANT_SKILL_HUD_GATE.cannyAperture,
      false
    );
    const nonZero = cv.countNonZero(edges);
    const area = crop.width * crop.height;
    const edgeRatio = area > 0 ? nonZero / area : 0;
    return {
      visible: edgeRatio > letterbox.VALORANT_SKILL_HUD_GATE.edgeRatioThreshold,
      edgeRatio
    };
  } finally {
    src.delete();
    gray.delete();
    edges.delete();
  }
}
class ValorantKillDetector {
  /** 当前是否判定为「横幅存在」（迟滞状态机） */
  present = false;
  /** 连续达 enterThreshold 的帧数，用于确认进入 present */
  enterStreak = 0;
  lastTriggerAt = 0;
  lastScore = 0;
  /** @returns 本帧是否应触发一次击杀（仅在 absent→present 上升沿、且过冷却时为 true） */
  process(feature) {
    const score = feature.length > 0 ? feature[0] : 0;
    this.lastScore = score;
    if (this.present) {
      if (score < letterbox.VALORANT_KILL_CONFIG.exitThreshold) {
        this.present = false;
        this.enterStreak = 0;
      }
      return false;
    }
    if (score >= letterbox.VALORANT_KILL_CONFIG.enterThreshold) {
      this.enterStreak++;
    } else {
      this.enterStreak = 0;
      return false;
    }
    if (this.enterStreak < letterbox.VALORANT_KILL_CONFIG.enterFrames) {
      return false;
    }
    this.present = true;
    this.enterStreak = 0;
    const now = Date.now();
    if (now - this.lastTriggerAt >= letterbox.VALORANT_KILL_CONFIG.cooldownMs) {
      this.lastTriggerAt = now;
      return true;
    }
    return false;
  }
  reset() {
    this.present = false;
    this.enterStreak = 0;
    this.lastTriggerAt = 0;
    this.lastScore = 0;
  }
  /** 最近一帧的原始 logit，供服务层打印标定日志 */
  get debugScore() {
    return this.lastScore;
  }
  /** 当前迟滞状态：横幅是否判定为存在 */
  get bannerPresent() {
    return this.present;
  }
}
class ValorantWinDetector {
  present = false;
  enterStreak = 0;
  lastTriggerAt = 0;
  lastScore = 0;
  config;
  constructor(config = letterbox.VALORANT_WIN_CONFIG) {
    this.config = config;
  }
  /** @returns 本帧是否应触发一次（absent→present 上升沿且过冷却） */
  process(score) {
    this.lastScore = score;
    if (this.present) {
      if (score < this.config.exitThreshold) {
        this.present = false;
        this.enterStreak = 0;
      }
      return false;
    }
    if (score >= this.config.enterThreshold) {
      this.enterStreak++;
    } else {
      this.enterStreak = 0;
      return false;
    }
    if (this.enterStreak < this.config.enterFrames) {
      return false;
    }
    this.present = true;
    this.enterStreak = 0;
    const now = Date.now();
    if (now - this.lastTriggerAt >= this.config.cooldownMs) {
      this.lastTriggerAt = now;
      return true;
    }
    return false;
  }
  reset() {
    this.present = false;
    this.enterStreak = 0;
    this.lastTriggerAt = 0;
    this.lastScore = 0;
  }
  /** 最近一帧的原始分数，供服务层打印标定日志 */
  get debugScore() {
    return this.lastScore;
  }
  /** 当前迟滞状态：胜利横幅是否判定为存在 */
  get bannerPresent() {
    return this.present;
  }
}
const HP_ROI_CHANGE_THRESHOLD = 8;
const HP_OCR_FORCE_INTERVAL = 30;
const WIN_ROI_CHANGE_THRESHOLD = 8;
const WIN_OCR_FORCE_INTERVAL = 60;
function matchesWinKeyword(text) {
  if (!text) return false;
  const norm = text.replace(/\s+/g, "").toUpperCase();
  return letterbox.VALORANT_WIN_CONFIG.winKeywords.some((kw) => norm.includes(kw.toUpperCase()));
}
function matchesDefeatKeyword(text) {
  if (!text) return false;
  const norm = text.replace(/\s+/g, "").toUpperCase();
  return letterbox.VALORANT_DEFEAT_CONFIG.defeatKeywords.some((kw) => norm.includes(kw.toUpperCase()));
}
const HERO_DISCOVERY_INTERVAL = 3;
const HERO_CONFIRM_INTERVAL = 45;
const AGENT_SELECT_INGAME_INTERVAL = 20;
const HERO_CONFIRM_MAX_FAIL = 3;
function magnifyRgba(img, factor) {
  const w = img.width * factor;
  const h = img.height * factor;
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = Math.floor(y / factor);
    for (let x = 0; x < w; x++) {
      const sx = Math.floor(x / factor);
      const si = (sy * img.width + sx) * 4;
      const di = (y * w + x) * 4;
      out[di] = img.data[si];
      out[di + 1] = img.data[si + 1];
      out[di + 2] = img.data[si + 2];
      out[di + 3] = img.data[si + 3];
    }
  }
  return { data: out, width: w, height: h };
}
class ValorantRecognitionService {
  constructor(emit2) {
    this.emit = emit2;
  }
  options = {};
  manualHero = null;
  autoDetectHero = true;
  autoDetectedHero = null;
  frameIndex = 0;
  killDetector = new ValorantKillDetector();
  winDetector = new ValorantWinDetector();
  /** 失败检测：复用同一套迟滞状态机，注入失败阈值配置（结算区与胜利同一块，故复用同一次 OCR） */
  defeatDetector = new ValorantWinDetector(letterbox.VALORANT_DEFEAT_CONFIG);
  /** 胜利结算区 OCR 降频：缓存上次跑 OCR 时的 ROI 灰度指纹，画面未变则跳过 */
  lastWinFingerprint = null;
  /**
   * 上次 OCR 有文本但未命中胜/负关键词：不锁指纹，下帧继续推理。
   * 避免横幅淡入首帧误读后 fingerprint 被锁死、最多等 WIN_OCR_FORCE_INTERVAL 才重试（败北比获胜更易首帧漏读）。
   */
  bannerOcrPending = false;
  previousAbilityCharges = /* @__PURE__ */ new Map();
  /** 每键充能状态去抖：连续 confirmFrames 帧一致才提交，过滤手臂扫过技能区的单帧误判（见 stabilizeAbility） */
  abilityStabilizer = /* @__PURE__ */ new Map();
  aiEnabled = false;
  lowHealthThreshold = 30;
  lastLowHealthFlashAt = 0;
  // private lastDamageHp: number | null = null
  // private lastDamageAt = 0
  showCroppedImages = false;
  /** 预览（roi-cropped）限频时间戳：预览编码（~11×PNG/帧）很重，降到 ~5fps 以免拖慢识别帧率 */
  lastPreviewAt = 0;
  initialized = false;
  templatesReady = false;
  pendingHeroScan = false;
  /** 已锁定英雄后连续复核失败计数；达 HERO_CONFIRM_MAX_FAIL 解锁重扫 */
  heroConfirmFailStreak = 0;
  skillHudVisible = true;
  skillHudGateStreak = 0;
  agentSelect = false;
  agentSelectStreak = 0;
  lastHeroDetectDebug = null;
  /** 临时诊断：一次性把实时 ROI 裁剪落盘，供离线分析英雄判别 */
  liveCropsDumped = false;
  /** HP OCR 降频：缓存上次跑 OCR 时的 ROI 灰度指纹与采纳结果，画面未变则跳过 OCR 复用 */
  lastHpFingerprint = null;
  lastOcrText = void 0;
  lastOcrHp = null;
  lastOcrAdopted = false;
  lastOcrConfidence = void 0;
  /** 菜单态冻结血量用：缓存正常对局最后一帧的 HP 快照，菜单遮挡血量区时复用，避免读乱值跳变 */
  lastHpSnapshot = null;
  async initialize(options = {}) {
    this.options = options;
    this.lowHealthThreshold = options.lowHealthThreshold ?? 30;
    this.showCroppedImages = options.showCroppedImages ?? false;
    console.error("[svc] loadCv start");
    await loadCv();
    console.error("[svc] loadCv done");
    if (options.enableAI !== false) {
      console.error("[svc] onnx start");
      const results = await Promise.allSettled(
        letterbox.VALORANT_MODEL_CONFIGS.map((cfg) => onnxEngineNode.loadModel(cfg))
      );
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          const id = letterbox.VALORANT_MODEL_CONFIGS[i]?.id ?? `#${i}`;
          console.error(`[svc] onnx load failed: ${id}:`, r.reason);
        }
      });
      this.aiEnabled = onnxEngineNode.getLoadedModels().length > 0;
      console.error("[svc] onnx done", onnxEngineNode.getLoadedModels());
    }
    this.initialized = true;
    console.error("[svc] core init done, aiEnabled=", this.aiEnabled);
    if (options.enableTemplateMatch !== false) {
      void this.loadTemplatesInBackground();
    } else {
      this.templatesReady = true;
    }
  }
  async loadTemplatesInBackground() {
    console.error("[svc] templates start (background)");
    const templates = [];
    const base = letterbox.VALORANT_ADAPTER.templateBasePath;
    for (const hero of letterbox.VALORANT_HEROES) {
      for (const ability of hero.abilities) {
        if (ability.iconPath) {
          templates.push({
            name: `ability_${hero.id}_${ability.key}`,
            src: `${base}/${ability.iconPath}`
          });
        }
      }
    }
    for (const icon of letterbox.VALORANT_MENU_ICONS.icons) {
      if (fs.existsSync(resolveTemplatePath(icon.templatePath))) {
        templates.push({ name: icon.name, src: icon.templatePath, scales: MENU_MATCH_SCALES });
      } else {
        console.warn(`[svc] skip missing menu icon template: ${icon.templatePath}`);
      }
    }
    for (const icon of letterbox.VALORANT_AGENT_SELECT_ICONS.icons) {
      if (fs.existsSync(resolveTemplatePath(icon.templatePath))) {
        templates.push({ name: icon.name, src: icon.templatePath, scales: ROLE_MATCH_SCALES });
      } else {
        console.warn(`[svc] skip missing agent-select role template: ${icon.templatePath}`);
      }
    }
    try {
      await templateMatcherNode.loadTemplates(templates);
      const selfTest = await templateMatcherNode.runSelfTest();
      console.error(
        "[svc] templates done",
        templateMatcherNode.getLoadedTemplates().length,
        "selfTest(jett C)=",
        selfTest.toFixed(3)
      );
      if (selfTest < 0.5) {
        console.warn(
          "[svc] template self-test score low — hero matching may fail; check opencv / template paths"
        );
      }
    } catch (error) {
      console.error(
        "[svc] templates failed",
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      this.templatesReady = true;
      this.pendingHeroScan = true;
    }
  }
  getLoadedModels() {
    return this.aiEnabled ? onnxEngineNode.getLoadedModels() : [];
  }
  setManualHero(hero) {
    this.manualHero = hero;
    this.autoDetectedHero = null;
    this.resetAbilityState();
  }
  setAutoDetectHero(enabled) {
    this.autoDetectHero = enabled;
    if (!enabled) this.autoDetectedHero = null;
  }
  setLowHealthThreshold(percent) {
    this.lowHealthThreshold = percent;
  }
  updateConfig(options) {
    this.options = { ...this.options, ...options };
    if (options.lowHealthThreshold !== void 0) {
      this.lowHealthThreshold = options.lowHealthThreshold;
    }
    if (options.showCroppedImages !== void 0) {
      this.showCroppedImages = options.showCroppedImages;
    }
  }
  async processFrame(frame) {
    if (!this.initialized) return;
    const start = performance.now();
    const gameState = await this.processValorantFrame(frame);
    this.detectAbilityReleases(gameState);
    this.emit({ type: "state", state: gameState });
    this.emit({ type: "frame-timing", ms: performance.now() - start });
  }
  /** 连续 stableFrames 帧一致才切换门控，避免菜单切换时闪烁 */
  applySkillHudGate(rawVisible) {
    if (rawVisible === this.skillHudVisible) {
      this.skillHudGateStreak = 0;
      return this.skillHudVisible;
    }
    this.skillHudGateStreak += 1;
    if (this.skillHudGateStreak >= letterbox.VALORANT_SKILL_HUD_GATE.stableFrames) {
      const wasVisible = this.skillHudVisible;
      this.skillHudVisible = rawVisible;
      this.skillHudGateStreak = 0;
      if (wasVisible && !rawVisible) {
        this.resetAbilityState();
        this.autoDetectedHero = null;
        this.agentSelect = false;
        this.agentSelectStreak = 0;
        this.killDetector.reset();
        this.winDetector.reset();
        this.defeatDetector.reset();
        this.lastWinFingerprint = null;
        this.bannerOcrPending = false;
      }
    }
    return this.skillHudVisible;
  }
  mapAbilityRoi(abilityPos, frameWidth, frameHeight) {
    return letterbox.mapRelativeRect(abilityPos, frameWidth, frameHeight);
  }
  async processValorantFrame(frame) {
    this.frameIndex++;
    const frameWidth = frame.width;
    const frameHeight = frame.height;
    let skillHudVisible = true;
    let skillHudEdgeRatio;
    let menuOpen = false;
    if (this.options.enableSkillHudGate !== false) {
      const gate = await detectSkillHudGate(frame, frameWidth, frameHeight);
      skillHudEdgeRatio = gate.edgeRatio;
      if (!gate.visible && this.options.enableMenuHold !== false && this.templatesReady && (this.manualHero !== null || this.autoDetectedHero !== null)) {
        menuOpen = await this.detectMenuOpen(frame, frameWidth, frameHeight);
      }
      skillHudVisible = menuOpen ? this.skillHudVisible : this.applySkillHudGate(gate.visible);
      if (this.frameIndex % 45 === 1) {
        console.error(
          `[svc] skillHud edgeRatio=${gate.edgeRatio.toFixed(3)} gate=${skillHudVisible}${menuOpen ? " menuHold" : ""}`
        );
      }
    }
    let agentSelect = this.agentSelect;
    if (skillHudVisible && !menuOpen && this.templatesReady) {
      const inRound = this.autoDetectedHero !== null && !this.agentSelect;
      const mustCheck = !inRound || this.frameIndex % AGENT_SELECT_INGAME_INTERVAL === 0;
      if (mustCheck) {
        const rawAgentSelect = await this.detectAgentSelect(frame, frameWidth, frameHeight);
        agentSelect = this.applyAgentSelectGate(rawAgentSelect);
      }
    } else {
      this.agentSelect = false;
      this.agentSelectStreak = 0;
      agentSelect = false;
    }
    if (agentSelect && this.autoDetectedHero) {
      this.resetAbilityState();
      this.autoDetectedHero = null;
      this.heroConfirmFailStreak = 0;
    }
    let hero = agentSelect ? this.manualHero : this.manualHero ?? (skillHudVisible || menuOpen ? this.autoDetectedHero : null);
    if (!agentSelect && !menuOpen && skillHudVisible && !this.manualHero && this.autoDetectHero) {
      const locked = this.autoDetectedHero;
      if (!locked) {
        if (this.pendingHeroScan || this.frameIndex % HERO_DISCOVERY_INTERVAL === 0) {
          this.pendingHeroScan = false;
          const detected = await this.recognizeHero(frame, frameWidth, frameHeight);
          if (detected) {
            this.emit({ type: "hero-detected", hero: detected });
            this.autoDetectedHero = detected;
            this.heroConfirmFailStreak = 0;
            hero = detected;
          }
        }
      } else if (this.frameIndex % HERO_CONFIRM_INTERVAL === 0) {
        const detected = await this.recognizeHero(frame, frameWidth, frameHeight);
        if (detected) {
          this.heroConfirmFailStreak = 0;
          if (detected.id !== locked.id) {
            this.resetAbilityState();
            this.emit({ type: "hero-detected", hero: detected });
            this.autoDetectedHero = detected;
            hero = detected;
          }
        } else if (++this.heroConfirmFailStreak >= HERO_CONFIRM_MAX_FAIL) {
          this.autoDetectedHero = null;
          this.heroConfirmFailStreak = 0;
          this.pendingHeroScan = true;
          hero = null;
        }
      }
    }
    const abilities = !agentSelect && !menuOpen && skillHudVisible && hero ? this.recognizeAbilities(frame, frameWidth, frameHeight, hero) : [];
    const gameState = {
      hero,
      abilities,
      timestamp: Date.now(),
      confidence: hero ? 0.7 + abilities.length * 0.05 : 0,
      skillHudVisible,
      skillHudEdgeRatio,
      menuOpen,
      agentSelect,
      heroDetectDebug: this.lastHeroDetectDebug ?? void 0
    };
    if (this.aiEnabled) {
      if (skillHudVisible && !menuOpen && !agentSelect && hero) {
        await this.runValorantOnnx(frame, frameWidth, frameHeight, gameState);
        if (gameState.healthPercent !== void 0) {
          this.lastHpSnapshot = {
            healthPercent: gameState.healthPercent,
            hpSource: gameState.hpSource,
            hpDigitSlots: gameState.hpDigitSlots,
            hpOcrText: gameState.hpOcrText,
            hpOcrConfidence: gameState.hpOcrConfidence,
            hpOcrAdopted: gameState.hpOcrAdopted
          };
        } else if (this.lastHpSnapshot) {
          gameState.healthPercent = this.lastHpSnapshot.healthPercent;
          gameState.hpSource = this.lastHpSnapshot.hpSource;
          gameState.hpDigitSlots = this.lastHpSnapshot.hpDigitSlots;
          gameState.hpOcrText = this.lastHpSnapshot.hpOcrText;
          gameState.hpOcrConfidence = this.lastHpSnapshot.hpOcrConfidence;
          gameState.hpOcrAdopted = this.lastHpSnapshot.hpOcrAdopted;
        }
      } else if (menuOpen && this.lastHpSnapshot) {
        gameState.healthPercent = this.lastHpSnapshot.healthPercent;
        gameState.hpSource = this.lastHpSnapshot.hpSource;
        gameState.hpDigitSlots = this.lastHpSnapshot.hpDigitSlots;
        gameState.hpOcrText = this.lastHpSnapshot.hpOcrText;
        gameState.hpOcrConfidence = this.lastHpSnapshot.hpOcrConfidence;
        gameState.hpOcrAdopted = this.lastHpSnapshot.hpOcrAdopted;
      } else {
        this.lastHpSnapshot = null;
        this.lastHpFingerprint = null;
        this.lastOcrText = void 0;
        this.lastOcrHp = null;
        this.lastOcrAdopted = false;
        this.lastOcrConfidence = void 0;
        this.killDetector.reset();
      }
      await this.runSettlementOcr(frame, frameWidth, frameHeight);
    }
    if (this.showCroppedImages) {
      const now = Date.now();
      if (now - this.lastPreviewAt >= 200) {
        this.lastPreviewAt = now;
        const cropped = await this.collectRoiImages(frame, frameWidth, frameHeight, hero);
        if (cropped.length > 0) {
          this.emit({ type: "roi-cropped", images: cropped });
        }
      }
      if (!this.liveCropsDumped && this.frameIndex > 60 && skillHudVisible && (skillHudEdgeRatio ?? 0) > 0.03) {
        void this.dumpLiveCropsOnce(frame, frameWidth, frameHeight);
      }
      if (skillHudVisible && (skillHudEdgeRatio ?? 0) > 0.03 && this.frameIndex % 20 === 0) {
        void this.dumpEnergyDiag(frame, frameWidth, frameHeight);
      }
    }
    return gameState;
  }
  async runValorantOnnx(frame, frameWidth, frameHeight, gameState) {
    const loaded = onnxEngineNode.getLoadedModels();
    if (loaded.includes("valorantHp")) {
      const hpRoi = letterbox.mapPixelRect(letterbox.VALORANT_HP_CONFIG.area, frameWidth, frameHeight);
      const hpCrop = cropRgbaFrame(frame, hpRoi);
      const hpResult = await onnxEngineNode.infer("valorantHp", hpCrop);
      if (hpResult.success && hpResult.type === "hp_digits") {
        const e2e = hpResult;
        gameState.hpDigitSlots = e2e.slots.map((s) => ({
          slot: s.slot,
          classIndex: s.classIndex,
          label: formatHpClassLabel(s.classIndex),
          digit: s.digit
        }));
        let hp;
        let hpSource;
        if (this.options.enableOCR !== false && loaded.includes("valorantOcr")) {
          const fp = computeRoiFingerprint(hpCrop);
          const mustRun = this.lastHpFingerprint === null || this.frameIndex % HP_OCR_FORCE_INTERVAL === 0 || fingerprintChanged(this.lastHpFingerprint, fp, HP_ROI_CHANGE_THRESHOLD);
          if (mustRun) {
            const ocrResult = await onnxEngineNode.infer("valorantOcr", hpCrop);
            if (ocrResult.success && ocrResult.type === "ocr") {
              const ocr = ocrResult;
              const ocrHp = parseHpFromOcrText(ocr.text);
              const adopted = ocrHp !== null && shouldAdoptOcrHp(ocrHp, ocr.confidence, this.options.ocrConfidenceThreshold);
              this.lastHpFingerprint = fp;
              this.lastOcrText = ocr.text;
              this.lastOcrHp = ocrHp;
              this.lastOcrAdopted = adopted;
              this.lastOcrConfidence = ocr.confidence;
              gameState.hpOcrText = ocr.text;
              gameState.hpOcrConfidence = ocr.confidence;
              gameState.hpOcrAdopted = adopted;
              if (adopted) {
                hp = ocrHp;
                hpSource = "ocr";
              }
            }
          } else {
            gameState.hpOcrText = this.lastOcrText;
            gameState.hpOcrConfidence = this.lastOcrConfidence;
            gameState.hpOcrAdopted = this.lastOcrAdopted;
            if (this.lastOcrAdopted && this.lastOcrHp !== null) {
              hp = this.lastOcrHp;
              hpSource = "ocr";
            }
          }
        }
        if (hp === void 0 && shouldPublishE2eHp(e2e.slots, e2e.hp)) {
          hp = e2e.hp;
          hpSource = "e2e";
        }
        if (hp !== void 0) {
          gameState.healthPercent = Math.min(150, hp);
          gameState.hpSource = hpSource;
          if (hp > 0 && hp <= this.lowHealthThreshold && Date.now() - this.lastLowHealthFlashAt > 2e3) {
            this.lastLowHealthFlashAt = Date.now();
            this.emit({ type: "low-health", percent: hp });
          }
        }
      }
    }
    if (loaded.includes("valorantKill")) {
      const killRoi = letterbox.mapPixelRect(letterbox.VALORANT_KILL_CONFIG.killArea, frameWidth, frameHeight);
      const killCrop = cropRgbaFrame(frame, killRoi);
      const killResult = await onnxEngineNode.infer("valorantKill", killCrop);
      if (killResult.success && killResult.type === "features") {
        const features = killResult.values;
        const fired = this.killDetector.process(features);
        if (fired || this.killDetector.debugScore >= letterbox.VALORANT_KILL_CONFIG.exitThreshold) {
          console.error(
            `[svc] kill score=${this.killDetector.debugScore.toFixed(2)} present=${this.killDetector.bannerPresent} thr=${letterbox.VALORANT_KILL_CONFIG.enterThreshold}/${letterbox.VALORANT_KILL_CONFIG.exitThreshold}${fired ? " FIRED" : ""}`
          );
        }
        if (fired) {
          this.emit({ type: "kill" });
        }
      }
    }
  }
  /**
   * 结算横幅检测（回合胜利/失败）：对结算文字区做 OCR，命中胜/负关键词即上升沿各发一次 win/defeat。
   *
   * 必须独立于对局 HUD 门控（skillHudVisible/menuOpen）每帧调用：回合结束、「获胜/败北」横幅出现的
   * 那一刻，技能 HUD 已消失、结算遮罩还常被 detectMenuOpen 判成 menuOpen=true，若挂在「对局中」分支里
   * 就会整段跳过、横幅漏检（实测第一张「败北」无 result ocr 行即此因）。
   * 结算文字大多数帧不出现/静止，按指纹（value 通道）降频跑 OCR，非结算帧只算指纹即跳过，开销可忽略。
   */
  async runSettlementOcr(frame, frameWidth, frameHeight) {
    if (this.options.enableOCR === false) return;
    if (!onnxEngineNode.getLoadedModels().includes("valorantOcr")) return;
    const winRoi = letterbox.mapPixelRect(letterbox.VALORANT_WIN_CONFIG.winArea, frameWidth, frameHeight);
    const winCrop = cropRgbaFrame(frame, winRoi);
    const fp = computeRoiFingerprint(winCrop, 8, 4, "value");
    const mustRun = this.lastWinFingerprint === null || this.bannerOcrPending || this.frameIndex % WIN_OCR_FORCE_INTERVAL === 0 || fingerprintChanged(this.lastWinFingerprint, fp, WIN_ROI_CHANGE_THRESHOLD);
    if (!mustRun) return;
    const ocrInput = valueChannelFrame(winCrop);
    const ocrResult = await onnxEngineNode.infer("valorantOcr", ocrInput);
    if (!ocrResult.success || ocrResult.type !== "ocr") return;
    const ocr = ocrResult;
    const winMatched = matchesWinKeyword(ocr.text);
    const winScore = winMatched ? ocr.confidence : 0;
    const winFired = this.winDetector.process(winScore);
    const defeatMatched = matchesDefeatKeyword(ocr.text);
    const defeatScore = defeatMatched ? ocr.confidence : 0;
    const defeatFired = this.defeatDetector.process(defeatScore);
    if (winMatched || defeatMatched || !ocr.text.trim()) {
      this.lastWinFingerprint = fp;
      this.bannerOcrPending = false;
    } else {
      this.bannerOcrPending = true;
    }
    if (winMatched || defeatMatched || this.winDetector.bannerPresent || this.defeatDetector.bannerPresent) {
      console.error(
        `[svc] result ocr text="${ocr.text}" conf=${ocr.confidence.toFixed(2)} win=${winMatched}(${this.winDetector.bannerPresent}) defeat=${defeatMatched}(${this.defeatDetector.bannerPresent})${winFired ? " WIN_FIRED" : ""}${defeatFired ? " DEFEAT_FIRED" : ""}`
      );
    }
    if (winFired) {
      this.emit({ type: "win" });
    }
    if (defeatFired) {
      this.emit({ type: "defeat" });
    }
  }
  /**
   * 菜单态检测：在屏幕右上角搜索区内对关闭(✕)/设置(⚙)图标做多尺度梯度 NCC，命中任一（峰值≥阈值）
   * 即判定对局中打开了购买/设置菜单（底部技能 HUD 被遮挡）。用于在门控判「HUD 不可见」时区分
   * 「开菜单」与「真离开对局」——前者保持已锁英雄不被清空。多尺度梯度匹配与明暗极性、分辨率无关，
   * 复用英雄识别的同一套实现（见 templateMatcher.node）。仅在门控不可见时调用，正常对局无开销。
   */
  async detectMenuOpen(frame, frameWidth, frameHeight) {
    const loaded = new Set(templateMatcherNode.getLoadedTemplates());
    const icons = letterbox.VALORANT_MENU_ICONS.icons.filter((i) => loaded.has(i.name));
    if (icons.length === 0) return false;
    const roi = letterbox.mapPixelRect(letterbox.VALORANT_MENU_ICONS.searchArea, frameWidth, frameHeight);
    const crop = cropRgbaFrame(frame, roi);
    if (crop.width < 8 || crop.height < 8) return false;
    const srcGrad = await templateMatcherNode.prepareSourceGradient(crop, {
      width: letterbox.VALORANT_MENU_ICONS.searchArea.width,
      height: letterbox.VALORANT_MENU_ICONS.searchArea.height
    });
    if (!srcGrad) return false;
    const scores = [];
    try {
      for (const icon of icons) {
        const { score, scale } = await templateMatcherNode.matchTemplateScoreMultiScaleWithSource(
          srcGrad,
          icon.name
        );
        const threshold = icon.threshold ?? letterbox.VALORANT_MENU_ICONS.threshold;
        scores.push({ name: icon.name, score, scale, threshold });
      }
    } finally {
      templateMatcherNode.releaseSourceGradient(srcGrad);
    }
    const open = scores.some((s) => s.score >= s.threshold);
    if (this.frameIndex % 30 === 1) {
      const detail = scores.map((s) => `${s.name}=${s.score.toFixed(3)}@${s.scale}(thr${s.threshold})`).join(" ");
      console.error(`[svc] menuIcon ${detail} open=${open}`);
    }
    return open;
  }
  /**
   * 选人界面检测：在左侧英雄格子上方的职责筛选条上匹配 4 个职责图标。
   * 命中任一即返回，避免对局里每帧跑满 4×多尺度。
   */
  async detectAgentSelect(frame, frameWidth, frameHeight) {
    const loaded = new Set(templateMatcherNode.getLoadedTemplates());
    const icons = letterbox.VALORANT_AGENT_SELECT_ICONS.icons.filter((i) => loaded.has(i.name));
    if (icons.length === 0) return false;
    const logThisFrame = this.frameIndex % 30 === 1;
    const logScores = [];
    let hit = false;
    for (const area of letterbox.VALORANT_AGENT_SELECT_ICONS.searchAreas) {
      const roi = letterbox.mapPixelRect(area, frameWidth, frameHeight);
      const crop = cropRgbaFrame(frame, roi);
      if (crop.width < 8 || crop.height < 8) continue;
      const srcGrad = await templateMatcherNode.prepareSourceGradient(crop, {
        width: area.width,
        height: area.height
      });
      if (!srcGrad) continue;
      try {
        for (const icon of icons) {
          const { score, scale } = await templateMatcherNode.matchTemplateScoreMultiScaleWithSource(
            srcGrad,
            icon.name
          );
          const threshold = icon.threshold ?? letterbox.VALORANT_AGENT_SELECT_ICONS.threshold;
          if (logThisFrame) {
            logScores.push(
              `${area.name}/${icon.name.replace("role_", "")}=${score.toFixed(3)}@${scale}`
            );
          }
          if (score >= threshold) {
            hit = true;
            if (!logThisFrame) return true;
          }
        }
      } finally {
        templateMatcherNode.releaseSourceGradient(srcGrad);
      }
      if (hit && !logThisFrame) return true;
    }
    if (logThisFrame) {
      console.error(`[svc] agentSelect ${logScores.join(" ") || "(no-roi)"} hit=${hit}`);
    }
    return hit;
  }
  /** 连续 stableFrames 帧一致才切换选人界面门控，避免对局场景单帧误匹配 */
  applyAgentSelectGate(rawHit) {
    if (rawHit === this.agentSelect) {
      this.agentSelectStreak = 0;
      return this.agentSelect;
    }
    this.agentSelectStreak += 1;
    if (this.agentSelectStreak >= letterbox.VALORANT_AGENT_SELECT_ICONS.stableFrames) {
      this.agentSelect = rawHit;
      this.agentSelectStreak = 0;
    }
    return this.agentSelect;
  }
  async recognizeHero(frame, frameWidth, frameHeight, candidates = letterbox.VALORANT_HEROES) {
    const threshold = this.options.templateMatchThreshold ?? 0.34;
    const slotMinScore = 0.28;
    const minMatchedSlots = 2;
    const peakOnlyThreshold = 0.36;
    const peakMarginMin = 0.04;
    const significanceZ = this.options.heroSignificanceZ ?? 3;
    const MIN_CANDIDATES_FOR_SIGNIFICANCE = 8;
    const SIGMA_FLOOR = 0.02;
    const templateCount = templateMatcherNode.getLoadedTemplates().length;
    const slotCount = letterbox.VALORANT_ADAPTER.uiPositions.abilities.length;
    if (this.options.enableTemplateMatch === false || !this.templatesReady) {
      this.lastHeroDetectDebug = {
        templatesReady: this.templatesReady,
        templateCount,
        threshold,
        bestHeroId: null,
        bestScore: 0,
        matchedSlots: 0,
        peakScore: 0,
        peakHeroId: null
      };
      return null;
    }
    const slotScoresByHero = /* @__PURE__ */ new Map();
    const bestSlotScoreByHero = /* @__PURE__ */ new Map();
    const bestSlotScaleByHero = /* @__PURE__ */ new Map();
    const avgAllByHero = /* @__PURE__ */ new Map();
    for (const hero of candidates) {
      slotScoresByHero.set(hero.id, []);
      bestSlotScoreByHero.set(hero.id, -1);
      bestSlotScaleByHero.set(hero.id, 0);
    }
    const loadedTemplates = new Set(templateMatcherNode.getLoadedTemplates());
    let matchErrors = 0;
    for (const abilityPos of letterbox.VALORANT_ADAPTER.uiPositions.abilities) {
      const roi = this.mapAbilityRoi(abilityPos, frameWidth, frameHeight);
      const roiImage = cropRgbaFrame(frame, roi);
      const srcGrad = await templateMatcherNode.prepareSourceGradient(roiImage);
      try {
        for (const hero of candidates) {
          const scores = slotScoresByHero.get(hero.id);
          const templateName = `ability_${hero.id}_${abilityPos.key}`;
          if (!srcGrad || !loadedTemplates.has(templateName)) {
            scores.push(0);
            continue;
          }
          try {
            const { score: confidence, scale } = await templateMatcherNode.matchTemplateScoreMultiScaleWithSource(
              srcGrad,
              templateName
            );
            scores.push(confidence);
            if (confidence > bestSlotScoreByHero.get(hero.id)) {
              bestSlotScoreByHero.set(hero.id, confidence);
              bestSlotScaleByHero.set(hero.id, scale);
            }
          } catch (error) {
            scores.push(0);
            matchErrors += 1;
            if (matchErrors <= 3 || this.frameIndex % 45 === 1) {
              console.warn(
                `[svc] hero match ${templateName}:`,
                error instanceof Error ? error.message : String(error)
              );
            }
          }
        }
      } finally {
        templateMatcherNode.releaseSourceGradient(srcGrad);
      }
    }
    let bestHeroId = null;
    let bestScore = 0;
    let bestMatchedSlots = 0;
    let peakHeroId = null;
    let peakScore = 0;
    let secondPeakScore = 0;
    let peakScale = 0;
    let bestScaleDbg = 0;
    for (const hero of candidates) {
      const slotScores = slotScoresByHero.get(hero.id);
      let matchedCount = 0;
      let matchedSum = 0;
      for (const s of slotScores) {
        if (s >= slotMinScore) {
          matchedCount++;
          matchedSum += s;
        }
      }
      const avgAll = slotScores.length > 0 ? slotScores.reduce((a, b) => a + b, 0) / slotScores.length : 0;
      avgAllByHero.set(hero.id, avgAll);
      if (avgAll > peakScore) {
        secondPeakScore = peakScore;
        peakScore = avgAll;
        peakHeroId = hero.id;
        peakScale = bestSlotScaleByHero.get(hero.id);
      } else if (avgAll > secondPeakScore) {
        secondPeakScore = avgAll;
      }
      if (matchedCount >= minMatchedSlots) {
        const avgMatched = matchedSum / matchedCount;
        if (avgMatched > bestScore) {
          bestScore = avgMatched;
          bestHeroId = hero.id;
          bestMatchedSlots = matchedCount;
          bestScaleDbg = bestSlotScaleByHero.get(hero.id);
        }
      }
    }
    const avgAllList = candidates.map((h) => avgAllByHero.get(h.id) ?? 0);
    const scoreMean = avgAllList.length > 0 ? avgAllList.reduce((a, b) => a + b, 0) / avgAllList.length : 0;
    const scoreStd = avgAllList.length > 0 ? Math.sqrt(
      avgAllList.reduce((a, b) => a + (b - scoreMean) ** 2, 0) / avgAllList.length
    ) : 0;
    const sigmaFloor = Math.max(scoreStd, SIGMA_FLOOR);
    const useSignificance = significanceZ > 0 && candidates.length >= MIN_CANDIDATES_FOR_SIGNIFICANCE;
    const zOf = (heroId) => ((avgAllByHero.get(heroId) ?? 0) - scoreMean) / sigmaFloor;
    const isSignificant = (heroId) => !useSignificance || zOf(heroId) >= significanceZ;
    const peakZ = peakHeroId ? zOf(peakHeroId) : 0;
    this.lastHeroDetectDebug = {
      templatesReady: true,
      templateCount,
      threshold,
      bestHeroId,
      bestScore,
      matchedSlots: bestMatchedSlots,
      peakScore,
      peakHeroId,
      secondPeakScore,
      matchErrors: matchErrors > 0 ? matchErrors : void 0,
      scoreMean,
      scoreStd,
      peakZ
    };
    if (this.frameIndex % 45 === 1) {
      console.error(
        `[svc] hero peak=${peakHeroId}@${peakScore.toFixed(3)}(x${peakScale}) 2nd=${secondPeakScore.toFixed(3)} best=${bestHeroId}@${bestScore.toFixed(3)}(x${bestScaleDbg}) slots=${bestMatchedSlots}/${slotCount} thr=${threshold} mu=${scoreMean.toFixed(3)} sd=${scoreStd.toFixed(3)} z=${peakZ.toFixed(2)} zmin=${useSignificance ? significanceZ : "off"}`
      );
    }
    if (bestHeroId && bestScore >= threshold && isSignificant(bestHeroId)) {
      return letterbox.findValorantHero(bestHeroId) ?? null;
    }
    const peakMargin = peakScore - secondPeakScore;
    if (peakHeroId && peakScore >= peakOnlyThreshold && peakMargin >= peakMarginMin && isSignificant(peakHeroId)) {
      return letterbox.findValorantHero(peakHeroId) ?? null;
    }
    return null;
  }
  /**
   * 临时诊断：把当前帧的 4 个技能 ROI 原始裁剪一次性落盘到 scripts/_live_crops/，
   * 连同 meta.json（帧尺寸/ROI 矩形）。用于离线用真实裁剪复算各英雄分数，定位误判。
   */
  async dumpLiveCropsOnce(frame, frameWidth, frameHeight) {
    if (this.liveCropsDumped) return;
    this.liveCropsDumped = true;
    try {
      const dir = path.join(__dirname, "..", "..", "scripts", "_live_crops");
      await fs$1.mkdir(dir, { recursive: true });
      const slots = [];
      for (const abilityPos of letterbox.VALORANT_ADAPTER.uiPositions.abilities) {
        const roi = this.mapAbilityRoi(abilityPos, frameWidth, frameHeight);
        const crop = cropRgbaFrame(frame, roi);
        const dataUrl = await encodePngDataUrl(crop);
        const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
        await fs$1.writeFile(path.join(dir, `slot_${abilityPos.key}.png`), Buffer.from(base64, "base64"));
        slots.push({ key: abilityPos.key, roi, width: crop.width, height: crop.height });
      }
      await fs$1.writeFile(
        path.join(dir, "meta.json"),
        JSON.stringify({ frameWidth, frameHeight, slots }, null, 2)
      );
      console.error(`[svc] live crops dumped -> ${dir}`);
    } catch (e) {
      console.error("[svc] dump live crops failed:", e instanceof Error ? e.message : String(e));
    }
  }
  /**
   * 临时诊断（修复「手臂青色误判充能」后移除）：周期性把 4 个充能条 ROI 的真实裁剪
   * （原始 + 8× 放大便于肉眼看）连同逐列/逐段判据指标落盘到 scripts/_live_crops/，
   * 用于离线对比「手臂青」vs「充能条青」，标定能区分二者的判据。
   */
  async dumpEnergyDiag(frame, frameWidth, frameHeight) {
    try {
      const dir = path.join(__dirname, "..", "..", "scripts", "_live_crops");
      await fs$1.mkdir(dir, { recursive: true });
      const slots = [];
      for (const abilityPos of letterbox.VALORANT_ADAPTER.uiPositions.abilities) {
        const key = abilityPos.key;
        const slot = letterbox.abilityKeyToSlotIndex(key);
        const energyRoi = letterbox.mapPixelRect(letterbox.getSkillEnergyPixelRect(slot), frameWidth, frameHeight);
        const crop = cropRgbaFrame(frame, energyRoi);
        const rawUrl = await encodePngDataUrl(crop);
        await fs$1.writeFile(
          path.join(dir, `energy_${key}.png`),
          Buffer.from(rawUrl.replace(/^data:image\/png;base64,/, ""), "base64")
        );
        const mag = magnifyRgba(crop, 8);
        const magUrl = await encodePngDataUrl(mag);
        await fs$1.writeFile(
          path.join(dir, `energy_${key}_x8.png`),
          Buffer.from(magUrl.replace(/^data:image\/png;base64,/, ""), "base64")
        );
        const diag2 = analyzeEnergyBar(crop);
        const production = detectAbilityEnergy(crop, key);
        slots.push({ key, roi: energyRoi, production, diag: diag2 });
      }
      await fs$1.writeFile(
        path.join(dir, "energy_diag.json"),
        JSON.stringify({ frameIndex: this.frameIndex, frameWidth, frameHeight, slots }, null, 2)
      );
      console.error(`[svc] energy diag dumped (frame ${this.frameIndex}) -> ${dir}`);
    } catch (e) {
      console.error("[svc] energy diag dump failed:", e instanceof Error ? e.message : String(e));
    }
  }
  recognizeAbilities(frame, frameWidth, frameHeight, hero) {
    const states = [];
    for (const abilityPos of letterbox.VALORANT_ADAPTER.uiPositions.abilities) {
      const ability = hero.abilities.find((a) => a.key === abilityPos.key);
      if (!ability) continue;
      const slot = letterbox.abilityKeyToSlotIndex(abilityPos.key);
      const energyRoi = letterbox.mapPixelRect(letterbox.getSkillEnergyPixelRect(slot), frameWidth, frameHeight);
      const barCrop = cropRgbaFrame(frame, energyRoi);
      const detected = detectAbilityEnergy(barCrop, abilityPos.key);
      const raw = {
        key: ability.key,
        name: ability.nameZh,
        available: detected.available,
        cooldown: 0,
        charges: detected.charges,
        maxCharges: detected.maxCharges
      };
      states.push(this.stabilizeAbility(raw));
    }
    return states;
  }
  /** 清空充能识别状态（充能缓存 + 去抖器），二者须同生命周期，避免跨英雄/重进对局串状态 */
  resetAbilityState() {
    this.previousAbilityCharges.clear();
    this.abilityStabilizer.clear();
  }
  /**
   * 充能状态去抖：连续 confirmFrames 帧一致才翻转「可用/段数」。
   * 手臂扫过技能区只造成短暂几帧的几何漏判，攒不够确认帧数即被压制；真实充能条静止，能稳定确认。
   * 镜像 applySkillHudGate 的连续帧门控；name/maxCharges 等非判定字段不参与，跟随已提交值。
   */
  stabilizeAbility(raw) {
    const prev = this.abilityStabilizer.get(raw.key);
    if (!prev) {
      this.abilityStabilizer.set(raw.key, { committed: raw, streak: 0 });
      return raw;
    }
    const changed = raw.available !== prev.committed.available || raw.charges !== prev.committed.charges;
    if (!changed) {
      prev.streak = 0;
      return prev.committed;
    }
    prev.streak += 1;
    if (prev.streak >= letterbox.VALORANT_SKILL_ENERGY.confirmFrames) {
      prev.committed = raw;
      prev.streak = 0;
    }
    return prev.committed;
  }
  async collectRoiImages(frame, frameWidth, frameHeight, hero) {
    const images = [];
    const hudGateRoi = letterbox.mapPixelRect(letterbox.getSkillHudGatePixelRect(), frameWidth, frameHeight);
    images.push({
      key: "skill_hud_gate",
      dataUrl: await encodePngDataUrl(cropRgbaFrame(frame, hudGateRoi))
    });
    const hpRoi = letterbox.mapPixelRect(letterbox.VALORANT_HP_CONFIG.area, frameWidth, frameHeight);
    images.push({
      key: "hp",
      dataUrl: await encodePngDataUrl(cropRgbaFrame(frame, hpRoi))
    });
    for (const area of letterbox.VALORANT_AGENT_SELECT_ICONS.searchAreas) {
      const agentSelectRoi = letterbox.mapPixelRect(area, frameWidth, frameHeight);
      images.push({
        key: `agent_select_${area.name}`,
        dataUrl: await encodePngDataUrl(cropRgbaFrame(frame, agentSelectRoi))
      });
    }
    const killRoi = letterbox.mapPixelRect(letterbox.VALORANT_KILL_CONFIG.killArea, frameWidth, frameHeight);
    images.push({
      key: "kill",
      dataUrl: await encodePngDataUrl(cropRgbaFrame(frame, killRoi))
    });
    const winRoi = letterbox.mapPixelRect(letterbox.VALORANT_WIN_CONFIG.winArea, frameWidth, frameHeight);
    images.push({
      key: "win",
      dataUrl: await encodePngDataUrl(valueChannelFrame(cropRgbaFrame(frame, winRoi)))
    });
    for (const abilityPos of letterbox.VALORANT_ADAPTER.uiPositions.abilities) {
      const iconRoi = this.mapAbilityRoi(abilityPos, frameWidth, frameHeight);
      images.push({
        key: `${abilityPos.key}_icon`,
        dataUrl: await encodePngDataUrl(cropRgbaFrame(frame, iconRoi))
      });
      const slot = letterbox.abilityKeyToSlotIndex(abilityPos.key);
      const energyRoi = letterbox.mapPixelRect(letterbox.getSkillEnergyPixelRect(slot), frameWidth, frameHeight);
      images.push({
        key: `${abilityPos.key}_energy`,
        dataUrl: await encodePngDataUrl(cropRgbaFrame(frame, energyRoi))
      });
    }
    if (hero) {
      images.push({ key: "hero", dataUrl: `hero:${hero.id}` });
    }
    return images;
  }
  detectAbilityReleases(gameState) {
    if (gameState.skillHudVisible === false || !gameState.hero) {
      if (gameState.skillHudVisible === false) {
        this.resetAbilityState();
      }
      return;
    }
    for (const ability of gameState.abilities) {
      const charges = ability.charges ?? (ability.available ? 1 : 0);
      const prevCharges = this.previousAbilityCharges.get(ability.key);
      if (prevCharges !== void 0 && charges < prevCharges && prevCharges > 0) {
        this.emit({
          type: "ability-released",
          heroId: gameState.hero.id,
          key: ability.key
        });
      }
      this.previousAbilityCharges.set(ability.key, charges);
    }
  }
  // /** 按已校验 HP 的下降量发受伤分级事件（damage/ 灯效暂禁用） */
  // private detectDamage(healthPercent: number | null | undefined): void {
  //   if (healthPercent == null || healthPercent <= 0) {
  //     this.lastDamageHp = null
  //     return
  //   }
  //   const prev = this.lastDamageHp
  //   this.lastDamageHp = healthPercent
  //   if (prev == null || healthPercent >= prev) return
  //   const drop = prev - healthPercent
  //   const cfg = VALORANT_DAMAGE_CONFIG
  //   if (drop < cfg.minDrop) return
  //   const now = Date.now()
  //   if (now - this.lastDamageAt < cfg.cooldownMs) return
  //   this.lastDamageAt = now
  //   let level = 0
  //   for (let i = 0; i < cfg.levelThresholds.length; i++) {
  //     if (drop >= cfg.levelThresholds[i]) level = i
  //   }
  //   this.emit({ type: 'damage', level })
  // }
  dispose() {
    templateMatcherNode.clearCache();
    onnxEngineNode.unload();
    this.killDetector.reset();
    this.winDetector.reset();
    this.defeatDetector.reset();
    this.resetAbilityState();
    this.skillHudVisible = true;
    this.skillHudGateStreak = 0;
    this.agentSelect = false;
    this.agentSelectStreak = 0;
    this.initialized = false;
    this.templatesReady = false;
    this.lastHpFingerprint = null;
    this.lastWinFingerprint = null;
    this.bannerOcrPending = false;
    this.lastOcrText = void 0;
    this.lastOcrHp = null;
    this.lastOcrAdopted = false;
    this.lastHpSnapshot = null;
  }
}
console.error("[worker] module eval start");
const parentPort = process.parentPort;
if (!parentPort) {
  throw new Error("recognition.worker must run in Electron utilityProcess");
}
console.error("[worker] parentPort ok");
let service = null;
let processing = false;
let pendingFrame = null;
let frameBuffer = null;
let frameBufferW = 0;
let frameBufferH = 0;
function emit(msg) {
  parentPort.postMessage(msg);
}
function drainPending() {
  if (!service || processing || !pendingFrame) return;
  const frame = pendingFrame;
  pendingFrame = null;
  void processOne(frame);
}
function reassembleFrame(width, height, rois) {
  if (!frameBuffer || frameBufferW !== width || frameBufferH !== height) {
    frameBuffer = new Uint8Array(width * height * 4);
    frameBufferW = width;
    frameBufferH = height;
  }
  const buf = frameBuffer;
  for (const roi of rois) {
    const src = new Uint8Array(roi.buffer);
    const rowBytes = roi.width * 4;
    for (let row = 0; row < roi.height; row++) {
      const dst = ((roi.y + row) * width + roi.x) * 4;
      const s = row * rowBytes;
      buf.set(src.subarray(s, s + rowBytes), dst);
    }
  }
  return { data: buf, width, height };
}
async function processOne(frame) {
  if (!service) return;
  processing = true;
  try {
    const reassembled = reassembleFrame(frame.width, frame.height, frame.rois);
    await service.processFrame(reassembled);
  } catch (error) {
    emit({
      type: "error",
      message: error instanceof Error ? error.message : String(error)
    });
  } finally {
    processing = false;
    drainPending();
  }
}
function handleMessage(msg) {
  switch (msg.type) {
    case "init":
      console.error("[worker] init received");
      configureResourcesRoot(msg.payload.resourcesRoot);
      service = new ValorantRecognitionService(emit);
      console.error("[worker] calling initialize");
      void service.initialize(msg.payload.options).then(() => {
        console.error("[worker] initialize resolved");
        emit({ type: "ready", loadedModels: service.getLoadedModels() });
      }).catch((error) => {
        emit({
          type: "error",
          message: error instanceof Error ? error.message : String(error)
        });
      });
      break;
    case "frame": {
      const next = {
        width: msg.payload.width,
        height: msg.payload.height,
        rois: msg.rois
      };
      if (processing) {
        pendingFrame = next;
      } else {
        void processOne(next);
      }
      break;
    }
    case "set-hero":
      service?.setManualHero(msg.heroId ? letterbox.findValorantHero(msg.heroId) ?? null : null);
      break;
    case "set-auto-detect":
      service?.setAutoDetectHero(msg.enabled);
      break;
    case "update-config":
      service?.updateConfig(msg.options);
      break;
    case "set-low-health-threshold":
      service?.setLowHealthThreshold(msg.percent);
      break;
    case "stop":
      service?.dispose();
      service = null;
      processing = false;
      pendingFrame = null;
      frameBuffer = null;
      break;
  }
}
parentPort.on("message", (event) => {
  handleMessage(event.data);
});
