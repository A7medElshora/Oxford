import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Request } from "express";
import { prisma } from "./prisma";
import type { Permission, Role } from "../types";

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

const roleMap: Record<"STUDENT" | "TEACHER" | "ADMIN", Role> = {
	STUDENT: "student",
	TEACHER: "teacher",
	ADMIN: "admin",
};

const permissionMap: Record<"USERS" | "COURSES" | "CONTENT" | "REPORTS" | "PAYMENTS" | "SETTINGS", Permission> = {
	USERS: "users",
	COURSES: "courses",
	CONTENT: "content",
	REPORTS: "reports",
	PAYMENTS: "payments",
	SETTINGS: "settings",
};

type PrismaAuthUser = {
	id: string;
	email: string;
	name: string;
	phone: string | null;
	parentPhone: string | null;
	grade: string | null;
	subject: string | null;
	avatarUrl: string | null;
	role: keyof typeof roleMap;
	status: "PENDING" | "APPROVED" | "REJECTED";
	permissions: Array<{ permission: keyof typeof permissionMap }>;
};

export type PrismaApiUser = {
	id: string;
	email: string;
	name: string;
	role: Role;
	phone?: string;
	parentPhone?: string;
	grade?: string;
	subject?: string;
	avatar?: string;
	status?: "pending" | "approved" | "rejected";
	permissions?: Permission[];
};

function legacyApiId(email: string) {
	const knownIds: Record<string, string> = {
		"student@demo.com": "student-demo",
		"teacher@demo.com": "teacher-demo",
		"admin@demo.com": "admin-demo",
	};
	return knownIds[email.toLowerCase()] || undefined;
}

function hashToken(token: string) {
	return createHash("sha256").update(token).digest("hex");
}

export function createPasswordResetToken() {
	const rawToken = randomBytes(32).toString("hex");
	return { rawToken, tokenHash: hashToken(rawToken) };
}

export { hashToken };

function isAllowedStatus(status: PrismaAuthUser["status"]) {
	return status === "APPROVED";
}

export function mapPrismaUser(user: PrismaAuthUser): PrismaApiUser {
	return {
		id: legacyApiId(user.email) || user.id,
		email: user.email,
		name: user.name,
		role: roleMap[user.role],
		phone: user.phone || undefined,
		parentPhone: user.parentPhone || undefined,
		grade: user.grade || undefined,
		subject: user.subject || undefined,
		avatar: user.avatarUrl || undefined,
		status: user.status.toLowerCase() as PrismaApiUser["status"],
		permissions: user.permissions.map(({ permission }) => permissionMap[permission]),
	};
}

export async function findPrismaUserByIdentifier(identifier: string) {
	const normalizedIdentifier = identifier.trim().toLowerCase();
	return prisma.user.findFirst({
		where: {
			OR: [
				{ email: normalizedIdentifier },
				{ phone: normalizedIdentifier },
				{ name: { equals: identifier.trim(), mode: "insensitive" } },
			],
		},
		include: { permissions: true },
	});
}

export async function hashPassword(password: string) {
	return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
	return bcrypt.compare(password, passwordHash);
}

export async function createPrismaSession(userId: string, request: Request) {
	const rawToken = randomBytes(32).toString("hex");
	const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
	await prisma.session.create({
		data: {
			userId,
			tokenHash: hashToken(rawToken),
			expiresAt,
			userAgent: request.get("user-agent") || null,
			ipAddress: request.ip || null,
		},
	});
	return { rawToken, expiresAt };
}

export async function resolvePrismaSession(rawToken: string | undefined) {
	if (!rawToken) return null;
	const session = await prisma.session.findUnique({
		where: { tokenHash: hashToken(rawToken) },
		include: { user: { include: { permissions: true } } },
	});
	if (!session || session.revokedAt || session.expiresAt <= new Date() || !isAllowedStatus(session.user.status)) return null;
	return session;
}

export async function revokePrismaSession(rawToken: string | undefined) {
	if (!rawToken) return;
	await prisma.session.updateMany({
		where: { tokenHash: hashToken(rawToken), revokedAt: null },
		data: { revokedAt: new Date() },
	});
}

export { isAllowedStatus };
