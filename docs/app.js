import * as THREE from "https://unpkg.com/three@0.164.1/build/three.module.js";

const presets = {
  paper: {
    width: 60,
    depth: 1.2,
    base: 4,
    clearance: 3,
    gap: 0.25,
    soften: 1,
    ribs: false,
    pressure: "hand press",
    note: "0.2 mm nozzle or finer is recommended for crisp paper embossing.",
    color: 0xe7b14a
  },
  thinMetal: {
    width: 70,
    depth: 2.2,
    base: 7,
    clearance: 4,
    gap: 0.45,
    soften: 2,
    ribs: true,
    pressure: "arbor press",
    note: "Use generous clearance and annealed thin stock to reduce tearing at sharp detail.",
    color: 0x74b9c7
  },
  thickMetal: {
    width: 82,
    depth: 3.2,
    base: 11,
    clearance: 6,
    gap: 0.75,
    soften: 3,
    ribs: true,
    pressure: "shop press",
    note: "Thicker metal needs slower pressure, larger radii, and a strong backer die.",
    color: 0xd9d0c1
  }
};

const state = {
  image: null,
  view: "dieSet",
  preset: "paper",
  dragging: false,
  yaw: -0.75,
  pitch: 0.78,
  distance: 285,
  mask: null,
  modelGroup: null
};

const els = {
  file: document.querySelector("#imageInput"),
  canvas: document.querySelector("#preview"),
  maskCanvas: document.querySelector("#maskCanvas"),
  threshold: document.querySelector("#threshold"),
  thresholdValue: document.querySelector("#thresholdValue"),
  autoThreshold: document.querySelector("#autoThreshold"),
  useAlpha: document.querySelector("#useAlpha"),
  cleanMask: document.querySelector("#cleanMask"),
  smoothing: document.querySelector("#smoothing"),
  resolution: document.querySelector("#resolution"),
  invert: document.querySelector("#invert"),
  mirror: document.querySelector("#mirror"),
  showMask: document.querySelector("#showMask"),
  stampWidth: document.querySelector("#stampWidth"),
  reliefDepth: document.querySelector("#reliefDepth"),
  baseThickness: document.querySelector("#baseThickness"),
  edgeClearance: document.querySelector("#edgeClearance"),
  formingGap: document.querySelector("#formingGap"),
  edgeSoften: document.querySelector("#edgeSoften"),
  pressRibs: document.querySelector("#pressRibs"),
  roundedBase: document.querySelector("#roundedBase"),
  download: document.querySelector("#downloadStl"),
  resetCamera: document.querySelector("#resetCamera"),
  printNote: document.querySelector("#printNote"),
  modelSize: document.querySelector("#modelSize"),
  modelDepth: document.querySelector("#modelDepth"),
  modelGap: document.querySelector("#modelGap"),
  modelPressure: document.querySelector("#modelPressure"),
  widthValue: document.querySelector("#widthValue"),
  depthValue: document.querySelector("#depthValue"),
  baseValue: document.querySelector("#baseValue"),
  clearanceValue: document.querySelector("#clearanceValue"),
  gapValue: document.querySelector("#gapValue"),
  softenValue: document.querySelector("#softenValue")
};

const renderer = new THREE.WebGLRenderer({
  canvas: els.canvas,
  antialias: true,
  preserveDrawingBuffer: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x111315, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x111315, 210, 460);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
const floor = new THREE.GridHelper(260, 26, 0x30373c, 0x202529);
floor.position.y = -7;
floor.material.opacity = 0.32;
floor.material.transparent = true;
scene.add(floor);

const hemi = new THREE.HemisphereLight(0xf7f1df, 0x26323a, 1.7);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffffff, 2.7);
key.position.set(-40, -65, 96);
scene.add(key);

const rim = new THREE.DirectionalLight(0x74b9c7, 1.6);
rim.position.set(70, 35, 54);
scene.add(rim);

const materials = {
  stamp: new THREE.MeshStandardMaterial({
    color: presets.paper.color,
    metalness: 0.18,
    roughness: 0.46
  }),
  female: new THREE.MeshStandardMaterial({
    color: 0xbfc7c4,
    metalness: 0.2,
    roughness: 0.5
  }),
  side: new THREE.MeshStandardMaterial({
    color: 0x31373a,
    metalness: 0.08,
    roughness: 0.72
  })
};

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function mm(value) {
  return Number.parseFloat(value).toFixed(1).replace(".0", "");
}

