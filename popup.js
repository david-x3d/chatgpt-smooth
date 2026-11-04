const ext = globalThis.browser || globalThis.chrome;
const DEFAULTS = { hover: true, popups: true, stream: true, pages: true, layout: true, appear: true, blur: true, press: true, glow: true, scroll: false, speed: 1 };

ext.storage.local.get(DEFAULTS).then((s) => {
  for (const key of Object.keys(DEFAULTS)) {
    const input = document.getElementById(key);
    if (input.type === "checkbox") {
      input.checked = !!s[key];
      input.addEventListener("change", () => ext.storage.local.set({ [key]: input.checked }));
    } else {
      input.value = s[key];
      input.addEventListener("input", () => ext.storage.local.set({ [key]: Number(input.value) }));
    }
  }
});
