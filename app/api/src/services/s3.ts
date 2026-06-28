import {
  S3Client,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "path";

const s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
const BUCKET = process.env.S3_BUCKET!;

export function originalKey(orgId: string, assetId: string, ext: string): string {
  return `originals/${orgId}/${assetId}/original${ext}`;
}

export function thumbnailKey(orgId: string, assetId: string): string {
  return `thumbnails/${orgId}/${assetId}/thumb.jpg`;
}

export function exportKey(orgId: string, collectionId: string, jobId: string): string {
  return `exports/${orgId}/${collectionId}/${jobId}.zip`;
}

export function extFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
    "application/pdf": ".pdf",
    "application/zip": ".zip",
  };
  return map[mimeType] ?? path.extname(mimeType) ?? "";
}

// Pre-signed URL for the client to PUT a file directly into S3
export async function presignUpload(key: string, mimeType: string, expiresIn = 300): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: mimeType,
  });
  return getSignedUrl(s3, cmd, { expiresIn });
}

// Pre-signed URL for the client (or share link visitor) to GET a file
export async function presignDownload(key: string, filename: string, expiresIn = 3600): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${filename}"`,
  });
  return getSignedUrl(s3, cmd, { expiresIn });
}

// Pre-signed URL for inline preview (images/video)
export async function presignView(key: string, expiresIn = 3600): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn });
}

export async function deleteObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
