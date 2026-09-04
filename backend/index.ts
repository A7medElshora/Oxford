import express from "express";
import app from "./app";

const port = Number(process.env.BACKEND_PORT || process.env.PORT || 4000);
const host = process.env.BACKEND_HOST || "127.0.0.1";

const server = express();
server.use("/api", app);

server.listen(port, host, () => {
  console.log(`Oxford API listening on http://${host}:${port}`);
  console.log("Persistence: in-memory only; no external services connected.");
});
