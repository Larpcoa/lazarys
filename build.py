"""Builds the Lazarys site into ./site.

Shared chrome (head, nav, footer) + per-page bodies. Bios are pulled from
~/Documents/lazarys-clean/people.html. Run `python3 build.py`, then deploy ./site.
"""
import html
import json
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(ROOT, "site")
ORIGIN = "https://lazarys.com"
EMAIL = "hello@lazarys.com"
LINKEDIN = "https://www.linkedin.com/company/lazaryslabs"
TAGLINE = "Lazarys turns today’s most powerful science into tomorrow’s cancer medicines."
HOME_DESC = ("Lazarys turns today’s most powerful science into tomorrow’s cancer medicines, controlling where proteins "
             "are made, where they stay, and what they do.")
LASTMOD = __import__("datetime").date.today().isoformat()

WORDMARK = open(os.path.join(SITE, "img/wordmark.svg")).read()
MARK = open(os.path.join(SITE, "img/mark.svg")).read()
DOWN = '<svg viewBox="0 0 10 22" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M5 1v19M1 16l4 4 4-4"/></svg>'
RIGHT = '<svg viewBox="0 0 24 10" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M1 5h21M18 1l4 4-4 4"/></svg>'
ARROW = f'<span class="arrow" aria-hidden="true">{RIGHT}</span>'

ORG_LD = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Lazarys",
    "url": ORIGIN + "/",
    "logo": ORIGIN + "/img/icon-512.png",
    "email": EMAIL,
    "contactPoint": [{"@type": "ContactPoint", "contactType": "general enquiries", "email": EMAIL}],
    "description": TAGLINE,
    "sameAs": [LINKEDIN],
    "founder": [{"@type": "Person", "name": "Dylan Paoletti", "jobTitle": "Founder & CEO"}],
    "employee": [
        {"@type": "Person", "name": "Dylan Paoletti", "jobTitle": "Founder & CEO"},
        {"@type": "Person", "name": "Yildirim Dogan", "honorificSuffix": "PhD", "jobTitle": "Co-Founder & CSO"},
        {"@type": "Person", "name": "Peter Evans", "honorificSuffix": "PhD, MPH", "jobTitle": "Co-Founder & Operations"},
    ],
    "knowsAbout": ["cancer therapeutics", "oncology", "messenger RNA", "protein engineering", "genetic engineering", "combination therapy"],
}
SITE_LD = {"@context": "https://schema.org", "@type": "WebSite", "name": "Lazarys", "url": ORIGIN + "/"}

# Hover-to-prerender makes navigation near-instant and lets the crossfade start straight away
SPECULATION = """<script type="speculationrules">
{"prerender": [{"where": {"href_matches": "/*"}, "eagerness": "moderate"}]}
</script>"""

# Runs before first paint: flags JS, and puts the breathing backdrop where the last page left it
BOOT = """<script>
document.documentElement.classList.add("js");
// browsers without cross-document view transitions fade the page in themselves
if (!("onpagereveal" in window)) document.documentElement.classList.add("fade-in");
// home: hold the page still until the hero has finished fading in (not when coming back or reloading mid-page)
if (location.pathname === "/" || location.pathname === "/index.html") {
  var nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
  if (!location.hash && !(nav && (nav.type === "back_forward" || nav.type === "reload")) && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.documentElement.classList.add("intro");
    setTimeout(function () { document.documentElement.classList.remove("intro"); }, 2900);
  }
}
document.documentElement.style.setProperty("--b", ((1 - Math.cos(Date.now() / 36000 * Math.PI * 2)) / 2).toFixed(4));
</script>"""


