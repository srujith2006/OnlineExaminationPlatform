const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use(cors());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const publicDir = path.join(__dirname, "public");
const clientDistDir = path.join(__dirname, "client", "dist");
const hasReactBuild = fs.existsSync(path.join(clientDistDir, "index.html"));

if (hasReactBuild) {
  app.use(express.static(clientDistDir));
} else {
  app.use(express.static(publicDir));
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log(err));

app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/exams", require("./routes/examRoutes"));
app.use("/api/questions", require("./routes/questionRoutes"));
app.use("/api/results", require("./routes/resultRoutes"));
app.use("/api/materials", require("./routes/materialRoutes"));
if (hasReactBuild) {
  app.get(/^(?!\/api|\/uploads).*/, (req, res) => {
    res.sendFile(path.join(clientDistDir, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.sendFile(path.join(publicDir, "login.html"));
  });
}

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
