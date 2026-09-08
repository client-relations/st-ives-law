import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes first — these always take priority over static files
app.use("/api", router);

// In production: serve the pre-built questionnaire SPA from the same process.
// This is required for deployments (e.g. Render) where the API server and
// frontend share a single web service and there is no reverse proxy in front.
if (process.env.NODE_ENV === "production") {
  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  const publicDir = path.resolve(thisDir, "../../questionnaire/dist/public");
  app.use(express.static(publicDir));
  // SPA fallback — return index.html for any path not matched above.
  // Must use app.use (not app.get) because Express 5 rejects bare "*" routes.
  app.use((_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

export default app;
