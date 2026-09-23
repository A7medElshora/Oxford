import { PrismaClient } from "@prisma/client";

const rawUrl = process.env.DATABASE_URL || "";
const cleanUrl = rawUrl.replace(/&channel_binding=require/g, "").replace(/channel_binding=require&?/g, "");

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: cleanUrl ? { db: { url: cleanUrl } } : undefined,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
