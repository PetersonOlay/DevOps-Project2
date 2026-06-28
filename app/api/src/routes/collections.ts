import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../services/db";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
});

// GET /collections
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = (req as AuthRequest).user;
    const cols = await db.collection.findMany({
      where: { orgId },
      include: { _count: { select: { assets: true, shareLinks: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(cols);
  } catch (err) {
    next(err);
  }
});

// POST /collections
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = (req as AuthRequest).user;
    const data = createSchema.parse(req.body);
    const col = await db.collection.create({ data: { orgId, ...data } });
    res.status(201).json(col);
  } catch (err) {
    next(err);
  }
});

// PUT /collections/:id
router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = (req as AuthRequest).user;
    const data = createSchema.partial().parse(req.body);
    await db.collection.findFirstOrThrow({ where: { id: req.params.id, orgId } });
    const col = await db.collection.update({ where: { id: req.params.id }, data });
    res.json(col);
  } catch (err) {
    next(err);
  }
});

// DELETE /collections/:id
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = (req as AuthRequest).user;
    await db.collection.findFirstOrThrow({ where: { id: req.params.id, orgId } });
    await db.collection.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// GET /collections/:id — detail with assets
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = (req as AuthRequest).user;
    const col = await db.collection.findFirstOrThrow({
      where: { id: req.params.id, orgId },
      include: {
        assets: {
          include: { asset: { include: { tags: { include: { tag: true } } } } },
          orderBy: { position: "asc" },
        },
      },
    });
    const serialized = {
      ...col,
      assets: col.assets.map((ca) => ({
        ...ca,
        asset: { ...ca.asset, fileSize: ca.asset.fileSize.toString() },
      })),
    };
    res.json(serialized);
  } catch (err) {
    next(err);
  }
});

// POST /collections/:id/assets — add asset
router.post("/:id/assets", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = (req as AuthRequest).user;
    const { assetId, position } = z.object({ assetId: z.string(), position: z.number().optional() }).parse(req.body);
    await db.collection.findFirstOrThrow({ where: { id: req.params.id, orgId } });
    await db.asset.findFirstOrThrow({ where: { id: assetId, orgId } });
    await db.collectionAsset.create({ data: { collectionId: req.params.id, assetId, position: position ?? 0 } });
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /collections/:id/assets/:assetId
router.delete("/:id/assets/:assetId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = (req as AuthRequest).user;
    await db.collection.findFirstOrThrow({ where: { id: req.params.id, orgId } });
    await db.collectionAsset.delete({
      where: { collectionId_assetId: { collectionId: req.params.id, assetId: req.params.assetId } },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /collections/:id/export — queue an EXPORT job
router.post("/:id/export", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = (req as AuthRequest).user;
    const col = await db.collection.findFirstOrThrow({ where: { id: req.params.id, orgId } });
    const job = await db.job.create({
      data: { type: "EXPORT", payload: { collectionId: col.id, orgId }, status: "QUEUED" },
    });
    res.status(201).json({ jobId: job.id });
  } catch (err) {
    next(err);
  }
});

export default router;
