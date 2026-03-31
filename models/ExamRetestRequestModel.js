const mongoose = require("mongoose");

const examRetestRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending"
    },
    used: { type: Boolean, default: false },
    requestedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null },
    note: { type: String, default: "" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true }
);

examRetestRequestSchema.index({ userId: 1, examId: 1 }, { unique: true });

module.exports = mongoose.model("ExamRetestRequest", examRetestRequestSchema);
