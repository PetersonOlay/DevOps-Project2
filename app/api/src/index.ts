import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/auth";
import assetRoutes from "./routes/assets";
import tagRoutes from "./routes/tags";
import collectionRoutes from "./routes/collections";
import shareRoutes from "./routes/shares";
import analyticsRoutes from "./routes/analytics";
import jobRoutes from "./routes/jobs";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(cors({
  origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/tags", tagRoutes);
app.use("/api/collections", collectionRoutes);
app.use("/api/share", shareRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/jobs", jobRoutes);

app.use(errorHandler);

app.listen(PORT, () => console.log(`DAM API listening on :${PORT}`));

export default app;
