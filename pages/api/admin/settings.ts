import type { NextApiResponse } from "next";
import { requireAuth, type AuthenticatedRequest } from "@/lib/auth";
import { parseSettingsInput } from "@/lib/settingsInput";
import { readSettings, writeSettings } from "@/lib/settingsStore";

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const settings = await readSettings();
    return void res.status(200).json({ settings });
  }

  if (req.method === "PUT") {
    const parsed = parseSettingsInput(req.body);
    if (!parsed.ok) {
      return void res.status(400).json({ error: parsed.error });
    }
    await writeSettings(parsed.data);
    return void res
      .status(200)
      .json({ message: "Store settings saved", settings: parsed.data });
  }

  return void res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler, "admin");
