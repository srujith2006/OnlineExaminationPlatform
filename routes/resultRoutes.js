const express = require("express");
const Exam = require("../models/examModel");
const Result = require("../models/resultModel");
const Question = require("../models/questionModel");
const ExamRetestRequest = require("../models/ExamRetestRequestModel");
const AdminFeedback = require("../models/AdminFeedbackModel");
const User = require("../models/UserModel");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");
const systemAdminMiddleware = require("../middleware/systemAdminMiddleware");

const router = express.Router();
const MAX_ATTEMPTS_PER_EXAM = 2;

function summarizeByExam(results) {
  const summaryMap = new Map();
  for (const result of results) {
    const examKey = String(result.examId?._id || result.examId);
    if (!summaryMap.has(examKey)) {
      summaryMap.set(examKey, {
        examId: result.examId,
        attemptsUsed: 0,
        bestScore: 0,
        totalMarks: result.totalMarks
      });
    }

    const summary = summaryMap.get(examKey);
    summary.attemptsUsed += 1;
    summary.bestScore = Math.max(summary.bestScore, result.score);
    summary.totalMarks = Math.max(summary.totalMarks, result.totalMarks);
  }
  return Array.from(summaryMap.values());
}

async function buildSectionRankings(section, examIds = null) {
  const students = await User.find({ role: "student", section })
    .select("_id name email section")
    .lean();
  const studentIds = students.map((student) => student._id);

  if (studentIds.length === 0) {
    return { rankings: [] };
  }

  const resultFilter = { userId: { $in: studentIds } };
  if (Array.isArray(examIds) && examIds.length > 0) {
    resultFilter.examId = { $in: examIds };
  }

  const results = await Result.find(resultFilter)
    .select("userId examId score totalMarks")
    .lean();

  const studentMap = new Map();
  for (const student of students) {
    studentMap.set(String(student._id), {
      userId: student._id,
      name: student.name || "Student",
      email: student.email || "",
      section: student.section || section,
      attemptsCount: 0,
      examMap: new Map()
    });
  }

  for (const result of results) {
    const userKey = String(result.userId);
    if (!studentMap.has(userKey)) continue;
    const entry = studentMap.get(userKey);
    entry.attemptsCount += 1;
    const examKey = String(result.examId);
    const current = entry.examMap.get(examKey) || {
      score: 0,
      totalMarks: result.totalMarks || 0
    };
    entry.examMap.set(examKey, {
      score: Math.max(current.score, result.score || 0),
      totalMarks: Math.max(current.totalMarks, result.totalMarks || 0)
    });
  }

  const rankings = Array.from(studentMap.values()).map((entry) => {
    let totalScore = 0;
    let totalMarks = 0;
    entry.examMap.forEach((value) => {
      totalScore += value.score;
      totalMarks += value.totalMarks;
    });
    const accuracy = totalMarks ? totalScore / totalMarks : 0;
    return {
      userId: entry.userId,
      name: entry.name,
      email: entry.email,
      section: entry.section,
      attemptsCount: entry.attemptsCount,
      examsCount: entry.examMap.size,
      totalScore,
      totalMarks,
      accuracy
    };
  });

  rankings.sort((a, b) => {
    if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return a.name.localeCompare(b.name);
  });

  rankings.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return { rankings };
}

