import express from "express";
import app from "../backend/app.ts";
import { prisma } from "../backend/lib/prisma.ts";

const server = express();
server.use("/api", app);

const listener = server.listen(0, "127.0.0.1", async () => {
  const address = listener.address();
  const port = address.port;
  console.log(`Test server running on port ${port}`);

  try {
    // 1. GET /api/setup/status
    const statusRes = await fetch(`http://127.0.0.1:${port}/api/setup/status`);
    const statusData = await statusRes.json();
    console.log("Status response:", statusRes.status, statusData);

    // 2. POST /api/setup/primary-admin with wrong secret
    const badSecretRes = await fetch(`http://127.0.0.1:${port}/api/setup/primary-admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Primary-Admin-Bootstrap-Secret": "wrong-secret" },
      body: JSON.stringify({ name: "Test Admin", email: "bootstrap@example.com", password: "password123" }),
    });
    console.log("Bad secret response:", badSecretRes.status, await badSecretRes.json());

    // 3. Check existing Primary Admin in Neon DB
    const primaryAdmin = await prisma.user.findFirst({
      where: { role: "ADMIN", status: "APPROVED" },
      orderBy: { createdAt: "asc" },
    });
    console.log("Existing Primary Admin in DB:", primaryAdmin ? { id: primaryAdmin.id, email: primaryAdmin.email, role: primaryAdmin.role, status: primaryAdmin.status } : "None");

  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    listener.close();
    await prisma.$disconnect();
  }
});
