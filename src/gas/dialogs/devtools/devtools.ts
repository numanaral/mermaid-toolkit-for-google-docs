const btnInspector = document.getElementById(
  "btn-inspector",
) as HTMLButtonElement;
const btnCheckbox = document.getElementById(
  "btn-checkbox",
) as HTMLButtonElement;
const devLoading = document.getElementById("loading") as HTMLDivElement;
const devLoadingMsg = document.getElementById(
  "loading-msg",
) as HTMLParagraphElement;
const devToolGrid = document.querySelector(".tool-grid") as HTMLDivElement;
const devStatus = document.getElementById("status") as HTMLDivElement;

const showLoading = (msg: string): void => {
  devLoadingMsg.textContent = msg;
  devToolGrid.style.display = "none";
  devLoading.style.display = "flex";
  devStatus.textContent = "";
};

const showError = (e: Error): void => {
  devLoading.style.display = "none";
  devToolGrid.style.display = "grid";
  devStatus.textContent = "Error: " + (e?.message ?? String(e));
  devStatus.style.color = "var(--error)";
};

const disableAll = (disabled: boolean): void => {
  btnInspector.disabled = disabled;
  btnCheckbox.disabled = disabled;
};

btnInspector.addEventListener("click", () => {
  showLoading("Loading document structure...");
  disableAll(true);
  google.script.run
    .withSuccessHandler(() => {
      google.script.host.close();
    })
    .withFailureHandler((e: Error) => {
      showError(e);
      disableAll(false);
    })
    .debugDocStructure();
});

btnCheckbox.addEventListener("click", () => {
  if (
    !confirm(
      "This will replace the current document content with test data. Continue?",
    )
  )
    return;
  showLoading("Inserting test checkboxes...");
  disableAll(true);
  google.script.run
    .withSuccessHandler(() => {
      devLoading.style.display = "none";
      devToolGrid.style.display = "grid";
      devStatus.textContent = "Test checkboxes inserted.";
      disableAll(false);
    })
    .withFailureHandler((e: Error) => {
      showError(e);
      disableAll(false);
    })
    .testCheckboxGist();
});
