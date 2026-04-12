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
