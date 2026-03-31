const mongoose = require("mongoose");

const materialSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      default: null
    },
    topic: { type: String, default: "" },
    type: {
      type: String,
      enum: ["pdf", "link", "video", "doc"],
      required: true
    },
    url: { type: String, default: "" },
    filePath: { type: String, default: "" },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Material", materialSchema);
