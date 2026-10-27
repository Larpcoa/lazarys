// Context → Bottleneck story.
// The section pins to the screen; scroll position (not speed) drives everything:
// the paragraphs glide up as one continuous column, each fading in and out as it
// passes the reading line, then the swing illustration's dots
// travel across and settle into the bedside illustration.
(() => {
  const story = document.querySelector(".story");
  if (!story || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const stage = story.querySelector(".story-stage");
  const imgA = story.querySelector("img[data-morph=from]");
  const imgB = story.querySelector("img[data-morph=to]");
  const chapters = [...story.querySelectorAll(".chapter")];
  const rail = story.querySelector(".story-rail i");
  const next = story.querySelector(".story-next");
  story.classList.add("live");

  // ---------- Dive: instead of scrolling down to the story, the hero zooms into the cell cloud ----------
  // The hero pins over the (already pinned) story; scrolling flies the camera through a cloud of cells
  // and out the other side, where "never not sick." is waiting.
  const dive = document.querySelector(".dive");
  const hero = dive?.querySelector(".hero"), heroBg = hero?.querySelector(".bg");
  const heroCopy = hero?.querySelector(".hero-copy"), backed = hero?.querySelector(".backed");
  let cells = null;
  if (hero) {
    dive.classList.add("live");
    // "learn more" (and #context links) land where the dive ends, not at the top of the overlapping story
    const end = document.createElement("span");
    end.className = "dive-end"; end.setAttribute("aria-hidden", "true");
    story.removeAttribute("id"); end.id = "context";
    dive.append(end);
    cells = makeCells(hero);
    if (location.hash === "#context") requestAnimationFrame(() => scrollTo(0, end.getBoundingClientRect().top + scrollY));
  }
  const diveLen = () => dive && hero ? dive.offsetHeight - innerHeight : 0;

  // ---------- Timeline (in "beats"; one paragraph = one beat of scrolling) ----------
  const INTRO = .5, MORPH = 2.4, OUTRO = .7;
  const [ctx, bn] = chapters.map(ch => {
    // paragraphs move together inside a column that slides behind a soft-edged window
    const box = ch.querySelector(".beats"), col = document.createElement("div");
    col.className = "col";
    col.append(...box.children);
    box.append(col);
    return { el: ch, head: ch.querySelector(".chapter-head"), col, beats: [...col.children] };
  });
  const mStart = INTRO + ctx.beats.length, mEnd = mStart + MORPH;
  const total = mEnd + bn.beats.length + OUTRO;
  ctx.start = INTRO; bn.start = mEnd;
  bn.hold = true; // the last bottleneck paragraph stays on screen as the section scrolls away
  // about half a screen of scrolling per beat, so nothing can be skimmed past by accident
  const sizeStory = () => { story.style.height = `calc(100svh + ${dive && hero ? "var(--dive) + " : ""}${(total * (innerWidth < 900 ? 48 : 55)).toFixed(1)}svh)`; };
  sizeStory();
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  // f = which paragraph sits on the reading line (fractional, continuous); before the first or past
  // the last it keeps going at the same spacing, so text drifts in from below and out above
  const columnY = (tops, f) => {
    const n = tops.length, gap = i => n > 1 ? tops[Math.min(i + 1, n - 1)] - tops[Math.min(i, n - 2)] : 120;
    if (f <= 0) return tops[0] + f * gap(0);
    if (f >= n - 1) return tops[n - 1] + (f - n + 1) * gap(n - 2);
    const i = Math.floor(f);
    return tops[i] + (f - i) * (tops[i + 1] - tops[i]);
  };
  const fadeBeat = (el, v) => {
    el.style.opacity = v.toFixed(3);
    el.style.filter = v > .995 ? "none" : `blur(${((1 - v) * 4).toFixed(2)}px)`;
    el.style.visibility = v < .01 ? "hidden" : "visible";
  };

  const show = (el, v, dy) => {
    el.style.opacity = v.toFixed(3);
    el.style.transform = `translate3d(0, ${dy.toFixed(1)}px, 0)`;
    el.style.filter = v > .995 ? "none" : `blur(${((1 - v) * 6).toFixed(2)}px)`;
    el.style.visibility = v < .01 ? "hidden" : "visible";
  };

  // ---------- Dots (WebGL) ----------
  const canvas = document.createElement("canvas");
  canvas.className = "story-dots";
  canvas.setAttribute("aria-hidden", "true");
  const gl = canvas.getContext("webgl", { antialias: true, premultipliedAlpha: true });
  const COLS = 190, BG = [227, 224, 219];
  let dots = null;

  function sample(img) {
    const rows = Math.round(COLS * img.naturalHeight / img.naturalWidth);
    const c = document.createElement("canvas"); c.width = COLS; c.height = rows;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(img, 0, 0, COLS, rows);
    const d = x.getImageData(0, 0, COLS, rows).data, pts = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < COLS; i++) {
      const k = (j * COLS + i) * 4, r = d[k], g = d[k + 1], b = d[k + 2];
      const diff = Math.abs(r - BG[0]) + Math.abs(g - BG[1]) + Math.abs(b - BG[2]);
      if (diff >= 24) pts.push({ u: (i + .5) / COLS, v: (j + .5) / rows, r: r / 255, g: g / 255, b: b / 255, a: Math.min(1, diff / 90) });
    }
    return pts;
  }
  // Hilbert order keeps neighbours together, so every dot travels to a nearby part of the new picture
  const H = 256;
  function hilbert(x, y) {
    let d = 0;
    for (let s = H / 2; s > 0; s >>= 1) {
      const rx = (x & s) > 0 ? 1 : 0, ry = (y & s) > 0 ? 1 : 0;
      d += s * s * ((3 * rx) ^ ry);
      if (ry === 0) { if (rx === 1) { x = H - 1 - x; y = H - 1 - y; } const t = x; x = y; y = t; }
    }
    return d;
  }
  const order = pts => pts.map(p => (p.h = hilbert(Math.min(H - 1, p.u * H | 0), Math.min(H - 1, p.v * H | 0)), p)).sort((a, b) => a.h - b.h);

  function initDots(ia, ib) {
    const vs = `
      attribute vec2 a, b; attribute vec4 ca, cb; attribute vec2 rnd;
      uniform vec4 ra, rb; uniform vec2 res; uniform float p, sizeA, sizeB, dpr, fade, bloom;
      varying vec4 col; varying float vb;
      float ease(float t){ return t < .5 ? 4.*t*t*t : 1. - pow(-2.*t + 2., 3.) / 2.; }
      void main(){
        float t = ease(clamp((p - rnd.x * .06) / .94, 0., 1.));
        vec2 pa = ra.xy + a * ra.zw, pb = rb.xy + b * rb.zw;
        vec2 pos = mix(pa, pb, t);
        vec2 dir = normalize(pb - pa + vec2(.001));
        pos += vec2(-dir.y, dir.x) * sin(t * 3.14159) * (rnd.y - .5) * 14. * dpr;
        // bloom: while the painting hands over, dots are big and soft so they read as the same wash of colour
        vb = bloom;
        col = mix(ca, cb, t); col.a *= fade * mix(1., .5, bloom);
        gl_PointSize = mix(sizeA, sizeB, t) * (1. + 1.5 * bloom);
        vec2 clip = pos / res * 2. - 1.;
        gl_Position = vec4(clip.x, -clip.y, 0., 1.);
      }`;
    const fs = `
      precision mediump float; varying vec4 col; varying float vb;
      void main(){ float a = col.a * smoothstep(.5, mix(.38, 0., vb), length(gl_PointCoord - .5)); gl_FragColor = vec4(col.rgb * a, a); }`;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
    gl.useProgram(pr);

    const pa = order(sample(ia)), pb = order(sample(ib));
    const n = Math.max(pa.length, pb.length), data = new Float32Array(n * 14);
    let prevA = -1, prevB = -1;
    for (let i = 0; i < n; i++) {
      const ia2 = Math.floor(i * pa.length / n), ib2 = Math.floor(i * pb.length / n);
      const s = pa[ia2], e = pb[ib2];
      // a dot that would be reused starts (or ends) invisible, so nothing visibly splits in two
      data.set([s.u, s.v, e.u, e.v, s.r, s.g, s.b, ia2 === prevA ? 0 : s.a, e.r, e.g, e.b, ib2 === prevB ? 0 : e.a, Math.random(), Math.random()], i * 14);
      prevA = ia2; prevB = ib2;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const attr = (name, size, off) => { const l = gl.getAttribLocation(pr, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 56, off * 4); };
    attr("a", 2, 0); attr("b", 2, 2); attr("ca", 4, 4); attr("cb", 4, 8); attr("rnd", 2, 12);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    dots = { n, U: Object.fromEntries(["ra", "rb", "res", "p", "sizeA", "sizeB", "dpr", "fade", "bloom"].map(k => [k, gl.getUniformLocation(pr, k)])) };
    stage.prepend(canvas);
    resize();
  }
  const loaded = img => img.complete && img.naturalWidth ? Promise.resolve(img) : new Promise(r => img.addEventListener("load", () => r(img), { once: true }));
  if (gl) Promise.all([loaded(imgA), loaded(imgB)]).then(([a, b]) => initDots(a, b));

  let dpr = 1;
  function resize() {
    if (!dots) return;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(stage.clientWidth * dpr); canvas.height = Math.round(stage.clientHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    request();
  }

  function drawDots(m, fade, bloom) {
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    if (fade < .001) return;
    const s = stage.getBoundingClientRect(), a = imgA.getBoundingClientRect(), b = imgB.getBoundingClientRect(), U = dots.U;
    gl.uniform4f(U.ra, (a.left - s.left) * dpr, (a.top - s.top) * dpr, a.width * dpr, a.height * dpr);
    gl.uniform4f(U.rb, (b.left - s.left) * dpr, (b.top - s.top) * dpr, b.width * dpr, b.height * dpr);
    gl.uniform2f(U.res, canvas.width, canvas.height);
    gl.uniform1f(U.p, m); gl.uniform1f(U.dpr, dpr); gl.uniform1f(U.fade, fade); gl.uniform1f(U.bloom, bloom);
    gl.uniform1f(U.sizeA, a.width / COLS * 1.15 * dpr);
    gl.uniform1f(U.sizeB, b.width / COLS * 1.15 * dpr);
    gl.drawArrays(gl.POINTS, 0, dots.n);
  }

  // ---------- Frame ----------
  let shown = null, raf = 0;
  // scroll distance into the section (px); the first diveLen() of it belongs to the dive
  const target = () => -story.getBoundingClientRect().top;
  function frame() {
    raf = 0;
    const goal = target();
    // follow the scroll position with a little easing so steps glide; never runs ahead of it
    shown = shown === null ? goal : shown + (goal - shown) * .18;
    if (Math.abs(goal - shown) < .5) shown = goal;
    const dl = diveLen();
    const u = clamp((shown - dl) / Math.max(1, story.offsetHeight - innerHeight - dl)) * total;
    if (cells) diveFrame(clamp(shown / Math.max(1, dl)));

    for (const ch of [ctx, bn]) {
      let f = u - ch.start - .5;
      if (ch.hold) f = Math.min(f, ch.beats.length - 1);
      const tops = ch.beats.map(b => b.offsetTop);
      ch.col.style.transform = `translate3d(0, ${(tops[0] - columnY(tops, f)).toFixed(1)}px, 0)`;
      // fully clear on the reading line, gone by three quarters of a paragraph away
      ch.beats.forEach((b, i) => fadeBeat(b, 1 - smooth(.3, .75, Math.abs(f - i))));
    }
    const ctxV = 1 - smooth(mStart + .05, mStart + .5, u), bnV = smooth(mEnd - .5, mEnd - .05, u);
    show(ctx.head, ctxV, (1 - ctxV) * -16);
    show(bn.head, bnV, (1 - bnV) * 16);
    ctx.el.style.pointerEvents = ctxV > .5 ? "" : "none";
    bn.el.style.pointerEvents = bnV > .5 ? "" : "none";

    const m = clamp((u - mStart) / MORPH);
    // three gentle stages: the painting melts into soft dots that sharpen (first fifth), the dots fly
    // across (middle), then they soften and melt back into the other painting (last fifth)
    const inA = smooth(0, .22, m), outB = 1 - smooth(.78, 1, m);
    const fade = dots ? Math.min(inA, outB) : 0;
    const bloom = dots ? (m < .5 ? 1 - smooth(.06, .3, m) : smooth(.7, .94, m)) : 0;
    const travel = smooth(.2, .8, m);
    const soften = (img, v) => { img.style.opacity = v.toFixed(3); img.style.filter = v > .995 || v < .005 ? "none" : `blur(${((1 - v) * 3).toFixed(2)}px)`; };
    if (dots) { soften(imgA, m < .5 ? 1 - inA : 0); soften(imgB, m > .5 ? 1 - outB : 0); }
    else { imgA.style.opacity = 1 - smooth(.3, .5, m); imgB.style.opacity = smooth(.5, .7, m); }
    if (dots) drawDots(travel, fade, bloom);
    if (rail) rail.style.transform = `scaleY(${(u / total).toFixed(4)})`;
    // the "keep scrolling" arrow only appears as the progress bar nears the bottom,
    // then stays until the story unpins and scrolls away
    if (next) next.style.opacity = smooth(.78, .9, u / total).toFixed(3);

    if (shown !== goal) request();
  }
  // p: 0 = hero at rest, 1 = through the cloud and arrived at the story
  function diveFrame(p) {
    const copyV = 1 - smooth(0, .24, p);
    heroCopy.style.opacity = copyV.toFixed(3);
    heroCopy.style.filter = copyV > .995 ? "none" : `blur(${((1 - copyV) * 10).toFixed(2)}px)`;
    heroCopy.style.transform = p > 0 ? `scale(${(1 + .45 * smooth(0, .3, p)).toFixed(4)})` : "";
    backed.style.opacity = (1 - smooth(0, .12, p)).toFixed(3);
    // the photo: zoom into its red heart, soften, then dissolve once the cells have taken over
    const z = Math.pow(p, 1.5);
    heroBg.style.scale = (1 + 6 * z).toFixed(4);
    heroBg.style.filter = p > .01 ? `blur(${(smooth(.1, .7, p) * 16).toFixed(2)}px)` : "none";
    heroBg.style.opacity = (1 - smooth(.42, .78, p)).toFixed(3);
    cells.draw(p);
    hero.style.visibility = p > .995 ? "hidden" : "visible";
    hero.style.pointerEvents = p > .3 ? "none" : "";
    // the story screen arrives from the far side of the cloud: small, soft, then settles in focus
    const a = smooth(.5, .96, p);
    stage.classList.toggle("arriving", a < 1);
    stage.style.opacity = a.toFixed(3);
    stage.style.scale = a < 1 ? (.86 + .14 * a).toFixed(4) : "";
    stage.style.filter = a < .995 ? `blur(${((1 - a) * 12).toFixed(2)}px)` : "none";
  }

  // A cloud of cells in 3D (canvas 2D sprites, perspective-projected); the camera flies through it
  function makeCells(host) {
    const cv = document.createElement("canvas");
    cv.className = "dive-cells"; cv.setAttribute("aria-hidden", "true");
    host.querySelector(".bg").after(cv);
    const cx = cv.getContext("2d");
    let rnd = 7;
    const r01 = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
    // colours sampled from the swing painting: oranges, reds, peach, cream, and its cool blue-greys
    const PAL = [[240, 120, 66], [232, 66, 44], [246, 168, 128], [244, 214, 190], [250, 236, 222], [184, 198, 222], [178, 44, 32], [236, 142, 98], [246, 196, 160]];
    const rgb = (c, k = 1, a = 1) => `rgba(${c.map(v => Math.round(Math.min(255, v * k))).join(",")},${a})`;
    // sprites in the painting's watercolour style: flat translucent washes with a pooled rim and a lacy
    // interior of tiny dots, small solid paint dots, red starburst clusters, and soft blooms for the lens
    const S = 192;
    function sprite(kind, c) {
      const o = document.createElement("canvas"); o.width = o.height = S;
      const g = o.getContext("2d"), R = S / 2 - 4;
      g.translate(S / 2, S / 2);
      if (kind === "soft") {
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, R);
        gr.addColorStop(0, rgb(c, 1, .42)); gr.addColorStop(.6, rgb(c, 1, .26)); gr.addColorStop(1, rgb(c, 1, 0));
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill();
        return o;
      }
      if (kind === "dot") {
        // a single dab of paint: nearly flat, the pigment pooling slightly at the edge
        for (let i = 0; i < 4; i++) {
          g.fillStyle = rgb(c, 1, .3); g.beginPath();
          g.arc((r01() - .5) * R * .04, (r01() - .5) * R * .04, R * (.9 + r01() * .06), 0, 7); g.fill();
        }
        g.strokeStyle = rgb(c, .82, .35); g.lineWidth = R * .06; g.beginPath(); g.arc(0, 0, R * .9, 0, 7); g.stroke();
        return o;
      }
      if (kind === "burst") {
        // the painting's spiky red clusters: a dense dark core of dots thinning out into rays
        for (let i = 0; i < 260; i++) {
          const t = Math.pow(r01(), 1.6), d = t * R * .95, ang = r01() * 6.283;
          const rr = R * (.03 + (1 - t) * .07) * (.6 + r01() * .7);
          const k = .55 + t * .6;
          g.fillStyle = rgb(c, k, .35 + (1 - t) * .5);
          g.beginPath(); g.arc(Math.cos(ang) * d, Math.sin(ang) * d, rr, 0, 7); g.fill();
        }
        return o;
      }
      // "wash": a watercolour disc. Several slightly offset translucent layers give an uneven edge
      for (let i = 0; i < 6; i++) {
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, R);
        gr.addColorStop(0, rgb(c, 1.08, .06)); gr.addColorStop(.75, rgb(c, 1, .1)); gr.addColorStop(.97, rgb(c, .92, .16)); gr.addColorStop(1, rgb(c, .9, 0));
        g.fillStyle = gr; g.beginPath();
        g.arc((r01() - .5) * R * .05, (r01() - .5) * R * .05, R * (.93 + r01() * .07), 0, 7); g.fill();
      }
      g.save(); g.beginPath(); g.arc(0, 0, R * .95, 0, 7); g.clip();
      // lacy mandala: rings of tiny dots and fine spokes radiating from the centre
      const spokes = 18 + (r01() * 14 | 0);
      g.strokeStyle = rgb(c, .72, .24); g.lineWidth = 1;
      for (let i = 0; i < spokes; i++) {
        const ang = i / spokes * 6.283 + r01() * .1;
        g.beginPath(); g.moveTo(Math.cos(ang) * R * .08, Math.sin(ang) * R * .08);
        g.quadraticCurveTo(Math.cos(ang + .25) * R * .5, Math.sin(ang + .25) * R * .5, Math.cos(ang) * R * .94, Math.sin(ang) * R * .94);
        g.stroke();
      }
      for (let i = 0; i < 520; i++) {
        const d = Math.pow(r01(), .7) * R * .95, ang = r01() * 6.283;
        g.fillStyle = r01() < .5 ? rgb(c, .78, .1 + r01() * .14) : `rgba(255,248,240,${.08 + r01() * .14})`;
        g.beginPath(); g.arc(Math.cos(ang) * d, Math.sin(ang) * d, .6 + r01() * R * .035, 0, 7); g.fill();
      }
      g.restore();
      // pigment pooled at the rim
      g.strokeStyle = rgb(c, .85, .22); g.lineWidth = R * .04;
      g.beginPath(); g.arc(0, 0, R * .955, 0, 7); g.stroke();
      return o;
    }
    const kinds = PAL.map((c, i) => ({ wash: sprite("wash", c), dot: sprite("dot", c), soft: sprite("soft", c),
      burst: sprite("burst", i === 6 || i === 1 ? c : PAL[1]) }));
    // world: x, y around the flight path, z ahead of the camera; nothing sits right on the path
    const N = innerWidth < 900 ? 150 : 230, items = [];
    for (let i = 0; i < N; i++) {
      let x = (r01() * 2 - 1) * 2.6, y = (r01() * 2 - 1) * 1.7;
      const near = Math.hypot(x / 1.3, y / .8);
      if (near < .32) { const k = .32 / Math.max(.05, near); x *= k; y *= k; }
      const roll = r01(), kind = roll < .5 ? "dot" : roll < .9 ? "wash" : "burst";
      const r = kind === "dot" ? .018 + r01() * .045 : kind === "wash" ? .08 + r01() * .24 : .07 + r01() * .1;
      items.push({ x, y, z: .9 + r01() * 7.8, r, set: kinds[(r01() * kinds.length) | 0], kind });
    }
    let w = 0, h = 0, dpr = 1;
    const size = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = cv.width = Math.round(host.clientWidth * dpr); h = cv.height = Math.round(host.clientHeight * dpr);
    };
    size(); addEventListener("resize", size);
    return {
      draw(p) {
        cx.clearRect(0, 0, w, h);
        const vis = smooth(.03, .2, p) * (1 - smooth(.86, .99, p));
        if (vis < .002) return;
        const cam = 8.4 * p;
        const f = Math.max(w, h) * .62, ox = w / 2, oy = h * .58;
        // far to near, so near cells paint over far ones
        const live = [];
        for (const c of items) { const d = c.z - cam; if (d > .06 && d < 8) live.push([d, c]); }
        live.sort((a, b) => b[0] - a[0]);
        for (const [d, c] of live) {
          const sx = ox + c.x / d * f, sy = oy + c.y / d * f, s = c.r / d * f * 2;
          if (s < 1 || sx + s < 0 || sx - s > w || sy + s < 0 || sy - s > h) continue;
          // far: faint (the haze of the photo); passing the lens: big and out of focus
          const a = vis * (1 - smooth(4.5, 8, d)) * smooth(.06, .3, d);
          const blur = Math.min(1, (1 - smooth(.25, .9, d)) + smooth(3.5, 6.5, d));
          cx.globalAlpha = a * (1 - blur);
          if (cx.globalAlpha > .01) cx.drawImage(c.set[c.kind], sx - s / 2, sy - s / 2, s, s);
          cx.globalAlpha = a * blur;
          if (cx.globalAlpha > .01) cx.drawImage(c.set.soft, sx - s * .7, sy - s * .7, s * 1.4, s * 1.4);
        }
        cx.globalAlpha = 1;
      },
    };
  }

  const request = () => { if (!raf) raf = requestAnimationFrame(frame); };
  addEventListener("scroll", request, { passive: true });
  addEventListener("resize", () => { sizeStory(); resize(); request(); });
  new ResizeObserver(request).observe(story);
  frame();
})();
