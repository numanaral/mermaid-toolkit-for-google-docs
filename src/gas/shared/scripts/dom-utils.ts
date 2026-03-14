export const $ = <T extends HTMLElement = HTMLElement>(selector: string): T | null =>
  document.querySelector<T>(selector);

export const $$ = <T extends HTMLElement = HTMLElement>(selector: string): NodeListOf<T> =>
  document.querySelectorAll<T>(selector);

export const byId = <T extends HTMLElement = HTMLElement>(id: string): T | null =>
  document.getElementById(id) as T | null;

export const openInNewTab = (base64: string): void => {
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  const blob = new Blob([arr], { type: "image/png" });
  window.open(URL.createObjectURL(blob), "_blank");
};
