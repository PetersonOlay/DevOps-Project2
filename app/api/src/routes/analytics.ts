import { Router, Request, Response, NextFunction } from "express";
import { db } from "../services/db";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

// GET /analytics/top-assets — most downloaded assets in the org
router.get("/top-assets", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = (req as AuthRequest).user;
    const { limit = "10" } = req.query as Record<string, string>;

    const results = await db.download.groupBy({
      by: ["assetId"],
      where: { asset: { orgId } },
      _count: { assetId: true },
      orderBy: { _count: { assetId: "desc" } },
      take: parseInt(limit),
    });

    const assetIds = results.map((r) => r.assetId);
    const assets = await db.asset.findMany({ where: { id: { in: assetIds } } });
    const countMap = new Map(results.map((r) => [r.assetId, r._count.assetId]));

    const ranked = assetIds
      .map((id) => {
        const a = assets.find((x) => x.id === id);
        return a ? { ...a, fileSize: a.fileSize.toString(), downloadCount: countMap.get(id) ?? 0 } : null;
      })
      .filter(Boolean);

    res.json(ranked);
  } catch (err) {
    next(err);
  }
});

// GET /analytics/downloads — recent download history
router.get("/downloads", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = (req as AuthRequest).user;
    const { page = "1", limit = "50" } = req.query as Record<string, string>;

    const downloads = await db.download.findMany({
      where: { asset: { orgId } },
      include: { asset: { select: { id: true, name: true, mimeType: true } }, user: { select: { id: true, email: true } } },
      orderBy: { downloadedAt: "desc" },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
    });

    res.json(downloads);
  } catch (err) {
    next(err);
  }
});

export default router;
