// Text on photographic backgrounds is dark by default. This measures the actual image
// pixels behind each element and switches it to white only where white reads better (WCAG).
(() => {
  const DARK = [10, 11, 11], LIGHT = [255, 255, 255];
  const lin = c => { c /= 255; return c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); };
  const lum = ([r, g, b]) => .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b);
  const ratio = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  const LD = lum(DARK), LL = lum(LIGHT);

  // each surface: its background element, image, and background-position y (0 = top, .5 = center)
  const surfaces = [];
  document.querySelectorAll(".atmos").forEach(el => surfaces.push({ root: el, bg: el.querySelector(".bg"), src: "/img/hero.jpg", py: .5 }));
  if (!surfaces.length) return;

  const TARGETS = ".formpage h1, .field, .seg, .slogan, .formnote, .prog-note, .picker .box, .thanks, .btn-out, .direct";
  const cache = {};
  const getImg = src => cache[src] ||= new Promise(res => {
    const im = new Image();
    im.onload = () => {
      const w = 320, h = Math.round(w * im.height / im.width);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(im, 0, 0, w, h);
      // precompute per-pixel luminance
      const d = x.getImageData(0, 0, w, h).data, L = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) L[i] = lum([d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]);
      res({ w, h, L });
    };
    im.src = src;
  });

  async function run() {
    for (const s of surfaces) {
      const img = await getImg(s.src);
      const box = s.bg.getBoundingClientRect();
      if (!box.width) continue;
      // background-size: cover
      const scale = Math.max(box.width / img.w, box.height / img.h);
      const dw = img.w * scale, dh = img.h * scale;
      const ox = box.left + (box.width - dw) / 2, oy = box.top + (box.height - dh) * s.py;
      s.root.querySelectorAll(TARGETS).forEach(el => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const x0 = Math.max(0, Math.floor((r.left - ox) / scale)), x1 = Math.min(img.w - 1, Math.ceil((r.right - ox) / scale));
        const y0 = Math.max(0, Math.floor((r.top - oy) / scale)), y1 = Math.min(img.h - 1, Math.ceil((r.bottom - oy) / scale));
        let sum = 0, n = 0, worstD = 1e9, worstL = 1e9;
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const l = img.L[y * img.w + x]; sum += l; n++;
        }
        if (!n) return;
        const avg = sum / n;
        // also check the extremes so the choice holds across the whole element
        for (let y = y0; y <= y1; y += 2) for (let x = x0; x <= x1; x += 2) {
          const l = img.L[y * img.w + x];
          worstD = Math.min(worstD, ratio(l, LD)); worstL = Math.min(worstL, ratio(l, LL));
        }
        const scoreD = ratio(avg, LD) + .5 * worstD, scoreL = ratio(avg, LL) + .5 * worstL;
        el.classList.toggle("ink-light", scoreL > scoreD);
      });
    }
  }

  let t;
  const later = () => { clearTimeout(t); t = setTimeout(run, 120); };
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(run);
  addEventListener("resize", later);
  addEventListener("load", later);
})();
