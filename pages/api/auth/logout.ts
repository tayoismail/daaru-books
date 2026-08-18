import type { NextApiRequest, NextApiResponse } from "next";
import { clearAuthCookie } from "@/lib/auth";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return void res.status(405).json({ error: "Method not allowed" });
  }
  clearAuthCookie(res);
  return void res.status(200).json({ message: "Signed out" });
}