def head(path, title, desc, atmos=False, locked=False, ld=None, index=True):
    url = ORIGIN + path
    preload_hero = '\n<link rel="preload" href="/img/hero.jpg" as="image" fetchpriority="high">' if atmos else ""
    jsonld = "".join(f'\n<script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>' for x in (ld or []))
    robots = "" if index else '\n<meta name="robots" content="noindex">'
    cls = ' class="locked"' if locked else ""
    return f"""<!doctype html>
<html lang="en"{cls}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">{robots}
<link rel="canonical" href="{url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Lazarys">
<meta property="og:url" content="{url}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="{ORIGIN}/img/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Lazarys">
<meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{ORIGIN}/img/og.jpg">
<meta name="author" content="Lazarys">
<meta name="theme-color" content="#e3e0db">
<link rel="icon" href="/img/star.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/img/icon-180.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preload" href="/fonts/disket-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/oxanium.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/poppins-400.woff2" as="font" type="font/woff2" crossorigin>{preload_hero}
<link rel="stylesheet" href="/style.css">
{BOOT}
{SPECULATION}{jsonld}
</head>
<body>"""


def nav(active=""):
    def link(href, label, key):
        cur = ' aria-current="page"' if key == active else ""
        return f'<a href="{href}"{cur}>{label}</a>'
    return f"""
<header class="nav">
  <a class="wordmark" href="/" aria-label="Lazarys home">{WORDMARK}</a>
  <nav class="pill" aria-label="Main">
    {link("/programs", "programs", "programs")}<i></i>
    {link("/#people", "people", "people")}<i></i>
    <a class="home" href="/" aria-label="Home"><img src="/img/star.svg" alt="" width="26" height="26"></a><i></i>
    {link("/contact", "contact", "contact")}<i></i>
    {link("/join", "Join us", "join")}
  </nav>
  <div class="nav-end">
    <a class="join-cta" href="/join">Join us</a>
    <button class="burger" aria-label="Menu" aria-expanded="false"><img src="/img/star.svg" alt="" width="24" height="24"></button>
  </div>
</header>"""


def tail(scripts):
    return "".join(f'\n<script src="/{x}.js" defer></script>' for x in scripts) + "\n</body>\n</html>\n"


def page(name, path, title, desc, active, body, scripts=("site", "contrast"), **kw):
    out = head(path, title, desc, atmos="atmos" in body, **kw) + nav(active) + body + tail(scripts)
    open(os.path.join(SITE, name), "w").write(out)
    print("wrote", name, len(out))


# ---------- People ----------
src = open(os.path.expanduser("~/Documents/lazarys-clean/people.html")).read()
BIOS = {}
for art in re.findall(r'<article class="person".*?</article>', src, re.S):
    name = html.unescape(re.sub("<[^>]+>", "", re.search(r"<h3>(.*?)</h3>", art).group(1)))
    bio = re.search(r'<div class="bio">(.*)<button', art, re.S).group(1)
    BIOS[name.split()[0].lower()] = re.sub(r"</?div[^>]*>", "", bio).strip()

PEOPLE = {
    "leaders": [
        ("dylan", "Dylan Paoletti", "Founder &amp; CEO"),
        ("yildirim", "Yildirim (“Yil”) Dogan, PhD", "Co-Founder &amp; CSO"),
        ("peter", "Peter Evans, PhD, MPH", "Co-Founder &amp; Operations"),
    ],
    "sab": [
        ("chris", "Chris Mason, MD, PhD", "Professor of Cell and Gene Therapy, University College London; Founder &amp; CEO, Sun Vectors"),
        ("axel", "Axel Schambach, MD, PhD", "Professor of Experimental Hematology, Hannover Medical School; President, ESGCT"),
    ],
}


def plain(s):
    return html.unescape(re.sub("<[^>]+>", "", s))


def people(group):
    return "\n".join(f"""      <div class="person">
        <b>{name}</b><span>{role}</span>
        <button class="arrow" data-bio="{key}" aria-label="Read {html.escape(plain(name))}’s bio">{RIGHT}</button>
      </div>""" for key, name, role in PEOPLE[group])


def templates():
    return "\n".join(
        f'<template id="bio-{key}"><h3>{name}</h3><p class="role">{role}</p><div class="bio">{BIOS[key]}</div></template>'
        for group in PEOPLE.values() for key, name, role in group)


