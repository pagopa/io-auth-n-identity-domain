import { app } from "@azure/functions";
import { InfoFunction } from "./info";

app.http("info", {
  authLevel: "anonymous",
  handler: InfoFunction({}),
  methods: ["GET"],
});
