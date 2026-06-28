import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../services/db";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { presignView, presignDownload } from "../services/s3";

const router = Router();

const createSchema = z.object({
  collectionId: z.string(),
  expiresAt: z.string().datetime().optional(),
  downloadAllowed: z.boolean().optional(),
});

// POST /share — create a share link (authenticated)
router.post("/", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = (req as AuthRequest).user;
    const { collectionId, expiresAt, downloadAllowed } = createSchema.parse(req.body);
    await db.collection.findFirstOrThrow({ where: { id: collectionId, orgId } });

    const link = await db.shareLink.create({
      data: {
        collectionId,
        ...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
        ...(downloadAllowed !== undefined ? { downloadAllowed } : {}),
      },
    });
    res.status(201).json({ token: link.token, shareUrl: `/share/${link.token}` });
  } catch (err) {
    next(err);
  }
});

// GET /share/:token — public endpoint, no auth required
router.get("/:token", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const link = await db.shareLink.findUniqueOrThrow({
      where: { token: req.params.token },
      include: {
        collection: {
          include: {
            assets: {
              include: { asset: true },
              orderBy: { position: "asc" },
            },
          },
        },
      },
    });

    if (link.expiresAt && link.expiresAt < new Date()) {
      res.status(410).json({ error: "Share link has expired" });
      return;
    }

    // Generate pre-signed view URLs for thumbnails
    const assets = await Promise.all(
      link.collection.assets.map(async (ca) => {
        const viewUrl = ca.asset.thumbnailKey ? await presignView(ca.asset.thumbnailKey) : null;
        return {
          id: ca.asset.id,
          name: ca.asset.name,
          mimeType: ca.asset.mimeType,
          fileSize: ca.asset.fileSize.toString(),
          status: ca.asset.status,
          viewUrl,
        };
      })
    );

    res.json({
      collection: { id: link.collection.id, name: link.collection.name, description: link.collection.description },
      downloadAllowed: link.downloadAllowed,
      assets,
    });
  } catch (err) {
    next(err);
  }
});

// POST /share/:token/download/:assetId — track download and return pre-signed GET URL
router.post("/:token/download/:assetId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const link = await db.shareLink.findUniqueOrThrow({ where: { token: req.params.token } });

    if (link.expiresAt && link.expiresAt < new Date()) {
      res.status(410).json({ error: "Share link has expired" });
      return;
    }
    if (!link.downloadAllowed) {
      res.status(403).json({ error: "Downloads not allowed on this link" });
      return;
    }

    const asset = await db.asset.findUniqueOrThrow({ where: { id: req.params.assetId } });
    const downloadUrl = await presignDownload(asset.fileKey, asset.name);

    await db.download.create({
      data: {
        assetId: asset.id,
        shareToken: req.params.token,
        ipAddress: req.ip,
      },
    });

    res.json({ downloadUrl });
  } catch (err) {
    next(err);
  }
});

export default router;
