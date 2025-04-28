import { app } from "@azure/functions";
import { InfoService } from "../services/info";
import { PackageUtils } from "../utils/package";
import { InfoFunction } from "./info";

app.http("Info", {
  authLevel: "anonymous",
  handler: InfoFunction({ InfoService, PackageUtils }),
  methods: ["GET"],
  route: "api/v1/info",
});
