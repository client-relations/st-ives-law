import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const R2_CONFIGURED =
  !!process.env.R2_ENDPOINT &&
  !!process.env.R2_BUCKET &&
  !!process.env.R2_ACCESS_KEY_ID &&
  !!process.env.R2_SECRET_ACCESS_KEY;

const s3 = R2_CONFIGURED
  ? new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })
  : null;

const BUCKET = process.env.R2_BUCKET || "";
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const router: IRouter = Router();

router.post("/upload", upload.array("files", 20), async (req, res) => {
  if (!R2_CONFIGURED || !s3) {
    res.status(503).json({
      error: "Document upload is temporarily unavailable. Please email your documents directly to Nautilus Law Group.",
    });
    return;
  }

  const files = (req.files as Express.Multer.File[]) || [];
  try {
    const results = await Promise.all(
      files.map(async (f) => {
        const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const ext = path.extname(f.originalname);
        const key = `uploads/${unique}${ext}`;

        await s3.send(
          new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: f.buffer,
            ContentType: f.mimetype,
          })
        );

        // Generate a presigned URL valid for 7 days so Make.com (and other
        // downstream consumers) can download the file without the bucket
        // needing public access.
        const signedUrl = await getSignedUrl(
          s3,
          new GetObjectCommand({ Bucket: BUCKET, Key: key }),
          { expiresIn: 7 * 24 * 60 * 60 }
        );

        return {
          name: f.originalname,
          url: signedUrl,
        };
      })
    );
    res.json({ files: results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Upload failed", detail: msg });
  }
});

export default router;
