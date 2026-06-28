import sharp from "sharp";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";

const s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
const BUCKET = process.env.S3_BUCKET!;

const THUMB_SIZE = 400; // square thumbnail

export interface ProcessResult {
  thumbnailKey: string;
  width: number;
  height: number;
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

export async function generateThumbnail(
  orgId: string,
  assetId: string,
  fileKey: string,
  mimeType: string
): Promise<ProcessResult> {
  // Download original from S3
  const resp = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: fileKey }));
  const original = await streamToBuffer(resp.Body as Readable);

  // Get dimensions of original
  const metadata = await sharp(original).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  // Generate JPEG thumbnail (cover-crop to square)
  const thumbnail = await sharp(original)
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover", position: "centre" })
    .jpeg({ quality: 85 })
    .toBuffer();

  const thumbKey = `thumbnails/${orgId}/${assetId}/thumb.jpg`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: thumbKey,
      Body: thumbnail,
      ContentType: "image/jpeg",
    })
  );

  return { thumbnailKey: thumbKey, width, height };
}

export function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/") && mimeType !== "image/svg+xml";
}