router.post("/", authMiddleware, async (req, res) => {
  try {
    const result = new Result({ ...req.body, userId: req.user._id });
    await result.save();
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/submit", authMiddleware, async (req, res) => {
  try {
    const { examId, answers } = req.body;

    if (!examId) {
      return res.status(400).json({ message: "examId is required" });
    }

    if (!Array.isArray(answers)) {
      return res.status(400).json({ message: "answers must be an array" });
    }

    const exam = await Exam.findById(examId).select("_id dueDate");
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }
    const approvedRetest = await ExamRetestRequest.findOne({
      examId,
      userId: req.user._id,
      status: "approved",
      used: false
    });
    const canUseRetest = Boolean(approvedRetest);
    if (exam.dueDate && new Date() > new Date(exam.dueDate) && !canUseRetest) {
      return res.status(403).json({
        message: "Exam due date has passed. Submission is closed.",
        dueDate: exam.dueDate
      });
    }

    const previousAttempts = await Result.countDocuments({
      examId,
      userId: req.user._id
    });

    if (previousAttempts >= MAX_ATTEMPTS_PER_EXAM) {
      return res.status(403).json({
        message: "Maximum attempts reached for this exam (2)",
        attemptsUsed: previousAttempts,
        attemptsRemaining: 0
      });
    }

    const questions = await Question.find({ examId })
      .select("_id question options correctOptionIndex")
      .lean();

    if (questions.length === 0) {
      return res.status(404).json({ message: "No questions found for exam" });
    }

    const answerMap = new Map(
      answers.map((item) => [String(item.questionId), item.selectedOptionIndex])
    );

    const answerReview = questions.map((question) => {
      const selectedOptionIndex = answerMap.has(String(question._id))
        ? Number(answerMap.get(String(question._id)))
        : -1;
      const isCorrect = selectedOptionIndex === question.correctOptionIndex;
      return {
        questionId: question._id,
        question: question.question,
        options: question.options,
        selectedOptionIndex,
        correctOptionIndex: question.correctOptionIndex,
        isCorrect
      };
    });

    const score = answerReview.filter((item) => item.isCorrect).length;
    const wrongAnswers = answerReview.filter((item) => !item.isCorrect);

    const result = await Result.create({
      examId,
      userId: req.user._id,
      score,
      totalMarks: questions.length
    });

    if (approvedRetest) {
      approvedRetest.used = true;
      approvedRetest.resolvedAt = approvedRetest.resolvedAt || new Date();
      await approvedRetest.save();
    }

    res.status(201).json({
      message: "Exam submitted successfully",
      score,
      totalMarks: questions.length,
      answerReview,
      wrongAnswers,
      attemptsUsed: previousAttempts + 1,
      attemptsRemaining: Math.max(
        0,
        MAX_ATTEMPTS_PER_EXAM - (previousAttempts + 1)
      ),
      result
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/", authMiddleware, async (req, res) => {
  const results = await Result.find({ userId: req.user._id })
    .populate("examId", "title description")
    .sort({ createdAt: -1 });
  res.json(summarizeByExam(results));
});

router.get("/rankings", authMiddleware, async (req, res) => {
  try {
    const section = String(req.user.section || "").trim();
    if (!section) {
      return res.json({ section: "", student: null, rankings: [] });
    }
    const { rankings } = await buildSectionRankings(section);
    const student = rankings.find(
      (entry) => String(entry.userId) === String(req.user._id)
    );
    res.json({ section, student: student || null, rankings });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/rankings/section", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const section = String(req.query?.section || "").trim();
    if (!section) {
      return res.status(400).json({ message: "section is required" });
    }

    let examIds = null;
    if (req.user.role === "teacher") {
      const exams = await Exam.find({ createdBy: req.user._id }).select("_id");
      examIds = exams.map((exam) => exam._id);
    }

    const { rankings } = await buildSectionRankings(section, examIds);
    res.json({ section, rankings });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/students", authMiddleware, adminMiddleware, async (req, res) => {
  const section = String(req.query?.section || "").trim();
  const filter = {};

  if (req.user.role === "teacher") {
    const exams = await Exam.find({ createdBy: req.user._id }).select("_id");
    const examIds = exams.map((exam) => exam._id);
    filter.examId = { $in: examIds };
  }

  if (section) {
    const students = await User.find({ role: "student", section }).select("_id");
    const studentIds = students.map((student) => student._id);
    filter.userId = { $in: studentIds };
  }

  const results = await Result.find(filter)
    .populate("userId", "name email role section")
    .lean();

  const studentMap = new Map();
  for (const result of results) {
    const userId = String(result.userId?._id || "");
    if (!userId) continue;
    if (!studentMap.has(userId)) {
      studentMap.set(userId, {
        userId,
        name: result.userId.name || "Student",
        email: result.userId.email || "",
        attemptsCount: 0
      });
    }
    studentMap.get(userId).attemptsCount += 1;
  }

  res.json(Array.from(studentMap.values()));
});

router.get("/student/:userId", authMiddleware, adminMiddleware, async (req, res) => {
  const section = String(req.query?.section || "").trim();
  const filter = { userId: req.params.userId };

  if (req.user.role === "teacher") {
    const exams = await Exam.find({ createdBy: req.user._id }).select("_id");
    const examIds = exams.map((exam) => exam._id);
    filter.examId = { $in: examIds };
  }

  if (section) {
    const student = await User.findById(req.params.userId).select("section");
    if (!student || student.section !== section) {
      return res.status(404).json({ message: "No results for this section" });
    }
  }

  const results = await Result.find(filter)
    .populate("examId", "title description")
    .populate("userId", "name email")
    .sort({ createdAt: -1 });

  const student = results[0]?.userId || null;
  res.json({
    student,
    results: summarizeByExam(results)
  });
});

router.get("/all", authMiddleware, adminMiddleware, async (req, res) => {
  const results = await Result.find()
    .populate("userId", "name email role")
    .populate("examId", "title description");
  res.json(results);
});

router.post("/retest-requests", authMiddleware, async (req, res) => {
  try {
    const { examId, reason } = req.body;
    if (!examId) {
      return res.status(400).json({ message: "examId is required" });
    }
    const cleanReason = String(reason || "").trim();
    if (cleanReason.length < 3) {
      return res.status(400).json({ message: "Reason is required (min 3 characters)" });
    }

    const exam = await Exam.findById(examId).select("_id dueDate");
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    if (!exam.dueDate || new Date() <= new Date(exam.dueDate)) {
      return res.status(400).json({ message: "Retest request is allowed only after exam due date" });
    }

    const existing = await ExamRetestRequest.findOne({ examId, userId: req.user._id });
    if (existing) {
      if (existing.status === "pending") {
        return res.status(400).json({ message: "Retest request is already pending" });
      }
      if (existing.status === "approved" && !existing.used) {
        return res.status(400).json({ message: "Retest request already approved and available" });
      }
    }

    await ExamRetestRequest.findOneAndUpdate(
      { examId, userId: req.user._id },
      {
        $set: {
          status: "pending",
          used: false,
          reason: cleanReason,
          requestedAt: new Date(),
          resolvedAt: null,
          note: "",
          reviewedBy: null
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ message: "Retest request sent to admin for approval" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/retest-status", authMiddleware, async (req, res) => {
  try {
    const requests = await ExamRetestRequest.find({ userId: req.user._id })
      .populate("examId", "title dueDate")
      .sort({ updatedAt: -1 });

    const items = requests.map((r) => ({
      id: r._id,
      examId: r.examId?._id || r.examId,
      examTitle: r.examId?.title || "Exam",
      status: r.status,
      used: r.used,
      note: r.note || "",
      requestedAt: r.requestedAt,
      resolvedAt: r.resolvedAt
    }));

    const approvedExamIds = items
      .filter((item) => item.status === "approved" && !item.used)
      .map((item) => String(item.examId));

    res.json({ items, approvedExamIds });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get(
  "/retest-requests",
  authMiddleware,
  systemAdminMiddleware,
  async (req, res) => {
    try {
      const requests = await ExamRetestRequest.find({ status: "pending" })
        .populate("userId", "name email")
        .populate("examId", "title dueDate")
        .sort({ requestedAt: -1 });

      res.json(
        requests.map((r) => ({
          id: r._id,
          userId: r.userId?._id || null,
          name: r.userId?.name || "Student",
          email: r.userId?.email || "",
          examId: r.examId?._id || null,
          examTitle: r.examId?.title || "Exam",
          reason: r.reason || "",
          requestedAt: r.requestedAt
        }))
      );
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

router.post(
  "/retest-requests/:id/review",
  authMiddleware,
  systemAdminMiddleware,
  async (req, res) => {
    try {
      const { action, note } = req.body;
      const cleanNote = String(note || "").trim();
      if (!["approve", "reject"].includes(action)) {
        return res.status(400).json({ message: "Action must be approve or reject" });
      }
      if (cleanNote.length < 3) {
        return res.status(400).json({ message: "A short admin note is required (min 3 characters)" });
      }

      const request = await ExamRetestRequest.findById(req.params.id);
      if (!request) {
        return res.status(404).json({ message: "Retest request not found" });
      }
      if (request.status !== "pending") {
        return res.status(400).json({ message: "Retest request is not pending" });
      }

      request.status = action === "approve" ? "approved" : "rejected";
      request.note = cleanNote;
      request.reviewedBy = req.user._id;
      request.resolvedAt = new Date();
      if (action === "reject") {
        request.used = false;
      }
      await request.save();

      await AdminFeedback.create({
        userId: request.userId,
        category: "retest_request",
        message: cleanNote,
        createdBy: req.user._id
      });

      res.json({
        message:
          action === "approve"
            ? "Retest request approved"
            : "Retest request rejected"
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;