function createSampleImage() {
  const canvas = document.createElement("canvas");
  canvas.width = 680;
  canvas.height = 680;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#faf8ef";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(340, 340);
  ctx.fillStyle = "#111315";
  ctx.strokeStyle = "#111315";
  ctx.lineWidth = 24;
  ctx.beginPath();
  ctx.arc(0, 0, 230, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 162, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = "900 160px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("SF", 0, -18);
  ctx.font = "800 42px Arial, sans-serif";
  ctx.fillText("EMBOSS", 0, 132);
  for (let i = 0; i < 18; i += 1) {
    const a = (i / 18) * Math.PI * 2;
    const x = Math.cos(a) * 197;
    const y = Math.sin(a) * 197;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  const img = new Image();
  img.src = canvas.toDataURL("image/png");
  return img;
}

function otsuThreshold(lumas) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < lumas.length; i += 1) hist[Math.round(lumas[i])] += 1;
  let sum = 0;
  for (let i = 0; i < 256; i += 1) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let maxVariance = 0;
  let threshold = 126;
  const total = lumas.length;

  for (let i = 0; i < 256; i += 1) {
    wB += hist[i];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += i * hist[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const variance = wB * wF * (mB - mF) * (mB - mF);
    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = i;
    }
  }

  return threshold;
}

function cleanBinaryMask(values, n) {
  const next = new Float32Array(values.length);
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      let filled = 0;
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          const sx = Math.min(n - 1, Math.max(0, x + ox));
          const sy = Math.min(n - 1, Math.max(0, y + oy));
          if (values[sy * n + sx] > 0.5) filled += 1;
        }
      }
      const current = values[y * n + x] > 0.5;
      next[y * n + x] = filled >= (current ? 3 : 5) ? 1 : 0;
    }
  }
  return next;
}