# ---------- Footer (home only) ----------
TICKER_ITEMS = ["looks like lazarys", "redefines modalities", "combines potent, validated biology", "does more with less toxicity"]
ticker_ul = "<ul>" + "".join(f'<li><img src="/img/star.svg" alt="" width="22" height="22">{t}</li>' for t in TICKER_ITEMS * 2) + "</ul>"
LINKEDIN_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><defs><mask id="li"><rect width="24" height="24" fill="#fff"/><circle cx="7" cy="7.4" r="1.7" fill="#000"/><rect x="5.5" y="10" width="3" height="8.6" fill="#000"/><path d="M10.6 10h2.9v1.3c.5-.9 1.6-1.6 3.1-1.6 2.7 0 3.4 1.8 3.4 4.2v4.7h-3v-4.2c0-1.1-.2-2.2-1.6-2.2s-1.8 1.1-1.8 2.2v4.2h-3z" fill="#000"/></mask></defs><rect width="24" height="24" rx="4" fill="currentColor" mask="url(#li)"/></svg>'
MAIL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><rect x="1.5" y="4" width="21" height="16" rx="2.5"/><path d="M2.5 5.5l9.5 7.2 9.5-7.2"/></svg>'

FOOTER = f"""
<section class="vision" id="vision" aria-labelledby="vision-h">
  <div class="sun" aria-hidden="true"></div>
  <h2 class="tag" id="vision-h" data-reveal>our vision</h2>
  <h3 class="soft on-dark soft-text">The future of oncology</h3>
  <div class="ticker soft-text" role="marquee" aria-label="{', '.join(TICKER_ITEMS)}">{ticker_ul}{ticker_ul.replace('<ul>', '<ul aria-hidden="true">')}</div>
  <footer class="foot">
    <a class="wordmark" href="/" aria-label="Lazarys home">{WORDMARK}</a>
    <p class="soft on-dark soft-text">© 2026 lazarys.<br>Unlocking the next great cancer medicines.<br>Various programs in active development.</p>
    <div class="foot-icons">
      <a href="{LINKEDIN}" target="_blank" rel="noopener" aria-label="Lazarys on LinkedIn">{LINKEDIN_SVG}</a>
      <a href="mailto:{EMAIL}" aria-label="Email {EMAIL}">{MAIL_SVG}</a>
    </div>
  </footer>
</section>"""

# ---------- Story (context → bottleneck) ----------
CONTEXT_BEATS = [
    "What looks like a peaceful day is actually a very busy environment inside the body.",
    "We exist in a highly controlled and delicate equilibrium, with the immune system constantly fighting hundreds of small battles to prevent pathogens and cancers from killing us.",
    "Every now and then, this system falls into disorder. With cancer, we need to push the immune system back in the patient’s favor – back against the tumor, transiently, so that we can restore balance.",
    "Push too far one way and you get unwanted toxicity. Too little and the immune system can’t find diseases or cancers.",
    "Mother nature has already given us clues to a future where cancer no longer has to be a lethal disease. Research has now discovered thousands of proteins with anti-tumor effects.",
    "We believe it’s time oncology got a major upgrade.",
]
BOTTLENECK_BEATS = [
    "Today’s individual therapeutics, targets, and mechanisms leave escape routes.",
    "Over 50 years of clinical research has shown that the right combinations produce deeper, longer-lasting responses.",
    "Off-target effects limit which molecules and mechanisms we can combine and how much a patient can tolerate.",
]


def hero_title():
    lines = ["Lazarys turns today’s", "most powerful science into", "tomorrow’s cancer medicines."]
    out, i = [], 0
    for line in lines:
        words = []
        for w in line.split():
            words.append(f'<span class="w" style="--i:{i}">{w}</span>')
            i += 1
        out.append(f'<span class="ln">{" ".join(words)} </span>')
    return "".join(out)


ENGINES = [
    ("e1", "engine 1: genetic engineering", "High-throughput screening for ever-improving control over which cells make therapeutic proteins."),
    ("e2", "engine 2: protein engineering", "ML-enabled protein engineering adds tumor-binding functions to some proteins, helping retain therapeutic activity locally."),
    ("e3", "engine 3: pathway engineering", "We combine therapeutic biology that attack cancer in powerful, clinically validated, complementary ways."),
]
# the loop of arrows around the photo (viewBox 1200 x 880): pieces of one circle, with gaps where the
# engines sit. Into engine 1, 1 → 2, 2 → 3, and out of 3; angles in degrees, screen coordinates (y down).
LOOP = dict(cx=600, cy=400, rx=400, ry=400)
LOOP_GAPS = [(232, 192), (166, 114), (66, 14), (-12, -52)]


