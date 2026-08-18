import fs from "fs";
import path from "path";
import type { NextApiRequest, NextApiResponse } from "next";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";

// NOTE: Server-only module (Node fs/path + multer). Never import from client.

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Only raster image types are accepted. SVG is explicitly rejected: an SVG
// can carry inline <script> and would be served from /uploads on the same
// origin as the app — a stored XSS vector. HTML disguised as an image is
// rejected the same way.
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/** The file shape multer attaches to the request (kept local so the API
 * routes do not depend on Express types). */
export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  path: string;
  size: number;
  filename: string;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) =>
    cb(null, `${uuidv4()}${path.extname(file.originalname).toLowerCase()}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error("Only JPEG, PNG or WebP images are allowed"));
    } else {
      cb(null, true);
    }
  },
});

/** Public URL path for a stored upload (Next serves `public/` at the root). */
export function uploadUrl(filename: string): string {
  return `/uploads/${filename}`;
}

/**
 * Safely delete a stored upload file. Accepts either a public URL
 * (`/uploads/<name>`) or a bare filename. Only files inside UPLOAD_DIR are
 * ever touched (the basename is validated so a user-supplied path can never
 * escape the uploads folder), and failures are swallowed — cleanup is
 * best-effort and must never break the API call.
 */
export function deleteUpload(urlOrFilename: string | undefined | null): void {
  if (!urlOrFilename) return;
  const basename = path.basename(urlOrFilename);
  if (!basename || basename === "." || basename === "..") return;
  const target = path.join(UPLOAD_DIR, basename);
  if (path.dirname(target) !== UPLOAD_DIR) return; // defense in depth
  fs.unlink(target, () => {
    /* ignore — best-effort cleanup */
  });
}

/**
 * Run a single-file multer middleware (field `image`) as a promise. The API
 * route MUST declare `export const config = { api: { bodyParser: false } }`
 * so multer can consume the raw multipart body.
 */
export function runUploadMiddleware(
  req: NextApiRequest,
  res: NextApiResponse,
  field = "image"
): Promise<void> {
  const middleware = upload.single(field);
  return new Promise((resolve, reject) => {
    middleware(
      req as unknown as Parameters<typeof middleware>[0],
      res as unknown as Parameters<typeof middleware>[1],
      (err: unknown) => (err ? reject(err) : resolve())
    );
  });
}
