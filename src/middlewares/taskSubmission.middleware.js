import multer from "multer";
import path from "path";
import fs from "fs";
import ApiError from "../utils/ApiError.js";

const uploadDir = path.resolve("public/uploads/submissions");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Unique filename: taskId-timestamp.extension
    const ext = path.extname(file.originalname);
    const uniqueName = `${req.params.id}-${Date.now()}${ext}`;
    cb(null, uniqueName);
  },
});

const allowedTypes = [
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-zip",
];

const fileFilter = (req, file, cb) => {
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new ApiError(400, "Only PDF or ZIP files are allowed"), false);
  }
  cb(null, true);
};

const taskSubmissionUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
});

export default taskSubmissionUpload;
