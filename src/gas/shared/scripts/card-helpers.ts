const SPINNER_HTML = '<span class="spinner-inline btn-spinner"></span>';

export const setBtnLoading = (
  btn: HTMLButtonElement,
  loading: boolean,
): void => {
  const existing = btn.querySelector(".btn-spinner");
  if (loading && !existing) {
    btn.insertAdjacentHTML("afterbegin", SPINNER_HTML);
  } else if (!loading && existing) {
    existing.remove();
  }
};

export const markBtn = (btn: HTMLButtonElement, ok: boolean): void => {
  btn.disabled = true;
  btn.innerHTML = ok ? "Done &#10003;" : "Failed";
  btn.className = ok ? "btn done" : "btn failed";
};

export const setLoading = (btn: HTMLButtonElement, text: string): void => {
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-inline"></span>' + text;
};

export const setCardStatus = (
  idx: number,
  text: string,
  spinning?: boolean,
): void => {
  const el = document.getElementById("card-status-" + idx);
  if (!el) return;
  el.classList.remove("done", "failed", "pending");
  if (spinning) {
    el.classList.add("pending");
    el.innerHTML = '<span class="spinner-status"></span>' + text;
  } else {
    const lower = text.toLowerCase();
    if (lower === "error" || lower === "failed") {
      el.classList.add("failed");
    } else if (
      lower === "inserted" ||
      lower === "replaced" ||
      lower === "done"
    ) {
      el.classList.add("done");
    }
    el.textContent = text;
  }
};

export const batchAction = <T extends { base64?: string | null }>(
  items: T[],
  actionName: string,
  serverFn: string,
  statusEl: HTMLElement,
  insertAllBtn: HTMLButtonElement,
  replaceAllBtn: HTMLButtonElement,
  getSortKey: (item: T, idx: number) => number,
  getArgs: (idx: number) => unknown[],
): void => {
  const isReplace = actionName === "replace";
  const btnPrefix = isReplace ? "rep-" : "ins-";

  const queue: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const hasBase64 = items[i].base64 !== undefined ? items[i].base64 : true;
    if (!hasBase64) continue;
    const btn = document.getElementById(
      btnPrefix + i,
    ) as HTMLButtonElement | null;
    if (btn?.classList.contains("done")) continue;
    queue.push(i);
  }

  if (queue.length === 0) {
    statusEl.textContent =
      "All items have already been " +
      (isReplace ? "replaced" : "inserted") +
      ".";
    return;
  }

  queue.sort((a, b) => getSortKey(items[b], b) - getSortKey(items[a], a));

  const activeBtn = isReplace ? replaceAllBtn : insertAllBtn;

  insertAllBtn.disabled = true;
  replaceAllBtn.disabled = true;
  activeBtn.innerHTML =
    '<span class="spinner-inline"></span>' +
    (isReplace ? "Replacing..." : "Inserting...");

  const total = queue.length;
  let step = 0;

  const next = (): void => {
    if (step >= queue.length) {
      google.script.host.close();
      return;
    }

    const idx = queue[step];
    const label = isReplace ? "Replacing" : "Inserting";
    statusEl.innerHTML =
      '<span class="spinner-inline" style="border-color:rgba(0,0,0,0.15);border-top-color:var(--text-muted)"></span>' +
      label +
      " " +
      (step + 1) +
      " of " +
      total +
      "...";
    setCardStatus(idx, label + "...", true);

    const curIns = document.getElementById(
      "ins-" + idx,
    ) as HTMLButtonElement | null;
    const curRep = document.getElementById(
      "rep-" + idx,
    ) as HTMLButtonElement | null;
    if (isReplace && curRep) {
      setLoading(curRep, "Replacing...");
      if (curIns) curIns.disabled = true;
    } else if (!isReplace && curIns) {
      setLoading(curIns, "Inserting...");
      if (curRep) curRep.disabled = true;
    }

    const runner = google.script.run
      .withSuccessHandler(() => {
        const insBtn = document.getElementById(
          "ins-" + idx,
        ) as HTMLButtonElement | null;
        const repBtn = document.getElementById(
          "rep-" + idx,
        ) as HTMLButtonElement | null;
        if (isReplace) {
          if (repBtn) markBtn(repBtn, true);
          if (insBtn) {
            insBtn.disabled = true;
            insBtn.textContent = "N/A";
          }
          setCardStatus(idx, "Replaced");
        } else {
          if (insBtn) markBtn(insBtn, true);
          setCardStatus(idx, "Inserted");
        }
        step++;
        next();
      })
      .withFailureHandler((err: Error) => {
        setCardStatus(idx, "Error");
        statusEl.textContent = "Error on item " + (idx + 1) + ": " + err;
        step++;
        next();
      });

    runner[serverFn](...getArgs(idx));
  };

  next();
};
