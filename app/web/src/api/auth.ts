import { api } from "./client";

export interface User {
  id: string;
  email: string;
  role: "ADMIN" | "MEMBER" | "VIEWER";
  org: { id: string; name: string; slug: string };
}

export async function login(email: string, password: string): Promise<{ accessToken: string; user: User }> {
  const { data } = await api.post("/auth/login", { email, password });
  return data;
}

export async function register(orgName: string, email: string, password: string): Promise<{ accessToken: string; user: User }> {
  const { data } = await api.post("/auth/register", { orgName, email, password });
  return data;
}

export async function logout(): Promise<void> {
  await api.post("/auth/logout");
  localStorage.removeItem("accessToken");
}

export async function getMe(): Promise<User> {
  const { data } = await api.get("/auth/me");
  return data;
}
