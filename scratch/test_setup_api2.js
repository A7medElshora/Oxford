import express from "express";
import app from "../backend/app.ts";
import { prisma } from "../backend/lib/prisma.ts";

const server = express();
server.use("/api", app);

const listener = server.listen(0, "127.0.0.1", async () => {
  const address = listener.address();
  const port = address.port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/setup/primary-admin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Primary-Admin-Bootstrap-Secret": process.env.PRIMARY_ADMIN_BOOTSTRAP_SECRET || "",
      },
      body: JSON.stringify({
        name: "Second Primary Admin Attempt",
        email: "secondadmin@example.com",
        password: "password123",
      }),
    });
    console.log("Response status:", res.status);
    console.log("Response data:", await res.json());
  } catch (err) {
    console.error("Test error:", err);
  } finally {
    listener.close();
    await prisma.$disconnect();
  }
});
