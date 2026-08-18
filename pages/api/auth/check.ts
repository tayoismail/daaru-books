import type { NextApiRequest, NextApiResponse } from "next";
import { getUserFromCookie, toSafeUser } from "@/lib/auth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return void res.status(405).json({ error: "Method not allowed" });
  }
  const user = await getUserFromCookie(req);
  return void res.status(200).json({
    authenticated: Boolean(user),
    user: user ? toSafeUser(user) : null,
  });
}
