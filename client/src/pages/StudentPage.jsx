import React, { useEffect, useMemo, useRef, useState } from "react";
import Shell from "../components/Shell";
import Toast from "../components/Toast";
import { apiBase, apiRequest } from "../lib/api";
import { useAuth } from "../state/AuthContext";

function useToast() {
  const [toast, setToast] = useState({ msg: "", error: false });
  const show = (msg, error = false) => setToast({ msg, error });
  return { toast, show };
}

export default function StudentPage() {
  const { token, name, section } = useAuth();
  const [active, setActive] = useState("exams");
  const [exams, setExams] = useState([]);
  const [results, setResults] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [examId, setExamId] = useState("");
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [retestItems, setRetestItems] = useState([]);
  const [retestReasons, setRetestReasons] = useState({});
  const [approvedRetestExamIds, setApprovedRetestExamIds] = useState([]);
  const [adminFeedbackItems, setAdminFeedbackItems] = useState([]);
  const [rankings, setRankings] = useState({ section: "", student: null, rankings: [] });
  const { toast, show } = useToast();
  const submittingRef = useRef(false);
  const autoSubmitTriggeredRef = useRef(false);

  const attemptsMap = useMemo(() => {
    const map = new Map();
    results.forEach((r) => {
      const id = String(r.examId?._id || r.examId);
      map.set(id, r.attemptsUsed || 0);
    });
    return map;
  }, [results]);

  const retestStatusByExamId = useMemo(() => {
    const map = new Map();
    retestItems.forEach((item) => {
      map.set(String(item.examId), item);
    });
    return map;
  }, [retestItems]);

  const dueExams = useMemo(() => {
    const now = new Date();
    return exams.filter((exam) => exam.dueDate && new Date(exam.dueDate) < now);
  }, [exams]);

  const availableExams = useMemo(() => {
    const now = new Date();
    return exams.filter((exam) => !exam.dueDate || new Date(exam.dueDate) >= now);
  }, [exams]);

  const loadExams = async () => {
    try {
      const query = section ? `?section=${encodeURIComponent(section)}` : "";
      const data = await apiRequest(`/api/exams${query}`, { token });
      setExams(data || []);
    } catch (err) {
      show(err.message, true);
    }
  };

  const loadResults = async () => {
    try {
      setResults(await apiRequest("/api/results", { token }));
    } catch (err) {
      show(err.message, true);
    }
  };

  const loadMaterials = async () => {
    try {
      setMaterials(await apiRequest("/api/materials", { token }));
    } catch (err) {
      show(err.message, true);
    }
  };

  const loadRankings = async () => {
    try {
      const data = await apiRequest("/api/results/rankings", { token });
      setRankings(data || { section: "", student: null, rankings: [] });
    } catch (err) {
      show(err.message, true);
    }
  };

  const loadRetestStatus = async () => {
    try {
      const data = await apiRequest("/api/results/retest-status", { token });
      setRetestItems(data.items || []);
      setApprovedRetestExamIds((data.approvedExamIds || []).map(String));
    } catch (err) {
      show(err.message, true);
    }
  };

  const requestRetest = async (id) => {
    try {
      const reason = String(retestReasons[id] || "").trim();
      if (reason.length < 3) {
        show("Reason is required (min 3 characters)", true);
        return;
      }
      const data = await apiRequest("/api/results/retest-requests", {
        method: "POST",
        token,
        body: { examId: id, reason }
      });
      show(data.message || "Retest request sent to admin");
      setRetestReasons((prev) => ({ ...prev, [id]: "" }));
      await loadRetestStatus();
    } catch (err) {
      show(err.message, true);
    }
  };

  const loadAdminFeedback = async () => {
    try {
      const data = await apiRequest("/api/users/admin-feedback", { token });
      setAdminFeedbackItems(data.items || []);
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
      setAdminFeedbackItems((prev) =>
        prev.map((item) => ({
          ...item,
          viewedAt: item.viewedAt || new Date().toISOString()
        }))
      );
    } catch (err) {
      show(err.message, true);
    }
  };

  const loadQuestions = async (e) => {
    e.preventDefault();
    try {
      let exam = exams.find((x) => String(x._id) === String(examId));
      if (!exam) {
        const examList = await apiRequest("/api/exams", { token });
        setExams(examList);
        exam = examList.find((x) => String(x._id) === String(examId));
      }

      if (!exam) throw new Error("Exam not found");
      if (
        exam.dueDate &&
        new Date() > new Date(exam.dueDate) &&
        !approvedRetestExamIds.includes(String(exam._id))
      ) {
        throw new Error("Exam due date has passed. Submission is closed.");
      }

      const q = await apiRequest(`/api/questions/${examId}`, { token });
      setQuestions(q);
      setAnswers({});
      setFeedback(null);
      autoSubmitTriggeredRef.current = false;
      setRemainingSeconds(Number(exam.duration || 0) * 60);
      if (!q.length) show("No questions found for exam.", true);
    } catch (err) {
      show(err.message, true);
    }
  };

  const submitExam = async (isAutoSubmit = false) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      const payload = {
        examId,
        answers: questions.map((q) => ({
          questionId: q._id,
          selectedOptionIndex:
            answers[q._id] === undefined ? -1 : Number(answers[q._id])
        }))
      };
      const data = await apiRequest("/api/results/submit", {
        method: "POST",
        token,
        body: payload
      });
      setFeedback(data);
      show(`${isAutoSubmit ? "Auto-submitted" : "Submitted"}: ${data.score}/${data.totalMarks}`);
      setQuestions([]);
      setRemainingSeconds(null);
      await loadResults();
      await loadRetestStatus();
    } catch (err) {
      show(err.message, true);
    } finally {
      submittingRef.current = false;
    }
  };

  useEffect(() => {
    loadExams();
    loadResults();
    loadRetestStatus();
    loadAdminFeedback();
    loadRankings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!questions.length || remainingSeconds === null) return;

    if (remainingSeconds <= 0 && !autoSubmitTriggeredRef.current) {
      autoSubmitTriggeredRef.current = true;
      show("Time is up. Auto-submitting exam.");
      submitExam(true);
      return;
    }

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => (prev === null ? prev : Math.max(0, prev - 1)));
    }, 1000);

    return () => clearInterval(timer);
  }, [questions.length, remainingSeconds]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const accuracySummary = useMemo(() => {
    const totalScore = results.reduce((sum, item) => sum + (item.bestScore || 0), 0);
    const totalMarks = results.reduce((sum, item) => sum + (item.totalMarks || 0), 0);
    return {
      totalScore,
      totalMarks,
      accuracy: totalMarks ? totalScore / totalMarks : 0
    };
  }, [results]);

  const performanceSeries = useMemo(
    () =>
      results.map((item, idx) => ({
        label: item.examId?.title || `Exam ${idx + 1}`,
        value: item.totalMarks ? item.bestScore / item.totalMarks : 0
      })),
    [results]
  );

  return (
    <>
      <Shell
        title={`${name || "Student"} Dashboard | Rank: ${rankings.student ? `#${rankings.student.rank}` : "N/A"} | Section: ${rankings.section || section || "N/A"}`}
        subtitle="Student Dashboard"
        onBellClick={async () => {
          setActive("admin-feedback");
          await loadAdminFeedback();
          await markAdminFeedbackViewed();
        }}
        bellCount={adminFeedbackItems.filter((item) => !item.viewedAt).length}
      >
        <div className="module-shell">
          <aside className="module-sidebar">
            <button className={`module-link ${active === "exams" ? "active" : ""}`} onClick={() => setActive("exams")}>Available Exams</button>
            <button className={`module-link ${active === "write" ? "active" : ""}`} onClick={() => setActive("write")}>Write Exam</button>
            <button className={`module-link ${active === "materials" ? "active" : ""}`} onClick={() => setActive("materials")}>Study Materials</button>
            <button className={`module-link ${active === "results" ? "active" : ""}`} onClick={() => setActive("results")}>My Results</button>
            <button className={`module-link ${active === "retest" ? "active" : ""}`} onClick={() => setActive("retest")}>Retest Requests</button>
            <button className={`module-link ${active === "rank" ? "active" : ""}`} onClick={() => setActive("rank")}>Rank Board</button>
          </aside>
          <div className="module-content">
            {active === "exams" && (
              <div className="panel">
                <h3>Available Exams</h3>
                <button className="btn" onClick={loadExams}>Refresh Exams</button>
                <div className="list">
                  {availableExams.map((exam) => (
                    <div className="item" key={exam._id}>
                      <strong>{exam.title}</strong>
                      <br />
                      ID: {exam._id}
                      <br />
                      {exam.description}
                      <br />
                      Duration: {exam.duration} mins
                      {exam.dueDate ? (
                        <>
                          <br />
                          Due Date: {new Date(exam.dueDate).toLocaleString()}
                        </>
                      ) : null}
                      <br />
                      Attempts Used: {attemptsMap.get(exam._id) || 0}/2
                      {exam.dueDate && new Date() > new Date(exam.dueDate) ? (
                        <>
                          <br />
                          <div className="material-actions">
                            {retestStatusByExamId.get(String(exam._id))?.status === "pending" ? (
                              <button className="btn" type="button" disabled>
                                Retest Request Pending
                              </button>
                            ) : retestStatusByExamId.get(String(exam._id))?.status === "approved" &&
                              !retestStatusByExamId.get(String(exam._id))?.used ? (
                              <button className="btn" type="button" disabled>
                                Retest Approved
                              </button>
                            ) : (
                              <button className="btn" onClick={() => requestRetest(exam._id)}>
                                Request Retest
                              </button>
                            )}
                          </div>
                        </>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {active === "write" && (
              <div className="panel">
                <h3>Write Exam</h3>
                <form className="row" onSubmit={loadQuestions}>
                  <input value={examId} onChange={(e) => setExamId(e.target.value)} placeholder="Enter Exam ID" required />
                  <button className="btn primary" type="submit">Load Questions</button>
                </form>
                {questions.length > 0 && remainingSeconds !== null && (
                  <div className="exam-timer">Time Left: {formatTime(remainingSeconds)}</div>
                )}
                {!!questions.length && (
                  <form
                    className="stack"
                    onSubmit={(e) => {
                      e.preventDefault();
                      submitExam(false);
                    }}
                  >
                    {questions.map((q, i) => (
                      <div className="question-box" key={q._id}>
                        <p>{i + 1}. {q.question}</p>
                        {q.options.map((opt, idx) => (
                          <label className="option" key={`${q._id}-${idx}`}>
                            <input
                              type="radio"
                              name={`q_${q._id}`}
                              value={idx}
                              onChange={(e) =>
                                setAnswers((prev) => ({ ...prev, [q._id]: e.target.value }))
                              }
                            />
                            {opt}
                          </label>
                        ))}
                      </div>
                    ))}
                    <button className="btn primary" type="submit">Submit Exam</button>
                  </form>
                )}
                {feedback && (
                  <div className="feedback">
                    <h4>Submission Review</h4>
                    <p className={(feedback.wrongAnswers || []).length ? "feedback-bad" : "feedback-good"}>
                      Score: {feedback.score}/{feedback.totalMarks}
                    </p>
                    {!!(feedback.wrongAnswers || []).length && (
                      <ol className="feedback-list">
                        {feedback.wrongAnswers.map((w) => (
                          <li key={w.questionId}>
                            <strong>{w.question}</strong>
                            <br />
                            Your answer:{" "}
                            {w.selectedOptionIndex >= 0 ? w.options[w.selectedOptionIndex] : "Not answered"}
                            <br />
                            Correct answer: {w.options[w.correctOptionIndex]}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </div>
            )}

            {active === "materials" && (
              <div className="panel">
                <h3>Study Materials</h3>
                <button className="btn" onClick={loadMaterials}>Load Materials</button>
                <div className="list">
                  {materials.map((m) => (
                    <div className="item" key={m._id}>
                      <strong>{m.title}</strong>
                      <br />
                      Type: {m.type}
                      {m.examId?.title ? <><br />Exam: {m.examId.title}</> : null}
                      {m.topic ? <><br />Topic: {m.topic}</> : null}
                      {m.description ? <><br />{m.description}</> : null}
                      <div className="material-actions">
                        <a
                          className="btn"
                          href={m.filePath ? `${apiBase()}${m.filePath}` : m.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {active === "results" && (
              <div className="panel">
                <h3>My Results</h3>
                <button className="btn" onClick={loadResults}>Load My Results</button>
                <div className="chart-grid">
                  <div className="chart-card">
                    <h4>Accuracy</h4>
                    <PieChart value={accuracySummary.accuracy} />
                    <div className="chart-meta">
                      <div>Correct: {accuracySummary.totalScore}</div>
                      <div>Total: {accuracySummary.totalMarks}</div>
                      <div>Accuracy: {Math.round(accuracySummary.accuracy * 100)}%</div>
                    </div>
                  </div>
                  <div className="chart-card">
                    <h4>Performance Trend</h4>
                    {performanceSeries.length ? (
                      <LineChart data={performanceSeries} />
                    ) : (
                      <div className="muted">No results yet. Take an exam to see your trend.</div>
                    )}
                  </div>
                </div>
                <div className="list">
                  {results.map((r, idx) => (
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

            {active === "rank" && (
              <div className="panel">
                <h3>Rank Board</h3>
                <button className="btn" onClick={loadRankings}>Load Rank Board</button>
                <div className="rank-grid">
                  <div className="rank-card">
                    <h4>Your Rank</h4>
                    {rankings.student ? (
                      <>
                        <div className="rank-hero">#{rankings.student.rank}</div>
                        <div className="rank-meta">
                          <div>Section: {rankings.section || section || "N/A"}</div>
                          <div>
                            Accuracy: {Math.round((rankings.student.accuracy || 0) * 100)}%
                          </div>
                          <div>
                            Score: {rankings.student.totalScore}/{rankings.student.totalMarks}
                          </div>
                          <div>Exams Considered: {rankings.student.examsCount}</div>
                        </div>
                      </>
                    ) : (
                      <div className="muted">No rank yet. Complete an exam to appear on the board.</div>
                    )}
                  </div>
                  <div className="rank-card">
                    <h4>Class Rankings</h4>
                    <div className="rank-list">
                      {rankings.rankings.length === 0 ? (
                        <div className="item">No rankings available for this section.</div>
                      ) : (
                        rankings.rankings.map((entry) => (
                          <div
                            className={`rank-item ${entry.name === name ? "me" : ""}`}
                            key={entry.userId}
                          >
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

            {active === "retest" && (
              <div className="panel">
                <h3>Retest Requests</h3>
                <div className="material-actions">
                  <button className="btn" onClick={loadRetestStatus}>Check Admin Response</button>
                  <button className="btn" onClick={loadExams}>Load Due Exams</button>
                </div>
                <div className="list">
                  {retestItems.length === 0 && <div className="item">No retest requests found.</div>}
                  {retestItems.map((item) => (
                    <div className="item" key={item.id}>
                      <strong>{item.examTitle}</strong>
                      <br />
                      Status: {item.status.toUpperCase()}
                      {item.note ? (
                        <>
                          <br />
                          Admin Note: {item.note}
                        </>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className="list">
                  {dueExams.length === 0 && (
                    <div className="item">No exams are past the due date.</div>
                  )}
                  {dueExams.map((exam) => {
                    const status = retestStatusByExamId.get(String(exam._id))?.status;
                    const used = retestStatusByExamId.get(String(exam._id))?.used;
                    return (
                      <div className="item" key={exam._id}>
                        <strong>{exam.title}</strong>
                        {exam.description ? <><br />{exam.description}</> : null}
                        <br />
                        Due Date: {new Date(exam.dueDate).toLocaleString()}
                        <div className="stack">
                          <textarea
                            placeholder="Reason for retest (required)"
                            value={retestReasons[exam._id] || ""}
                            onChange={(e) =>
                              setRetestReasons((prev) => ({
                                ...prev,
                                [exam._id]: e.target.value
                              }))
                            }
                            required
                          />
                        </div>
                        <div className="material-actions">
                          {status === "pending" ? (
                            <button className="btn" type="button" disabled>
                              Retest Request Pending
                            </button>
                          ) : status === "approved" && !used ? (
                            <button className="btn" type="button" disabled>
                              Retest Approved
                            </button>
                          ) : (
                            <button className="btn" onClick={() => requestRetest(exam._id)}>
                              Request Retest
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
                    await markAdminFeedbackViewed();
                  }}
                >
                  Load Feedback
                </button>
                <div className="list">
                  {adminFeedbackItems.length === 0 && (
                    <div className="item">No admin feedback yet.</div>
                  )}
                  {adminFeedbackItems.map((item) => (
                    <div className="item" key={item._id}>
                      <strong>{item.category.replace("_", " ").toUpperCase()}</strong>
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

function PieChart({ value }) {
  const percentage = Math.min(100, Math.max(0, Math.round(value * 100)));
  const dash = `${percentage} ${100 - percentage}`;
  return (
    <div className="pie-wrap">
      <svg className="pie-chart" viewBox="0 0 42 42" role="img" aria-label="Accuracy chart">
        <circle className="pie-track" cx="21" cy="21" r="15.9155" />
        <circle
          className="pie-value"
          cx="21"
          cy="21"
          r="15.9155"
          strokeDasharray={dash}
          strokeDashoffset="25"
        />
      </svg>
      <div className="pie-center">{percentage}%</div>
    </div>
  );
}

function LineChart({ data }) {
  const width = 320;
  const height = 140;
  const padding = 18;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const step = data.length > 1 ? usableWidth / (data.length - 1) : 0;
  const points = data
    .map((item, index) => {
      const x = padding + index * step;
      const y = padding + (1 - item.value) * usableHeight;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="line-wrap">
      <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Performance trend chart">
        <line className="line-axis" x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} />
        <polyline className="line-path" points={points} />
        {data.map((item, index) => {
          const x = padding + index * step;
          const y = padding + (1 - item.value) * usableHeight;
          return <circle className="line-point" cx={x} cy={y} r="3.5" key={`${item.label}-${index}`} />;
        })}
      </svg>
      <div className="line-labels">
        {data.map((item, index) => (
          <span key={`${item.label}-label-${index}`}>{item.label}</span>
        ))}
      </div>
    </div>
  );
}
