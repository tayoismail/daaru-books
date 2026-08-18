import type { NextApiRequest, NextApiResponse } from "next";
import { requireAuth, type AuthenticatedRequest } from "@/lib/auth";
import { updateSlides } from "@/lib/slides";
import {
  runUploadMiddleware,
  uploadUrl,
  deleteUpload,
  type UploadedFile,
} from "@/lib/upload";

export const config = { api: { bodyParser: false } };

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    try {
      await runUploadMiddleware(req, res);
    } catch (error) {
      return void res
        .status(400)
        .json({ error: (error as Error).message || "Upload failed" });
    }
    const file = (req as NextApiRequest & { file?: UploadedFile }).file;
    if (!file) {
      return void res.status(400).json({ error: "No image uploaded" });
    }

    const url = uploadUrl(file.filename);
    try {
      // Serialized read-modify-write: two concurrent uploads cannot drop each
      // other's banner (see lib/slides.ts updateSlides).
      const slides = await updateSlides((config) => {
        config.banners.push(url);
        return config;
      });
      return void res
        .status(201)
        .json({ message: "Banner uploaded", url, slides });
    } catch (error) {
      // The config write failed — don't leave an orphaned file on disk.
      deleteUpload(file.filename);
      return void res
        .status(500)
        .json({ error: (error as Error).message || "Could not save banner" });
    }
  }

  if (req.method === "DELETE") {
    const url = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url;
    if (!url) {
      return void res.status(400).json({ error: "Missing banner url" });
    }

    try {
      // Serialized; only removes a banner that is actually configured.
      const slides = await updateSlides((config) => {
        if (!config.banners.includes(url)) return config;
        config.banners = config.banners.filter((banner) => banner !== url);
        return config;
      });
      // Clean up the file on disk (best-effort, after the config no longer
      // references it).
      deleteUpload(url);
      return void res
        .status(200)
        .json({ message: "Banner removed", slides });
    } catch (error) {
      return void res
        .status(500)
        .json({ error: (error as Error).message || "Could not remove banner" });
    }
  }

  return void res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler, "admin");
