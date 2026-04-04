const express = require("express");
const Question = require("../models/questionModel");
const Exam = require("../models/examModel");
const ExamEditRequest = require("../models/ExamEditRequestModel");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

const router = express.Router();

router.post("/", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const question = new Question(req.body);
    await question.save();
    res.status(201).json(question);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/bulk", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { examId, questions } = req.body || {};
    if (!examId || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        message: "examId and non-empty questions array are required"
      });
    }

    const exam = await Exam.findById(examId).select("_id totalQuestions");
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    if (questions.length !== exam.totalQuestions) {
      return res.status(400).json({
        message: `You must submit exactly ${exam.totalQuestions} questions for this exam`
      });
    }

    const existingCount = await Question.countDocuments({ examId });
    if (existingCount > 0) {
      return res.status(400).json({
        message: "Questions already exist for this exam"
      });
    }

    const payload = questions.map((q) => ({
      examId,
      question: q.question,
      options: q.options,
      correctOptionIndex: q.correctOptionIndex
    }));

    const inserted = await Question.insertMany(payload);
    res.status(201).json(inserted);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

const ensureEditPermission = async (req, res, examId, requestType) => {
  if (req.user?.role === "admin") {
    return true;
  }

  if (req.user?.role !== "teacher") {
    res.status(403).json({ message: "Access denied" });
    return false;
  }

  const exam = await Exam.findById(examId).select("_id createdBy totalQuestions");
  if (!exam) {
    res.status(404).json({ message: "Exam not found" });
    return false;
  }

  if (String(exam.createdBy || "") !== String(req.user._id || "")) {
    res.status(403).json({ message: "Only the exam creator can edit questions" });
    return false;
  }

  const approvedRequest = await ExamEditRequest.findOne({
    examId: exam._id,
    requestedBy: req.user._id,
    status: "approved",
    requestType: { $in: [requestType, "both"] }
  });

  if (!approvedRequest) {
    res.status(403).json({ message: "Admin approval required to edit questions" });
    return false;
  }

  return true;
};

router.get("/manage/:examId", authMiddleware, async (req, res) => {
  try {
    const allowed = await ensureEditPermission(req, res, req.params.examId, "questions");
    if (!allowed) return;

    const questions = await Question.find({ examId: req.params.examId });
    res.json(questions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:examId", async (req, res) => {
  const questions = await Question.find({ examId: req.params.examId }).select(
    "-correctOptionIndex"
  );
  res.json(questions);
});

router.put("/bulk-update", authMiddleware, async (req, res) => {
  try {
    const {
      examId,
      questions = [],
      newQuestions = [],
      deletedQuestionIds = [],
      dueDate
    } = req.body || {};
    const hasUpdates = Array.isArray(questions) && questions.length > 0;
    const hasAdds = Array.isArray(newQuestions) && newQuestions.length > 0;
    const hasDeletes = Array.isArray(deletedQuestionIds) && deletedQuestionIds.length > 0;
    if (!examId || (!hasUpdates && !hasAdds && !hasDeletes)) {
      return res.status(400).json({
        message: "examId and at least one update, add, or delete action are required"
      });
    }

    const allowed = await ensureEditPermission(req, res, examId, "questions");
    if (!allowed) return;

    const exam = await Exam.findById(examId).select("_id totalQuestions dueDate");
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    if ((hasAdds || hasDeletes) && !dueDate) {
      return res.status(400).json({
        message: "Updating the due date is mandatory when adding or deleting questions"
      });
    }

    if (hasDeletes && deletedQuestionIds.length >= exam.totalQuestions && !hasAdds) {
      return res.status(400).json({
        message: "At least one question must remain in the exam"
      });
    }

    const bulkOps = [];

    if (hasUpdates) {
      questions.forEach((q, idx) => {
        const options = Array.isArray(q.options) ? q.options : [];
        if (!q._id) {
          throw new Error(`Question ${idx + 1} id is required`);
        }
        if (!q.question || !String(q.question).trim()) {
          throw new Error(`Question ${idx + 1} text is required`);
        }
        if (options.length < 2) {
          throw new Error(`Question ${idx + 1} must have at least 2 options`);
        }
        if (!Number.isInteger(Number(q.correctOptionIndex))) {
          throw new Error(`Question ${idx + 1} correct option index is required`);
        }

        bulkOps.push({
          updateOne: {
            filter: { _id: q._id, examId },
            update: {
              $set: {
                question: String(q.question).trim(),
                options: options.map((opt) => String(opt).trim()),
                correctOptionIndex: Number(q.correctOptionIndex)
              }
            }
          }
        });
      });
    }

    if (hasAdds) {
      newQuestions.forEach((q, idx) => {
        const options = Array.isArray(q.options) ? q.options : [];
        if (!q.question || !String(q.question).trim()) {
          throw new Error(`New question ${idx + 1} text is required`);
        }
        if (options.length < 2) {
          throw new Error(`New question ${idx + 1} must have at least 2 options`);
        }
        if (!Number.isInteger(Number(q.correctOptionIndex))) {
          throw new Error(`New question ${idx + 1} correct option index is required`);
        }

        bulkOps.push({
          insertOne: {
            document: {
              examId,
              question: String(q.question).trim(),
              options: options.map((opt) => String(opt).trim()),
              correctOptionIndex: Number(q.correctOptionIndex)
            }
          }
        });
      });
    }

    if (hasDeletes) {
      bulkOps.push({
        deleteMany: {
          filter: {
            examId,
            _id: { $in: deletedQuestionIds }
          }
        }
      });
    }

    if (bulkOps.length > 0) {
      await Question.bulkWrite(bulkOps);
    }

    if (hasAdds || hasDeletes) {
      const updatedCount = await Question.countDocuments({ examId });
      if (updatedCount < 1) {
        return res.status(400).json({
          message: "At least one question must remain in the exam"
        });
      }
      const nextDueDate = new Date(dueDate);
      if (Number.isNaN(nextDueDate.getTime())) {
        return res.status(400).json({ message: "Invalid due date" });
      }
      exam.totalQuestions = updatedCount;
      exam.dueDate = nextDueDate;
      await exam.save();
    }

    res.json({ message: "Questions updated successfully" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