def _arc(a, b):
    import math
    pt = lambda t: (LOOP["cx"] + LOOP["rx"] * math.cos(math.radians(t)), LOOP["cy"] + LOOP["ry"] * math.sin(math.radians(t)))
    (x0, y0), (x1, y1) = pt(a), pt(b)
    return f'M{x0:.1f} {y0:.1f} A{LOOP["rx"]} {LOOP["ry"]} 0 0 0 {x1:.1f} {y1:.1f}'


ENGINE_ARCS = [_arc(a, b) for a, b in LOOP_GAPS]


def engines():
    colours = ["#fc8629", "#f7703a", "#f45a30", "#fb3a1c"]  # orange round to red, like the deck
    # a single heartbeat surge travels round the loop: it runs down one arc, and as it reaches the end
    # the next arc takes over (--i staggers them in CSS)
    arcs = "".join(f'<path class="arc" d="{d}" stroke="{colours[i]}" pathLength="100" marker-end="url(#tip{i})" style="--i:{i}"/>'
                   f'<path class="spark" d="{d}" pathLength="100" style="--i:{i}"/>' for i, d in enumerate(ENGINE_ARCS))
    # arrowheads: two strokes meeting at a right angle (each 45° off the line)
    tips = "".join(f'<marker id="tip{i}" viewBox="0 0 12 16" refX="9" refY="8" markerWidth="15" markerHeight="20" markerUnits="userSpaceOnUse" orient="auto"><path d="M3 2 L9 8 L3 14" fill="none" stroke="{c}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker>'
                   for i, c in enumerate(colours))
    glow = '<filter id="glow" filterUnits="userSpaceOnUse" x="-60" y="-60" width="1320" height="1000"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
    cards = "\n".join(f'    <div class="engine {k}"><h3>{t}</h3><p>{b}</p></div>' for k, t, b in ENGINES)
    return f"""  <div class="engines" data-reveal>
    <svg class="loop" viewBox="0 0 1200 880" aria-hidden="true"><defs>{tips}{glow}</defs>{arcs}</svg>
    <img class="photo" src="/img/lab.jpg" alt="A Lazarys scientist pipetting samples at a biosafety cabinet" loading="lazy" decoding="async" width="502" height="502">
{cards}
  </div>"""


def beats(items):
    return "\n".join(f'        <p class="beat">{t}</p>' for t in items)


