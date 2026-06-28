import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../services/db";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

// GET /tags
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = (req as AuthRequest).user;
    const tags = await db.tag.findMany({
      where: { orgId },
      include: { _count: { select: { assets: true } } },
      orderBy: { name: "asc" },
    });
    res.json(tags);
  } catch (err) {
    next(err);
  }
});

// POST /tags
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = (req as AuthRequest).user;
    const { name, color } = createSchema.parse(req.body);
    const tag = await db.tag.create({ data: { orgId, name, ...(color ? { color } : {}) } });
    res.status(201).json(tag);
  } catch (err) {
    next(err);
  }
});

// DELETE /tags/:id — only admin
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId, role } = (req as AuthRequest).user;
    if (role !== "ADMIN") { res.status(403).json({ error: "Admin only" }); return; }
    await db.tag.findFirstOrThrow({ where: { id: req.params.id, orgId } });
    await db.tag.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
