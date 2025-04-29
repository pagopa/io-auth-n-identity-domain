import { app } from "@azure/functions";
import { InfoService } from "../services/info";
import { Package } from "../repositories/package";
import { InfoFunction } from "./info";

app.http("Info", {
  authLevel: "anonymous",
  handler: InfoFunction({ InfoService, Package }),
  methods: ["GET"],
  route: "api/v1/info",
});
