import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import archiver from "archiver";
import { PassThrough, Readable } from "stream";
import path from "path";

const s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
const BUCKET = process.env.S3_BUCKET!;

export async function zipAndUpload(
  assets: Array<{ id: string; name: string; fileKey: string }>,
  destKey: string
): Promise<void> {
  const archive = archiver("zip", { zlib: { level: 6 } });
  const passthrough = new PassThrough();

  archive.pipe(passthrough);

  // Upload stream to S3 while we're still adding entries
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: BUCKET,
      Key: destKey,
      Body: passthrough,
      ContentType: "application/zip",
    },
  });

  // Add each asset to the archive by streaming from S3
  for (const asset of assets) {
    const resp = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: asset.fileKey }));
    const ext = path.extname(asset.fileKey);
    const safeName = asset.name.replace(/[/\\]/g, "_");
    archive.append(resp.Body as Readable, { name: `${safeName}${ext}` });
  }

  archive.finalize();
  await upload.done();
}
