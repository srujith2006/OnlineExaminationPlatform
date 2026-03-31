const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/UserModel");
const AdminFeedback = require("../models/AdminFeedbackModel");
const authMiddleware = require("../middleware/authMiddleware");
const systemAdminMiddleware = require("../middleware/systemAdminMiddleware");

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    console.log("BODY:", req.body);

    const role = String(req.body?.role || "student");
    const section = String(req.body?.section || "").trim();
    if (role === "student" && !section) {
      return res.status(400).json({ message: "Section is required for students" });
    }

    const user = new User({
      name: req.body?.name,
      email: req.body?.email,
      password: req.body?.password,
      role,
      section
    });
    await user.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.log("ERROR:", err);
    res.status(400).json({ message: err.message });
  }
});


router.post("/login", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(req.body.password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    const section = String(req.body?.section || "").trim();
    if (user.role === "student" && section && section !== user.section) {
      user.section = section;
      await user.save();
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      role: user.role,
      userId: user._id,
      name: user.name,
      section: user.section || ""
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/change-password", async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body;

    if (!email || !currentPassword || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "New password must be at least 6 characters" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    if (user.passwordChangeRequest?.status === "pending") {
      return res.status(400).json({ message: "A password change request is already pending" });
    }

    const pendingPasswordHash = await bcrypt.hash(newPassword, 10);
    user.passwordChangeRequest = {
      requestType: "change",
      status: "pending",
      pendingPasswordHash,
      requestedAt: new Date(),
      resolvedAt: null,
      note: "",
      reviewedBy: null
    };
    await user.save();

    res.json({ message: "Request sent to admin for approval" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/forgot-password-request", async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ message: "Email and new password are required" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "New password must be at least 6 characters" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (user.passwordChangeRequest?.status === "pending") {
      return res.status(400).json({ message: "A password change request is already pending" });
    }

    const pendingPasswordHash = await bcrypt.hash(newPassword, 10);
    user.passwordChangeRequest = {
      requestType: "forgot",
      status: "pending",
      pendingPasswordHash,
      requestedAt: new Date(),
      resolvedAt: null,
      note: "",
      reviewedBy: null
    };
    await user.save();

    res.json({ message: "Forgot password request sent to admin for approval" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/change-password/status", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email }).select("passwordChangeRequest");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const request = user.passwordChangeRequest || { status: "none", note: "" };
    const requestType = request.requestType || "change";
    let message = "No password change request found";

    if (request.status === "pending") {
      message =
        requestType === "forgot"
          ? "Forgot password request sent to admin and waiting for approval"
          : "Request sent to admin and waiting for approval";
    } else if (request.status === "approved") {
      message =
        requestType === "forgot"
          ? "Admin confirmed your forgot password request. You can login with your new password"
          : "Admin confirmed your request. You can login with your new password";
    } else if (request.status === "rejected") {
      message = request.note || "Admin did not confirm your password change request";
    }

    res.json({
      status: request.status || "none",
      requestType,
      note: request.note || "",
      message
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get(
  "/password-change-requests",
  authMiddleware,
  systemAdminMiddleware,
  async (req, res) => {
    try {
      const users = await User.find({ "passwordChangeRequest.status": "pending" })
        .select("name email passwordChangeRequest");

      const requests = users.map((user) => ({
        userId: user._id,
        name: user.name,
        email: user.email,
        requestType: user.passwordChangeRequest?.requestType || "change",
        status: user.passwordChangeRequest?.status || "none",
        requestedAt: user.passwordChangeRequest?.requestedAt || null
      }));

      res.json(requests);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

router.post(
  "/password-change-requests/:userId/review",
  authMiddleware,
  systemAdminMiddleware,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { action, note } = req.body;
      const cleanNote = String(note || "").trim();

      if (!["approve", "reject"].includes(action)) {
        return res.status(400).json({ message: "Action must be approve or reject" });
      }
      if (cleanNote.length < 3) {
        return res.status(400).json({ message: "A short admin note is required (min 3 characters)" });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.passwordChangeRequest?.status !== "pending") {
        return res.status(400).json({ message: "No pending request for this user" });
      }

      const pendingHash = user.passwordChangeRequest.pendingPasswordHash;
      const nextStatus = action === "approve" ? "approved" : "rejected";
      const update = {
        "passwordChangeRequest.status": nextStatus,
        "passwordChangeRequest.pendingPasswordHash": "",
        "passwordChangeRequest.resolvedAt": new Date(),
        "passwordChangeRequest.note": cleanNote,
        "passwordChangeRequest.reviewedBy": req.user._id
      };

      if (action === "approve") {
        update.password = pendingHash;
      }

      await User.updateOne({ _id: userId }, { $set: update });
      await AdminFeedback.create({
        userId,
        category: "password_request",
        message: cleanNote,
        createdBy: req.user._id
      });

      const message =
        action === "approve"
          ? "Password change request approved"
          : "Password change request rejected";

      res.json({ message });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

router.get("/admin-feedback", authMiddleware, async (req, res) => {
  try {
    if (req.user.role === "admin") {
      const sent = await AdminFeedback.find({ createdBy: req.user._id })
        .populate("userId", "name email role")
        .sort({ createdAt: -1 });
      return res.json({ mode: "sent", items: sent });
    }

    const received = await AdminFeedback.find({ userId: req.user._id })
      .populate("createdBy", "name email role")
      .sort({ createdAt: -1 });
    return res.json({ mode: "received", items: received });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/admin-feedback/mark-viewed", authMiddleware, async (req, res) => {
  try {
    if (req.user.role === "admin") {
      return res.status(400).json({ message: "Admins do not have inbox feedback" });
    }

    const result = await AdminFeedback.updateMany(
      { userId: req.user._id, viewedAt: null },
      { $set: { viewedAt: new Date() } }
    );

    res.json({ updated: result.modifiedCount || 0 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