# ---------- Home ----------
home = f"""
<main>
<div class="dive">
<section class="atmos hero" aria-label="Introduction">
  <div class="bg" aria-hidden="true"></div>
  <div class="hero-copy soft on-dark">
    <h1>{hero_title()}</h1>
    <a class="learn" href="#context">learn more <span class="down">{DOWN}</span></a>
  </div>
  <div class="backed">Backed early by<img src="/img/backers.png" alt="1517 Fund and Emergent Ventures" width="435" height="145"></div>
</section>
</div>

<section class="story" id="context" aria-label="Context and bottleneck">
  <div class="story-stage">
    <div class="slot slot-a"><img data-morph="from" src="/img/swing.jpg" alt="A figure on a swing made of immune cells, surrounded by pathogens" width="1111" height="941" decoding="async"></div>
    <div class="slot slot-b"><img data-morph="to" src="/img/bedside.jpg" alt="A patient in a hospital bed looking out at the sunrise" width="903" height="847" decoding="async"></div>
    <article class="chapter ch-context">
      <div class="chapter-head"><h2 class="tag">context</h2><h3 class="story-title">never not<br>sick.</h3></div>
      <div class="beats">
{beats(CONTEXT_BEATS)}
      </div>
    </article>
    <article class="chapter ch-bottleneck" id="bottleneck">
      <div class="chapter-head"><h2 class="tag">bottleneck</h2></div>
      <div class="beats">
{beats(BOTTLENECK_BEATS)}
      </div>
    </article>
    <div class="story-rail" aria-hidden="true"><i></i></div>
    <div class="story-next" aria-hidden="true"><span class="down">{DOWN}</span></div>
  </div>
</section>

<section class="keytruda" id="keytruda">
  <h2 data-reveal>The most successful cancer drug <br>in the world still isn’t good enough:</h2>
  <p class="money" data-reveal>in 2025, keytruda made $31b</p>
  <div class="molecule" data-reveal>
    <div class="ghost" aria-hidden="true">{MARK}</div>
    <img class="prot" src="/img/protein.png" alt="Keytruda (pembrolizumab) bound to human PD-1" loading="lazy" decoding="async" width="791" height="381">
    <svg class="leads" viewBox="0 2080 1024 380" preserveAspectRatio="none" aria-hidden="true">
      <g fill="none" stroke="#f0613e" stroke-width="1" vector-effect="non-scaling-stroke"><path class="lead l1" d="M332 2183 H253 L218.5 2138.5" pathLength="1"/><path class="lead l2" d="M700.5 2333.5 L736 2418 H812" pathLength="1"/></g>
    </svg>
    <svg class="leads" viewBox="0 0 1024 380" aria-hidden="true"><g fill="#fb3a1c"><circle class="dot d1b" cx="218.5" cy="58.5" r="3"/><circle class="dot d1a" cx="333" cy="103" r="3"/><circle class="dot d2a" cx="700.5" cy="253.5" r="3"/><circle class="dot d2b" cx="812" cy="338" r="3"/></g></svg>
    <div class="callout c1" data-decode=".5 .78">keytruda (pembrolizumab)<small>bound to human pd-1</small></div>
    <div class="callout c2" data-decode=".72 .92">human pd-1</div>
    <div class="stat s1" data-decode=".3 .55">40+ indication approvals</div>
    <div class="stat s2" data-decode=".4 .65">redosed every 3-6 weeks</div>
    <div class="stat s3" data-decode=".5 .75">&lt;50% of patients respond</div>
  </div>
</section>

<section class="question">
  <div class="rule"></div>
  <p data-reveal>what will bring the next great cancer medicines <br>from possibility into reality?</p>
</section>

<section class="platform">
  <h2 data-reveal>We’re building a platform to control where proteins are made, where they stay, and what they do.</h2>
  <p class="sub" data-reveal>and we’re starting with messenger RNA.</p>
{engines()}
  <a class="btn-out" href="/programs" data-reveal>see our programs in motion {ARROW}</a>
</section>

<section class="people" id="people" aria-labelledby="people-h">
  <div class="tag-row"><h2 class="tag" id="people-h" data-reveal>people</h2></div>
  <div class="bigmark" aria-hidden="true">{MARK}</div>
  <div class="wrap team">
    <h3 data-reveal>Leadership</h3>
    <p class="lede" data-reveal>A team of scientists, builders and operators committed to transforming cancer care through a new generation of what’s possible.</p>
    <div class="grid" data-reveal>
{people("leaders")}
    </div>
    <h3 data-reveal>Scientific Advisory Board</h3>
    <p class="lede" data-reveal>World-leading scientists and clinicians who advise our research, development and clinical strategy.</p>
    <div class="grid two" data-reveal>
{people("sab")}
    </div>
  </div>
  <div class="wrap mission" id="mission">
    <h2 class="tag" data-reveal>our mission</h2>
    <div class="prose" data-reveal>
      <p>Combination therapy made testicular, non-hodgkin lymphoma, and acute lymphoblastic leukemia curable.</p>
      <p>Evolution has dictated that we exist in a delicate equilibrium with the laws and limits of our biology – inscribed in the letters of our genetic code; however, in our modern world, we sometimes have to bend those laws to correct things nature didn’t plan for if we want to survive.</p>
      <p>Lazarys is turning today’s most powerful science into tomorrow’s cancer therapies – to redirect <i>luck</i> in the patient’s favor.</p>
    </div>
  </div>
</section>
{FOOTER}
</main>

<div class="drawer" role="dialog" aria-modal="true" aria-label="Biography">
  <div class="scrim"></div>
  <aside><button class="close">close ×</button><div class="drawer-body"></div></aside>
</div>
{templates()}
"""
page("index.html", "/", "Lazarys | Unlocking the next great cancer medicines", HOME_DESC, "", home,
     scripts=("site", "contrast", "story"), ld=[ORG_LD, SITE_LD])

