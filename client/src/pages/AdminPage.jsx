import React, { useEffect, useMemo, useState } from "react";
import Shell from "../components/Shell";
import Toast from "../components/Toast";
import { apiBase, apiRequest } from "../lib/api";
import { useAuth } from "../state/AuthContext";

function useToast() {
  const [toast, setToast] = useState({ msg: "", error: false });
  const show = (msg, error = false) => setToast({ msg, error });
  return { toast, show };
}

export default function AdminPage() {
  const { token, role } = useAuth();
  const isSystemAdmin = role === "admin";
  const { toast, show } = useToast();
  const [active, setActive] = useState(isSystemAdmin ? "requests" : "exam");
  const [materials, setMaterials] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentResults, setStudentResults] = useState([]);
  const [resultsSection, setResultsSection] = useState("");
  const [rankSection, setRankSection] = useState("");
  const [rankBoard, setRankBoard] = useState({ section: "", rankings: [] });
  const [examForm, setExamForm] = useState({
    title: "",
    description: "",
    duration: "",
    totalQuestions: "",
    section: "",
    dueDate: ""
  });
  const [currentExamForQuestions, setCurrentExamForQuestions] = useState(null);
  const [batchQuestions, setBatchQuestions] = useState([]);
  const [materialLinkForm, setMaterialLinkForm] = useState({
    title: "",
    description: "",
    examId: "",
    topic: "",
    type: "link",
    url: ""
  });
  const [uploadMeta, setUploadMeta] = useState({
    title: "",
    description: "",
    examId: "",
    topic: ""
  });
  const [uploadFile, setUploadFile] = useState(null);
  const [pendingPasswordRequests, setPendingPasswordRequests] = useState([]);
  const [pendingRetestRequests, setPendingRetestRequests] = useState([]);
  const [exams, setExams] = useState([]);
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [passwordNotes, setPasswordNotes] = useState({});
  const [retestNotes, setRetestNotes] = useState({});
  const [examDeleteNotes, setExamDeleteNotes] = useState({});
  const [examEditRequests, setExamEditRequests] = useState([]);
  const [examEditNotes, setExamEditNotes] = useState({});
  const [teacherEditRequests, setTeacherEditRequests] = useState([]);
  const [selectedEditExamId, setSelectedEditExamId] = useState("");
  const [editRequestType, setEditRequestType] = useState("due_date");
  const [editRequestReason, setEditRequestReason] = useState("");
  const [requestedDueDate, setRequestedDueDate] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editQuestionsDueDate, setEditQuestionsDueDate] = useState("");
  const [editQuestions, setEditQuestions] = useState([]);
  const [editingQuestionsExamId, setEditingQuestionsExamId] = useState("");
  const [deletedQuestionIds, setDeletedQuestionIds] = useState([]);
  const [editModeById, setEditModeById] = useState({});

  useEffect(() => {
    setActive(isSystemAdmin ? "requests" : "my-exams");
  }, [isSystemAdmin]);

  useEffect(() => {
    if (isSystemAdmin) {
      loadPendingPasswordRequests();
      loadPendingRetestRequests();
      loadExamEditRequests();
    }
  }, [isSystemAdmin]);

  useEffect(() => {
    if (!isSystemAdmin) {
      loadAdminFeedback();
      loadExams();
    }
  }, [isSystemAdmin]);

  useEffect(() => {
    if (!isSystemAdmin && active === "edit-exam") {
      loadExams();
      loadTeacherEditRequests();
    }
  }, [active, isSystemAdmin]);

  const pendingPasswordCount = useMemo(
    () => pendingPasswordRequests.length,
    [pendingPasswordRequests]
  );

  const pendingRetestCount = useMemo(
    () => pendingRetestRequests.length,
    [pendingRetestRequests]
  );

  const pendingExamEditCount = useMemo(
    () => examEditRequests.length,
    [examEditRequests]
  );

  const loadMaterials = async () => {
    try {
      setMaterials(await apiRequest("/api/materials", { token }));
    } catch (err) {
      show(err.message, true);
    }
  };

  const loadStudents = async () => {
    try {
      const section = resultsSection.trim();
      if (!section) {
        show("Enter the section to view results", true);
        return;
      }
      const data = await apiRequest(`/api/results/students?section=${encodeURIComponent(section)}`, { token });
      setStudents(data);
      setSelectedStudent(null);
      setStudentResults([]);
    } catch (err) {
      show(err.message, true);
    }
  };

  const loadStudentResults = async (student) => {
    try {
      const section = resultsSection.trim();
      const query = section ? `?section=${encodeURIComponent(section)}` : "";
      const data = await apiRequest(`/api/results/student/${student.userId}${query}`, { token });
      setSelectedStudent(data.student || student);
      setStudentResults(data.results || []);
    } catch (err) {
      show(err.message, true);
    }
  };

  const loadRankBoard = async () => {
    try {
      const section = rankSection.trim();
      if (!section) {
        show("Enter the section to view rank board", true);
        return;
      }
      const data = await apiRequest(`/api/results/rankings/section?section=${encodeURIComponent(section)}`, { token });
      setRankBoard(data || { section, rankings: [] });
    } catch (err) {
      show(err.message, true);
    }
  };

  const createExam = async (e) => {
    e.preventDefault();
    try {
      const data = await apiRequest("/api/exams", {
        method: "POST",
        token,
        body: {
          title: examForm.title,
          description: examForm.description,
          duration: Number(examForm.duration),
          totalQuestions: Number(examForm.totalQuestions),
          section: examForm.section,
          dueDate: examForm.dueDate || null
        }
      });
      show(`Exam created: ${data._id}`);
      setCurrentExamForQuestions(data);
      setBatchQuestions(
        Array.from({ length: Number(data.totalQuestions) }, () => ({
          question: "",
          optionsText: "",
          correctOptionIndex: ""
        }))
      );
      setExamForm({ title: "", description: "", duration: "", totalQuestions: "", section: "", dueDate: "" });
      setActive("question-batch");
    } catch (err) {
      show(err.message, true);
    }
  };

  const setBatchQuestionField = (index, key, value) => {
    setBatchQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, [key]: value } : q))
    );
  };

  const submitBatchQuestions = async (e) => {
    e.preventDefault();
    if (!currentExamForQuestions?._id) {
      show("Create an exam first", true);
      return;
    }

    try {
      const parsedQuestions = batchQuestions.map((q, idx) => {
        const options = q.optionsText
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
        if (!q.question.trim()) {
          throw new Error(`Question ${idx + 1} text is required`);
        }
        if (options.length < 2) {
          throw new Error(`Question ${idx + 1} must have at least 2 options`);
        }
        if (!Number.isInteger(Number(q.correctOptionIndex))) {
          throw new Error(`Question ${idx + 1} correct option index is required`);
        }
        return {
          question: q.question.trim(),
          options,
          correctOptionIndex: Number(q.correctOptionIndex)
        };
      });

      await apiRequest("/api/questions/bulk", {
        method: "POST",
        token,
        body: {
          examId: currentExamForQuestions._id,
          questions: parsedQuestions
        }
      });

      show("All questions added successfully");
      setCurrentExamForQuestions(null);
      setBatchQuestions([]);
      setActive("exam");
    } catch (err) {
      show(err.message, true);
    }
  };

  const createLinkMaterial = async (e) => {
    e.preventDefault();
    try {
      await apiRequest("/api/materials", {
        method: "POST",
        token,
        body: materialLinkForm
      });
      show("Material link added");
      setMaterialLinkForm({
        title: "",
        description: "",
        examId: "",
        topic: "",
        type: "link",
        url: ""
      });
    } catch (err) {
      show(err.message, true);
    }
  };

  const uploadMaterial = async (e) => {
    e.preventDefault();
    try {
      if (!uploadFile) throw new Error("Please choose a file");
      const formData = new FormData();
      formData.append("title", uploadMeta.title);
      formData.append("description", uploadMeta.description);
      formData.append("examId", uploadMeta.examId);
      formData.append("topic", uploadMeta.topic);
      formData.append("file", uploadFile);
      await apiRequest("/api/materials/upload", {
        method: "POST",
        token,
        body: formData,
        isForm: true
      });
      show("File material uploaded");
      setUploadMeta({ title: "", description: "", examId: "", topic: "" });
      setUploadFile(null);
    } catch (err) {
      show(err.message, true);
    }
  };

  const deleteMaterial = async (id) => {
    try {
      await apiRequest(`/api/materials/${id}`, { method: "DELETE", token });
      show("Material deleted");
      await loadMaterials();
    } catch (err) {
      show(err.message, true);
    }
  };

  const loadPendingPasswordRequests = async () => {
    try {
      const data = await apiRequest("/api/users/password-change-requests", { token });
      const sorted = (data || []).slice().sort((a, b) => {
        const aTime = new Date(a.requestedAt || 0).getTime();
        const bTime = new Date(b.requestedAt || 0).getTime();
        return bTime - aTime;
      });
      setPendingPasswordRequests(sorted);
    } catch (err) {
      show(err.message, true);
    }
  };

  const reviewPasswordRequest = async (userId, action) => {
    const note = String(passwordNotes[userId] || "").trim();
    if (note.length < 3) {
      show("Enter a short note (min 3 chars) before approving/rejecting", true);
      return;
    }
    try {
      const data = await apiRequest(`/api/users/password-change-requests/${userId}/review`, {
        method: "POST",
        token,
        body: { action, note }
      });
      show(data.message || "Request updated");
      setPasswordNotes((prev) => ({ ...prev, [userId]: "" }));
      await loadPendingPasswordRequests();
    } catch (err) {
      show(err.message, true);
    }
  };

  const loadPendingRetestRequests = async () => {
    try {
      const data = await apiRequest("/api/results/retest-requests", { token });
      const sorted = (data || []).slice().sort((a, b) => {
        const aTime = new Date(a.requestedAt || 0).getTime();
        const bTime = new Date(b.requestedAt || 0).getTime();
        return bTime - aTime;
      });
      setPendingRetestRequests(sorted);
    } catch (err) {
      show(err.message, true);
    }
  };

  const reviewRetestRequest = async (id, action) => {
    const note = String(retestNotes[id] || "").trim();
    if (note.length < 3) {
      show("Enter a short note (min 3 chars) before approving/rejecting", true);
      return;
    }
    try {
      const data = await apiRequest(`/api/results/retest-requests/${id}/review`, {
        method: "POST",
        token,
        body: { action, note }
      });
      show(data.message || "Retest request updated");
      setRetestNotes((prev) => ({ ...prev, [id]: "" }));
      await loadPendingRetestRequests();
    } catch (err) {
      show(err.message, true);
    }
  };

  const loadExams = async () => {
    try {
      const endpoint = isSystemAdmin ? "/api/exams" : "/api/exams/mine";
      const data = await apiRequest(endpoint, { token });
      const sorted = (data || []).slice().sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      });
      setExams(sorted);
    } catch (err) {
      show(err.message, true);
    }
  };

  const deleteExam = async (examId) => {
    const note = String(examDeleteNotes[examId] || "").trim();
    if (note.length < 3) {
      show("Enter a short note (min 3 chars) before deleting exam", true);
      return;
    }
    try {
      const data = await apiRequest(`/api/exams/${examId}`, {
        method: "DELETE",
        token,
        body: { note }
      });
      show(data.message || "Exam deleted");
      setExamDeleteNotes((prev) => ({ ...prev, [examId]: "" }));
      await loadExams();
    } catch (err) {
      show(err.message, true);
    }
  };

  const loadAdminFeedback = async () => {
    try {
      const data = await apiRequest("/api/users/admin-feedback", { token });
      setFeedbackItems(data.items || []);
    } catch (err) {
      show(err.message, true);
    }
  };

  const markAdminFeedbackViewed = async () => {
    try {
      await apiRequest("/api/users/admin-feedback/mark-viewed", {
        method: "POST",
        token
      });
      setFeedbackItems((prev) =>
        prev.map((item) => ({
          ...item,
          viewedAt: item.viewedAt || new Date().toISOString()
        }))
      );
    } catch (err) {
      show(err.message, true);
    }
  };

  const loadExamEditRequests = async () => {
    try {
      const data = await apiRequest("/api/exams/edit-requests", { token });
      const sorted = (data.items || []).slice().sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      });
      setExamEditRequests(sorted);
    } catch (err) {
      show(err.message, true);
    }
  };

  const loadTeacherEditRequests = async () => {
    try {
      const data = await apiRequest("/api/exams/edit-requests/mine", { token });
      setTeacherEditRequests(data.items || []);
    } catch (err) {
      show(err.message, true);
    }
  };

  const reviewExamEditRequest = async (requestId, action) => {
    const note = String(examEditNotes[requestId] || "").trim();
    if (note.length < 3) {
      show("Enter a short note (min 3 chars) before approving/rejecting", true);
      return;
    }
    try {
      const data = await apiRequest(`/api/exams/edit-requests/${requestId}/review`, {
        method: "POST",
        token,
        body: { action, note }
      });
      show(data.message || "Edit request updated");
      setExamEditNotes((prev) => ({ ...prev, [requestId]: "" }));
      await loadExamEditRequests();
    } catch (err) {
      show(err.message, true);
    }
  };

  const requestExamEditPermission = async () => {
    if (!selectedEditExamId) {
      show("Select an exam first", true);
      return;
    }
    if (["due_date", "both"].includes(editRequestType) && !requestedDueDate) {
      show("Select a new due date for approval", true);
      return;
    }
    try {
      const data = await apiRequest(`/api/exams/${selectedEditExamId}/edit-requests`, {
        method: "POST",
        token,
        body: {
          requestType: editRequestType,
          reason: editRequestReason,
          requestedDueDate: ["due_date", "both"].includes(editRequestType)
            ? requestedDueDate
            : null
        }
      });
      show(data.message || "Edit request submitted");
      setEditRequestReason("");
      setRequestedDueDate("");
      await loadTeacherEditRequests();
    } catch (err) {
      show(err.message, true);
    }
  };

  const updateExamDueDate = async (e) => {
    e.preventDefault();
    if (!selectedEditExamId) {
      show("Select an exam first", true);
      return;
    }
    try {
      const data = await apiRequest(`/api/exams/${selectedEditExamId}`, {
        method: "PUT",
        token,
        body: { dueDate: editDueDate || null }
      });
      show("Due date updated");
      setEditDueDate(data.dueDate ? new Date(data.dueDate).toISOString().slice(0, 16) : "");
      await loadExams();
    } catch (err) {
      show(err.message, true);
    }
  };

  const loadQuestionsForEdit = async () => {
    if (!selectedEditExamId) {
      show("Select an exam first", true);
      return;
    }
    try {
      const data = await apiRequest(`/api/questions/manage/${selectedEditExamId}`, { token });
      const normalized = (data || []).map((q) => ({
        _id: q._id,
        question: q.question || "",
        optionsText: Array.isArray(q.options) ? q.options.join("\n") : "",
        correctOptionIndex:
          Number.isInteger(Number(q.correctOptionIndex)) ? String(q.correctOptionIndex) : "",
        isNew: false
      }));
      setEditQuestions(normalized);
      setEditingQuestionsExamId(selectedEditExamId);
      setDeletedQuestionIds([]);
      setEditModeById({});
      setEditQuestionsDueDate(
        selectedEditExam?.dueDate
          ? new Date(selectedEditExam.dueDate).toISOString().slice(0, 16)
          : ""
      );
    } catch (err) {
      show(err.message, true);
    }
  };

  const setEditQuestionField = (index, key, value) => {
    setEditQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, [key]: value } : q))
    );
  };

  const toggleEditQuestion = (id) => {
    setEditModeById((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const addEditQuestion = () => {
    const tempId = `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setEditQuestions((prev) => [
      ...prev,
      {
        _id: tempId,
        question: "",
        optionsText: "",
        correctOptionIndex: "",
        isNew: true
      }
    ]);
    setEditModeById((prev) => ({ ...prev, [tempId]: true }));
  };

  const deleteEditQuestion = (id) => {
    setEditQuestions((prev) => prev.filter((q) => String(q._id) !== String(id)));
    setEditModeById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (!String(id).startsWith("new-")) {
      setDeletedQuestionIds((prev) =>
        prev.includes(String(id)) ? prev : [...prev, String(id)]
      );
    }
  };

  const saveEditedQuestions = async (e) => {
    e.preventDefault();
    if (!editingQuestionsExamId) {
      show("Load questions first", true);
      return;
    }
    try {
      const newQuestions = editQuestions.filter((q) => q.isNew);
      const existingQuestions = editQuestions.filter((q) => !q.isNew);
      const requiresDueDate = newQuestions.length > 0 || deletedQuestionIds.length > 0;
      if (requiresDueDate && !editQuestionsDueDate) {
        show("Updating the due date is mandatory when adding or deleting questions", true);
        return;
      }

      const payload = existingQuestions.map((q, idx) => {
        const options = q.optionsText
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
        if (!q.question.trim()) {
          throw new Error(`Question ${idx + 1} text is required`);
        }
        if (options.length < 2) {
          throw new Error(`Question ${idx + 1} must have at least 2 options`);
        }
        if (!Number.isInteger(Number(q.correctOptionIndex))) {
          throw new Error(`Question ${idx + 1} correct option index is required`);
        }
        return {
          _id: q._id,
          question: q.question.trim(),
          options,
          correctOptionIndex: Number(q.correctOptionIndex)
        };
      });

      const newPayload = newQuestions.map((q, idx) => {
        const options = q.optionsText
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
        if (!q.question.trim()) {
          throw new Error(`New question ${idx + 1} text is required`);
        }
        if (options.length < 2) {
          throw new Error(`New question ${idx + 1} must have at least 2 options`);
        }
        if (!Number.isInteger(Number(q.correctOptionIndex))) {
          throw new Error(`New question ${idx + 1} correct option index is required`);
        }
        return {
          question: q.question.trim(),
          options,
          correctOptionIndex: Number(q.correctOptionIndex)
        };
      });

      const data = await apiRequest("/api/questions/bulk-update", {
        method: "PUT",
        token,
        body: {
          examId: editingQuestionsExamId,
          questions: payload,
          newQuestions: newPayload,
          deletedQuestionIds,
          dueDate: requiresDueDate ? editQuestionsDueDate : null
        }
      });
      show(data.message || "Questions updated");
      setDeletedQuestionIds([]);
      setEditModeById({});
      await loadExams();
    } catch (err) {
      show(err.message, true);
    }
  };

  const selectedEditExam = exams.find(
    (exam) => String(exam._id) === String(selectedEditExamId)
  );
  const selectedEditRequest = teacherEditRequests.find(
    (req) => String(req.examId?._id || req.examId) === String(selectedEditExamId)
  );

  const teacherSections = useMemo(() => {
    const set = new Set();
    exams.forEach((exam) => {
      if (exam.section) set.add(exam.section);
    });
    return Array.from(set);
  }, [exams]);

  return (
    <>
      <Shell
        title={isSystemAdmin ? "Admin Dashboard" : "Teacher Dashboard"}
        subtitle={isSystemAdmin ? "Admin Dashboard" : "Teacher Dashboard"}
        onBellClick={
          isSystemAdmin
            ? undefined
            : async () => {
                setActive("admin-feedback");
                await loadAdminFeedback();
                await markAdminFeedbackViewed();
              }
        }
        bellCount={
          isSystemAdmin
            ? undefined
            : feedbackItems.filter((item) => !item.viewedAt).length
        }
      >
        <div className="module-shell">
          <aside className="module-sidebar">
            {!isSystemAdmin && (
              <>
                <button className={`module-link ${active === "my-exams" ? "active" : ""}`} onClick={() => setActive("my-exams")}>My Exams</button>
                <button className={`module-link ${active === "exam" ? "active" : ""}`} onClick={() => setActive("exam")}>Create Exam</button>
                <button className={`module-link ${active === "question-batch" ? "active" : ""}`} onClick={() => setActive("question-batch")}>Add Questions (Batch)</button>
                <button className={`module-link ${active === "edit-exam" ? "active" : ""}`} onClick={() => setActive("edit-exam")}>Edit Exam</button>
                <button className={`module-link ${active === "materials" ? "active" : ""}`} onClick={() => setActive("materials")}>Materials</button>
                <button className={`module-link ${active === "results" ? "active" : ""}`} onClick={() => setActive("results")}>Student Results</button>
                <button className={`module-link ${active === "rank-board" ? "active" : ""}`} onClick={() => setActive("rank-board")}>Rank Board</button>
              </>
            )}
            {isSystemAdmin && (
              <>
                <button className={`module-link ${active === "requests" ? "active" : ""}`} onClick={() => setActive("requests")}>
                  Password Requests ({pendingPasswordCount})
                </button>
                <button className={`module-link ${active === "retest-requests" ? "active" : ""}`} onClick={() => setActive("retest-requests")}>
                  Retest Requests ({pendingRetestCount})
                </button>
                <button className={`module-link ${active === "exam-edit-requests" ? "active" : ""}`} onClick={() => setActive("exam-edit-requests")}>
                  Exam Edit Requests ({pendingExamEditCount})
                </button>
                <button className={`module-link ${active === "delete-exams" ? "active" : ""}`} onClick={() => setActive("delete-exams")}>Delete Exams</button>
                <button className={`module-link ${active === "admin-feedback" ? "active" : ""}`} onClick={() => setActive("admin-feedback")}>Admin Feedback</button>
              </>
            )}
          </aside>
          <div className="module-content">
            {!isSystemAdmin && active === "my-exams" && (
              <div className="panel">
                <h3>My Exams</h3>
                <button className="btn" onClick={loadExams}>Load My Exams</button>
                <div className="material-actions">
                  <span className="badge">My Classes: {teacherSections.length ? teacherSections.join(", ") : "None"}</span>
                </div>
                <div className="list">
                  {exams.length === 0 && <div className="item">No exams created yet.</div>}
                  {exams.map((exam) => (
                    <div className="item" key={exam._id}>
                      <strong>{exam.title}</strong>
                      <br />
                      ID: {exam._id}
                      <br />
                      {exam.description || "No description"}
                      <br />
                      Section: {exam.section || "All"}
                      <br />
                      Duration: {exam.duration} mins
                      <br />
                      Due Date: {exam.dueDate ? new Date(exam.dueDate).toLocaleString() : "None"}
                      <br />
                      Total Questions: {exam.totalQuestions}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!isSystemAdmin && active === "exam" && (
              <div className="panel">
                <h3>Create Exam</h3>
                <form className="stack" onSubmit={createExam}>
                  <input placeholder="Title" value={examForm.title} onChange={(e) => setExamForm((p) => ({ ...p, title: e.target.value }))} required />
                  <input placeholder="Description" value={examForm.description} onChange={(e) => setExamForm((p) => ({ ...p, description: e.target.value }))} />
                  <input placeholder="Section (e.g., A)" value={examForm.section} onChange={(e) => setExamForm((p) => ({ ...p, section: e.target.value }))} required />
                  <input type="number" placeholder="Duration (mins)" value={examForm.duration} onChange={(e) => setExamForm((p) => ({ ...p, duration: e.target.value }))} required />
                  <input type="number" min="1" placeholder="Total Questions" value={examForm.totalQuestions} onChange={(e) => setExamForm((p) => ({ ...p, totalQuestions: e.target.value }))} required />
                  <input type="datetime-local" value={examForm.dueDate} onChange={(e) => setExamForm((p) => ({ ...p, dueDate: e.target.value }))} />
                  <button className="btn primary" type="submit">Create Exam</button>
                </form>
              </div>
            )}

            {!isSystemAdmin && active === "question-batch" && (
              <div className="panel">
                <h3>Add Questions In One Go</h3>
                {!currentExamForQuestions ? (
                  <div className="item">
                    Create an exam first. You will then add all questions at once for that exam.
                  </div>
                ) : (
                  <form className="stack" onSubmit={submitBatchQuestions}>
                    <div className="item">
                      <strong>Exam:</strong> {currentExamForQuestions.title}
                      <br />
                      <strong>Exam ID:</strong> {currentExamForQuestions._id}
                      <br />
                      <strong>Total Questions Required:</strong> {currentExamForQuestions.totalQuestions}
                    </div>
                    {batchQuestions.map((q, idx) => (
                      <div className="question-box" key={`batch-${idx}`}>
                        <p><strong>Question {idx + 1}</strong></p>
                        <textarea
                          placeholder="Question"
                          value={q.question}
                          onChange={(e) => setBatchQuestionField(idx, "question", e.target.value)}
                          required
                        />
                        <textarea
                          placeholder="Options (one per line)"
                          value={q.optionsText}
                          onChange={(e) => setBatchQuestionField(idx, "optionsText", e.target.value)}
                          required
                        />
                        <input
                          type="number"
                          placeholder="Correct Option Index (0-based)"
                          value={q.correctOptionIndex}
                          onChange={(e) => setBatchQuestionField(idx, "correctOptionIndex", e.target.value)}
                          required
                        />
                      </div>
                    ))}
                    <button className="btn primary" type="submit">Save All Questions</button>
                  </form>
                )}
              </div>
            )}

            {!isSystemAdmin && active === "edit-exam" && (
              <div className="panel">
                <h3>Edit Exam (Admin Approval Required)</h3>
                <div className="stack">
                  <button className="btn" onClick={() => { loadExams(); loadTeacherEditRequests(); }}>
                    Load Exams
                  </button>
                  <select
                    value={selectedEditExamId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedEditExamId(id);
                      const exam = exams.find((x) => String(x._id) === String(id));
                      setEditDueDate(
                        exam?.dueDate
                          ? new Date(exam.dueDate).toISOString().slice(0, 16)
                          : ""
                      );
                      setEditQuestionsDueDate(
                        exam?.dueDate
                          ? new Date(exam.dueDate).toISOString().slice(0, 16)
                          : ""
                      );
                      setEditQuestions([]);
                      setEditingQuestionsExamId("");
                      setDeletedQuestionIds([]);
                      setEditModeById({});
                    }}
                  >
                    <option value="">Select exam to edit</option>
                    {exams.map((exam) => (
                      <option key={exam._id} value={exam._id}>
                        {exam.title}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedEditExam && (
                  <div className="item">
                    <strong>{selectedEditExam.title}</strong>
                    <br />
                    ID: {selectedEditExam._id}
                    <br />
                    Current Due Date:{" "}
                    {selectedEditExam.dueDate
                      ? new Date(selectedEditExam.dueDate).toLocaleString()
                      : "None"}
                    <br />
                    Request Status: {selectedEditRequest?.status || "none"}
                    {selectedEditRequest?.note ? (
                      <>
                        <br />
                        Admin Note: {selectedEditRequest.note}
                      </>
                    ) : null}
                  </div>
                )}
                <div className="panel">
                  <h4>Request Permission</h4>
                  <div className="stack">
                    <select
                      value={editRequestType}
                      onChange={(e) => setEditRequestType(e.target.value)}
                    >
                      <option value="due_date">Extend Due Date</option>
                      <option value="questions">Edit Questions</option>
                      <option value="both">Due Date + Questions</option>
                    </select>
                    {["due_date", "both"].includes(editRequestType) && (
                      <input
                        type="datetime-local"
                        value={requestedDueDate}
                        onChange={(e) => setRequestedDueDate(e.target.value)}
                        placeholder="New due date"
                        required
                      />
                    )}
                    <textarea
                      placeholder="Reason for edit request (optional but recommended)"
                      value={editRequestReason}
                      onChange={(e) => setEditRequestReason(e.target.value)}
                    />
                    <button
                      className="btn primary"
                      onClick={requestExamEditPermission}
                      disabled={!selectedEditExamId || selectedEditRequest?.status === "pending"}
                    >
                      {selectedEditRequest?.status === "pending"
                        ? "Request Pending"
                        : "Request Edit Permission"}
                    </button>
                  </div>
                </div>
                <div className="panel">
                  <h4>Edit Due Date</h4>
                  <form className="stack" onSubmit={updateExamDueDate}>
                    <input
                      type="datetime-local"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      disabled={
                        !selectedEditExamId ||
                        !["due_date", "both"].includes(selectedEditRequest?.requestType) ||
                        selectedEditRequest?.status !== "approved"
                      }
                    />
                    <button
                      className="btn primary"
                      type="submit"
                      disabled={
                        !selectedEditExamId ||
                        !["due_date", "both"].includes(selectedEditRequest?.requestType) ||
                        selectedEditRequest?.status !== "approved"
                      }
                    >
                      Save Due Date
                    </button>
                  </form>
                </div>
                <div className="panel">
                  <h4>Edit Questions</h4>
                  <div className="material-actions">
                    <button
                      className="btn"
                      type="button"
                      onClick={loadQuestionsForEdit}
                      disabled={
                        !selectedEditExamId ||
                        !["questions", "both"].includes(selectedEditRequest?.requestType) ||
                        selectedEditRequest?.status !== "approved"
                      }
                    >
                      Load Questions
                    </button>
                    <button
                      className="btn"
                      type="button"
                      onClick={addEditQuestion}
                      disabled={
                        !editingQuestionsExamId ||
                        !["questions", "both"].includes(selectedEditRequest?.requestType) ||
                        selectedEditRequest?.status !== "approved"
                      }
                    >
                      + Add Question
                    </button>
                  </div>
                  {editingQuestionsExamId && (
                    <form className="stack" onSubmit={saveEditedQuestions}>
                      <div className="stack">
                        <label className="muted">
                          New due date (required when adding or deleting questions)
                        </label>
                        <input
                          type="datetime-local"
                          value={editQuestionsDueDate}
                          onChange={(e) => setEditQuestionsDueDate(e.target.value)}
                        />
                      </div>
                      {editQuestions.length === 0 && (
                        <div className="muted">No questions loaded yet. Use + Add Question to start.</div>
                      )}
                      {editQuestions.map((q, idx) => (
                        <div className="question-box" key={`edit-${q._id}`}>
                          <div className="question-header">
                            <p>
                              <strong>
                                Question {idx + 1}
                                {q.isNew ? " (New)" : ""}
                              </strong>
                            </p>
                            <div className="question-actions">
                              <button
                                className="icon-btn"
                                type="button"
                                onClick={() => toggleEditQuestion(q._id)}
                                title="Edit question"
                                aria-label="Edit question"
                              >
                                &#9998;
                              </button>
                              <button
                                className="icon-btn danger"
                                type="button"
                                onClick={() => deleteEditQuestion(q._id)}
                                title="Delete question"
                                aria-label="Delete question"
                              >
                                &#128465;
                              </button>
                            </div>
                          </div>
                          <textarea
                            placeholder="Question"
                            value={q.question}
                            onChange={(e) => setEditQuestionField(idx, "question", e.target.value)}
                            required
                            disabled={!editModeById[q._id] && !q.isNew}
                          />
                          <textarea
                            placeholder="Options (one per line)"
                            value={q.optionsText}
                            onChange={(e) => setEditQuestionField(idx, "optionsText", e.target.value)}
                            required
                            disabled={!editModeById[q._id] && !q.isNew}
                          />
                          <input
                            type="number"
                            placeholder="Correct Option Index (0-based)"
                            value={q.correctOptionIndex}
                            onChange={(e) => setEditQuestionField(idx, "correctOptionIndex", e.target.value)}
                            required
                            disabled={!editModeById[q._id] && !q.isNew}
                          />
                        </div>
                      ))}
                      <button className="btn primary" type="submit">Save Question Updates</button>
                    </form>
                  )}
                </div>
              </div>
            )}

            {!isSystemAdmin && active === "materials" && (
              <div className="panel">
                <h3>Study Materials</h3>
                <form className="stack" onSubmit={createLinkMaterial}>
                  <input placeholder="Material Title" value={materialLinkForm.title} onChange={(e) => setMaterialLinkForm((p) => ({ ...p, title: e.target.value }))} required />
                  <input placeholder="Description" value={materialLinkForm.description} onChange={(e) => setMaterialLinkForm((p) => ({ ...p, description: e.target.value }))} />
                  <input placeholder="Exam ID (optional)" value={materialLinkForm.examId} onChange={(e) => setMaterialLinkForm((p) => ({ ...p, examId: e.target.value }))} />
                  <input placeholder="Topic (optional)" value={materialLinkForm.topic} onChange={(e) => setMaterialLinkForm((p) => ({ ...p, topic: e.target.value }))} />
                  <select value={materialLinkForm.type} onChange={(e) => setMaterialLinkForm((p) => ({ ...p, type: e.target.value }))}>
                    <option value="link">Link</option>
                    <option value="video">Video</option>
                  </select>
                  <input placeholder="https://..." value={materialLinkForm.url} onChange={(e) => setMaterialLinkForm((p) => ({ ...p, url: e.target.value }))} required />
                  <button className="btn primary" type="submit">Add Link Material</button>
                </form>
                <form className="stack" onSubmit={uploadMaterial}>
                  <input placeholder="File Title" value={uploadMeta.title} onChange={(e) => setUploadMeta((p) => ({ ...p, title: e.target.value }))} required />
                  <input placeholder="Description" value={uploadMeta.description} onChange={(e) => setUploadMeta((p) => ({ ...p, description: e.target.value }))} />
                  <input placeholder="Exam ID (optional)" value={uploadMeta.examId} onChange={(e) => setUploadMeta((p) => ({ ...p, examId: e.target.value }))} />
                  <input placeholder="Topic (optional)" value={uploadMeta.topic} onChange={(e) => setUploadMeta((p) => ({ ...p, topic: e.target.value }))} />
                  <input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} required />
                  <button className="btn primary" type="submit">Upload File Material</button>
                </form>
                <button className="btn" onClick={loadMaterials}>Refresh Materials</button>
                <div className="list">
                  {materials.map((m) => (
                    <div className="item" key={m._id}>
                      <strong>{m.title}</strong>
                      <br />
                      Type: {m.type}
                      <div className="material-actions">
                        <a className="btn" href={m.filePath ? `${apiBase()}${m.filePath}` : m.url} target="_blank" rel="noreferrer">Open</a>
                        <button className="btn" onClick={() => deleteMaterial(m._id)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isSystemAdmin && active === "results" && (
              <div className="panel">
                <h3>Student Results</h3>
                <div className="stack">
                  <input
                    placeholder="Section (e.g., A)"
                    value={resultsSection}
                    onChange={(e) => setResultsSection(e.target.value)}
                  />
                </div>
                <button className="btn" onClick={loadStudents}>Load Students</button>
                <div className="list">
                  {students.map((s) => (
                    <button className="item student-row" key={s.userId} onClick={() => loadStudentResults(s)}>
                      <strong>{s.name}</strong>
                      <br />
                      {s.email}
                    </button>
                  ))}
                </div>
                <h4>
                  {selectedStudent
                    ? `${selectedStudent.name || "Student"} (${selectedStudent.email || ""}) - Results`
                    : "Select a student to view results"}
                </h4>
                <div className="list">
                  {studentResults.map((r, idx) => (
                    <div className="item" key={`${r.examId?._id || r.examId}-${idx}`}>
                      <strong>
                        {r.examId?.title || "Exam"}
                        {r.examId?.description ? ` (${r.examId.description})` : ""}
                      </strong>
                      <br />
                      Attempts: {r.attemptsUsed}/2
                      <br />
                      Best Score Considered: {r.bestScore}/{r.totalMarks}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isSystemAdmin && active === "rank-board" && (
              <div className="panel">
                <h3>Rank Board</h3>
                <div className="stack">
                  <input
                    placeholder="Section (e.g., A)"
                    value={rankSection}
                    onChange={(e) => setRankSection(e.target.value)}
                  />
                </div>
                <button className="btn" onClick={loadRankBoard}>Load Rank Board</button>
                <div className="rank-grid">
                  <div className="rank-card">
                    <h4>Section Overview</h4>
                    <div className="rank-meta">
                      <div>Section: {rankBoard.section || rankSection || "N/A"}</div>
                      <div>Students Ranked: {rankBoard.rankings.length}</div>
                    </div>
                  </div>
                  <div className="rank-card">
                    <h4>Class Rankings</h4>
                    <div className="rank-list">
                      {rankBoard.rankings.length === 0 ? (
                        <div className="item">No rankings available for this section.</div>
                      ) : (
                        rankBoard.rankings.map((entry) => (
                          <div className="rank-item" key={entry.userId}>
                            <div className="rank-pill">#{entry.rank}</div>
                            <div className="rank-name">
                              {entry.name}
                              <span>{entry.email}</span>
                            </div>
                            <div className="rank-score">
                              {Math.round((entry.accuracy || 0) * 100)}%
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isSystemAdmin && active === "requests" && (
              <div className="panel">
                <h3>Password Change Requests</h3>
                <button className="btn" onClick={loadPendingPasswordRequests}>Refresh Requests</button>
                <div className="list">
                  {pendingPasswordRequests.length === 0 && <div className="item">No pending requests.</div>}
                  {pendingPasswordRequests.map((req) => (
                    <div className="item" key={req.userId}>
                      <strong>{req.name}</strong>
                      <br />
                      {req.email}
                      <br />
                      Type: {req.requestType === "forgot" ? "Forgot Password" : "Change Password"}
                      <br />
                      Requested: {req.requestedAt ? new Date(req.requestedAt).toLocaleString() : "N/A"}
                      <textarea
                        placeholder="Mandatory short note (e.g. Please remember your password)"
                        value={passwordNotes[req.userId] || ""}
                        onChange={(e) => setPasswordNotes((prev) => ({ ...prev, [req.userId]: e.target.value }))}
                      />
                      <div className="material-actions">
                        <button className="btn primary" onClick={() => reviewPasswordRequest(req.userId, "approve")}>Approve</button>
                        <button className="btn" onClick={() => reviewPasswordRequest(req.userId, "reject")}>Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isSystemAdmin && active === "retest-requests" && (
              <div className="panel">
                <h3>Retest Requests</h3>
                <button className="btn" onClick={loadPendingRetestRequests}>Refresh Retest Requests</button>
                <div className="list">
                  {pendingRetestRequests.length === 0 && <div className="item">No pending retest requests.</div>}
                  {pendingRetestRequests.map((req) => (
                    <div className="item" key={req.id}>
                      <strong>{req.name}</strong>
                      <br />
                      {req.email}
                      <br />
                      Exam: {req.examTitle}
                      <br />
                      Reason: {req.reason || "No reason provided"}
                      <br />
                      Requested: {req.requestedAt ? new Date(req.requestedAt).toLocaleString() : "N/A"}
                      <textarea
                        placeholder="Mandatory short note (e.g. Test seems not good enough)"
                        value={retestNotes[req.id] || ""}
                        onChange={(e) => setRetestNotes((prev) => ({ ...prev, [req.id]: e.target.value }))}
                      />
                      <div className="material-actions">
                        <button className="btn primary" onClick={() => reviewRetestRequest(req.id, "approve")}>Approve</button>
                        <button className="btn" onClick={() => reviewRetestRequest(req.id, "reject")}>Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isSystemAdmin && active === "exam-edit-requests" && (
              <div className="panel">
                <h3>Exam Edit Requests</h3>
                <button className="btn" onClick={loadExamEditRequests}>Refresh Edit Requests</button>
                <div className="list">
                  {examEditRequests.length === 0 && (
                    <div className="item">No pending edit requests.</div>
                  )}
                  {examEditRequests.map((req) => (
                    <div className="item" key={req._id}>
                      <strong>{req.examId?.title || "Exam"}</strong>
                      <br />
                      Exam ID: {req.examId?._id || req.examId}
                      <br />
                      Requested By: {req.requestedBy?.name || "Teacher"} ({req.requestedBy?.email || ""})
                      <br />
                      Type: {req.requestType.replace("_", " ").toUpperCase()}
                      {req.reason ? (
                        <>
                          <br />
                          Reason: {req.reason}
                        </>
                      ) : null}
                      {req.requestedDueDate ? (
                        <>
                          <br />
                          Requested Due Date: {new Date(req.requestedDueDate).toLocaleString()}
                        </>
                      ) : null}
                      <textarea
                        placeholder="Mandatory short note for teacher"
                        value={examEditNotes[req._id] || ""}
                        onChange={(e) => setExamEditNotes((prev) => ({ ...prev, [req._id]: e.target.value }))}
                      />
                      <div className="material-actions">
                        <button className="btn primary" onClick={() => reviewExamEditRequest(req._id, "approve")}>
                          Approve
                        </button>
                        <button className="btn" onClick={() => reviewExamEditRequest(req._id, "reject")}>
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isSystemAdmin && active === "delete-exams" && (
              <div className="panel">
                <h3>Delete Exams</h3>
                <button className="btn" onClick={loadExams}>Load Exams</button>
                <div className="list">
                  {exams.length === 0 && <div className="item">No exams found.</div>}
                  {exams.map((exam) => (
                    <div className="item" key={exam._id}>
                      <strong>{exam.title}</strong>
                      <br />
                      ID: {exam._id}
                      <br />
                      {exam.description || "No description"}
                      <textarea
                        placeholder="Mandatory short note to exam owner"
                        value={examDeleteNotes[exam._id] || ""}
                        onChange={(e) => setExamDeleteNotes((prev) => ({ ...prev, [exam._id]: e.target.value }))}
                      />
                      <div className="material-actions">
                        <button className="btn" onClick={() => deleteExam(exam._id)}>Delete Exam</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {active === "admin-feedback" && (
              <div className="panel">
                <h3>Admin Feedback</h3>
                <button
                  className="btn"
                  onClick={async () => {
                    await loadAdminFeedback();
                    if (!isSystemAdmin) {
                      await markAdminFeedbackViewed();
                    }
                  }}
                >
                  Load Feedback
                </button>
                <div className="list">
                  {feedbackItems.length === 0 && <div className="item">No feedback available.</div>}
                  {feedbackItems.map((item) => (
                    <div className="item" key={item._id}>
                      {isSystemAdmin ? (
                        <>
                          <strong>
                            To: {item.userId?.name || "User"} ({item.userId?.role || ""})
                          </strong>
                          <br />
                        </>
                      ) : (
                        <>
                          <strong>
                            From: {item.createdBy?.name || "Admin"}
                          </strong>
                          <br />
                        </>
                      )}
                      Category: {item.category.replace("_", " ").toUpperCase()}
                      <br />
                      {item.message}
                      <br />
                      {new Date(item.createdAt).toLocaleString()}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </Shell>
      <Toast message={toast.msg} error={toast.error} />
    </>
  );
}
