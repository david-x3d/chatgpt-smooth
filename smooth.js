(() => {
  const DEFAULTS = {
    hover: true, popups: true, stream: true, pages: true,
    layout: true, appear: true, blur: true, press: true, glow: true,
    scroll: false, speed: 1
  };
  const root = document.documentElement;
  let settings = { ...DEFAULTS };

  function apply() {
    for (const key of Object.keys(DEFAULTS)) {
      if (typeof DEFAULTS[key] === "boolean") root.classList.toggle("cs-" + key, !!settings[key]);
    }
    root.style.setProperty("--cs-k", String(settings.speed || 1));
    writeSprings();
    queueMicrotask(() => rebuildHighlightCss()); // after the rest of the script has initialised
  }

  // ----------------------------------------------------------------------
  // Real damped springs (SwiftUI-style response / dampingFraction),
  // sampled into CSS linear() easings. Under-damped ones overshoot.
  // ----------------------------------------------------------------------
  const SPRINGS = {
    smooth: { response: 0.5, damping: 1 },     // no bounce, long soft tail
    snappy: { response: 0.36, damping: 0.8 },  // quick, a hint of overshoot
    bouncy: { response: 0.5, damping: 0.62 },  // playful settle
    layout: { response: 0.34, damping: 1 },    // sidebar / panels: quick, no wobble
    send:   { response: 0.42, damping: 0.84 }, // sent message: lifts off, settles softly
    follow: { response: 0.3, damping: 1 }      // streaming: each new line glides up
  };
  const springs = {};

  function springCurve(response, damping) {
    const w = (2 * Math.PI) / response;
    const z = damping;
    const x = (t) => {
      if (z < 1) {
        const wd = w * Math.sqrt(1 - z * z);
        return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
      }
      return 1 - Math.exp(-w * t) * (1 + w * t);
    };
    // settle = first moment after which it stays within 0.1 % of the target
    let settle = 3;
    for (let t = 3; t > 0; t -= 1 / 600) {
      if (Math.abs(x(t) - 1) > 0.001) { settle = t; break; }
    }
    const n = 64;
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push(i === n ? 1 : +x((settle * i) / n).toFixed(4));
    return { easing: `linear(${pts.join(", ")})`, ms: Math.round(settle * 1000) };
  }

  function writeSprings() {
    for (const [name, p] of Object.entries(SPRINGS)) {
      const c = springCurve(p.response * (settings.speed || 1), p.damping);
      springs[name] = c;
      root.style.setProperty("--cs-spring-" + name, c.easing);
      root.style.setProperty("--cs-d-" + name, c.ms + "ms");
    }
  }
  apply();

  // Firefox exposes `browser`, Chromium `chrome` (both promise-based in MV3)
  const ext = globalThis.browser || globalThis.chrome;
  ext.storage.local.get(DEFAULTS).then((s) => { settings = s; apply(); });
  ext.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const [key, v] of Object.entries(changes)) settings[key] = v.newValue;
    apply();
  });

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const k = () => settings.speed || 1;
  const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

  const hasCssAnim = typeof CSSAnimation !== "undefined";
  function once(el, cls, done, maxMs = 950) {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      el.removeEventListener("animationend", onEnd);
      el.classList.remove(cls);
      done && done();
    };
    // a class can run several animations at once (spring motion + blur focus):
    // only finish when the last one has ended, or the spring gets cut off
    function onEnd(e) {
      if (e.target !== el) return;
      if (hasCssAnim && el.getAnimations().some((a) => a instanceof CSSAnimation && a.playState === "running")) return;
      finish();
    }
    el.addEventListener("animationend", onEnd);
    setTimeout(finish, maxMs * k()); // safety net if no animation runs
    el.classList.add(cls);
  }

  // ======================================================================
  // Menus, dropdowns, tooltips, popovers, dialogs — anywhere in the page
  // ======================================================================
  const FLOAT = '[data-radix-popper-content-wrapper], [role="menu"], [role="listbox"], ' +
    '[role="tooltip"], [role="dialog"], [role="alertdialog"], [data-radix-menu-content], ' +
    '[data-radix-select-content], [data-radix-popover-content], [data-floating-ui-portal] > *';
  const DIALOG = '[role="dialog"], [role="alertdialog"]';
  const floats = new Map(); // element -> { kind, rect }

  function floatRoot(el) {
    // animate the outermost floating layer only (e.g. the popper wrapper, not the menu inside)
    return el.closest("[data-radix-popper-content-wrapper]") || el;
  }

  function isBodyLayer(el) {
    if (el.parentElement !== document.body) return false;
    if (el.matches("script, style, link, noscript, template")) return false;
    if (el.querySelector("main, nav, #root, [data-app-root]")) return false; // the app itself
    const pos = getComputedStyle(el).position;
    return pos === "fixed" || pos === "absolute";
  }

  function findFloats(el) {
    const out = [];
    if (el.matches(FLOAT)) out.push(floatRoot(el));
    else {
      const inner = el.querySelector(FLOAT);
      if (inner) out.push(floatRoot(inner));
      else if (isBodyLayer(el)) out.push(el);
    }
    return out;
  }

  const ghosts = new Set();
  function clearGhosts() { for (const g of ghosts) g.remove(); ghosts.clear(); }

  // Radix keeps a closing menu mounted with data-state="closed" while it plays
  // its own exit; such menus must not get a second (ghost) exit from us.
  function isClosing(el) {
    if (el.getAttribute("data-state") === "closed" || el.hidden) return true;
    const c = el.querySelector('[role="menu"], [role="listbox"], [role="dialog"], [role="alertdialog"], ' +
      '[role="tooltip"], [data-radix-menu-content], [data-radix-popover-content], [data-radix-select-content]');
    return !!c && c.getAttribute("data-state") === "closed";
  }

  function animateFloatIn(el, quiet) {
    if (floats.has(el) || el.closest(".cs-out, .cs-out-fade") || isClosing(el)) return;
    const dialog = el.matches(DIALOG) ? el : el.querySelector(DIALOG);
    const f = { kind: dialog ? "fade" : "pop", waiting: false, started: false, timer: 0 };
    floats.set(el, f);
    if (quiet) return; // re-render of a menu that was already open: no second bloom
    clearGhosts();     // a new menu replaces any old one still fading out
    if (dialog) {
      once(el, "cs-fade");
      if (dialog !== el) once(dialog, "cs-dialog");
    } else if (unplaced(el)) {
      // Radix parks a menu off-screen until it has been measured. Start the bloom
      // on its first positioned frame, so none of it plays where nobody sees it
      // and it grows out of the right side of its button.
      f.waiting = true;
      f.timer = setTimeout(() => startPop(el), 120);
    } else {
      startPop(el);
    }
  }

  const unplaced = (el) => el.style.transform.includes("-200%");

  // which way the menu opens, as seen from its button
  const SIDE_OFFSET = { top: [0, 6], bottom: [0, -6], left: [6, 0], right: [-6, 0] };

  function startPop(el) {
    const f = floats.get(el);
    if (!f || f.started) return;
    f.started = true;
    f.waiting = false;
    clearTimeout(f.timer);
    if (!el.isConnected) return;
    const content = el.matches("[data-side]") ? el : el.querySelector("[data-side]");
    const side = content ? content.getAttribute("data-side") : "bottom";
    const [dx, dy] = SIDE_OFFSET[side] || SIDE_OFFSET.bottom;
    el.style.setProperty("--cs-dx", dx + "px");
    el.style.setProperty("--cs-dy", dy + "px");
    once(el, "cs-pop");
    staggerItems(el, side === "top");
  }

  // Menu entries cascade in, starting next to the button the menu came from
  const ITEMS = '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="option"]';
  function staggerItems(el, fromBottom) {
    const items = el.querySelectorAll(ITEMS);
    const n = items.length;
    if (n < 2 || n > 40) return;
    for (let i = 0; i < n; i++) {
      items[i].style.setProperty("--cs-i", Math.min(fromBottom ? n - 1 - i : i, 8));
      once(items[i], "cs-item", null, 1200);
    }
  }

  // While a dialog is open the page behind it recedes (iOS sheet style)
  let appRoot = null;
  function getAppRoot() {
    if (appRoot && appRoot.isConnected) return appRoot;
    appRoot = [...document.body.children].find((c) => c.querySelector("main")) || null;
    if (appRoot) appRoot.classList.add("cs-recede-host");
    return appRoot;
  }
  function updateRecede() {
    const host = getAppRoot();
    if (!host) return;
    let open = false;
    for (const [el, f] of floats) {
      if (f.kind === "fade" && !host.contains(el)) { open = true; break; }
    }
    host.classList.toggle("cs-recede", open && !reducedMotion.matches);
  }

  // React has already removed the portal; put a lifeless copy back in the same
  // spot (its inline styles still position it) and let it fade out.
  function animateFloatOut(el, next) {
    const f = floats.get(el);
    floats.delete(el);
    if (f) clearTimeout(f.timer);
    if (!f || (f.kind === "pop" && !f.started) || isClosing(el)) return;
    if (el.matches('[role="tooltip"]') || el.querySelector('[role="tooltip"]')) return;
    clearGhosts();
    const ghost = el.cloneNode(true);
    for (const n of [ghost, ...ghost.querySelectorAll(".cs-pop, .cs-fade, .cs-dialog, .cs-item")]) {
      n.classList.remove("cs-pop", "cs-fade", "cs-dialog", "cs-item");
    }
    ghost.setAttribute("aria-hidden", "true");
    ghost.inert = true;
    ghost.removeAttribute("id");
    ghost.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
    document.body.insertBefore(ghost, next && next.parentNode === document.body ? next : null);
    ghosts.add(ghost);
    once(ghost, f.kind === "fade" ? "cs-out-fade" : "cs-out", () => {
      ghost.remove();
      ghosts.delete(ghost);
    });
  }

  const isGhost = (n) => n.classList.contains("cs-out") || n.classList.contains("cs-out-fade");

  function handleFloats(mutations) {
    // First pass: did a menu disappear and another appear in the same batch?
    // Then it's a re-render, not close + open.
    let removedFloat = false, addedFloat = false;
    for (const m of mutations) {
      if (m.type !== "childList") continue;
      for (const n of m.removedNodes) {
        if (n.nodeType === 1 && !isGhost(n) && (floats.has(n) || [...floats.keys()].some((f) => n.contains(f)))) removedFloat = true;
      }
      for (const n of m.addedNodes) {
        if (n.nodeType === 1 && !isGhost(n) && !n.inert && findFloats(n).length) addedFloat = true;
      }
    }
    const rerender = removedFloat && addedFloat;

    for (const m of mutations) {
      if (m.type === "attributes") {
        if (m.attributeName === "style") {
          const f = floats.get(m.target);
          if (f && f.waiting && !unplaced(m.target)) startPop(m.target);
          continue;
        }
        if (m.attributeName !== "data-state" && m.attributeName !== "hidden") continue;
        const el = m.target;
        if (el.nodeType !== 1 || !el.matches(FLOAT)) continue;
        const r = floatRoot(el);
        const state = el.getAttribute("data-state");
        if (state === "closed" || el.hidden) floats.delete(r); // claude.ai animates this close itself
        else if (state === "open" && !floats.has(r)) animateFloatIn(r);
        continue;
      }
      if (m.type !== "childList") continue;
      for (const n of m.removedNodes) {
        if (n.nodeType !== 1 || n.isConnected || isGhost(n)) continue;
        if (floats.has(n)) {
          if (!rerender && m.target === document.body) animateFloatOut(n, m.nextSibling);
          else floats.delete(n);
        }
      }
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1 || n.inert || isGhost(n)) continue;
        for (const f of findFloats(n)) animateFloatIn(f, rerender);
      }
    }
    for (const el of floats.keys()) if (!el.isConnected) floats.delete(el);
    updateRecede();
  }

  // ======================================================================
  // Layout glide (FLIP): sidebar collapse, panels opening — only where
  // claude.ai doesn't already animate the change itself.
  // ======================================================================
  const LANDMARKS = 'nav, aside, main, [role="navigation"], [role="complementary"], main > *';
  // claude.ai's current sidebar has its own handling further down
  const OWN_SIDEBAR = '.dframe-sidebar, [data-activity-peek-zone]';
  const LAYOUT_PROPS = /width|left|right|margin|padding|transform|translate|grid|inset|flex|clearance/;
  const snap = new Map(); // element -> rect
  let snapUntil = 0;
  let flipQueued = false;

  function takeSnapshot() {
    snap.clear();
    const els = document.querySelectorAll(LANDMARKS);
    for (let i = 0; i < els.length && i < 40; i++) {
      if (animating(els[i]) || els[i].closest(OWN_SIDEBAR)) continue; // mid-glide rects include our own offset
      const r = els[i].getBoundingClientRect();
      if (r.width) snap.set(els[i], r);
    }
    snapUntil = performance.now() + 900;
  }

  function animating(el) {
    return el.getAnimations().some((a) => a.id === "cs-flip" && a.playState === "running");
  }

  function layoutAlreadyAnimating() {
    return document.getAnimations().some((a) =>
      a.playState === "running" && a.id !== "cs-flip" &&
      typeof CSSTransition !== "undefined" && a instanceof CSSTransition &&
      LAYOUT_PROPS.test(a.transitionProperty));
  }

  function flip() {
    flipQueued = false;
    if (!settings.layout || performance.now() > snapUntil) return;
    const moved = [];
    for (const [el, old] of snap) {
      if (!el.isConnected) continue;
      const now = el.getBoundingClientRect();
      const dx = old.left - now.left;
      const dw = old.width - now.width;
      if ((Math.abs(dx) > 6 || Math.abs(dw) > 6) && now.width && !animating(el)) {
        moved.push({ el, old, now, dx, dw });
      }
    }
    if (moved.length && !layoutAlreadyAnimating()) {
      moved.sort((a, b) => depth(a.el) - depth(b.el)); // outermost first
      const done = [];
      for (const mv of moved) {
        if (done.some((p) => p.contains(mv.el))) continue;
        done.push(mv.el);
        const frames = [{}, {}];
        if (Math.abs(mv.dw) > 6) {
          frames[0].width = mv.old.width + "px";
          frames[1].width = mv.now.width + "px";
        }
        if (Math.abs(mv.dx) > 6) {
          frames[0].translate = `${mv.dx}px 0`;
          frames[1].translate = "0 0";
        }
        const sp = springs.layout || { ms: 450, easing: EASE };
        const a = mv.el.animate(frames, { duration: sp.ms, easing: sp.easing });
        a.id = "cs-flip";
      }
    }
    takeSnapshot(); // keep watching: some apps change layout in several steps
    snapUntil = performance.now() + 400;
  }

  function depth(el) { let d = 0; while ((el = el.parentElement)) d++; return d; }

  function onUserAction(e) {
    if (!settings.layout || reducedMotion.matches) return;
    takeSnapshot();
    const toggle = e.type === "keydown"
      ? (e.key === "b" || e.key === "B") && (e.ctrlKey || e.metaKey) && !e.altKey
      : e.target.closest && e.target.closest(SIDE_TOGGLE);
    if (toggle) sidePrepare();
  }
  addEventListener("pointerdown", onUserAction, true);
  addEventListener("keydown", onUserAction, true);

  // ======================================================================
  // claude.ai's sidebar: collapsing turns the whole sidebar into a small
  // button in a single frame and the page jumps over. Instead, a copy of the
  // open sidebar slides out while the page glides after it (its offset,
  // --df-sidebar-clearance, transitions in smooth.css); opening slides the
  // real sidebar in. The page title, which makes room for the button, glides too.
  // ======================================================================
  const SIDE_TOGGLE = 'button[aria-keyshortcuts$="+b" i], button[aria-label*="seitenleiste" i], ' +
    'button[aria-label*="sidebar" i]';
  const side = { ghost: null, bar: null, w: 0, at: -1e9, title: null, titleLeft: 0, peekAt: -1e9 };

  const frameRoot = () => document.querySelector(".dframe-root");
  const isRtl = (el) => getComputedStyle(el).direction === "rtl";

  // Runs on pointerdown / Ctrl+B, i.e. while the sidebar still looks open.
  function sidePrepare() {
    const frame = frameRoot();
    side.ghost = null;
    side.at = performance.now();
    if (!frame || frame.hasAttribute("data-phone-sheet")) return;
    // title, its menu arrow and icons move as one row
    const title = frame.querySelector('.dframe-header [data-testid="session-title-split"]') ||
      frame.querySelector(".dframe-header h2");
    side.title = title;
    side.titleLeft = title ? title.getBoundingClientRect().left : 0;
    if (frame.hasAttribute("data-collapsed")) return;
    const bar = frame.querySelector(".dframe-sidebar");
    if (!bar) return;
    // the sidebar is positioned against its containing block, not the frame
    const fr = (bar.offsetParent || frame).getBoundingClientRect();
    const b = bar.getBoundingClientRect();
    // rebuild the open-sidebar context around a copy: frame > ... > sidebar
    const wrap = frame.cloneNode(false);
    for (const a of ["id", "data-collapsed", "data-hovering", "data-peeked", "data-resizing"]) wrap.removeAttribute(a);
    let host = wrap;
    const chain = [];
    for (let p = bar.parentElement; p && p !== frame; p = p.parentElement) chain.unshift(p);
    for (const p of chain) {
      const c = p.cloneNode(false);
      c.removeAttribute("id");
      host.appendChild(c);
      host = c;
    }
    const copy = bar.cloneNode(true);
    copy.removeAttribute("id");
    for (const n of copy.querySelectorAll("[id]")) n.removeAttribute("id");
    host.appendChild(copy);
    wrap.classList.add("cs-side-ghost");
    wrap.setAttribute("aria-hidden", "true");
    wrap.inert = true;
    Object.assign(wrap.style, {
      position: "fixed", left: fr.left + "px", top: fr.top + "px", width: fr.width + "px",
      height: fr.height + "px", margin: "0", pointerEvents: "none", zIndex: "2147483600",
      overflow: "hidden", background: "none"
    });
    side.ghost = wrap;
    side.bar = copy;
    side.w = isRtl(frame) ? -(fr.right - b.left) : b.right - fr.left;
  }

  function sideCollapse(frame) {
    const wrap = side.ghost;
    side.ghost = null;
    if (!wrap || performance.now() - side.at > 1500) return;
    root.appendChild(wrap); // outside <body>: invisible to claude.ai and to our observers
    const sp = springs.layout || { ms: 450, easing: EASE };
    const a = side.bar.animate([{ translate: "0 0" }, { translate: `${-side.w}px 0` }],
      { duration: sp.ms, easing: sp.easing, fill: "forwards" });
    const done = () => wrap.remove();
    a.onfinish = a.oncancel = done;
    setTimeout(done, sp.ms + 300);
  }

  function sideExpand(frame) {
    // opened from the hover peek: it is already on screen, nothing to slide
    if (frame.hasAttribute("data-hovering") || performance.now() - side.peekAt < 400) return;
    const bar = frame.querySelector(".dframe-sidebar");
    if (!bar) return;
    const fr = frame.getBoundingClientRect();
    const b = bar.getBoundingClientRect();
    const w = isRtl(frame) ? -(fr.right - b.left) : b.right - fr.left;
    const sp = springs.layout || { ms: 450, easing: EASE };
    const a = bar.animate([{ translate: `${-w}px 0` }, { translate: "0 0" }],
      { duration: sp.ms, easing: sp.easing });
    a.id = "cs-flip";
  }

  function sideTitle() {
    const t = side.title;
    if (!t || !t.isConnected || performance.now() - side.at > 1500) return;
    const dx = side.titleLeft - t.getBoundingClientRect().left;
    side.title = null;
    if (Math.abs(dx) < 2 || Math.abs(dx) > 200) return;
    const sp = springs.layout || { ms: 450, easing: EASE };
    const a = t.animate([{ translate: `${dx}px 0` }, { translate: "0 0" }],
      { duration: sp.ms, easing: sp.easing, composite: "add" });
    a.id = "cs-flip";
  }

  function handleSidebar(mutations) {
    let changed = null;
    for (const m of mutations) {
      if (m.type !== "attributes") continue;
      const t = m.target;
      if (m.attributeName === "data-hovering") side.peekAt = performance.now();
      else if (m.attributeName === "data-collapsed" && t.classList && t.classList.contains("dframe-root") &&
        (m.oldValue !== null) !== t.hasAttribute("data-collapsed")) changed = t;
    }
    if (!changed || changed.hasAttribute("data-phone-sheet") || changed.hasAttribute("data-resizing")) return;
    if (changed.hasAttribute("data-collapsed")) sideCollapse(changed);
    else sideExpand(changed);
    sideTitle();
  }

  // ======================================================================
  // Every click: press squish with spring release, pointer sheen,
  // click pulse, and SF-Symbols-style icon swaps.
  // ======================================================================
  const CLICKABLE = 'button, a[href], summary, label, select, [role="button"], [role="link"], ' +
    '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="option"], ' +
    '[role="tab"], [role="switch"], [role="checkbox"], [role="radio"]';
  const TYPING = 'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), ' +
    'textarea, [contenteditable]:not([contenteditable="false"])';

  function clickable(node) {
    const el = node && node.closest ? node.closest(CLICKABLE) : null;
    if (!el || el.matches(':disabled, [aria-disabled="true"]') || el.closest(TYPING)) return null;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.width * r.height > innerWidth * innerHeight * 0.2) return null;
    if (getComputedStyle(el).display === "inline") return null; // links inside text
    return { el, r };
  }

  const scaleOf = (el) => {
    const v = parseFloat(getComputedStyle(el).scale);
    return isNaN(v) ? 1 : v; // "none" -> 1
  };
  const stopPress = (el) => { for (const a of el.getAnimations()) if (a.id === "cs-press") a.cancel(); };

  // squish `el` (and the sheen layer on top of it) towards `to`
  function squish(el, from, to, release) {
    const sp = springs.bouncy || { ms: 600, easing: EASE };
    const opts = release
      ? { duration: sp.ms, easing: sp.easing }
      : { duration: 150 * k(), easing: "cubic-bezier(0.2, 0.9, 0.3, 1)", fill: "forwards" };
    const a = el.animate([{ scale: String(from) }, { scale: String(to) }], opts);
    a.id = "cs-press";
  }

  let pressed = null;
  function press(c) {
    release();
    const { el, r } = c;
    const cur = scaleOf(el);
    stopPress(el);
    const base = scaleOf(el);
    // small things squish more, big rows barely (Apple-ish ~8px total)
    const d = Math.min(0.1, Math.max(0.02, 8 / Math.max(r.width, r.height)));
    const to = base * (1 - d);
    squish(el, cur, to, false);
    pressed = { el, base, ratio: to / base, sheen: sheen.el === el };
    if (pressed.sheen) { stopPress(sheen.box); squish(sheen.box, 1, pressed.ratio, false); }
  }

  function release(e) {
    if (!pressed) return;
    const { el, base, sheen: withSheen, ratio } = pressed;
    pressed = null;
    const cur = scaleOf(el);
    stopPress(el);
    squish(el, cur, base, true);
    if (withSheen && sheen.box) { stopPress(sheen.box); squish(sheen.box, ratio, 1, true); }
    const touch = e && e.pointerType === "touch";
    setTimeout(() => {
      if (sheen.el && (touch || !sheen.el.isConnected)) sheenHide();
    }, touch ? 650 * k() : 60);
  }

  // ---- sheen: a soft light that follows the pointer over buttons
  const sheen = { box: null, spot: null, el: null, r: null, size: 0, x: 0, y: 0, raf: 0 };

  function sheenInit() {
    if (sheen.box) return;
    sheen.box = document.createElement("div");
    sheen.box.className = "cs-sheen";
    sheen.spot = document.createElement("div");
    sheen.spot.className = "cs-sheen-spot";
    sheen.box.appendChild(sheen.spot);
    root.appendChild(sheen.box); // outside <body>: invisible to claude.ai and to our observers
  }

  function sheenShow(el, r) {
    sheenInit();
    const cs = getComputedStyle(el);
    const b = sheen.box.style;
    b.left = r.left + "px";
    b.top = r.top + "px";
    b.width = r.width + "px";
    b.height = r.height + "px";
    b.borderRadius = cs.borderRadius;
    sheen.box.style.setProperty("--cs-sheen-color", cs.color);
    sheen.size = Math.max(70, Math.min(280, Math.max(r.width, r.height) * 1.3));
    sheen.spot.style.width = sheen.spot.style.height = sheen.size + "px";
    sheen.el = el;
    sheen.r = r;
    // jump (don't glide) to the new element, then glide again
    sheen.spot.style.transition = "none";
    placeSpot();
    requestAnimationFrame(() => { if (sheen.spot) sheen.spot.style.transition = ""; });
    sheen.box.classList.add("cs-on");
  }

  function sheenHide() {
    if (sheen.box) sheen.box.classList.remove("cs-on");
    sheen.el = null;
  }

  function placeSpot() {
    sheen.raf = 0;
    if (!sheen.el) return;
    const x = sheen.x - sheen.r.left - sheen.size / 2;
    const y = sheen.y - sheen.r.top - sheen.size / 2;
    sheen.spot.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
  }

  addEventListener("pointermove", (e) => {
    if (!settings.glow || e.pointerType === "touch" || reducedMotion.matches || pressed) return;
    sheen.x = e.clientX;
    sheen.y = e.clientY;
    if (!sheen.el || !sheen.el.isConnected || !sheen.el.contains(e.target)) {
      const c = clickable(e.target);
      if (!c) { if (sheen.el) sheenHide(); return; }
      sheenShow(c.el, c.r);
    }
    if (!sheen.raf) sheen.raf = requestAnimationFrame(placeSpot);
  }, { capture: true, passive: true });
  addEventListener("scroll", () => { if (sheen.el) sheenHide(); }, { capture: true, passive: true });
  document.addEventListener("pointerleave", sheenHide);

  // ---- click pulse: a ring of light spreading from the pointer
  function pulse(e, c) {
    if (!settings.glow) return;
    sheen.x = e.clientX;
    sheen.y = e.clientY;
    if (sheen.el !== c.el) sheenShow(c.el, c.r);
    const size = Math.max(c.r.width, c.r.height) * 2.4;
    const p = document.createElement("div");
    p.className = "cs-pulse";
    p.style.width = p.style.height = size + "px";
    p.style.left = (e.clientX - c.r.left - size / 2) + "px";
    p.style.top = (e.clientY - c.r.top - size / 2) + "px";
    sheen.box.appendChild(p);
    const a = p.animate(
      [{ scale: "0.04", opacity: 0.32 }, { scale: "1", opacity: 0 }],
      { duration: 700 * k(), easing: "cubic-bezier(0.16, 0.8, 0.24, 1)" });
    a.onfinish = a.oncancel = () => p.remove();
  }

  // ---- icon swaps (copy -> check, send -> stop ...): morph like SF Symbols
  const icons = { list: [], until: 0 };

  function rememberIcons(el) {
    icons.until = performance.now() + 1500;
    icons.list = [...el.querySelectorAll("svg")].slice(0, 4).map((s) => ({
      node: s, rect: s.getBoundingClientRect(), color: getComputedStyle(s).color,
      html: s.outerHTML, replaced: null
    }));
  }

  function handleIcons(mutations) {
    if (!icons.list.length || performance.now() > icons.until) return;
    const added = [];
    for (const m of mutations) {
      if (m.type !== "childList") continue;
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.tagName.toLowerCase() === "svg") added.push(n);
        else added.push(...n.querySelectorAll("svg"));
      }
    }
    for (const n of added.slice(0, 6)) {
      const r = n.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const old = icons.list.find((i) => !i.replaced &&
        Math.abs(i.rect.left + i.rect.width / 2 - cx) < 10 && Math.abs(i.rect.top + i.rect.height / 2 - cy) < 10);
      if (!old || old.html === n.outerHTML) continue; // same icon, just re-rendered
      old.replaced = n;
      once(n, "cs-symbol-in");
    }
    for (const i of icons.list) {
      if (!i.replaced || i.ghosted || i.node.isConnected) continue;
      i.ghosted = true;
      const g = i.node.cloneNode(true);
      Object.assign(g.style, {
        position: "fixed", left: i.rect.left + "px", top: i.rect.top + "px",
        width: i.rect.width + "px", height: i.rect.height + "px", margin: "0",
        color: i.color, pointerEvents: "none", zIndex: "2147483645"
      });
      g.setAttribute("aria-hidden", "true");
      root.appendChild(g);
      once(g, "cs-symbol-out", () => g.remove());
    }
  }

  addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || reducedMotion.matches) return;
    const c = clickable(e.target);
    if (!c) return;
    pulse(e, c); // first, so the sheen layer exists and squishes along
    if (settings.press) { rememberIcons(c.el); press(c); }
  }, true);
  addEventListener("pointerup", release, true);
  addEventListener("pointercancel", release, true);
  addEventListener("dragstart", () => release(), true);
  addEventListener("blur", () => release());
  addEventListener("keydown", (e) => {
    if (e.repeat || (e.key !== "Enter" && e.key !== " ") || !settings.press || reducedMotion.matches) return;
    const c = clickable(document.activeElement);
    if (c) { rememberIcons(c.el); press(c); }
  }, true);
  addEventListener("keyup", () => release(), true);

  // ======================================================================
  // Page changes (settings, projects, switching chats)
  // ======================================================================
  const QUIET_MS = 1200; // no message / streaming effects right after a navigation
  let quietUntil = performance.now() + QUIET_MS;
  const loadQuietUntil = performance.now() + 1500; // the app's first render: nothing fades
  let lastPath = location.pathname;
  let pageUntil = 0; // after a route change, the next content that lands glides in

  function checkRoute() {
    if (location.pathname === lastPath) return;
    const from = lastPath;
    lastPath = location.pathname;
    // sending the first message turns /new into /chat/<id>: that's not a page
    // change, the message and its answer must animate like any other
    if (/^\/(new)?$/.test(from) && location.pathname.startsWith("/chat/")) return;
    quietUntil = performance.now() + QUIET_MS;
    resetStream();
    pageUntil = settings.pages ? performance.now() + 1500 : 0;
  }

  // Runs inside the MutationObserver callback, i.e. before the new content is
  // painted, so it never flashes up first and then blinks back to invisible.
  // Only the new content moves: whatever stays (settings tabs, header) stays put.
  const NAV = 'nav, aside, [role="navigation"]';
  function pageIn(fresh) {
    const main = document.querySelector("main");
    const page = fresh.filter((n) => appearable(n) &&
      (main ? main.contains(n) || n.contains(main) : !n.closest(NAV)));
    if (!page.length) return false;
    let targets = page;
    if (main && (page.length > 8 || page.some((n) => n.contains(main)))) targets = [main];
    for (const el of targets.slice(0, 8)) once(el, "cs-page");
    return true;
  }

  // ======================================================================
  // New messages: yours lifts off from the message box, Claude's rises in
  // ======================================================================
  const USER_MSG = '[data-testid="user-message"]';
  const LIVE = '[data-is-streaming="true"]';
  const RESPONSE = ".font-claude-response, .font-claude-message";
  const COMPOSER = '.ProseMirror, [contenteditable="true"], textarea';
  const SEND_BTN = 'button[type="submit"], button[aria-label*="send" i], button[aria-label*="senden" i]';
  let sentAt = -1e9;

  addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing && e.target.closest && e.target.closest(COMPOSER)) {
      sentAt = performance.now();
    }
  }, true);
  addEventListener("pointerdown", (e) => {
    if (e.target.closest && e.target.closest(SEND_BTN)) sentAt = performance.now();
  }, true);

  function lastOf(sel) {
    const all = document.querySelectorAll(sel);
    return all[all.length - 1] || null;
  }

  function handleNewMessages(fresh) {
    // only right after sending: opening an old chat must not replay its messages
    const sent = performance.now() - sentAt < 6000;
    for (const el of fresh) {
      if (el.closest(".cs-msg, .cs-turn, .cs-page")) continue;
      const msg = sent && (el.matches(USER_MSG) ? el : el.querySelector(USER_MSG));
      if (msg && msg === lastOf(USER_MSG) && el.querySelectorAll(USER_MSG).length <= 1) {
        sendIn(el, msg);
        continue;
      }
      if (el.querySelector(USER_MSG)) continue;
      const live = el.matches(LIVE) ? el : el.querySelector(LIVE);
      const resp = el.matches(RESPONSE) ? el : el.querySelector(RESPONSE);
      if (live || (sent && resp && resp === lastOf(RESPONSE))) once(el, "cs-turn");
    }
  }

  function sendIn(el, msg) {
    // lift off from wherever the bubble sits (left or right aligned)
    const r = msg.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    const ox = box.width ? ((r.left + r.width / 2 - box.left) / box.width) * 100 : 50;
    el.style.setProperty("--cs-ox", ox.toFixed(1) + "%");
    once(el, "cs-msg", () => el.style.removeProperty("--cs-ox"));
  }

  // ======================================================================
  // Text streaming: new words fade in one after another
  // Uses the CSS Custom Highlight API, so claude.ai's DOM is never touched.
  // ======================================================================
  const hasHighlights = typeof Highlight === "function" && CSS.highlights;
  const BUCKETS = 24;                  // fade steps (0 = not revealed yet)
  const colorIdx = new Map();          // computed text colour -> index
  const highlights = [];               // [colourIdx][bucket] -> Highlight
  let hlStyle = null;

  function ensureColor(color) {
    let i = colorIdx.get(color);
    if (i !== undefined) return i;
    i = colorIdx.size;
    colorIdx.set(color, i);
    if (!hlStyle) {
      hlStyle = document.createElement("style");
      (document.head || root).appendChild(hlStyle);
    }
    highlights[i] = [];
    for (let b = 0; b < BUCKETS; b++) {
      const h = new Highlight();
      CSS.highlights.set(`cs-t${i}-${b}`, h);
      highlights[i][b] = h;
    }
    rebuildHighlightCss();
    return i;
  }

  // Each step: glyph colour fades up while a blurred copy of itself
  // (text-shadow) sharpens — words "focus in". Fresh words carry a faint warm glow.
  function highlightRules(color, i) {
    let css = "";
    for (let b = 0; b < BUCKETS; b++) {
      const p = b / BUCKETS;
      const e = 1 - Math.pow(1 - p, 3); // ease-out cubic
      const alpha = Math.round(e * 100);
      let shadow = "none";
      if (b > 0 && settings.blur) {
        const blur = ((1 - e) * 7).toFixed(2);
        const ghost = Math.round((1 - e) * 85);
        const glow = Math.round(Math.pow(1 - p, 2) * 38);
        shadow = `0 0 ${blur}px color-mix(in srgb, ${color} ${ghost}%, transparent), ` +
          `0 0 ${(4 + (1 - e) * 10).toFixed(1)}px color-mix(in srgb, #d97757 ${glow}%, transparent)`;
      }
      css += `::highlight(cs-t${i}-${b}){color:color-mix(in srgb, ${color} ${alpha}%, transparent);text-shadow:${shadow}}\n`;
    }
    return css;
  }

  function rebuildHighlightCss() {
    if (!hlStyle) return;
    let css = "";
    for (const [color, i] of colorIdx) css += highlightRules(color, i);
    hlStyle.textContent = css;
  }

  const stream = {
    el: null, known: 0, segs: [], nextStart: 0, frame: 0, pending: false,
    grewAt: -1e9, lostText: "", lostAt: -1e9
  };

  function resetStream() {
    stream.el = null;
    stream.known = 0;
    stream.segs = [];
    stream.lostText = "";
    follow.el = follow.scroller = follow.list = null;
    clearHighlights();
  }

  // claude.ai may swap the streaming element for its final version when the
  // answer is done: remember what was on screen so it doesn't fade in again
  function loseStream(el) {
    stream.lostText = el.textContent;
    stream.lostAt = performance.now();
    stream.el = null;
    stream.known = 0;
    stream.segs = [];
    clearHighlights();
  }

  // how much of `now` was already visible as `before` (ignores whitespace,
  // which the final render often lays out differently)
  function shownPrefix(before, now) {
    let i = 0, j = 0;
    while (i < before.length && j < now.length) {
      const a = before.charCodeAt(i), b = now.charCodeAt(j);
      if (a === b) { i++; j++; } else if (a <= 32) i++; else if (b <= 32) j++; else break;
    }
    return j;
  }

  function clearHighlights() {
    for (const row of highlights) for (const h of row) h.clear();
  }

  function textNodes(el) {
    const out = [];
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let pos = 0, n;
    while ((n = w.nextNode())) {
      const len = n.data.length;
      if (!len) continue;
      out.push({ node: n, start: pos, end: pos + len });
      pos += len;
    }
    return { nodes: out, total: pos };
  }

  // Spread the words of a chunk out over time so bursts read like a steady flow.
  function scheduleWord(now) {
    const backlog = stream.nextStart - now;
    if (backlog <= 0) stream.nextStart = now;
    else if (backlog > 700 * k()) stream.nextStart = now + 300 * k(); // never fall far behind
    const step = (backlog > 300 * k() ? 8 : 24) * k();
    const t = stream.nextStart;
    stream.nextStart += step;
    return t;
  }

  function rebuild() {
    stream.pending = false;
    const el = stream.el;
    if (!el) return;
    if (!el.isConnected) { loseStream(el); return; }
    const { nodes, total } = textNodes(el);
    const now = performance.now();

    if (total < stream.known) { // text was re-rendered shorter: don't hide anything
      stream.known = total;
      stream.segs = stream.segs.filter((s) => s.a < total);
      for (const s of stream.segs) s.b = Math.min(s.b, total);
    }

    if (total > stream.known) {
      let text = "";
      for (const n of nodes) {
        if (n.end <= stream.known) continue;
        text += n.node.data.slice(Math.max(0, stream.known - n.start));
      }
      const re = /\s*\S+\s*|\s+/g;
      let m;
      while ((m = re.exec(text))) {
        const a = stream.known + m.index;
        stream.segs.push({ a, b: a + m[0].length, t: scheduleWord(now) });
      }
      stream.known = total;
    }

    // map each segment onto live Ranges inside the current text nodes
    let ni = 0;
    for (const s of stream.segs) {
      s.ranges = [];
      while (ni < nodes.length && nodes[ni].end <= s.a) ni++;
      for (let j = ni; j < nodes.length && nodes[j].start < s.b; j++) {
        const n = nodes[j];
        const r = new Range();
        r.setStart(n.node, Math.max(0, s.a - n.start));
        r.setEnd(n.node, Math.min(n.node.data.length, s.b - n.start));
        const parent = n.node.parentElement;
        s.ranges.push({ r, c: ensureColor(parent ? getComputedStyle(parent).color : "currentColor") });
      }
    }
    if (!stream.frame) stream.frame = requestAnimationFrame(paint);
  }

  function paint() {
    stream.frame = 0;
    const now = performance.now();
    const fade = 600 * k();
    clearHighlights();
    stream.segs = stream.segs.filter((s) => now - s.t < fade);
    for (const s of stream.segs) {
      const age = now - s.t;
      const b = age < 0 ? 0 : Math.min(BUCKETS - 1, 1 + Math.floor((age / fade) * (BUCKETS - 1)));
      for (const { r, c } of s.ranges || []) highlights[c][b].add(r);
    }
    if (stream.segs.length) stream.frame = requestAnimationFrame(paint);
  }

  function streamTarget(node) {
    const el = node.nodeType === 1 ? node : node.parentElement;
    if (!el) return null;
    const live = el.closest(LIVE);
    if (live) return live.querySelector(RESPONSE) || live;
    const r = el.closest(RESPONSE);
    return r && r === lastOf(RESPONSE) ? r : null;
  }

  function handleStreamText(mutations) {
    let target = null;
    for (const m of mutations) {
      if (m.type === "attributes" || m.target === document.body) continue;
      target = streamTarget(m.target);
      if (target) break;
    }
    if (!target) return;
    if (target !== stream.el) {
      const text = target.textContent;
      // a message we've never seen that's already long was there before: keep it
      let known = text.length > 400 ? text.length : 0;
      let before = "";
      if (stream.el && !stream.el.isConnected) before = stream.el.textContent;
      else if (performance.now() - stream.lostAt < 4000) before = stream.lostText;
      if (before) known = Math.max(known, shownPrefix(before, text));
      stream.el = target;
      stream.segs = [];
      stream.known = known;
      stream.lostText = "";
    }
    stream.grewAt = performance.now();
    followStart();
    if (!stream.pending) {
      stream.pending = true;
      requestAnimationFrame(rebuild);
    }
  }

  // New blocks at the end of an answer slide in (and fade, if word fading isn't available)
  const BLOCKS = new Set(["P", "LI", "UL", "OL", "PRE", "BLOCKQUOTE", "TABLE", "HR",
    "H1", "H2", "H3", "H4", "H5", "H6", "DIV", "IMG", "FIGURE"]);
  const MEDIA_BLOCKS = new Set(["HR", "IMG", "FIGURE"]); // no text to fade word by word

  function handleStreamBlocks(added) {
    if (added.length > 6) return;
    for (const el of added) {
      if (!BLOCKS.has(el.tagName) || !el.isConnected) continue;
      const msg = el.closest(RESPONSE + ", " + LIVE);
      if (!msg || el === msg) continue;
      if (msg.matches(RESPONSE) && msg !== lastOf(RESPONSE)) continue;
      // streaming only ever appends: a block with content after it is a re-render
      let next = el.nextElementSibling;
      while (next && !BLOCKS.has(next.tagName)) next = next.nextElementSibling;
      if (next) continue;
      if (el.parentElement && el.parentElement.closest(".cs-in, .cs-in-soft")) continue;
      const soft = hasHighlights && !MEDIA_BLOCKS.has(el.tagName);
      once(el, soft ? "cs-in-soft" : "cs-in");
      stream.grewAt = performance.now();
    }
  }

  // ======================================================================
  // While an answer streams in, claude.ai keeps the newest line in view by
  // jumping the scroll position a line at a time. Each jump becomes a glide:
  // the conversation is pushed back by the jump and springs up to rest.
  // ======================================================================
  const follow = {
    el: null, scroller: null, list: null, top: 0, at: 0, painted: NaN, raf: 0,
    userUntil: 0, held: false
  };

  function scrollerOf(el) {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const oy = getComputedStyle(p).overflowY;
      if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight + 1) return p;
    }
    return document.scrollingElement;
  }

  // the outermost wrapper of the conversation that doesn't also hold the
  // message box (that one has to stay where it is)
  function listOf(el, scroller) {
    let list = el;
    for (let p = el.parentElement; p && p !== scroller && p !== document.body; p = p.parentElement) {
      if (p.querySelector(COMPOSER)) break;
      list = p;
    }
    return list;
  }

  function followStart() {
    if (!stream.el || reducedMotion.matches) return;
    if (follow.el !== stream.el) {
      follow.el = stream.el;
      follow.scroller = scrollerOf(stream.el);
      follow.list = listOf(stream.el, follow.scroller);
      follow.top = follow.scroller ? follow.scroller.scrollTop : 0;
      follow.painted = NaN;
    }
    if (!follow.raf) follow.raf = requestAnimationFrame(followTick);
  }

  // Remember where the scroll position stood once each frame was painted.
  // A jump that is already on screen can't be softened any more.
  function followTick() {
    follow.raf = 0;
    if (!follow.scroller || performance.now() - stream.grewAt > 1500) return;
    setTimeout(() => { if (follow.scroller) follow.painted = follow.scroller.scrollTop; }, 0);
    follow.raf = requestAnimationFrame(followTick);
  }

  addEventListener("scroll", (e) => {
    const s = follow.scroller;
    if (!s || !follow.list) return;
    if (e.target !== s && !(e.target === document && s === document.scrollingElement)) return;
    const now = performance.now();
    const top = s.scrollTop;
    const d = top - follow.top;
    const gap = now - follow.at;
    follow.top = top;
    follow.at = now;
    if (!settings.stream || reducedMotion.matches || stream.el !== follow.el) return;
    if (now - stream.grewAt > 1000 || now < follow.userUntil || follow.held) return;
    if (gap < 40) return;                 // a smooth scroll is already running
    if (top === follow.painted) return;   // already painted: too late
    if (d < 2 || d > s.clientHeight * 0.6) return;
    const sp = springs.follow || { ms: 450, easing: EASE };
    const a = follow.list.animate([{ translate: `0 ${d}px` }, { translate: "0 0" }],
      { duration: sp.ms, easing: sp.easing, composite: "add" });
    a.id = "cs-follow";
  }, { capture: true, passive: true });

  // the user scrolling themselves is never smoothed or fought
  const userScrolls = () => { follow.userUntil = performance.now() + 600; };
  addEventListener("wheel", userScrolls, { capture: true, passive: true });
  addEventListener("touchmove", userScrolls, { capture: true, passive: true });
  addEventListener("keydown", (e) => {
    if (/^(PageUp|PageDown|ArrowUp|ArrowDown|Home|End| )$/.test(e.key) &&
      !(e.target.closest && e.target.closest(TYPING))) userScrolls();
  }, true);
  addEventListener("pointerdown", () => { follow.held = true; }, true);
  addEventListener("pointerup", () => { follow.held = false; }, true);
  addEventListener("pointercancel", () => { follow.held = false; }, true);
  addEventListener("pointermove", (e) => { if (!e.buttons) follow.held = false; }, { capture: true, passive: true });

  // ======================================================================
  // Everything else that appears fades in. Only the outermost new element
  // fades: if every nested element faded on its own, their opacities would
  // multiply and the content would show up late and then pop.
  // ======================================================================
  const NO_APPEAR = 'svg, .ProseMirror, [contenteditable]:not([contenteditable="false"]), ' +
    '[data-is-streaming], [role="tooltip"], ' + RESPONSE + ', ' +
    '.cs-pop, .cs-fade, .cs-dialog, .cs-out, .cs-out-fade, .cs-item, ' +
    '.cs-msg, .cs-turn, .cs-page, .cs-in, .cs-in-soft';
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "LINK", "META", "TEMPLATE", "NOSCRIPT", "BR", "WBR"]);
  const appearable = (n) => !SKIP_TAGS.has(n.tagName) && !n.inert && !n.closest(NO_APPEAR);
  const sig = (n) => n.tagName + "|" + (n.getAttribute("class") || "");

  function outermost(nodes) {
    const set = new Set(nodes);
    const out = [];
    for (const n of nodes) {
      if (!n.isConnected) continue;
      let inner = false;
      for (let p = n.parentElement, d = 0; p && d < 40; p = p.parentElement, d++) {
        if (set.has(p)) { inner = true; break; }
      }
      if (!inner) out.push(n);
    }
    return out;
  }

  function appear(fresh, removed) {
    if (fresh.length > 24) return; // bulk render (long lists, page load): leave it
    const swapped = new Set(removed.map(sig)); // same kind of element replaced = re-render
    let removedMsg = null;
    for (const n of fresh) {
      if (!appearable(n) || swapped.has(sig(n))) continue;
      if (n.querySelector(RESPONSE)) {
        // a finished answer re-rendered into a new wrapper: it is already on screen
        if (removedMsg === null) removedMsg = removed.some((r) => r.matches(RESPONSE) || r.querySelector(RESPONSE));
        if (removedMsg) continue;
      }
      const cs = getComputedStyle(n);
      if (cs.display === "none" || cs.display === "contents" || cs.visibility === "hidden") continue;
      const to = parseFloat(cs.opacity);
      if (!(to > 0)) continue;
      const a = n.animate([{ opacity: 0 }, { opacity: to }], { duration: 240 * k(), easing: EASE });
      a.id = "cs-appear";
    }
  }

  // ======================================================================
  const observer = new MutationObserver((mutations) => {
    checkRoute();
    if (reducedMotion.matches) return;
    if (settings.popups) handleFloats(mutations);
    if (settings.layout) handleSidebar(mutations);
    if (settings.press) handleIcons(mutations);
    if (settings.layout && !flipQueued && performance.now() < snapUntil) {
      flipQueued = true;
      requestAnimationFrame(flip);
    }

    const added = [], removed = [];
    for (const m of mutations) {
      if (m.type !== "childList" || m.target === document.body) continue;
      for (const n of m.addedNodes) if (n.nodeType === 1 && added.length < 300) added.push(n);
      for (const n of m.removedNodes) if (n.nodeType === 1 && removed.length < 60) removed.push(n);
    }
    const now = performance.now();
    const fresh = added.length ? outermost(added) : [];

    if (pageUntil) {
      if (now > pageUntil) pageUntil = 0;
      else if (fresh.length && pageIn(fresh)) pageUntil = 0;
    }
    if (now >= quietUntil) {
      if (settings.pages && fresh.length && fresh.length <= 6) handleNewMessages(fresh);
      if (settings.stream) {
        if (hasHighlights) handleStreamText(mutations);
        handleStreamBlocks(added);
      } else if (stream.el) {
        resetStream();
      }
    }
    if (settings.appear && fresh.length && now >= loadQuietUntil) appear(fresh, removed);
  });

  addEventListener("popstate", checkRoute);

  function start() {
    observer.observe(document.body, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeOldValue: true,
      attributeFilter: ["data-state", "hidden", "class", "style", "aria-expanded", "data-collapsed", "data-hovering"]
    });
  }
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})();
