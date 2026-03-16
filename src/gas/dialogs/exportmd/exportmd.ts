const exportOutput = document.getElementById("output") as HTMLTextAreaElement;
const exportCopyBtn = document.getElementById("copy-btn") as HTMLButtonElement;
const exportStatus = document.getElementById("status")!;
const loadingEl = document.getElementById("loading")!;
const cbNotice = document.getElementById("checkbox-notice")!;

google.script.run
  .withSuccessHandler((md: string) => {
    loadingEl.style.display = "none";
    exportOutput.style.display = "";

    if (md) {
      exportOutput.value = md;
      exportCopyBtn.disabled = false;
      const lineCount = md.split("\n").length;
      const charCount = md.length;
      exportStatus.textContent = `${lineCount} lines, ${charCount} characters`;

      if (/^[ \t]*- \[ \] /m.test(md)) {
        cbNotice.style.display = "";
      }
    } else {
      exportStatus.textContent = "Document is empty.";
    }
  })
  .withFailureHandler((err: Error) => {
    loadingEl.style.display = "none";
    exportOutput.style.display = "";
    exportOutput.value = "";
    exportStatus.textContent = "Error: " + err;
  })
  .getExportMarkdown();

exportCopyBtn.addEventListener("click", () => {
  navigator.clipboard
    .writeText(exportOutput.value)
    .then(() => {
      exportCopyBtn.textContent = "Copied!";
      setTimeout(() => {
        exportCopyBtn.textContent = "Copy to Clipboard";
      }, 1500);
    })
    .catch(() => {
      exportOutput.select();
      document.execCommand("copy");
      exportCopyBtn.textContent = "Copied!";
      setTimeout(() => {
        exportCopyBtn.textContent = "Copy to Clipboard";
      }, 1500);
    });
});
