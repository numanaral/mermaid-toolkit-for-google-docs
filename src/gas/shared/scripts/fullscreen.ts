import { openDataUriInNewTab } from "./dom-utils";
import { OPEN_SVG as OPEN_TAB_SVG } from "./icons";

export const wrapImgWithFullscreen = (img: HTMLImageElement): void => {
  const parent = img.parentElement;
  if (!parent || parent.classList.contains("img-wrap")) return;

  const wrap = document.createElement("div");
  wrap.className = "img-wrap";
  parent.insertBefore(wrap, img);
  wrap.appendChild(img);

  const btn = document.createElement("button");
  btn.className = "fullscreen-btn";
  btn.innerHTML = OPEN_TAB_SVG;
  btn.title = "Open image in new tab";
  wrap.insertBefore(btn, img);

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    openDataUriInNewTab(img.src);
  });
};
