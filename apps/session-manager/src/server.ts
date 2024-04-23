import express from "express";
import { newApp } from "./app";
import { log } from "./utils/logger";

// eslint-disable-next-line turbo/no-undeclared-env-vars
const port = process.env.WEBSITES_PORT ?? 3000;

newApp()
  .then((app) => {
    app.get("/", (_req: express.Request, res: express.Response) => {
      res.send("Hello World!");
    });

    app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`Example app listening on port ${port}`);
    });
  })
  .catch((err) => {
    log.error("Error loading app: %s", err);
    process.exit(1);
  });
