import { Registry, Counter, Histogram, collectDefaultMetrics } from "prom-client";
import type { Request, Response, NextFunction } from "express";

export const register = new Registry();
collectDefaultMetrics({ register });

// Paths excluded from request metrics — scrape/health traffic would otherwise
// skew the histograms and inflate the request counter on every Prometheus scrape.
const EXCLUDED_PATHS = new Set(["/metrics", "/health"]);

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

export const httpRequestDurationSeconds = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  if (EXCLUDED_PATHS.has(req.path)) {
    next();
    return;
  }

  const endTimer = httpRequestDurationSeconds.startTimer();

  res.on("finish", () => {
    // Use the matched route pattern (e.g. "/api/assets/:id"), not req.path,
    // to avoid unbounded label cardinality from IDs embedded in URLs.
    const route = req.route?.path
      ? `${req.baseUrl}${req.route.path}`
      : req.baseUrl || "unmatched";
    const labels = { method: req.method, route, status_code: String(res.statusCode) };

    httpRequestsTotal.inc(labels);
    endTimer(labels);
  });

  next();
}

export async function metricsHandler(_req: Request, res: Response) {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
}
