import { PrismaClient } from "@prisma/client";
import { generateThumbnail, isImage } from "./processor";

const db = new PrismaClient();
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS ?? "5000");

async function claimJob(): Promise<{ id: string; payload: unknown } | null> {
  // Use a transaction + raw query for SKIP LOCKED so two pods don't process the same job
  const result = await db.$queryRaw<Array<{ id: string; payload: unknown }>>`
    UPDATE "Job"
    SET status = 'PROCESSING', "updatedAt" = NOW()
    WHERE id = (
      SELECT id FROM "Job"
      WHERE type = 'TRANSFORM' AND status = 'QUEUED'
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, payload
  `;
  return result[0] ?? null;
}

async function processJob(jobId: string, payload: unknown): Promise<void> {
  const { assetId } = payload as { assetId: string };

  const asset = await db.asset.findUniqueOrThrow({ where: { id: assetId } });

  try {
    if (isImage(asset.mimeType)) {
      const { thumbnailKey, width, height } = await generateThumbnail(
        asset.orgId,
        asset.id,
        asset.fileKey,
        asset.mimeType
      );

      await db.asset.update({
        where: { id: assetId },
        data: { thumbnailKey, width, height, status: "READY" },
      });
    } else {
      // Non-image assets (video, PDF, etc.) skip thumbnail, mark ready directly
      await db.asset.update({ where: { id: assetId }, data: { status: "READY" } });
    }

    await db.job.update({ where: { id: jobId }, data: { status: "DONE" } });
    console.log(`[transform] job ${jobId} done — asset ${assetId}`);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await db.job.update({ where: { id: jobId }, data: { status: "FAILED", error } });
    await db.asset.update({ where: { id: assetId }, data: { status: "FAILED" } });
    console.error(`[transform] job ${jobId} failed:`, error);
  }
}

export async function runLoop(): Promise<void> {
  console.log(`[transform] polling every ${POLL_INTERVAL}ms`);
  while (true) {
    const job = await claimJob().catch((err) => { console.error("[transform] claim error:", err); return null; });
    if (job) {
      await processJob(job.id, job.payload);
    } else {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    }
  }
}