# ---------- Programs ----------
PROGRAMS = ["lung", "liver", "colorectal", "breast", "ovarian", "pancreatic", "prostate", "bladder", "kidney",
            "skin", "brain", "stomach", "esophageal", "uterine", "cervical", "bile duct", "head and neck"]
items = "\n".join(f'      <li><span class="box" data-slug="{p.replace(" ", "-")}">{p} cancer</span></li>' for p in PROGRAMS)
programs = f"""
<main class="atmos programs">
  <div class="bg" aria-hidden="true"></div>
  <h1 class="sr-only">Programs: the cancers Lazarys is making therapeutics for</h1>
  <div class="picker">
    <div class="box">making therapeutics for</div>
    <div class="wheel" tabindex="-1">
      <ul>
{items}
      </ul>
    </div>
  </div>
  <div class="prog-note">
    <p>Lazarys is unlocking the next great cancer medicines.</p>
    <div class="rule"></div>
    <p>More soon.</p>
    <a class="btn-out" href="/contact">contact us {ARROW}</a>
  </div>
</main>
"""
page("programs.html", "/programs", "Programs | Lazarys",
     "Lazarys is making therapeutics for lung, liver, colorectal, breast, ovarian, pancreatic and other cancers.",
     "programs", programs, locked=True, ld=[{"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "Lazarys", "item": ORIGIN + "/"}, {"@type": "ListItem", "position": 2, "name": "Programs", "item": ORIGIN + "/programs"}]}])

# ---------- Contact & Join ----------
FORMNOTE = '<div class="formnote"><div class="rule"></div><p>Lazarys turns today’s most powerful science<br>into tomorrow’s cancer medicines.</p></div>'

contact = f"""
<main class="atmos formpage">
  <div class="bg" aria-hidden="true"></div>
  <div class="form-col">
    <h1>say hello</h1>
    <form class="form" data-mail="{EMAIL}" data-kind="contact" novalidate>
      <input class="field" name="name" placeholder="Your name" autocomplete="name" required aria-label="Your name">
      <input class="field" name="email" type="email" placeholder="Email address" autocomplete="email" required aria-label="Email address">
      <input class="field" name="topic" placeholder="What’s this about?" required aria-label="What’s this about?">
      <textarea class="field" name="message" placeholder="Tell us a little more" aria-label="Message"></textarea>
      <button class="submit" type="submit">Send message</button>
    </form>
    <p class="direct">or write to us at <a href="mailto:{EMAIL}">{EMAIL}</a></p>
    <div class="thanks" role="status"><h2>thank you</h2><p>Your email app should now be open with your message ready to send. Nothing happened? Write to us at <a href="mailto:{EMAIL}">{EMAIL}</a>.</p></div>
    {FORMNOTE}
  </div>
</main>
"""
page("contact.html", "/contact", "Contact | Lazarys", f"Say hello to Lazarys, the team unlocking the next great cancer medicines. Reach us at {EMAIL}.", "contact", contact, locked=True, ld=[{"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "Lazarys", "item": ORIGIN + "/"}, {"@type": "ListItem", "position": 2, "name": "Contact", "item": ORIGIN + "/contact"}]}])

join = f"""
<main class="atmos formpage">
  <div class="bg" aria-hidden="true"></div>
  <div class="join-grid">
    <div class="slogans l" aria-hidden="true">
      <div class="slogan">build what cancer<b>cannot escape</b></div>
      <div class="slogan">turn science<b>into therapies</b></div>
    </div>
    <div class="form-col">
      <h1>Join lazarys</h1>
      <form class="form" data-mail="{EMAIL}" data-kind="join" novalidate>
        <div class="seg" role="group" aria-label="Apply or refer">
          <button type="button" data-mode="apply" aria-pressed="true">apply</button>
          <button type="button" data-mode="refer" aria-pressed="false">refer</button>
        </div>
        <input class="field" name="name" placeholder="Your name" autocomplete="name" required aria-label="Your name">
        <input class="field" name="email" type="email" placeholder="Email address" autocomplete="email" required aria-label="Email address">
        <input class="field" name="candidate" placeholder="Who are you referring?" aria-label="Who are you referring?" data-only="refer" data-req hidden disabled>
        <input class="field" name="candidate_email" type="email" placeholder="Their email address" aria-label="Their email address" data-only="refer" hidden disabled>
        <input class="field" name="role" placeholder="What would you like to work on?" data-ph-refer="What would they be great at?" required aria-label="Role or area">
        <input class="field" name="why" placeholder="What draws you to Lazarys?" aria-label="What draws you to Lazarys?" data-only="apply">
        <textarea class="field" name="message" placeholder="Anything else? Links, a CV, work you’re proud of" data-ph-refer="Why them? Links or anything we should see" aria-label="Anything else"></textarea>
        <button class="submit" type="submit" data-label-apply="Send application" data-label-refer="Send referral">Send application</button>
      </form>
      <div class="thanks" role="status"><h2>thank you</h2><p>Your email app should now be open with everything filled in. Attach a CV if you have one. Nothing happened? Write to us at <a href="mailto:{EMAIL}">{EMAIL}</a>.</p></div>
      {FORMNOTE}
    </div>
    <div class="slogans r" aria-hidden="true">
      <div class="slogan">work at the<b>frontier of biology</b></div>
      <div class="slogan"><b>Join the mission</b></div>
    </div>
  </div>
</main>
"""
page("join.html", "/join", "Join | Lazarys", "Work at the frontier of biology. Apply to Lazarys or refer someone great.", "join", join, locked=True, ld=[{"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "Lazarys", "item": ORIGIN + "/"}, {"@type": "ListItem", "position": 2, "name": "Join", "item": ORIGIN + "/join"}]}])

# ---------- 404 ----------
missing = f"""
<main class="atmos formpage">
  <div class="bg" aria-hidden="true"></div>
  <div class="form-col">
    <h1>page not found</h1>
    <a class="btn-out" href="/">back to lazarys {ARROW}</a>
  </div>
</main>
"""
page("404.html", "/404", "Page not found | Lazarys", TAGLINE, "", missing, scripts=("site",), locked=True, index=False)

# ---------- SEO files + hosting config ----------
open(os.path.join(SITE, "robots.txt"), "w").write(f"User-agent: *\nAllow: /\n\nSitemap: {ORIGIN}/sitemap.xml\n")
urls = "".join(f"  <url><loc>{ORIGIN}{p}</loc><lastmod>{LASTMOD}</lastmod><changefreq>monthly</changefreq><priority>{pr}</priority></url>\n"
               for p, pr in [("/", "1.0"), ("/programs", "0.8"), ("/join", "0.6"), ("/contact", "0.6")])
open(os.path.join(SITE, "sitemap.xml"), "w").write(
    f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}</urlset>\n')

open(os.path.join(SITE, "site.webmanifest"), "w").write(json.dumps({
    "name": "Lazarys", "short_name": "Lazarys", "description": TAGLINE, "start_url": "/", "display": "browser",
    "background_color": "#e3e0db", "theme_color": "#e3e0db",
    "icons": [{"src": "/img/icon-180.png", "sizes": "180x180", "type": "image/png"},
              {"src": "/img/icon-512.png", "sizes": "512x512", "type": "image/png"}],
}, indent=2) + "\n")

VERCEL = {
    "cleanUrls": True,
    "trailingSlash": False,
    "headers": [
        {"source": "/fonts/(.*)", "headers": [{"key": "Cache-Control", "value": "public, max-age=31536000, immutable"}]},
        {"source": "/img/(.*)", "headers": [{"key": "Cache-Control", "value": "public, max-age=604800, stale-while-revalidate=86400"}]},
        {"source": "/(.*)", "headers": [
            {"key": "X-Content-Type-Options", "value": "nosniff"},
            {"key": "Referrer-Policy", "value": "strict-origin-when-cross-origin"},
        ]},
    ],
}
open(os.path.join(SITE, "vercel.json"), "w").write(json.dumps(VERCEL, indent=2) + "\n")
