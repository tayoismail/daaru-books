import type { NextApiResponse } from "next";
import { db } from "@/lib/db";
import { requireAuth, type AuthenticatedRequest } from "@/lib/auth";
import { reverseRefund } from "@/lib/refunds";

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id) {
    return void res.status(400).json({ error: "Missing refund id" });
  }

  if (req.method === "DELETE") {
    const refund = await db.refunds.getById(id);
    if (!refund) {
      return void res.status(404).json({ error: "Refund not found" });
    }
    const deleted = await reverseRefund(refund);
    if (!deleted) {
      return void res.status(404).json({ error: "Refund not found" });
    }
    return void res.status(200).json({ message: "Refund deleted" });
  }

  return void res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler, "admin");
