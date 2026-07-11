import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { startAllEngines, stopAllEngines } from "./engines";

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

app.use("/api", router);

startAllEngines();

process.on("SIGTERM", () => {
  logger.info("SIGTERM received — stopping engines");
  stopAllEngines();
});

process.on("SIGINT", () => {
  logger.info("SIGINT received — stopping engines");
  stopAllEngines();
});

export default app;
