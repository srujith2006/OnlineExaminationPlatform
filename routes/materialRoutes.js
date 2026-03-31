const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const Material = require("../models/materialModel");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

const router = express.Router();

const uploadDir = path.join(__dirname, "..", "uploads", "materials");
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({ storage });

router.post("/", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { title, description, examId, topic, type, url } = req.body;
    if (!title || !type) {
      return res.status(400).json({ message: "title and type are required" });
    }

    if ((type === "link" || type === "video") && !url) {
      return res.status(400).json({ message: "url is required for link/video" });
    }

    const material = await Material.create({
      title,
      description,
      examId: examId || null,
      topic,
      type,
      url: url || "",
      uploadedBy: req.user._id
    });

    res.status(201).json(material);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post(
  "/upload",
  authMiddleware,
  adminMiddleware,
  upload.single("file"),
  async (req, res) => {
    try {
      const { title, description, examId, topic } = req.body;
      if (!title) {
        return res.status(400).json({ message: "title is required" });
      }
      if (!req.file) {
        return res.status(400).json({ message: "file is required" });
      }

      const ext = path.extname(req.file.originalname).toLowerCase();
      const type = ext === ".pdf" ? "pdf" : "doc";

      const material = await Material.create({
        title,
        description,
        examId: examId || null,
        topic,
        type,
        filePath: `/uploads/materials/${req.file.filename}`,
        uploadedBy: req.user._id
      });

      res.status(201).json(material);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
);

router.get("/", authMiddleware, async (req, res) => {
  try {
    const { examId, topic } = req.query;
    const filter = {};
    if (examId) filter.examId = examId;
    if (topic) filter.topic = { $regex: topic, $options: "i" };

    const materials = await Material.find(filter)
      .populate("examId", "title description")
      .sort({ createdAt: -1 });
    res.json(materials);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const material = await Material.findByIdAndDelete(req.params.id);
    if (!material) {
      return res.status(404).json({ message: "Material not found" });
    }
    res.json({ message: "Material deleted" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
