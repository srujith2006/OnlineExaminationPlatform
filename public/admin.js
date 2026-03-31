(() => {
  const { state, api } = window.AppApi;
  const { getEl, showToast, initModuleNavigation, renderResults, renderMaterials } = window.AppUi;
  const { setupTopbar, requireAuth } = window.AppAuth;

  if (!requireAuth("teacher")) return;
  setupTopbar();
  initModuleNavigation();

  const createExamForm = getEl("createExamForm");
  const createQuestionForm = getEl("createQuestionForm");
  const createMaterialLinkForm = getEl("createMaterialLinkForm");
  const uploadMaterialForm = getEl("uploadMaterialForm");
  const loadAdminMaterialsBtn = getEl("loadAdminMaterialsBtn");
  const adminMaterialsList = getEl("adminMaterialsList");
  const loadAllResultsBtn = getEl("loadAllResultsBtn");
  const allResultsList = getEl("allResultsList");
  const adminSelectedStudentTitle = getEl("adminSelectedStudentTitle");
  const adminStudentResultsList = getEl("adminStudentResultsList");

  createExamForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: getEl("examTitle").value.trim(),
        description: getEl("examDescription").value.trim(),
        duration: Number(getEl("examDuration").value),
      };
      const exam = await api("/api/exams", "POST", payload);
      showToast(`Exam created: ${exam._id}`);
      e.target.reset();
    } catch (err) {
      showToast(err.message, true);
    }
  });

  createQuestionForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const options = getEl("questionOptions")
        .value.split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      await api("/api/questions", "POST", {
        examId: getEl("questionExamId").value.trim(),
        question: getEl("questionText").value.trim(),
        options,
        correctOptionIndex: Number(getEl("questionCorrectIndex").value),
      });
      showToast("Question added");
      e.target.reset();
    } catch (err) {
      showToast(err.message, true);
    }
  });

  createMaterialLinkForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("/api/materials", "POST", {
        title: getEl("materialTitle").value.trim(),
        description: getEl("materialDescription").value.trim(),
        examId: getEl("materialExamId").value.trim(),
        topic: getEl("materialTopic").value.trim(),
        type: getEl("materialType").value,
        url: getEl("materialUrl").value.trim(),
      });
      showToast("Material link added");
      e.target.reset();
    } catch (err) {
      showToast(err.message, true);
    }
  });

  uploadMaterialForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append("title", getEl("uploadMaterialTitle").value.trim());
      formData.append("description", getEl("uploadMaterialDescription").value.trim());
      formData.append("examId", getEl("uploadMaterialExamId").value.trim());
      formData.append("topic", getEl("uploadMaterialTopic").value.trim());
      const fileInput = getEl("uploadMaterialFile");
      if (!fileInput.files.length) throw new Error("Please choose a file");
      formData.append("file", fileInput.files[0]);

      const res = await fetch("/api/materials/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${state.token}` },
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Upload failed");
      showToast("File material uploaded");
      e.target.reset();
    } catch (err) {
      showToast(err.message, true);
    }
  });

  loadAdminMaterialsBtn?.addEventListener("click", async () => {
    try {
      const materials = await api("/api/materials");
      renderMaterials(adminMaterialsList, materials, true);
    } catch (err) {
      showToast(err.message, true);
    }
  });

  adminMaterialsList?.addEventListener("click", async (e) => {
    const materialId = e.target.dataset.deleteMaterial;
    if (!materialId) return;
    try {
      await api(`/api/materials/${materialId}`, "DELETE");
      showToast("Material deleted");
      const materials = await api("/api/materials");
      renderMaterials(adminMaterialsList, materials, true);
    } catch (err) {
      showToast(err.message, true);
    }
  });

  const renderAdminStudents = (students) => {
    if (!students.length) {
      allResultsList.innerHTML = "<div class='item'>No student attempts found.</div>";
      return;
    }
    allResultsList.innerHTML = students
      .map(
        (s) =>
          `<button class="item student-row" type="button" title="Click to view this student's results" data-student-id="${s.userId}"><strong>${s.name}</strong><br>${s.email}</button>`
      )
      .join("");
  };

  loadAllResultsBtn?.addEventListener("click", async () => {
    try {
      const students = await api("/api/results/students");
      renderAdminStudents(students);
      adminSelectedStudentTitle.textContent = "Select a student to view results";
      adminStudentResultsList.innerHTML = "";
    } catch (err) {
      showToast(err.message, true);
    }
  });

  allResultsList?.addEventListener("click", async (e) => {
    const studentId = e.target.closest("[data-student-id]")?.dataset.studentId;
    if (!studentId) return;
    try {
      const data = await api(`/api/results/student/${studentId}`);
      const studentName = data.student?.name || "Student";
      const studentEmail = data.student?.email ? ` (${data.student.email})` : "";
      adminSelectedStudentTitle.textContent = `${studentName}${studentEmail} - Results`;
      renderResults(adminStudentResultsList, data.results || []);
    } catch (err) {
      showToast(err.message, true);
    }
  });
})();
