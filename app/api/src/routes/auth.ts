import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../services/db";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../services/jwt";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

const registerSchema = z.object({
  orgName: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// POST /auth/register — creates org + first admin user
router.post("/register", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgName, email, password } = registerSchema.parse(req.body);
    const slug = `${slugify(orgName)}-${Date.now()}`;
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        role: "ADMIN",
        org: { create: { name: orgName, slug } },
      },
      include: { org: true },
    });

    const payload = { userId: user.id, orgId: user.orgId, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.status(201).json({ accessToken, user: { id: user.id, email: user.email, role: user.role, org: user.org } });
  } catch (err) {
    next(err);
  }
});

// POST /auth/login
router.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await db.user.findUnique({ where: { email }, include: { org: true } });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const payload = { userId: user.id, orgId: user.orgId, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ accessToken, user: { id: user.id, email: user.email, role: user.role, org: user.org } });
  } catch (err) {
    next(err);
  }
});

// POST /auth/refresh — issues new access token from refresh cookie
router.post("/refresh", (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken as string | undefined;
  if (!token) { res.status(401).json({ error: "No refresh token" }); return; }
  try {
    const payload = verifyRefreshToken(token);
    const accessToken = signAccessToken({ userId: payload.userId, orgId: payload.orgId, role: payload.role });
    res.json({ accessToken });
  } catch {
    res.status(401).json({ error: "Invalid refresh token" });
  }
});

// POST /auth/logout
router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie("refreshToken");
  res.json({ ok: true });
});

// GET /auth/me
router.get("/me", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = (req as AuthRequest).user;
    const user = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { org: true } });
    res.json({ id: user.id, email: user.email, role: user.role, org: user.org });
  } catch (err) {
    next(err);
  }
});

export default router;
