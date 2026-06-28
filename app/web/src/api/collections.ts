import { api } from "./client";

export interface Collection {
  id: string;
  name: string;
  description?: string;
  coverKey?: string;
  createdAt: string;
  _count?: { assets: number; shareLinks: number };
}

export async function listCollections(): Promise<Collection[]> {
  const { data } = await api.get("/collections");
  return data;
}

export async function getCollection(id: string): Promise<Collection & { assets: unknown[] }> {
  const { data } = await api.get(`/collections/${id}`);
  return data;
}

export async function createCollection(name: string, description?: string): Promise<Collection> {
  const { data } = await api.post("/collections", { name, description });
  return data;
}

export async function updateCollection(id: string, data: { name?: string; description?: string }): Promise<Collection> {
  const resp = await api.put(`/collections/${id}`, data);
  return resp.data;
}

export async function deleteCollection(id: string): Promise<void> {
  await api.delete(`/collections/${id}`);
}

export async function addAssetToCollection(collectionId: string, assetId: string): Promise<void> {
  await api.post(`/collections/${collectionId}/assets`, { assetId });
}

export async function removeAssetFromCollection(collectionId: string, assetId: string): Promise<void> {
  await api.delete(`/collections/${collectionId}/assets/${assetId}`);
}

export async function createShareLink(collectionId: string, opts?: { expiresAt?: string; downloadAllowed?: boolean }): Promise<{ token: string; shareUrl: string }> {
  const { data } = await api.post("/share", { collectionId, ...opts });
  return data;
}

export async function requestExport(collectionId: string): Promise<{ jobId: string }> {
  const { data } = await api.post(`/collections/${collectionId}/export`);
  return data;
}

export async function pollJob(jobId: string): Promise<{ status: string; downloadUrl?: string }> {
  const { data } = await api.get(`/jobs/${jobId}`);
  return data;
}
