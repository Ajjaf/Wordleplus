import express from "express";

const DEFAULT_ERROR = { error: "Unauthorized" };

export default function createAdminEventsRouter({
  setAiBattleEventActive,
  getAiBattleEventStatus,
} = {}) {
  if (typeof setAiBattleEventActive !== "function") {
    throw new Error("setAiBattleEventActive must be provided");
  }
  if (typeof getAiBattleEventStatus !== "function") {
    throw new Error("getAiBattleEventStatus must be provided");
  }

  const router = express.Router();
  const adminToken = process.env.EVENT_ADMIN_TOKEN || "";

  function requireAdmin(req, res, next) {
    if (!adminToken) {
      return res.status(503).json({ error: "Admin token not configured" });
    }
    const header = req.get("authorization") || "";
    const provided =
      header.startsWith("Bearer ") ? header.slice(7).trim() : header.trim();
    if (!provided || provided !== adminToken) {
      return res.status(401).json(DEFAULT_ERROR);
    }
    return next();
  }

  router.post("/ai-battle/start", requireAdmin, (_req, res) => {
    const status = setAiBattleEventActive(true);
    res.json({ ok: true, ...status });
  });

  router.post("/ai-battle/stop", requireAdmin, (_req, res) => {
    const status = setAiBattleEventActive(false);
    res.json({ ok: true, ...status });
  });

  router.get("/ai-battle/status", requireAdmin, (_req, res) => {
    res.json({ ok: true, ...getAiBattleEventStatus() });
  });

  return router;
}
