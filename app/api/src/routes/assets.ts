import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../services/db";
import { requireAuth, AuthRequest } from "../middleware/auth";
import {
  originalKey,
  presignUpload,
  presignView,
  presignDownload,
  deleteObject,
  extFromMime,
} from "../services/s3";

const router = Router();

router.use(requireAuth);

const uploadUrlSchema = z.object({
  name: z.string().min(1).max(255),
  mimeType: z.string(),
  fileSize: z.number().positive().max(5 * 1024 * 1024 * 1024), // 5 GB cap
  description: z.string().max(500).optional(),
});

const patchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(500).optional(),
});

// GET /assets — list with optional tag/type/status filters
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = (req as AuthRequest).user;
    const { tagId, mimeType, status, page = "1", limit = "50" } = req.query as Record<string, string>;

    const assets = await db.asset.findMany({
      where: {
        orgId,
        ...(tagId ? { tags: { some: { tagId } } } : {}),
        ...(mimeType ? { mimeType: { startsWith: mimeType } } : {}),
        ...(status ? { status: status as never } : {}),
      },
      include: { tags: { include: { tag: true } }, user: { select: { id: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
    });

    const serialized = assets.map((a) => ({ ...a, fileSize: a.fileSize.toString() }));
    res.json(serialized);
  } catch (err) {
    next(err);
  }
});

// POST /assets/upload-url — step 1: get pre-signed PUT URL
router.post("/upload-url", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, orgId } = (req as AuthRequest).user;
    const { name, mimeType, fileSize, description } = uploadUrlSchema.parse(req.body);

    const ext = extFromMime(mimeType);
    const asset = await db.asset.create({
      data: {
        orgId,
        userId,
        name,
        description,
        fileKey: "pending", // will be updated after confirm
        mimeType,
        fileSize: BigInt(fileSize),
        status: "PROCESSING",
      },
    });

    const key = originalKey(orgId, asset.id, ext);
    await db.asset.update({ where: { id: asset.id }, data: { fileKey: key } });

    const uploadUrl = await presignUpload(key, mimeType);
    res.json({ assetId: asset.id, uploadUrl, key });
  } catch (err) {
    next(err);
  }
});

// POST /assets/:id/confirm — step 2: signal upload done, queue TRANSFORM job
router.post("/:id/confirm", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, orgId } = (req as AuthRequest).user;
    const asset = await db.asset.findFirstOrThrow({ where: { id: req.params.id, orgId } });

    if (asset.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await db.job.create({
      data: { type: "TRANSFORM", payload: { assetId: asset.id }, status: "QUEUED" },
    });

    res.json({ ok: true, assetId: asset.id, status: "PROCESSING" });
  } catch (err) {
    next(err);
  }
});

// GET /assets/:id — single asset with pre-signed view + download URLs
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = (req as AuthRequest).user;
    const asset = await db.asset.findFirstOrThrow({
      where: { id: req.params.id, orgId },
      include: { tags: { include: { tag: true } } },
    });

    const viewUrl = asset.thumbnailKey ? await presignView(asset.thumbnailKey) : null;
    const downloadUrl = asset.status === "READY" ? await presignDownload(asset.fileKey, asset.name) : null;

    res.json({ ...asset, fileSize: asset.fileSize.toString(), viewUrl, downloadUrl });
  } catch (err) {
    next(err);
  }
});

// PATCH /assets/:id
router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, orgId } = (req as AuthRequest).user;
    const data = patchSchema.parse(req.body);
    const asset = await db.asset.findFirstOrThrow({ where: { id: req.params.id, orgId } });

    if (asset.userId !== userId && (req as AuthRequest).user.role !== "ADMIN") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const updated = await db.asset.update({ where: { id: req.params.id }, data });
    res.json({ ...updated, fileSize: updated.fileSize.toString() });
  } catch (err) {
    next(err);
  }
});

// DELETE /assets/:id
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, orgId } = (req as AuthRequest).user;
    const asset = await db.asset.findFirstOrThrow({ where: { id: req.params.id, orgId } });

    if (asset.userId !== userId && (req as AuthRequest).user.role !== "ADMIN") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    // Delete S3 objects then DB record
    await deleteObject(asset.fileKey);
    if (asset.thumbnailKey) await deleteObject(asset.thumbnailKey);
    await db.asset.delete({ where: { id: req.params.id } });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /assets/:id/tags — add tag to asset
router.post("/:id/tags", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = (req as AuthRequest).user;
    const { tagId } = z.object({ tagId: z.string() }).parse(req.body);
    await db.asset.findFirstOrThrow({ where: { id: req.params.id, orgId } });
    await db.tag.findFirstOrThrow({ where: { id: tagId, orgId } });
    await db.assetTag.create({ data: { assetId: req.params.id, tagId } });
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /assets/:id/tags/:tagId
router.delete("/:id/tags/:tagId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = (req as AuthRequest).user;
    await db.asset.findFirstOrThrow({ where: { id: req.params.id, orgId } });
    await db.assetTag.delete({ where: { assetId_tagId: { assetId: req.params.id, tagId: req.params.tagId } } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
