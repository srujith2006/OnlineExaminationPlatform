const express = require("express");
const Exam = require("../models/examModel");
const Question = require("../models/questionModel");
const Result = require("../models/resultModel");
const AdminFeedback = require("../models/AdminFeedbackModel");
const ExamEditRequest = require("../models/ExamEditRequestModel");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");
const systemAdminMiddleware = require("../middleware/systemAdminMiddleware");

const router = express.Router();

router.post("/", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const totalQuestions = Number(req.body.totalQuestions);
    if (!Number.isInteger(totalQuestions) || totalQuestions < 1) {
      return res.status(400).json({ message: "totalQuestions must be a positive integer" });
    }

    const exam = new Exam({
      ...req.body,
      totalQuestions,
      createdBy: req.user._id
    });
    await exam.save();
    res.status(201).json(exam);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/", async (req, res) => {
  const section = String(req.query?.section || "").trim();
  const filter = section ? { section } : {};
  const exams = await Exam.find(filter);
  res.json(exams);
});

router.get("/mine", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const exams = await Exam.find({ createdBy: req.user._id });
    res.json(exams);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/:id/edit-requests", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    if (String(exam.createdBy || "") !== String(req.user._id || "")) {
      return res.status(403).json({ message: "Only the exam creator can request edits" });
    }

    const requestType = String(req.body?.requestType || "").trim();
    const reason = String(req.body?.reason || "").trim();
    const allowedTypes = ["due_date", "questions", "both"];

    if (!allowedTypes.includes(requestType)) {
      return res.status(400).json({ message: "Invalid request type" });
    }

    const pendingExisting = await ExamEditRequest.findOne({
      examId: exam._id,
      requestedBy: req.user._id,
      status: "pending"
    });

    if (pendingExisting) {
      return res.status(400).json({ message: "An edit request is already pending for this exam" });
    }

    const request = await ExamEditRequest.create({
      examId: exam._id,
      requestedBy: req.user._id,
      requestType,
      reason
    });

    res.status(201).json(request);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/edit-requests/mine", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const requests = await ExamEditRequest.find({ requestedBy: req.user._id })
      .populate("examId", "title dueDate")
      .sort({ updatedAt: -1 });
    res.json({ items: requests });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/edit-requests", authMiddleware, systemAdminMiddleware, async (req, res) => {
  try {
    const requests = await ExamEditRequest.find({ status: "pending" })
      .populate("examId", "title dueDate createdBy")
      .populate("requestedBy", "name email role")
      .sort({ createdAt: -1 });
    res.json({ items: requests });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post(
  "/edit-requests/:id/review",
  authMiddleware,
  systemAdminMiddleware,
  async (req, res) => {
    try {
      const action = String(req.body?.action || "").trim();
      const note = String(req.body?.note || "").trim();

      if (!["approve", "reject"].includes(action)) {
        return res.status(400).json({ message: "Invalid action" });
      }

      if (note.length < 3) {
        return res.status(400).json({ message: "A short admin note is required (min 3 characters)" });
      }

      const request = await ExamEditRequest.findById(req.params.id);
      if (!request) {
        return res.status(404).json({ message: "Edit request not found" });
      }

      request.status = action === "approve" ? "approved" : "rejected";
      request.note = note;
      request.reviewedBy = req.user._id;
      request.reviewedAt = new Date();
      await request.save();

      await AdminFeedback.create({
        userId: request.requestedBy,
        category: "exam_edit_request",
        message: note,
        createdBy: req.user._id
      });

      res.json({
        message:
          action === "approve" ? "Edit request approved" : "Edit request rejected"
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    const nextDueDate = req.body?.dueDate ?? null;
    if (nextDueDate === undefined) {
      return res.status(400).json({ message: "dueDate is required" });
    }

    const isAdmin = req.user?.role === "admin";
    if (!isAdmin) {
      if (req.user?.role !== "teacher") {
        return res.status(403).json({ message: "Access denied" });
      }

      if (String(exam.createdBy || "") !== String(req.user._id || "")) {
        return res.status(403).json({ message: "Only the exam creator can edit this exam" });
      }

      const approvedRequest = await ExamEditRequest.findOne({
        examId: exam._id,
        requestedBy: req.user._id,
        status: "approved",
        requestType: { $in: ["due_date", "both"] }
      });

      if (!approvedRequest) {
        return res.status(403).json({ message: "Admin approval required to edit due date" });
      }
    }

    exam.dueDate = nextDueDate ? new Date(nextDueDate) : null;
    await exam.save();
    res.json(exam);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", authMiddleware, systemAdminMiddleware, async (req, res) => {
  try {
    const note = String(req.body?.note || "").trim();
    if (note.length < 3) {
      return res.status(400).json({ message: "A short admin note is required (min 3 characters)" });
    }

    const exam = await Exam.findById(req.params.id);
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    await Exam.findByIdAndDelete(req.params.id);
    await Question.deleteMany({ examId: req.params.id });
    await Result.deleteMany({ examId: req.params.id });

    if (exam.createdBy) {
      await AdminFeedback.create({
        userId: exam.createdBy,
        category: "exam_delete",
        message: note,
        createdBy: req.user._id
      });
    }

    res.json({ message: "Exam deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
