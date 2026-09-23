import express from "express";
import { prisma } from "../backend/lib/prisma.ts";
import app from "../backend/app.ts";

const TARGET_IDS = [
  "00000000-0000-0000-0000-000000000012", // admin@demo.com
  "04d0cb72-087b-4496-9aa6-bee799aaf3f4", // e2e-admin-fix-...
];

async function deleteAdminsAndVerify() {
  console.log("=== STEP 1: DELETE users in a single transaction ===\n");

  const deleted = await prisma.$transaction(async (tx) => {
    // Prisma Cascade will auto-delete: UserPermissions, Sessions, PasswordResetTokens,
    // Notifications, ConversationParticipants, Carts
    // SetNull will handle: MediaFiles, CalendarEvents, Announcements, ReviewedSubmissions, etc.
    const result = await tx.user.deleteMany({
      where: { id: { in: TARGET_IDS } },
    });
    return result;
  });

  console.log(`Deleted ${deleted.count} user(s).`);

  console.log("\n=== STEP 2: Verify users are gone ===\n");
  const remaining = await prisma.user.findMany({
    where: { id: { in: TARGET_IDS } },
    select: { id: true, email: true, role: true, status: true },
  });
  if (remaining.length === 0) {
    console.log("✅ 0 rows returned — both users deleted successfully.");
  } else {
    console.log("❌ ERROR: Users still exist:", remaining);
  }

  console.log("\n=== STEP 3: Check for any remaining ADMIN APPROVED ===\n");
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", status: "APPROVED" },
    select: { id: true, email: true, role: true, status: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  if (admins.length === 0) {
    console.log("✅ No ADMIN + APPROVED users found — system is clean.");
  } else {
    console.log(`⚠️  Found ${admins.length} ADMIN APPROVED user(s):`);
    admins.forEach(u => console.log(`  - ${u.id} | ${u.email} | ${u.role} | ${u.status} | ${u.createdAt}`));
  }

  console.log("\n=== STEP 4: Test /api/setup/status ===\n");
  const server = express();
  server.use("/api", app);
  const listener = server.listen(0, "127.0.0.1", async () => {
    try {
      const port = (listener.address() as any).port;
      const res = await fetch(`http://127.0.0.1:${port}/api/setup/status`);
      const data = await res.json();
      console.log(`GET /api/setup/status → ${res.status}`, data);
      if (data?.data?.setupRequired === true) {
        console.log("✅ setupRequired = true — Bootstrap mode active.");
      } else {
        console.log("❌ setupRequired is NOT true. Check logic.");
      }
    } finally {
      listener.close();
      await prisma.$disconnect();
    }
  });
}

deleteAdminsAndVerify().catch(async (err) => {
  console.error("FATAL ERROR:", err);
  await prisma.$disconnect();
  process.exit(1);
});
