import type { NextApiRequest, NextApiResponse } from "next";
import { readSettings } from "@/lib/settingsStore";

/** Public store settings — used by the storefront to brand itself. */
export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  const settings = await readSettings();
  return void res.status(200).json({ settings });
}
