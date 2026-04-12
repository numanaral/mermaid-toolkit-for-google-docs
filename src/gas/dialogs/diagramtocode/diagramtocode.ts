export {};

declare const source: string;
declare const imageIdx: number;

const messageEl = document.getElementById("message")!;
const spinnerEl = document.getElementById("spinner")!;
const closeBtn = document.getElementById("close-btn") as HTMLButtonElement;

const showError = (msg: string): void => {
  spinnerEl.style.display = "none";
  messageEl.className = "error-msg";
  messageEl.textContent = msg;
  closeBtn.style.display = "inline-block";
};

closeBtn.addEventListener("click", () => {
  google.script.host.close();
});

google.script.run
  .withSuccessHandler(() => {
    google.script.host.close();
  })
  .withFailureHandler((err: Error) => {
    showError("Failed to convert: " + err);
  })
  .replaceImageWithCodeBlock(source, imageIdx);