function drawMask() {
  const n = Number(els.resolution.value);
  const smoothing = Number(els.smoothing.value) + Number(els.edgeSoften.value);
  const hidden = document.createElement("canvas");
  hidden.width = n;
  hidden.height = n;
  const ctx = hidden.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, n, n);

  const img = state.image;
  const scale = Math.min(n / img.width, n / img.height) * 0.88;
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.save();
  if (els.mirror.checked) {
    ctx.translate(n, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(img, (n - w) / 2, (n - h) / 2, w, h);
  ctx.restore();

  const data = ctx.getImageData(0, 0, n, n);
  const pixels = data.data;
  const lumas = new Float32Array(n * n);
  let transparentPixels = 0;
  let opaquePixels = 0;
  for (let i = 0; i < n * n; i += 1) {
    const r = pixels[i * 4];
    const g = pixels[i * 4 + 1];
    const b = pixels[i * 4 + 2];
    const a = pixels[i * 4 + 3];
    lumas[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (a < 245) transparentPixels += 1;
    if (a > 15) opaquePixels += 1;
  }

  const hasUsefulAlpha = els.useAlpha.checked && transparentPixels > n * n * 0.02 && opaquePixels > n * n * 0.02;
  const threshold = els.autoThreshold.checked ? otsuThreshold(lumas) : Number(els.threshold.value);
  els.threshold.value = threshold;
  els.thresholdValue.value = els.autoThreshold.checked ? `auto ${threshold}` : threshold;

  let values = new Float32Array(n * n);
  for (let i = 0; i < n * n; i += 1) {
    let v = hasUsefulAlpha ? pixels[i * 4 + 3] / 255 : lumas[i] < threshold ? 1 : 0;
    if (els.invert.checked) v = 1 - v;
    values[i] = v;
  }

  if (els.cleanMask.checked && !hasUsefulAlpha) values = cleanBinaryMask(values, n);

  for (let pass = 0; pass < smoothing; pass += 1) {
    const next = new Float32Array(values.length);
    for (let y = 0; y < n; y += 1) {
      for (let x = 0; x < n; x += 1) {
        let sum = 0;
        let count = 0;
        for (let oy = -1; oy <= 1; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            const sx = Math.min(n - 1, Math.max(0, x + ox));
            const sy = Math.min(n - 1, Math.max(0, y + oy));
            sum += values[sy * n + sx];
            count += 1;
          }
        }
        next[y * n + x] = sum / count;
      }
    }
    values = next;
  }

  const maskCtx = els.maskCanvas.getContext("2d");
  els.maskCanvas.width = n;
  els.maskCanvas.height = n;
  const out = maskCtx.createImageData(n, n);
  for (let i = 0; i < n * n; i += 1) {
    const c = Math.round((1 - values[i]) * 255);
    out.data[i * 4] = c;
    out.data[i * 4 + 1] = c;
    out.data[i * 4 + 2] = c;
    out.data[i * 4 + 3] = 255;
  }
  maskCtx.putImageData(out, 0, 0);
  state.mask = { n, values };
}

function roundedFactor(x, y, width, radius) {
  if (!els.roundedBase.checked || radius <= 0) return 1;
  const half = width / 2;
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const cx = half - radius;
  const cy = half - radius;
  if (ax <= cx || ay <= cy) return 1;
  const dx = ax - cx;
  const dy = ay - cy;
  const d = Math.sqrt(dx * dx + dy * dy);
  return d <= radius ? 1 : 0.35;
}

function createDieGeometry(kind) {
  const { n, values } = state.mask;
  const width = Number(els.stampWidth.value);
  const depth = Number(els.reliefDepth.value);
  const base = Number(els.baseThickness.value);
  const clearance = Number(els.edgeClearance.value);
  const gap = Number(els.formingGap.value);
  const step = width / (n - 1);
  const cornerRadius = Math.min(8, width * 0.14);
  const vertices = [];
  const indices = [];

  function addVertex(x, y, z) {
    vertices.push(x, y, z);
    return vertices.length / 3 - 1;
  }

  function reliefAt(x, y) {
    const edge = Math.min(x, y, n - 1 - x, n - 1 - y) * step;
    const fade = Math.min(1, Math.max(0, edge / Math.max(0.1, clearance)));
    return values[y * n + x] * fade;
  }

  function heightAt(x, y) {
    const relief = reliefAt(x, y) * depth;
    if (kind === "female") {
      return base + depth - Math.max(0, relief - gap);
    }
    return base + relief;
  }

  const topIds = [];
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      const px = (x / (n - 1) - 0.5) * width;
      const py = (y / (n - 1) - 0.5) * width;
      const footprint = roundedFactor(px, py, width, cornerRadius);
      const h = footprint ? heightAt(x, y) : Math.max(0, base * 0.35);
      topIds.push(addVertex(px, py, h));
    }
  }

  for (let y = 0; y < n - 1; y += 1) {
    for (let x = 0; x < n - 1; x += 1) {
      const a = topIds[y * n + x];
      const b = topIds[y * n + x + 1];
      const c = topIds[(y + 1) * n + x];
      const d = topIds[(y + 1) * n + x + 1];
      indices.push(a, c, b, b, c, d);
    }
  }

  const bottomIds = [];
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      const px = (x / (n - 1) - 0.5) * width;
      const py = (y / (n - 1) - 0.5) * width;
      bottomIds.push(addVertex(px, py, 0));
    }
  }

  for (let y = 0; y < n - 1; y += 1) {
    for (let x = 0; x < n - 1; x += 1) {
      const a = bottomIds[y * n + x];
      const b = bottomIds[y * n + x + 1];
      const c = bottomIds[(y + 1) * n + x];
      const d = bottomIds[(y + 1) * n + x + 1];
      indices.push(a, b, c, b, d, c);
    }
  }

  for (let i = 0; i < n - 1; i += 1) {
    addWall(topIds[i], topIds[i + 1], bottomIds[i], bottomIds[i + 1]);
    addWall(topIds[(n - 1) * n + i + 1], topIds[(n - 1) * n + i], bottomIds[(n - 1) * n + i + 1], bottomIds[(n - 1) * n + i]);
    addWall(topIds[(i + 1) * n], topIds[i * n], bottomIds[(i + 1) * n], bottomIds[i * n]);
    addWall(topIds[i * n + n - 1], topIds[(i + 1) * n + n - 1], bottomIds[i * n + n - 1], bottomIds[(i + 1) * n + n - 1]);
  }

  function addWall(t1, t2, b1, b2) {
    indices.push(t1, b1, t2, t2, b1, b2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function addPressRibs(group, kind) {
  if (!els.pressRibs.checked) return;
  const width = Number(els.stampWidth.value);
  const base = Number(els.baseThickness.value);
  const depth = Number(els.reliefDepth.value);
  const gap = Number(els.formingGap.value);
  const top = kind === "female" ? base + depth - gap : base + depth;
  const ribHeight = Math.max(2, base * 0.18);
  const ribWidth = Math.max(2.4, width * 0.045);
  const length = width * 0.82;
  const ribMaterial = new THREE.MeshStandardMaterial({
    color: 0x566068,
    metalness: 0.12,
    roughness: 0.62
  });

  const bars = [
    { sx: length, sy: ribWidth, x: 0, y: width * 0.34 },
    { sx: length, sy: ribWidth, x: 0, y: -width * 0.34 },
    { sx: ribWidth, sy: length, x: width * 0.34, y: 0 },
    { sx: ribWidth, sy: length, x: -width * 0.34, y: 0 }
  ];

  for (const bar of bars) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(bar.sx, bar.sy, ribHeight), ribMaterial);
    mesh.position.set(bar.x, bar.y, top + ribHeight / 2 + 0.2);
    mesh.userData.solidName = `${kind}-press-rib`;
    group.add(mesh);
  }
}

