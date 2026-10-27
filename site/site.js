(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Cell background "breathes" on a wall-clock cycle, so it is in the same place on every page
  // and nothing jumps when navigating between them.
  const bgs = $$(".atmos .bg");
  if (bgs.length && !reduced) {
    const tick = () => {
      const b = (1 - Math.cos(Date.now() / 36000 * Math.PI * 2)) / 2;
      for (const bg of bgs) bg.style.setProperty("--b", b.toFixed(4));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  // Leaving for another page: browsers with cross-document view transitions fade by themselves (style.css);
  // the rest fade the page out here first, so it never looks like a hard reload.
  if (!("onpagereveal" in window) && !reduced) {
    document.addEventListener("click", e => {
      const a = e.target.closest("a[href]");
      if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target === "_blank" || a.hasAttribute("download") || a.origin !== location.origin) return;
      if (a.pathname === location.pathname && a.hash) return; // same-page anchor
      e.preventDefault();
      document.documentElement.classList.add("leaving");
      setTimeout(() => { location.href = a.href; }, 1100);
    });
    // coming back via the back button restores the page as it was left: make it visible again
    addEventListener("pageshow", e => { if (e.persisted) document.documentElement.classList.remove("leaving"); });
  }

  // Sunrise: the footer glow climbs from low on the horizon to its full height as the page ends
  const vision = $(".vision");
  if (vision && !reduced) {
    let queued = false;
    const rise = () => {
      queued = false;
      const r = vision.getBoundingClientRect();
      // 0 when the section first peeks in, 1 when its bottom meets the bottom of the screen
      const p = Math.min(1, Math.max(0, (innerHeight - r.top) / Math.max(1, r.height)));
      const e = 1 - Math.pow(1 - p, 2.2);
      vision.style.setProperty("--rise", e.toFixed(4));
    };
    const ask = () => { if (!queued) { queued = true; requestAnimationFrame(rise); } };
    rise();
    addEventListener("scroll", ask, { passive: true });
    addEventListener("resize", ask);
  }

  // Mobile menu, plus a soft fade under the nav once the page has scrolled
  const nav = $(".nav");
  const onScroll = () => nav.classList.toggle("scrolled", scrollY > 40);
  onScroll();
  addEventListener("scroll", onScroll, { passive: true });
  const burger = $(".burger");
  burger?.addEventListener("click", () => {
    const open = nav.classList.toggle("menu");
    burger.setAttribute("aria-expanded", open);
  });
  $$(".pill a").forEach(a => a.addEventListener("click", () => nav.classList.remove("menu")));

  // Smooth-scroll only for links within the current page (arriving from another page jumps straight there)
  document.addEventListener("click", e => {
    const a = e.target.closest('a[href*="#"]');
    if (!a || a.origin !== location.origin || a.pathname.replace(/\.html$/, "").replace(/\/index$/, "/") !== location.pathname.replace(/\.html$/, "").replace(/\/index$/, "/")) return;
    const target = a.hash && document.getElementById(a.hash.slice(1));
    if (!target) return;
    e.preventDefault();
    nav.classList.remove("menu");
    glide(target);
    history.pushState(null, "", a.hash);
  });
  // An unhurried scroll to a section: eases in, cruises, eases out. Longer trips take a little longer
  // (about 1.2–3 s), and any wheel, touch or key from the visitor hands control straight back.
  function glide(target) {
    const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    const from = scrollY, to = Math.min(target.getBoundingClientRect().top + scrollY - margin, document.documentElement.scrollHeight - innerHeight);
    const dist = to - from;
    if (reduced || Math.abs(dist) < 2) { scrollTo(0, to); return; }
    const dur = Math.min(3000, 1200 + Math.abs(dist) * .15);
    const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const t0 = performance.now();
    let stop = false;
    const cancel = () => { stop = true; };
    const evs = ["wheel", "touchstart", "keydown"];
    evs.forEach(n => addEventListener(n, cancel, { passive: true, once: true }));
    const step = now => {
      if (stop) return;
      const t = Math.min(1, (now - t0) / dur);
      scrollTo(0, from + dist * ease(t));
      if (t < 1) requestAnimationFrame(step);
      else evs.forEach(n => removeEventListener(n, cancel));
    };
    requestAnimationFrame(step);
  }

  // Scroll-driven: everything below is a pure function of scroll position, so it plays backwards
  // when you scroll back up and nothing can be skipped past half-shown.
  const reveals = $$("[data-reveal]");
  const mark = $(".pill .home img");
  const desktop = matchMedia("(min-width: 901px) and (hover: hover)");
  const big = $(".bigmark svg, .bigmark img") || $(".bigmark");
  let gear = scrollY * .32, bigGear = scrollY * .05, frame = 0;
  const smooth = t => t * t * (3 - 2 * t);
  // Keytruda figure: lead lines draw out from the protein and the labels decode, cyber style
  const mol = $(".molecule");
  const leads = mol ? $$(".lead", mol) : [], dots = mol ? $$(".dot", mol) : [];
  const decoders = $$("[data-decode]").map(el => {
    const [a, b] = el.dataset.decode.split(" ").map(Number);
    // every text node, so nested markup (the small second line) survives
    const nodes = [];
    const walk = n => n.nodeType === 3 ? nodes.push({ n, text: n.textContent }) : [...n.childNodes].forEach(walk);
    walk(el);
    el.setAttribute("aria-label", el.textContent);
    return { el, a, b, nodes, len: nodes.reduce((t, x) => t + x.text.length, 0), shown: -1 };
  });
  // only characters the labels already use, so every glyph exists in the mono font
  const GLYPHS = [...new Set(decoders.map(d => d.el.textContent).join("").replace(/\s/g, ""))];
  const rand = () => GLYPHS[Math.random() * GLYPHS.length | 0];
  let lastGlitch = 0;
  const decode = (d, q, now) => {
    if (q === d.shown && (q <= 0 || q >= 1)) return false;
    const live = q > 0 && q < 1;
    if (live && q === d.shown && now - lastGlitch < 55) return true;
    d.shown = q;
    const cut = q * (d.len + 6); // settled characters; the next few are flickering noise, the rest blank
    let i = 0;
    for (const x of d.nodes) {
      let out = "";
      for (const ch of x.text) {
        if (/\s/.test(ch) || i < cut - 6) out += ch;
        else if (i < cut) out += rand();
        else out += "\u00a0";
        i++;
      }
      x.n.textContent = out;
    }
    return live;
  };
  const scrub = () => {
    frame = 0;
    const vh = innerHeight;
    if (mol) {
      const r = mol.getBoundingClientRect();
      // 0 as the figure's top reaches the bottom of the screen, 1 once it is well in view
      const p = Math.min(1, Math.max(0, (vh * .95 - r.top) / (vh * .6)));
      const seg = (a, b) => Math.min(1, Math.max(0, (p - a) / (b - a)));
      const draw = [seg(.15, .5), seg(.32, .68)];
      leads.forEach((l, i) => { l.style.strokeDashoffset = (1 - draw[i]).toFixed(3); });
      const pop = { d1a: seg(.1, .2), d1b: seg(.48, .58), d2a: seg(.27, .37), d2b: seg(.66, .76) };
      dots.forEach(dt => { const k = [...dt.classList].find(c => pop[c] !== undefined); const v = smooth(pop[k]); dt.style.transform = `scale(${(v * (1 + .6 * Math.sin(v * Math.PI))).toFixed(3)})`; });
      const now = performance.now();
      let flicker = false;
      const stacked = !desktop.matches && innerWidth <= 900; // phones: the stats sit in a column under the protein
      for (const d of decoders) {
        const q = stacked ? (vh * .92 - d.el.getBoundingClientRect().top) / (vh * .3) : (p - d.a) / (d.b - d.a);
        flicker = decode(d, Math.min(1, Math.max(0, q)), now) || flicker;
      }
      if (flicker) { lastGlitch = now; frame = requestAnimationFrame(scrub); }
    }
    for (const el of reveals) {
      const r = el.getBoundingClientRect();
      // fades up over the first ~30% of the screen after its top edge appears
      const p = smooth(Math.min(1, Math.max(0, (vh - r.top) / (vh * .3))));
      el.style.opacity = p.toFixed(3);
      el.style.transform = p > .999 ? "none" : `translate3d(0, ${((1 - p) * 22).toFixed(1)}px, 0)`;
    }
    // the nav mark turns like a gear with the page: eased toward the scroll angle so it has a little weight
    if (mark && desktop.matches) {
      const target = scrollY * .32;
      gear += (target - gear) * .14;
      mark.style.transform = `rotate(${gear.toFixed(2)}deg)`;
      if (Math.abs(target - gear) > .05 && !frame) frame = requestAnimationFrame(scrub);
    }
    // the big people-section mark turns too, much slower (it's huge) and on every screen size
    if (big) {
      const target = scrollY * .05;
      bigGear += (target - bigGear) * .1;
      big.style.transform = `rotate(${bigGear.toFixed(2)}deg)`;
      if (Math.abs(target - bigGear) > .05 && !frame) frame = requestAnimationFrame(scrub);
    }
  };
  const queue = () => { if (!frame) frame = requestAnimationFrame(scrub); };
  if (reduced) reveals.forEach(el => { el.style.opacity = 1; });
  else {
    scrub();
    addEventListener("scroll", queue, { passive: true });
    addEventListener("resize", queue);
    addEventListener("load", queue);
  }

  // Bio drawer
  const drawer = $(".drawer");
  if (drawer) {
    let last;
    const open = id => {
      const t = document.getElementById("bio-" + id);
      if (!t) return;
      last = document.activeElement;
      $(".drawer-body", drawer).innerHTML = t.innerHTML;
      drawer.classList.add("open");
      document.body.style.overflow = "hidden";
      $(".close", drawer).focus();
    };
    const close = () => {
      drawer.classList.remove("open");
      document.body.style.overflow = "";
      last?.focus();
    };
    $$("[data-bio]").forEach(b => b.addEventListener("click", () => open(b.dataset.bio)));
    $(".scrim", drawer).addEventListener("click", close);
    $(".close", drawer).addEventListener("click", close);
    addEventListener("keydown", e => { if (e.key === "Escape" && drawer.classList.contains("open")) close(); });
  }

  // Programs wheel: loops forever through the list
  const wheel = $(".wheel");
  if (wheel) {
    const ul = $("ul", wheel);
    const originals = $$("li", ul);
    const N = originals.length;
    // three copies so there is always something above and below the active row
    const before = originals.map(li => { const c = li.cloneNode(true); c.setAttribute("aria-hidden", "true"); return c; });
    const after = originals.map(li => { const c = li.cloneNode(true); c.setAttribute("aria-hidden", "true"); return c; });
    ul.prepend(...before); ul.append(...after);
    const all = $$(".box", ul);
    let pos = N; // index into all (middle copy)
    let timer;
    const rowH = () => all[0].offsetHeight + 10;
    const centre = () => Math.floor((parseInt(getComputedStyle(wheel).getPropertyValue("--rows")) || 7) / 2);
    const place = animate => {
      if (!animate) ul.style.transition = "none";
      ul.style.transform = `translateY(${(centre() - pos) * rowH()}px)`;
      if (!animate) { ul.offsetHeight; ul.style.transition = ""; }
      all.forEach((b, i) => b.classList.toggle("on", i === pos));
    };
    const go = (n, fromUser) => {
      pos = n; place(true);
      if (fromUser) history.replaceState(null, "", "#" + all[pos].dataset.slug);
    };
    ul.addEventListener("transitionend", () => {
      if (pos < N || pos >= 2 * N) { pos = ((pos % N) + N) % N + N; place(false); }
    });
    const auto = () => { clearInterval(timer); timer = setInterval(() => go(pos + 1), 2200); };
    // hands off: the wheel only turns on its own (no clicks, scrolling, swiping or keys)
    const fromHash = originals.findIndex(li => "#" + $(".box", li).dataset.slug === location.hash);
    pos = N + Math.max(0, fromHash);
    place(false);
    // fonts change the row height; settle the position before showing the list
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { place(false); wheel.classList.add("ready"); });
    addEventListener("resize", () => place(false));
    // pause while the tab is hidden so it doesn't race to catch up on return
    document.addEventListener("visibilitychange", () => document.hidden ? clearInterval(timer) : !reduced && auto());
    if (!reduced) auto();
  }

  // Join: apply / refer
  const seg = $(".seg");
  if (seg) {
    const form = seg.closest("form");
    const set = mode => {
      $$("button", seg).forEach(b => b.setAttribute("aria-pressed", b.dataset.mode === mode));
      $$("[data-only]", form).forEach(el => {
        const show = el.dataset.only === mode;
        el.hidden = !show;
        el.required = show && el.hasAttribute("data-req");
        el.disabled = !show;
      });
      // wording that changes between applying yourself and referring someone else
      $$("[data-ph-refer]", form).forEach(el => {
        el.dataset.phApply ??= el.placeholder;
        el.placeholder = mode === "refer" ? el.dataset.phRefer : el.dataset.phApply;
      });
      const btn = $(".submit", form);
      if (btn?.dataset["label" + mode[0].toUpperCase() + mode.slice(1)]) btn.textContent = btn.dataset["label" + mode[0].toUpperCase() + mode.slice(1)];
      form.dataset.mode = mode;
    };
    $$("button", seg).forEach(b => b.addEventListener("click", () => set(b.dataset.mode)));
    set(location.hash === "#refer" ? "refer" : "apply");
  }

  // Forms: compose an email to the team, then show a thank-you state.
  // There is no server: this opens the visitor's own mail app with the message to the team ready to send.
  const tidy = v => String(v || "").trim();
  const who = (name, email) => email ? `${name} <${email}>` : name;
  const compose = (form, fd) => {
    const f = k => tidy(fd.get(k));
    const lines = (...rows) => rows.filter(([, v]) => v).map(([k, v]) => v.includes("\n") ? `${k}:\n${v}` : `${k}: ${v}`).join("\n\n");
    if (form.dataset.kind === "contact") return {
      subject: `Website message: ${f("topic")} – ${f("name")}`,
      body: "New message from the Lazarys website\n\n" + lines(
        ["From", who(f("name"), f("email"))], ["About", f("topic")], ["Message", f("message")]),
    };
    if (form.dataset.mode === "refer") return {
      subject: `Referral: ${f("candidate")}${f("role") ? ` (${f("role")})` : ""} – from ${f("name")}`,
      body: "New referral from the Lazarys website\n\n" + lines(
        ["Referring", who(f("candidate"), f("candidate_email"))], ["Would be great at", f("role")],
        ["Why them", f("message")], ["Referred by", who(f("name"), f("email"))]),
    };
    return {
      subject: `Application: ${f("role")} – ${f("name")}`,
      body: "New application from the Lazarys website\n\n" + lines(
        ["Applicant", who(f("name"), f("email"))], ["Wants to work on", f("role")],
        ["What draws them to Lazarys", f("why")], ["Anything else", f("message")]),
    };
  };
  $$("form[data-mail]").forEach(form => {
    form.addEventListener("submit", e => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const { subject, body } = compose(form, new FormData(form));
      const href = `mailto:${form.dataset.mail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      const wrap = form.parentElement;
      $(".thanks a", wrap)?.setAttribute("href", href);
      location.href = href;
      wrap.classList.add("sent");
    });
  });
})();
