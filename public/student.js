(() => {
  const { MAX_EXAM_ATTEMPTS, state, api } = window.AppApi;
  const { getEl, showToast, initModuleNavigation, renderResults, renderMaterials } = window.AppUi;
  const { setupTopbar, requireAuth } = window.AppAuth;

  if (!requireAuth("student")) return;

  setupTopbar(() => {
    stopExamTimer();
  });
  initModuleNavigation();

  let examTimerInterval = null;
  let examSubmissionInFlight = false;

  const studentHeading = getEl("studentHeading");
  if (studentHeading) {
    studentHeading.textContent = state.name ? `${state.name}'s Dashboard` : "Student Dashboard";
  }

  const loadExamsBtn = getEl("loadExamsBtn");
  const examList = getEl("examList");
  const startExamForm = getEl("startExamForm");
  const examSubmitForm = getEl("examSubmitForm");
  const loadMyResultsBtn = getEl("loadMyResultsBtn");
  const myResultsList = getEl("myResultsList");
  const loadStudentMaterialsBtn = getEl("loadStudentMaterialsBtn");
  const studentMaterialsList = getEl("studentMaterialsList");

  function stopExamTimer() {
    if (examTimerInterval) {
      clearInterval(examTimerInterval);
      examTimerInterval = null;
    }
  }

  function hideExamTimer() {
    const examTimer = getEl("examTimer");
    if (!examTimer) return;
    examTimer.classList.add("hidden");
    examTimer.textContent = "";
  }

  function clearExamFeedback() {
    const examFeedback = getEl("examFeedback");
    if (!examFeedback) return;
    examFeedback.classList.add("hidden");
    examFeedback.innerHTML = "";
  }

  function renderExamFeedback(submitRes) {
    const examFeedback = getEl("examFeedback");
    if (!examFeedback) return;
    const wrongAnswers = submitRes.wrongAnswers || [];
    const summaryClass = wrongAnswers.length === 0 ? "feedback-good" : "feedback-bad";
    const summaryText =
      wrongAnswers.length === 0
        ? "Great work. You answered all questions correctly."
        : `You had ${wrongAnswers.length} wrong answer(s). Review below.`;

    const wrongList = wrongAnswers.length
      ? `<ol class="feedback-list">${wrongAnswers
          .map((item) => {
            const selectedText =
              item.selectedOptionIndex >= 0
                ? item.options[item.selectedOptionIndex]
                : "Not answered";
            const correctText = item.options[item.correctOptionIndex];
            return `<li><strong>${item.question}</strong><br>Your answer: ${selectedText}<br>Correct answer: ${correctText}</li>`;
          })
          .join("")}</ol>`
      : "";

    examFeedback.innerHTML = `
      <h4>Submission Review</h4>
      <p class="${summaryClass}">Score: ${submitRes.score}/${submitRes.totalMarks}</p>
      <p>${summaryText}</p>
      ${wrongList}
    `;
    examFeedback.classList.remove("hidden");
  }

  function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  }

  function startExamTimer(durationMinutes, attemptsLeft, onTimeUp) {
    const examTimer = getEl("examTimer");
    if (!examTimer) return;
    stopExamTimer();
    const safeMinutes = Number(durationMinutes);
    if (!Number.isFinite(safeMinutes) || safeMinutes <= 0) return;
    const deadline = Date.now() + safeMinutes * 60 * 1000;

    const tick = async () => {
      const remainingSeconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      examTimer.textContent = `Time Left: ${formatDuration(remainingSeconds)} | Attempts Left: ${attemptsLeft}`;
      examTimer.classList.remove("hidden");
      if (remainingSeconds === 0) {
        stopExamTimer();
        showToast("Time is up. Auto-submitting exam.");
        await onTimeUp();
      }
    };

    tick();
    examTimerInterval = setInterval(tick, 1000);
  }

  const renderExamList = (exams) => {
    if (!exams.length) {
      examList.innerHTML = "<div class='item'>No exams yet.</div>";
      return;
    }
    examList.innerHTML = exams
      .map(
        (exam) =>
          `<div class="item"><strong>${exam.title}</strong><br>ID: ${exam._id}<br>${exam.description || ""}<br>Duration: ${exam.duration} mins</div>`
      )
      .join("");
  };

  const getExamById = async (examId) => {
    const exams = await api("/api/exams");
    return exams.find((exam) => String(exam._id) === String(examId));
  };

  const getAttemptStats = async (examId) => {
    const results = await api("/api/results");
    const summary = results.find(
      (r) => String(r.examId?._id || r.examId) === String(examId)
    );
    const used = summary ? Number(summary.attemptsUsed || 0) : 0;
    return { used, left: Math.max(0, MAX_EXAM_ATTEMPTS - used) };
  };

  const submitActiveExam = async (isAutoSubmit = false) => {
    if (examSubmissionInFlight) return;
    examSubmissionInFlight = true;
    try {
      const activeExamInput = getEl("activeExamId");
      if (!activeExamInput) throw new Error("No active exam loaded");
      const examId = activeExamInput.value;
      const answers = Array.from(examSubmitForm.querySelectorAll(".question-box"))
        .map((qBox) => {
          const firstInput = qBox.querySelector("input[type='radio']");
          if (!firstInput) return null;
          const checked = qBox.querySelector("input[type='radio']:checked");
          return {
            questionId: firstInput.name.replace("q_", ""),
            selectedOptionIndex: checked ? Number(checked.value) : -1,
          };
        })
        .filter(Boolean);

      const res = await api("/api/results/submit", "POST", { examId, answers });
      const submitLabel = isAutoSubmit ? "Auto-submitted" : "Submitted";
      showToast(`${submitLabel}: ${res.score}/${res.totalMarks}`);
      stopExamTimer();
      hideExamTimer();
      examSubmitForm.classList.add("hidden");
      examSubmitForm.innerHTML = "";
      renderExamFeedback(res);
    } catch (err) {
      showToast(err.message, true);
    } finally {
      examSubmissionInFlight = false;
    }
  };

  const loadQuestionsForExam = async (examId) => {
    const attemptStats = await getAttemptStats(examId);
    if (attemptStats.left <= 0) {
      stopExamTimer();
      hideExamTimer();
      examSubmitForm.classList.add("hidden");
      examSubmitForm.innerHTML = "";
      clearExamFeedback();
      showToast("Attempt limit reached for this exam (max 2).", true);
      return;
    }

    const exam = await getExamById(examId);
    if (!exam) throw new Error("Exam not found");
    const questions = await api(`/api/questions/${examId}`);
    if (!questions.length) {
      examSubmitForm.classList.add("hidden");
      clearExamFeedback();
      showToast("No questions for this exam", true);
      return;
    }

    const blocks = questions
      .map((q, i) => {
        const opts = q.options
          .map(
            (opt, idx) =>
              `<label class="option"><input type="radio" name="q_${q._id}" value="${idx}" /> ${opt}</label>`
          )
          .join("");
        return `<div class="question-box"><p>${i + 1}. ${q.question}</p>${opts}</div>`;
      })
      .join("");

    examSubmitForm.innerHTML = `
      <input type="hidden" id="activeExamId" value="${examId}" />
      ${blocks}
      <button class="btn primary" type="submit">Submit Exam</button>
    `;
    examSubmitForm.classList.remove("hidden");
    clearExamFeedback();
    startExamTimer(exam.duration, attemptStats.left, () => submitActiveExam(true));
  };

  loadExamsBtn?.addEventListener("click", async () => {
    try {
      const exams = await api("/api/exams");
      renderExamList(exams);
    } catch (err) {
      showToast(err.message, true);
    }
  });

  startExamForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const examId = getEl("startExamId").value.trim();
      await loadQuestionsForExam(examId);
    } catch (err) {
      showToast(err.message, true);
    }
  });

  examSubmitForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await submitActiveExam(false);
  });

  loadMyResultsBtn?.addEventListener("click", async () => {
    try {
      const results = await api("/api/results");
      renderResults(myResultsList, results);
    } catch (err) {
      showToast(err.message, true);
    }
  });

  loadStudentMaterialsBtn?.addEventListener("click", async () => {
    try {
      const materials = await api("/api/materials");
      renderMaterials(studentMaterialsList, materials, false);
    } catch (err) {
      showToast(err.message, true);
    }
  });
})();