function rebuildModel() {
  drawMask();
  if (state.modelGroup) scene.remove(state.modelGroup);

  const group = new THREE.Group();
  const color = presets[state.preset].color;
  materials.stamp.color.setHex(color);
  const width = Number(els.stampWidth.value);
  const pairOffset = width * 0.62;

  function addDie(kind, x) {
    const dieGroup = new THREE.Group();
    const geometry = createDieGeometry(kind);
    const material = kind === "female" ? materials.female : materials.stamp;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.solidName = `${kind}-die`;
    dieGroup.add(mesh);
    addPressRibs(dieGroup, kind);
    dieGroup.position.x = x;
    group.add(dieGroup);
  }

  if (state.view === "positive") {
    addDie("male", 0);
  } else if (state.view === "negative") {
    addDie("female", 0);
  } else {
    addDie("male", -pairOffset);
    addDie("female", pairOffset);
  }

  group.rotation.x = -Math.PI / 2;
  group.position.z = 0;
  state.modelGroup = group;
  scene.add(group);
  updateStats();
}

function updateStats() {
  const width = Number(els.stampWidth.value);
  const depth = Number(els.reliefDepth.value);
  const base = Number(els.baseThickness.value);
  const clearance = Number(els.edgeClearance.value);
  const gap = Number(els.formingGap.value);
  const soften = Number(els.edgeSoften.value);
  els.widthValue.value = mm(width);
  els.depthValue.value = mm(depth);
  els.baseValue.value = mm(base);
  els.clearanceValue.value = mm(clearance);
  els.gapValue.value = mm(gap);
  els.softenValue.value = soften;
  els.modelSize.textContent = `${mm(width)} x ${mm(width)} mm`;
  els.modelDepth.textContent = `${mm(depth)} mm`;
  els.modelGap.textContent = `${mm(gap)} mm`;
  els.modelPressure.textContent = presets[state.preset].pressure;
  els.printNote.textContent = presets[state.preset].note;
}

function setPreset(name) {
  state.preset = name;
  const preset = presets[name];
  els.stampWidth.value = preset.width;
  els.reliefDepth.value = preset.depth;
  els.baseThickness.value = preset.base;
  els.edgeClearance.value = preset.clearance;
  els.formingGap.value = preset.gap;
  els.edgeSoften.value = preset.soften;
  els.pressRibs.checked = preset.ribs;
  document.querySelectorAll(".preset").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.preset === name);
  });
  rebuildModel();
}

function updateCamera() {
  const target = new THREE.Vector3(0, 0, 8);
  const cp = Math.cos(state.pitch);
  camera.position.set(
    target.x + Math.sin(state.yaw) * cp * state.distance,
    target.y + Math.cos(state.yaw) * cp * state.distance,
    target.z + Math.sin(state.pitch) * state.distance
  );
  camera.lookAt(target);
}

function resize() {
  const rect = els.canvas.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
}

new ResizeObserver(() => resize()).observe(els.canvas);

