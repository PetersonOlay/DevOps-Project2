import { api } from "./client";

export interface Tag {
  id: string;
  name: string;
  color: string;
  _count?: { assets: number };
}

export async function listTags(): Promise<Tag[]> {
  const { data } = await api.get("/tags");
  return data;
}

export async function createTag(name: string, color?: string): Promise<Tag> {
  const { data } = await api.post("/tags", { name, color });
  return data;
}

export async function deleteTag(id: string): Promise<void> {
  await api.delete(`/tags/${id}`);
}
