import axios from "axios";
import { api } from "./client";

export interface Asset {
  id: string;
  name: string;
  description?: string;
  fileKey: string;
  thumbnailKey?: string;
  mimeType: string;
  fileSize: string;
  width?: number;
  height?: number;
  status: "PROCESSING" | "READY" | "FAILED";
  createdAt: string;
  viewUrl?: string;
  downloadUrl?: string;
  tags?: Array<{ tag: { id: string; name: string; color: string } }>;
}

export async function listAssets(params?: Record<string, string>): Promise<Asset[]> {
  const { data } = await api.get("/assets", { params });
  return data;
}

export async function getAsset(id: string): Promise<Asset> {
  const { data } = await api.get(`/assets/${id}`);
  return data;
}

export async function getUploadUrl(payload: {
  name: string;
  mimeType: string;
  fileSize: number;
  description?: string;
}): Promise<{ assetId: string; uploadUrl: string; key: string }> {
  const { data } = await api.post("/assets/upload-url", payload);
  return data;
}

export async function uploadToS3(uploadUrl: string, file: File): Promise<void> {
  // Direct PUT to pre-signed S3 URL — bypasses the API pod
  await axios.put(uploadUrl, file, { headers: { "Content-Type": file.type } });
}

export async function confirmUpload(assetId: string): Promise<void> {
  await api.post(`/assets/${assetId}/confirm`);
}

export async function patchAsset(id: string, data: { name?: string; description?: string }): Promise<Asset> {
  const resp = await api.patch(`/assets/${id}`, data);
  return resp.data;
}

export async function deleteAsset(id: string): Promise<void> {
  await api.delete(`/assets/${id}`);
}

export async function addTag(assetId: string, tagId: string): Promise<void> {
  await api.post(`/assets/${assetId}/tags`, { tagId });
}

export async function removeTag(assetId: string, tagId: string): Promise<void> {
  await api.delete(`/assets/${assetId}/tags/${tagId}`);
}
