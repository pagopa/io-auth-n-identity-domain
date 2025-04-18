/* main.ts (Functions entrypoint) */
import { app } from "@azure/functions";
import { InfoService } from "../services/info";
import { CustomDependencyRepository } from "../repositories/custom-dependency";
import { InfoFunction } from "./info";

app.http("info", {
  authLevel: "anonymous",
  handler: InfoFunction({ InfoService, CustomDependencyRepository }),
  methods: ["GET"],
});
