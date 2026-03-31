const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true
    },
    question: { type: String, required: true },
    options: {
      type: [{ type: String, required: true }],
      validate: {
        validator: function (value) {
          return Array.isArray(value) && value.length >= 2;
        },
        message: "At least two options are required"
      }
    },
    correctOptionIndex: { type: Number, required: true, min: 0 }
  },
  { timestamps: true }
);

questionSchema.pre("validate", function () {
  if (
    Array.isArray(this.options) &&
    this.correctOptionIndex >= this.options.length
  ) {
    throw new Error("correctOptionIndex must be less than options length");
  }
});

module.exports = mongoose.model("Question", questionSchema);
