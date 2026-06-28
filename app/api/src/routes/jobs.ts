import { Router, Request, Response, NextFunction } from "express";
import { db } from "../services/db";
import { requireAuth } from "../middleware/auth";
import { presignDownload } from "../services/s3";
import { exportKey } from "../services/s3";

const router = Router();
router.use(requireAuth);

// GET /jobs/:id — poll job status; returns download URL when DONE
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await db.job.findUniqueOrThrow({ where: { id: req.params.id } });

    if (job.status === "DONE" && job.type === "EXPORT") {
      const { collectionId, orgId } = job.payload as { collectionId: string; orgId: string };
      const key = exportKey(orgId, collectionId, job.id);
      const downloadUrl = await presignDownload(key, `collection-${collectionId}.zip`);
      res.json({ ...job, downloadUrl });
      return;
    }

    res.json(job);
  } catch (err) {
    next(err);
  }
});

export default router;
