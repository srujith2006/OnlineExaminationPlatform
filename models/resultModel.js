const mongoose = require("mongoose");

const resultSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    score: { type: Number, required: true },
    totalMarks: { type: Number, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Result", resultSchema);
