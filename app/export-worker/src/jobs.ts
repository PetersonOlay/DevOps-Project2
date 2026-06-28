import { PrismaClient } from "@prisma/client";
import { zipAndUpload } from "./zipper";

const db = new PrismaClient();
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS ?? "5000");

async function claimJob(): Promise<{ id: string; payload: unknown } | null> {
  const result = await db.$queryRaw<Array<{ id: string; payload: unknown }>>`
    UPDATE "Job"
    SET status = 'PROCESSING', "updatedAt" = NOW()
    WHERE id = (
      SELECT id FROM "Job"
      WHERE type = 'EXPORT' AND status = 'QUEUED'
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, payload
  `;
  return result[0] ?? null;
}

async function processJob(jobId: string, payload: unknown): Promise<void> {
  const { collectionId, orgId } = payload as { collectionId: string; orgId: string };

  try {
    const rows = await db.collectionAsset.findMany({
      where: { collectionId },
      include: { asset: true } as never,
      orderBy: { position: "asc" },
    } as never);

    const assets = (rows as Array<{ asset: { id: string; name: string; fileKey: string } }>).map((r) => r.asset);

    if (assets.length === 0) {
      throw new Error("Collection has no assets to export");
    }

    const destKey = `exports/${orgId}/${collectionId}/${jobId}.zip`;
    await zipAndUpload(assets, destKey);

    await db.job.update({ where: { id: jobId }, data: { status: "DONE" } });
    console.log(`[export] job ${jobId} done — ${assets.length} assets zipped`);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await db.job.update({ where: { id: jobId }, data: { status: "FAILED", error } });
    console.error(`[export] job ${jobId} failed:`, error);
  }
}

export async function runLoop(): Promise<void> {
  console.log(`[export] polling every ${POLL_INTERVAL}ms`);
  while (true) {
    const job = await claimJob().catch((err) => { console.error("[export] claim error:", err); return null; });
    if (job) {
      await processJob(job.id, job.payload);
    } else {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    }
  }
}
