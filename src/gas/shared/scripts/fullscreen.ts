const OPEN_TAB_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
  '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>' +
  '<polyline points="15 3 21 3 21 9"/>' +
  '<line x1="10" y1="14" x2="21" y2="3"/></svg>';

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
    window.open(img.src, "_blank");
  });
};
