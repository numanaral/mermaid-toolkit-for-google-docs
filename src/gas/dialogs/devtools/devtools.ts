const btnInspector = document.getElementById(
  "btn-inspector",
) as HTMLButtonElement;
const btnDocInfo = document.getElementById("btn-doc-info") as HTMLButtonElement;
const devLoading = document.getElementById("loading") as HTMLDivElement;
const devLoadingMsg = document.getElementById(
  "loading-msg",
) as HTMLParagraphElement;
const devToolGrid = document.querySelector(".action-grid") as HTMLDivElement;
const devStatus = document.getElementById("status") as HTMLDivElement;

const showLoading = (msg: string): void => {
  devLoadingMsg.textContent = msg;
  devToolGrid.style.display = "none";
  devLoading.style.display = "flex";
  devStatus.textContent = "";
};

const showError = (e: Error): void => {
  devLoading.style.display = "none";
  devToolGrid.style.display = "flex";
  devStatus.textContent = "Error: " + (e?.message ?? String(e));
  devStatus.style.color = "var(--error)";
};

const showSuccess = (msg: string): void => {
  devLoading.style.display = "none";
  devToolGrid.style.display = "flex";
  devStatus.textContent = msg;
  devStatus.style.color = "var(--secondary)";
};

btnInspector.addEventListener("click", () => {
  showLoading("Loading document structure...");
  btnInspector.disabled = true;
  google.script.run
    .withSuccessHandler(() => {
      google.script.host.close();
    })
    .withFailureHandler((e: Error) => {
      showError(e);
      btnInspector.disabled = false;
    })
    .debugDocStructure();
});

btnDocInfo.addEventListener("click", () => {
  showLoading("Gathering document info...");
  btnDocInfo.disabled = true;
  google.script.run
    .withSuccessHandler((info: string) => {
      showSuccess("Info retrieved");
      alert(info);
      btnDocInfo.disabled = false;
    })
    .withFailureHandler((e: Error) => {
      showError(e);
      btnDocInfo.disabled = false;
    })
    .getDocumentInfo();
});
