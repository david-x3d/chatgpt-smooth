import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../smooth.js', import.meta.url), 'utf8');
const frameClocks = new Set();
async function flush() {
  // Flush mutation delivery and chained rebuild/paint frames explicitly. Fixed
  // wall-clock delays can expire before a loaded CI runner paints a highlight.
  for (let tick = 0; tick < 4; tick++) {
    await new Promise(resolve => setImmediate(resolve));
    for (const advance of frameClocks) advance();
  }
}

async function page(t, { reduced = false, path = '/', effects = { appear: false, press: false, glow: false } } = {}) {
  const dom = new JSDOM('<main><section id="messages"></section><textarea id="prompt-textarea"></textarea></main>', {
    url: 'https://chatgpt.com' + path, runScripts: 'outside-only', pretendToBeVisual: true
  });
  const w = dom.window;
  const observers = [];
  const deliveries = [];
  const animations = [];
  const Observer = w.MutationObserver;
  w.MutationObserver = class extends Observer {
    constructor(callback) {
      super((records, observer) => { deliveries.push(records); callback(records, observer); });
      observers.push(this);
    }
  };
  const errors = [];
  w.addEventListener('error', event => errors.push(event.error));
  t.after(() => {
    for (const observer of observers) observer.disconnect();
    frameClocks.delete(advanceFrames);
    dom.window.close();
    assert.deepEqual(errors, [], 'content script raised no runtime errors');
  });
  let now = 0;
  let frameId = 0;
  const pendingFrames = new Map();
  w.requestAnimationFrame = callback => {
    pendingFrames.set(++frameId, callback);
    return frameId;
  };
  w.cancelAnimationFrame = id => pendingFrames.delete(id);
  const advanceFrames = () => {
    const callbacks = [...pendingFrames.values()];
    pendingFrames.clear();
    for (const callback of callbacks) callback(now);
  };
  frameClocks.add(advanceFrames);
  Object.defineProperty(w.performance, 'now', { value: () => now });
  w.matchMedia = () => ({ matches: reduced });
  w.CSS = { highlights: new Map() };
  w.Highlight = class extends Set {};
  w.Element.prototype.getAnimations = () => [];
  w.document.getAnimations = () => [];
  w.Element.prototype.animate = function(frames, options) {
    const animation = { target: this, frames, options, playState: 'finished', cancel() {} };
    animations.push(animation);
    return animation;
  };
  let update;
  w.chrome = { storage: {
    local: { get: async defaults => ({ ...defaults, ...effects }) },
    onChanged: { addListener: callback => { update = callback; } }
  } };
  w.eval(source);
  await flush();
  now = 2000;
  const messages = w.document.querySelector('#messages');
  const composer = w.document.querySelector('textarea');
  const send = () => composer.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  const append = (role, text = '') => {
    const article = w.document.createElement('article');
    const message = w.document.createElement('div');
    message.setAttribute('data-message-author-role', role);
    const body = w.document.createElement('div');
    body.className = 'markdown';
    body.textContent = text;
    message.append(body);
    article.append(message);
    messages.append(article);
    return { article, message, body };
  };
  return { w, send, append, update, deliveries, animations };
}

test('first send animates messages across ChatGPT conversation creation', async t => {
  const p = await page(t);
  p.send();
  p.w.history.pushState({}, '', '/c/new-conversation');
  const user = p.append('user', 'Hello');
  const answer = p.append('assistant', '');
  await flush();
  assert.ok(user.article.classList.contains('cs-msg'));
  assert.ok(answer.article.classList.contains('cs-turn'));
  answer.body.append(p.w.document.createTextNode('Hello back'));
  await flush();
  const ranges = [...p.w.CSS.highlights.values()].flatMap(h => [...h]);
  assert.ok(ranges.length > 0, 'new answer words use highlight ranges');
  assert.equal(answer.body.textContent, 'Hello back', 'text remains unchanged');
  assert.equal(answer.body.children.length, 0, 'no text wrappers inserted');
});

test('opening history does not replay messages or stream text', async t => {
  const p = await page(t);
  p.w.history.pushState({}, '', '/c/old-conversation');
  const answer = p.append('assistant', 'An existing answer');
  await flush();
  answer.body.append(' with a final render');
  await flush();
  assert.equal(answer.article.classList.contains('cs-turn'), false);
  assert.equal(p.w.CSS.highlights.size, 0);
});

test('regeneration streams assistant text without a user send', async t => {
  const p = await page(t, { path: '/c/existing' });
  const answer = p.append('assistant');
  await flush();
  answer.body.append('Regenerated words');
  await flush();
  assert.ok([...p.w.CSS.highlights.values()].some(h => h.size));
});

test('reduced motion prevents message and text effects', async t => {
  const p = await page(t, { reduced: true });
  p.send();
  const user = p.append('user', 'Hello');
  const answer = p.append('assistant');
  await flush();
  answer.body.append('A reply');
  await flush();
  assert.equal(user.article.classList.contains('cs-msg'), false);
  assert.equal(answer.article.classList.contains('cs-turn'), false);
  assert.equal(p.w.CSS.highlights.size, 0);
});

test('settings changes disable new message and streaming effects', async t => {
  const p = await page(t);
  p.update({ pages: { newValue: false }, stream: { newValue: false } }, 'local');
  p.send();
  const user = p.append('user', 'Hello');
  const answer = p.append('assistant');
  await flush();
  answer.body.append('A reply');
  await flush();
  assert.equal(user.article.classList.contains('cs-msg'), false);
  assert.equal(p.w.CSS.highlights.size, 0);
  assert.equal(p.w.document.documentElement.classList.contains('cs-stream'), false);
});

