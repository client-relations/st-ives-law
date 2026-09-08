import { Router, type IRouter } from "express";
import Client from "@replit/database";

// @replit/database requires REPLIT_DB_URL — only available on Replit.
// On external hosts (e.g. Render) sessions are unavailable; the form
// falls back to in-memory React state which is fine for a single sitting.
const db = process.env.REPLIT_DB_URL ? new Client() : null;

const router: IRouter = Router();

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type SessionRecord = {
  state: unknown;
  expires: number;
};

router.get("/session/:id", async (req, res) => {
  if (!db) {
    res.status(404).json({ state: null });
    return;
  }
  try {
    const key = `nlg_session_${req.params.id}`;
    const result = await db.get(key);
    if (!result.ok || result.value === null || result.value === undefined) {
      res.status(404).json({ state: null });
      return;
    }
    const record = result.value as SessionRecord;
    if (record.expires && Date.now() > record.expires) {
      await db.delete(key);
      res.status(404).json({ state: null });
      return;
    }
    res.json({ state: record.state });
  } catch (err) {
    req.log.error({ err }, "Failed to get session");
    res.status(500).json({ state: null });
  }
});

router.put("/session/:id", async (req, res) => {
  if (!db) {
    res.status(200).json({ ok: false });
    return;
  }
  try {
    const key = `nlg_session_${req.params.id}`;
    const { state } = req.body as { state: unknown };
    const record: SessionRecord = { state, expires: Date.now() + SESSION_TTL_MS };
    await db.set(key, record);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to save session");
    res.status(500).json({ ok: false });
  }
});

router.delete("/session/:id", async (req, res) => {
  if (!db) {
    res.status(200).json({ ok: true });
    return;
  }
  try {
    const key = `nlg_session_${req.params.id}`;
    await db.delete(key);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete session");
    res.status(500).json({ ok: false });
  }
});

export default router;
