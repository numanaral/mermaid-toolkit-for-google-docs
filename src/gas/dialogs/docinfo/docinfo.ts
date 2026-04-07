declare const infoData: { rows: [string, string][] };

(() => {
  const table = document.getElementById("info-table")!;
  const copyBtn = document.getElementById("copy-btn") as HTMLButtonElement;

  let html = "";
  for (const [key, value] of infoData.rows) {
    html += "<tr><th>" + key + "</th><td>" + value + "</td></tr>";
  }
  table.innerHTML = html;

  const doCopy = (): void => {
    let text = "";
    for (const [key, value] of infoData.rows) {
      text += key + ": " + value + "\n";
    }

    const onSuccess = (): void => {
      copyBtn.textContent = "Copied!";
      copyBtn.classList.add("copied");
      setTimeout(() => {
        copyBtn.textContent = "Copy";
        copyBtn.classList.remove("copied");
      }, 1500);
    };

    navigator.clipboard
      .writeText(text)
      .then(onSuccess)
      .catch(() => {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;left:-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        onSuccess();
      });
  };

  copyBtn.addEventListener("click", doCopy);
})();
