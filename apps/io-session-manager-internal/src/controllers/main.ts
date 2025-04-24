import { app } from "@azure/functions";
import { InfoFunction } from "./info";

app.http("Info", {
  authLevel: "anonymous",
  handler: InfoFunction({}),
  methods: ["GET"],
  route: "info",
});
