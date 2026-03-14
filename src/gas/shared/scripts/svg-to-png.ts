export const svgToPngBase64 = (svgString: string): Promise<string | null> =>
  new Promise((resolve) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) { resolve(null); return; }

    let w = parseFloat(svg.getAttribute("width") || "0");
    let h = parseFloat(svg.getAttribute("height") || "0");

    if (!w || !h || isNaN(w) || isNaN(h)) {
      const vb = (svg.getAttribute("viewBox") || "").split(/[\s,]+/);
      if (vb.length === 4) {
        w = parseFloat(vb[2]);
        h = parseFloat(vb[3]);
      }
    }

    if (!w || isNaN(w)) w = 800;
    if (!h || isNaN(h)) h = 600;

    svg.setAttribute("width", String(w));
    svg.setAttribute("height", String(h));
    const style = (svg.getAttribute("style") || "").replace(/max-width:[^;]+;?/g, "");
    svg.setAttribute("style", style);

    const fixed = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([fixed], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      const scale = 2;
      const c = document.createElement("canvas");
      c.width = w * scale;
      c.height = h * scale;
      const ctx = c.getContext("2d")!;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/png").replace(/^data:image\/png;base64,/, ""));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