function animate() {
  updateCamera();
  if (state.modelGroup && !state.dragging) state.modelGroup.rotation.z += 0.0015;
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function eventPoint(event) {
  const point = event.touches ? event.touches[0] : event;
  return { x: point.clientX, y: point.clientY };
}

function pointerDown(event) {
  state.dragging = true;
  state.lastPointer = eventPoint(event);
}

function pointerMove(event) {
  if (!state.dragging) return;
  const point = eventPoint(event);
  const dx = point.x - state.lastPointer.x;
  const dy = point.y - state.lastPointer.y;
  state.yaw -= dx * 0.008;
  state.pitch = Math.min(1.34, Math.max(0.16, state.pitch + dy * 0.006));
  state.lastPointer = point;
}

function pointerUp() {
  state.dragging = false;
}

function exportBinaryStl() {
  state.modelGroup.updateMatrixWorld(true);
  const normal = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const cb = new THREE.Vector3();
  const ab = new THREE.Vector3();

  let triangleCount = 0;
  state.modelGroup.traverse((object) => {
    if (!object.isMesh) return;
    const geo = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry;
    triangleCount += geo.getAttribute("position").count / 3;
  });

  const buffer = new ArrayBuffer(80 + 4 + triangleCount * 50);
  const view = new DataView(buffer);
  const encoder = new TextEncoder();
  const header = encoder.encode("StampForge binary STL");
  for (let i = 0; i < header.length; i++) view.setUint8(i, header[i]);
  view.setUint32(80, triangleCount, true);

  let offset = 84;
  state.modelGroup.traverse((object) => {
    if (!object.isMesh) return;
    const geo = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry;
    const position = geo.getAttribute("position");
    for (let i = 0; i < position.count; i += 3) {
      a.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld);
      b.fromBufferAttribute(position, i + 1).applyMatrix4(object.matrixWorld);
      c.fromBufferAttribute(position, i + 2).applyMatrix4(object.matrixWorld);
      cb.subVectors(c, b);
      ab.subVectors(a, b);
      normal.crossVectors(cb, ab).normalize();
      view.setFloat32(offset, normal.x, true); offset += 4;
      view.setFloat32(offset, normal.y, true); offset += 4;
      view.setFloat32(offset, normal.z, true); offset += 4;
      for (const v of [a, b, c]) {
        view.setFloat32(offset, v.x, true); offset += 4;
        view.setFloat32(offset, v.y, true); offset += 4;
        view.setFloat32(offset, v.z, true); offset += 4;
      }
      view.setUint16(offset, 0, true); offset += 2;
    }
  });

  return buffer;
}

function downloadStl() {
  const blob = new Blob([exportBinaryStl()], { type: "model/stl" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `stampforge-${state.preset}-${state.view}.stl`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function loadFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    const img = new Image();
    img.addEventListener("load", () => {
      state.image = img;
      rebuildModel();
    });
    img.src = reader.result;
  });
  reader.readAsDataURL(file);
}

els.file.addEventListener("change", (event) => loadFile(event.target.files[0]));

const uploadZone = document.querySelector(".upload-zone");
uploadZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  uploadZone.classList.add("is-dragging");
});
uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("is-dragging"));
uploadZone.addEventListener("drop", (event) => {
  event.preventDefault();
  uploadZone.classList.remove("is-dragging");
  loadFile(event.dataTransfer.files[0]);
});
els.showMask.addEventListener("change", () => {
  els.maskCanvas.classList.toggle("is-visible", els.showMask.checked);
});
els.autoThreshold.addEventListener("change", () => {
  els.threshold.disabled = els.autoThreshold.checked;
});

const rebuildDebounced = debounce(rebuildModel, 150);

[
  els.threshold,
  els.smoothing,
  els.resolution,
  els.stampWidth,
  els.reliefDepth,
  els.baseThickness,
  els.edgeClearance,
  els.formingGap,
  els.edgeSoften
].forEach((input) => input.addEventListener("input", rebuildDebounced));

[
  els.autoThreshold,
  els.useAlpha,
  els.cleanMask,
  els.invert,
  els.mirror,
  els.pressRibs,
  els.roundedBase
].forEach((input) => input.addEventListener("input", rebuildModel));

document.querySelectorAll(".preset").forEach((button) => {
  button.addEventListener("click", () => setPreset(button.dataset.preset));
});

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    state.view = button.dataset.view;
    document.querySelectorAll("[data-view]").forEach((item) => {
      item.classList.toggle("is-active", item === button);
    });
    rebuildModel();
  });
});

els.resetCamera.addEventListener("click", () => {
  state.yaw = -0.75;
  state.pitch = 0.78;
  state.distance = 285;
});

els.download.addEventListener("click", downloadStl);
els.canvas.addEventListener("mousedown", pointerDown);
window.addEventListener("mousemove", pointerMove);
window.addEventListener("mouseup", pointerUp);
els.canvas.addEventListener("touchstart", pointerDown, { passive: true });
window.addEventListener("touchmove", pointerMove, { passive: true });
window.addEventListener("touchend", pointerUp);
els.canvas.addEventListener("wheel", (event) => {
  state.distance = Math.min(360, Math.max(58, state.distance + event.deltaY * 0.08));
});

els.threshold.disabled = els.autoThreshold.checked;

state.image = createSampleImage();
state.image.addEventListener("load", () => {
  setPreset("paper");
  animate();
});
