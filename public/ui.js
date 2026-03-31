window.AppUi = (() => {
  function getEl(id) {
    return document.getElementById(id);
  }

  function showToast(message, isError = false) {
    const toast = getEl("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove("hidden", "error");
    if (isError) toast.classList.add("error");
    setTimeout(() => toast.classList.add("hidden"), 2400);
  }

  function initModuleNavigation() {
    document.querySelectorAll(".module-shell").forEach((shell) => {
      const links = shell.querySelectorAll(".module-link");
      const panels = shell.querySelectorAll(".module-panel");

      function activate(moduleName) {
        links.forEach((btn) =>
          btn.classList.toggle("active", btn.dataset.module === moduleName)
        );
        panels.forEach((p) =>
          p.classList.toggle("active", p.dataset.module === moduleName)
        );
      }

      links.forEach((btn, idx) => {
        btn.title = "Select module";
        btn.addEventListener("click", () => activate(btn.dataset.module));
        if (idx === 0) activate(btn.dataset.module);
      });
    });
  }

  function renderResults(listEl, results) {
    if (!listEl) return;
    if (!results.length) {
      listEl.innerHTML = "<div class='item'>No results found.</div>";
      return;
    }

    const maxAttempts = window.AppApi?.MAX_EXAM_ATTEMPTS ?? 2;

    listEl.innerHTML = results
      .map((r) => {
        const title = r.examId?.title || "Exam";
        const description = r.examId?.description ? ` (${r.examId.description})` : "";
        const user = r.userId?.email ? ` | ${r.userId.email}` : "";
        const isStudentSummary =
          typeof r.attemptsUsed === "number" && typeof r.bestScore === "number";

        if (isStudentSummary) {
          return `<div class="item"><strong>${title}${description}</strong>${user}<br>Attempts: ${r.attemptsUsed}/${maxAttempts}<br>Best Score Considered: ${r.bestScore}/${r.totalMarks}</div>`;
        }

        return `<div class="item"><strong>${title}${description}</strong>${user}<br>Score: ${r.score}/${r.totalMarks}</div>`;
      })
      .join("");
  }

  function renderMaterials(listEl, materials, isAdmin = false) {
    if (!listEl) return;
    if (!materials.length) {
      listEl.innerHTML = "<div class='item'>No materials found.</div>";
      return;
    }

    listEl.innerHTML = materials
      .map((m) => {
        const examLabel = m.examId?.title ? `<br>Exam: ${m.examId.title}` : "";
        const topic = m.topic ? `<br>Topic: ${m.topic}` : "";
        const desc = m.description ? `<br>${m.description}` : "";
        const href = m.filePath || m.url || "#";
        const openBtn =
          href !== "#"
            ? `<a class="btn" target="_blank" href="${href}">Open</a>`
            : "";
        const deleteBtn = isAdmin
          ? `<button class="btn" data-delete-material="${m._id}" type="button">Delete</button>`
          : "";
        return `<div class="item"><strong>${m.title}</strong><br>Type: ${m.type}${examLabel}${topic}${desc}<div class="material-actions">${openBtn}${deleteBtn}</div></div>`;
      })
      .join("");
  }

  return {
    getEl,
    showToast,
    initModuleNavigation,
    renderResults,
    renderMaterials,
  };
})();
