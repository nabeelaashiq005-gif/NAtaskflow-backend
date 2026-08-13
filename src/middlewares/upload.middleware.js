import multer from "multer";
import path from "path";
import fs from "fs";
import ApiError from "../utils/ApiError.js";

const isServerless = process.env.VERCEL === "1";

// Make sure the upload folder exists (won't error if it already does)
// On serverless platforms (Vercel) the filesystem is read-only, so we
// skip creating the folder there — file uploads are disabled in that env.
const uploadDir = path.resolve("public/uploads/avatars");
if (!isServerless) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Unique filename: userId-timestamp.extension
    // Prevents overwriting other users' files and browser-caching stale images.
    const ext = path.extname(file.originalname);
    const uniqueName = `${req.user._id}-${Date.now()}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(
      new ApiError(400, "Only JPG, PNG, or WEBP images are allowed"),
      false
    );
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
});

export default upload;
