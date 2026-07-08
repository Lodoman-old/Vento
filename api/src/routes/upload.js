import { Router } from "express";
import multer from "multer";
import { authenticate, authorize } from "../middleware/auth.js";
import cloudinary from "cloudinary";
import streamifier from "streamifier";

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();

router.post("/", authenticate, authorize("administrador"), upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Selecciona un archivo" });

    const type = req.body.type === "logo" ? "logos" : "catalog";

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.v2.uploader.upload_stream(
        {
          folder: `vento/${type}`,
          format: "webp",
          quality: "auto:eco",
          transformation: [{ width: type === "logos" ? 400 : 800, crop: "limit" }],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      streamifier.createReadStream(req.file.buffer).pipe(stream);
    });

    res.json({ url: result.secure_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;