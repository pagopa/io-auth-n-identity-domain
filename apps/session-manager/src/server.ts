import express from "express";

const app = express();
const port = process.env.WEBSITES_PORT ?? 3000;

app.get("/healthcheck", (_req: express.Request, res: express.Response) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Example app listening on port ${port}`);
});