test('history edits and assistant controls do not receive word highlights', async t => {
  const p = await page(t, { path: '/c/existing' });
  const old = p.append('assistant', 'An older answer');
  const latest = p.append('assistant', 'The latest answer');
  await flush();
  const button = p.w.document.createElement('button');
  latest.message.append(button);
  old.body.append(' edited');
  button.append('Copied');
  await flush();
  assert.equal(p.w.CSS.highlights.size, 0);
});

test('new app-shell textarea and localized send button trigger message effects', async t => {
  const p = await page(t);
  p.w.document.querySelector('textarea').id = 'pending-conversation-input';
  const send = p.w.document.createElement('button');
  send.setAttribute('aria-label', 'Senden');
  p.w.document.querySelector('main').append(send);
  send.dispatchEvent(new p.w.MouseEvent('pointerdown', { bubbles: true, button: 0 }));
  const user = p.append('user', 'Hello');
  await flush();
  assert.ok(user.article.classList.contains('cs-msg'));
});

function layoutProbe(w) {
  let left = 260;
  let reads = 0;
  const animations = [];
  const main = w.document.querySelector('main');
  main.getBoundingClientRect = () => {
    reads++;
    return { left, width: 800, top: 0, height: 600 };
  };
  main.animate = (frames, options) => {
    const animation = { playState: 'finished', frames, options };
    animations.push(animation);
    return animation;
  };
  const control = w.document.createElement('button');
  w.document.body.append(control);
  return { main, control, animations, reads: () => reads, move: x => { left = x; } };
}

test('layout smoothing translates once and never animates conversation width', async t => {
  const { w } = await page(t);
  const probe = layoutProbe(w);
  probe.control.dispatchEvent(new w.MouseEvent('pointerdown', { bubbles: true }));
  probe.move(0);
  probe.main.classList.add('layout-changed');
  await flush();
  const flips = probe.animations.filter(a => a.id === 'cs-flip');
  assert.equal(flips.length, 1);
  assert.deepEqual(Object.keys(flips[0].frames[0]), ['translate']);
  const reads = probe.reads();
  probe.main.classList.add('another-render');
  await flush();
  assert.equal(probe.reads(), reads, 'later mutations do not restart layout measurement');
});

test('sidebar collapse uses native motion without extension layout measurements', async t => {
  const { w } = await page(t);
  const probe = layoutProbe(w);
  probe.control.setAttribute('data-app-shell-sidebar-trigger', 'true');
  probe.control.dispatchEvent(new w.MouseEvent('pointerdown', { bubbles: true }));
  probe.move(0);
  probe.main.setAttribute('data-app-shell-sidebar-open', 'false');
  await flush();
  assert.equal(probe.reads(), 0);
  assert.equal(probe.animations.length, 0);
});

test('typing does not measure the page layout', async t => {
  const { w } = await page(t);
  const probe = layoutProbe(w);
  const composer = w.document.querySelector('textarea');
  for (const key of ['a', 'b', ' ', 'Enter']) {
    composer.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true }));
  }
  await flush();
  assert.equal(probe.reads(), 0);
});

test('sidebar frame updates do not wake the page observer with all effects enabled', async t => {
  const p = await page(t, { effects: {} });
  const frame = p.w.document.querySelector('main');
  const before = p.deliveries.length;
  for (let i = 0; i < 120; i++) {
    frame.style.setProperty('--app-shell-animated-left-panel-width', `${269 - i}px`);
    frame.className = `sidebar-frame-${i}`;
  }
  await flush();
  assert.equal(p.deliveries.length, before, 'per-frame style/class writes bypass the extension observer');
});

test('sidebar controls and newly mounted content receive no extra effects with defaults enabled', async t => {
  const p = await page(t, { effects: {} });
  const panel = p.w.document.createElement('aside');
  panel.className = 'app-shell-left-panel';
  panel.innerHTML = '<div id="app-shell-sidebar"><button data-app-shell-sidebar-trigger="true"><svg></svg></button></div>';
  p.w.document.body.append(panel);
  await flush();
  const button = panel.querySelector('button');
  let measurements = 0;
  button.getBoundingClientRect = () => {
    measurements++;
    return { left: 0, top: 0, width: 32, height: 32 };
  };
  p.animations.length = 0;
  button.dispatchEvent(new p.w.MouseEvent('pointerdown', { bubbles: true, button: 0 }));
  button.dispatchEvent(new p.w.MouseEvent('pointerup', { bubbles: true, button: 0 }));
  const content = p.w.document.createElement('div');
  content.style.opacity = '1';
  content.textContent = 'Sidebar content';
  panel.querySelector('#app-shell-sidebar').append(content);
  await flush();
  assert.equal(measurements, 0, 'sidebar trigger avoids glow and press geometry reads');
  assert.equal(p.animations.length, 0, 'sidebar content does not fade, pulse, morph or spring');
  assert.equal(p.w.document.querySelector('.cs-sheen'), null);
});

test('unplaced popups still animate after their own positioning style changes', async t => {
  const { w } = await page(t);
  const popup = w.document.createElement('div');
  popup.setAttribute('data-radix-popper-content-wrapper', '');
  popup.style.transform = 'translate(0px, -200%)';
  popup.innerHTML = '<div role="menu" data-state="open"><button role="menuitem">Copy</button></div>';
  w.document.body.append(popup);
  await flush();
  assert.equal(popup.classList.contains('cs-pop'), false);
  popup.style.transform = 'translate(10px, 20px)';
  await flush();
  assert.ok(popup.classList.contains('cs-pop'), 'scoped observer starts the placed popup');
});
