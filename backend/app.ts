import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import express, { type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { createPasswordResetToken, createPrismaSession, findPrismaUserByIdentifier, hashPassword, hashToken, mapPrismaUser, resolvePrismaSession, revokePrismaSession, verifyPassword } from "./lib/auth";
import { prisma } from "./lib/prisma";
import { createPrismaCourse, createPrismaTeacher, resolvePrismaTeacherId, updatePrismaCourse, updatePrismaTeacher } from "./lib/prisma-catalog";
import { id, saveAnnouncements, saveSettings, store, timestamp } from "./store";
import { permissionKeys, type AuthedRequest, type AuthUser, type CourseId, type Permission, type Role } from "./types";

const app = express();
app.use(express.json({ limit: "25mb" }));
app.use((_req, res, next) => { res.setHeader("Access-Control-Allow-Origin", "*"); res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Demo-Role"); res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS"); if (_req.method === "OPTIONS") return res.sendStatus(204); next(); });

const courseId = z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/);
const role = z.enum(["student", "teacher", "admin"]);
const permission = z.enum(permissionKeys);
const prismaRoleMap = { student: "STUDENT", teacher: "TEACHER", admin: "ADMIN" } as const;
const permissionEnumMap = { users: "USERS", courses: "COURSES", content: "CONTENT", reports: "REPORTS", payments: "PAYMENTS", settings: "SETTINGS" } as const;
const loginBody = z.object({ identifier: z.string().trim().min(1), password: z.string().min(1) });
const registerBody = z.object({
	name: z.string().trim().min(2).max(80),
	email: z.string().email(),
	password: z.string().min(6).max(100),
	role,
	phone: z.string().trim().min(8).max(20).optional(),
	parentPhone: z.string().trim().min(8).max(20).optional(),
	grade: z.string().trim().min(1).max(80).optional(),
	subject: z.string().trim().min(1).max(80).optional(),
	grades: z.array(z.string().trim().min(1).max(80)).min(1).max(12).optional(),
	avatar: z.string().max(700_000).optional(),
	adminInviteCode: z.string().optional(),
}).superRefine((body, ctx) => {
	if (body.role === "student" && (!body.phone || !body.parentPhone || !body.grade)) ctx.addIssue({ code: "custom", path: ["role"], message: "بيانات الطالب الهاتف والصف وولي الأمر مطلوبة" });
	if (body.role === "teacher" && (!body.subject || !body.grades?.length)) ctx.addIssue({ code: "custom", path: ["role"], message: "المادة والصفوف الدراسية مطلوبة للمدرس" });
	if (body.role === "admin" && !body.adminInviteCode) ctx.addIssue({ code: "custom", path: ["adminInviteCode"], message: "كود دعوة الأدمن غير صحيح" });
});
const lessonBody = z.object({ courseId, title: z.string().min(1), description: z.string().default(""), lectureUrl: z.string().url(), resourceUrl: z.string().max(700_000).refine((value) => value.startsWith("data:") || URL.canParse(value), "resourceUrl must be a URL or data URL").optional(), unit: z.string().trim().min(1).max(120).optional(), published: z.boolean().default(true) });
const question = z.object({ prompt: z.string().min(1), choices: z.array(z.string().min(1)).min(2), correctIndex: z.number().int().nonnegative(), marks: z.number().positive().default(1) }).superRefine((value, ctx) => { if (value.correctIndex >= value.choices.length) ctx.addIssue({ code: "custom", path: ["correctIndex"], message: "correctIndex must reference a choice" }); });
const examBody = z.object({ courseId, title: z.string().min(1), description: z.string().default(""), duration: z.number().int().positive(), resultVisibility: z.enum(["immediate", "after_review"]).default("immediate"), questions: z.array(question).min(1), published: z.boolean().default(true) });
const teacherPlan = z.object({ teacherId: z.string().min(1), monthlyPrice: z.number().nonnegative(), lessonPrice: z.number().nonnegative(), chapterPrice: z.number().nonnegative(), discountEnabled: z.boolean(), discountKind: z.enum(["percent", "amount"]).optional(), discountValue: z.number().nonnegative().optional() }).superRefine((value, ctx) => { if (value.discountEnabled && (!value.discountKind || value.discountValue === undefined)) ctx.addIssue({ code: "custom", path: ["discountValue"], message: "Discount type and value are required when discounting is enabled" }); if (value.discountKind === "percent" && value.discountValue !== undefined && value.discountValue > 100) ctx.addIssue({ code: "custom", path: ["discountValue"], message: "Percentage discount cannot exceed 100" }); });
const courseBody = z.object({ id: courseId, title: z.string().trim().min(1), description: z.string().default(""), level: z.string().default("كل المستويات"), duration: z.string().default("غير محدد"), image: z.string().default(""), price: z.number().nonnegative().default(0), published: z.boolean().default(true), targetGrades: z.array(z.string().trim().min(1)).default([]), teacherPlans: z.array(teacherPlan).default([]) });
const coursePatchBody = courseBody.omit({ id: true }).partial();
const teacherBody = z.object({ name: z.string().trim().min(2).max(80), subject: z.string().trim().min(1).max(80), bio: z.string().max(5000).default(""), image: z.string().max(700_000).default(""), trustLabel: z.string().trim().max(80).default("مدرس جديد") });
const teacherPatchBody = teacherBody.partial();
const announcementFields = z.object({ kicker: z.string().trim().min(1).max(80), title: z.string().trim().min(1).max(160), body: z.string().trim().min(1).max(500), cta: z.string().trim().min(1).max(60), target: z.enum(["home", "courses", "teachers", "lessons", "exams", "assignments"]), mediaType: z.enum(["none", "image", "video"]), mediaUrl: z.string().max(22_000_000).optional(), published: z.boolean().default(true), sortOrder: z.number().int().nonnegative().default(0) });
function validateAnnouncement(value: { mediaType?: "none" | "image" | "video"; mediaUrl?: string }, ctx: z.RefinementCtx) { if (value.mediaType !== "none" && !value.mediaUrl) ctx.addIssue({ code: "custom", path: ["mediaUrl"], message: "رابط الوسائط مطلوب" }); if (value.mediaType === "image" && value.mediaUrl && !value.mediaUrl.startsWith("data:image/") && !URL.canParse(value.mediaUrl)) ctx.addIssue({ code: "custom", path: ["mediaUrl"], message: "رابط الصورة غير صحيح" }); if (value.mediaType === "video" && value.mediaUrl && !value.mediaUrl.startsWith("data:video/") && !URL.canParse(value.mediaUrl)) ctx.addIssue({ code: "custom", path: ["mediaUrl"], message: "رابط الفيديو غير صحيح" }); }
const announcementBody = announcementFields.superRefine(validateAnnouncement);
const announcementPatchBody = announcementFields.partial().superRefine(validateAnnouncement);
const enrollmentBody = z.object({ courseId, teacherId: z.string().min(1), studentId: z.string().optional(), studentName: z.string().min(1), studentPhone: z.string().min(8), parentPhone: z.string().min(8), grade: z.string().min(1), bookingType: z.string().min(1), unit: z.string().optional(), amount: z.number().positive().optional(), transferImage: z.string().max(700_000).refine((value) => value.startsWith("data:image/"), "transferImage must be an image data URL").optional() });

function calculateEnrollmentAmount(basePrice: number, discountEnabled?: boolean, discountKind?: string | null, discountValue?: unknown) {
	if (!discountEnabled || discountValue === null || discountValue === undefined) return basePrice;
	const val = Number(discountValue);
	if (Number.isNaN(val) || val <= 0) return basePrice;
	const kind = String(discountKind).toLowerCase();
	if (kind === "percent") {
		return Math.round(basePrice * (1 - val / 100));
	}
	if (kind === "amount") {
		return Math.max(0, basePrice - val);
	}
	return basePrice;
}

function sendError(res: Response, status: number, message: string, details?: unknown) { return res.status(status).json({ error: { message, details } }); }
function ok(res: Response, data: unknown, status = 200) { return res.status(status).json({ data }); }
function publicUser(user: AuthUser) { const { password: _password, ...safeUser } = user; return safeUser; }
function findUserByToken(token: string | undefined) { const userId = token ? store.sessions.get(token) : undefined; return store.users.find((user) => user.id === userId); }
function auth(required = true) {
	return async (req: Request, res: Response, next: NextFunction) => {
		const bearer = prismaBearerToken(req) || req.header("authorization")?.replace(/^Bearer\s+/i, "");
		if (prismaAuthEnabled) {
			try {
				const session = await resolvePrismaSession(bearer);
				if (session) {
					req.user = mapPrismaUser(session.user);
					(req as Request & { prismaUserId?: string }).prismaUserId = session.user.id;
					return next();
				}
				if (required) return sendError(res, 401, "Authentication is required");
				return next();
			} catch {
				return sendError(res, 503, "Authentication service is unavailable");
			}
		}
		const tokenUser = findUserByToken(bearer);
		const demoRole = role.safeParse(req.header("x-demo-role")).data;
		const user = tokenUser || (demoRole ? store.users.find((item) => item.role === demoRole) : undefined);
		if (!user && required) return sendError(res, 401, "Authentication is required");
		req.user = user;
		next();
	};
}
function catalogAuth(required = true) {
	return async (req: Request, res: Response, next: NextFunction) => {
		if (!prismaAuthEnabled) return auth(required)(req, res, next);
		try {
			const session = await resolvePrismaSession(prismaBearerToken(req));
			if (session) {
				req.user = mapPrismaUser(session.user);
				(req as Request & { prismaUserId?: string }).prismaUserId = session.user.id;
			}
			else if (required) return sendError(res, 401, "Authentication is required");
			return next();
		} catch {
			return sendError(res, 503, "Authentication service is unavailable");
		}
	};
}
async function adminUsersAuth(req: Request, res: Response, next: NextFunction) {
	if (!prismaAuthEnabled) return auth()(req, res, next);
	try {
		const session = await resolvePrismaSession(prismaBearerToken(req));
		if (!session) return sendError(res, 401, "Authentication is required");
		req.user = mapPrismaUser(session.user);
		return next();
	} catch {
		return sendError(res, 503, "Authentication service is unavailable");
	}
}
async function prismaProtectedAuth(req: Request, res: Response, next: NextFunction) {
	if (!prismaAuthEnabled) return auth()(req, res, next);
	try {
		const session = await resolvePrismaSession(prismaBearerToken(req));
		if (!session) return sendError(res, 401, "Authentication is required");
		req.user = mapPrismaUser(session.user);
		(req as Request & { prismaUserId?: string }).prismaUserId = session.user.id;
		return next();
	} catch {
		return sendError(res, 503, "Authentication service is unavailable");
	}
}
function prismaUserId(req: Request) {
	return (req as Request & { prismaUserId?: string }).prismaUserId || currentUser(req).id;
}
async function optionalTeacherAuth(req: Request, res: Response, next: NextFunction) {
	if (!prismaAuthEnabled) return auth(false)(req, res, next);
	const bearer = prismaBearerToken(req);
	if (!bearer) return next();
	try {
		const session = await resolvePrismaSession(bearer);
		if (!session) return sendError(res, 401, "Authentication is required");
		req.user = mapPrismaUser(session.user);
		return next();
	} catch {
		return sendError(res, 503, "Authentication service is unavailable");
	}
}
async function getPrimaryAdminPrismaUser() {
	if (!prismaAuthEnabled) return null;
	return prisma.user.findFirst({
		where: { role: "ADMIN", status: "APPROVED" },
		orderBy: { createdAt: "asc" },
		include: { permissions: true },
	});
}

function getPrimaryAdminMemoryUser() {
	return store.users.find((user) => user.role === "admin" && user.status === "approved");
}

async function isPrimaryAdmin(req: Request) {
	const user = currentUser(req);
	if (!user || user.role !== "admin" || user.status !== "approved") return false;
	if (prismaAuthEnabled) {
		const primary = await getPrimaryAdminPrismaUser();
		const userId = (req as Request & { prismaUserId?: string }).prismaUserId || user.id;
		return Boolean(primary && primary.id === userId);
	}
	const primary = getPrimaryAdminMemoryUser();
	return Boolean(primary && primary.id === user.id);
}

function allow(...roles: Role[]) { return (req: Request, res: Response, next: NextFunction) => { if (!req.user || !roles.includes(req.user.role)) return sendError(res, 403, "This role cannot perform the requested action"); next(); }; }
function allowPermission(required: Permission) {
	return async (req: Request, res: Response, next: NextFunction) => {
		const user = currentUser(req);
		if (!user) return sendError(res, 401, "Authentication is required");
		if (user.role === "teacher") return next();
		if (user.role === "admin") {
			const primary = await isPrimaryAdmin(req);
			if (primary || user.permissions?.includes(required)) return next();
		}
		return sendError(res, 403, "لا تملك صلاحية تنفيذ هذا الإجراء");
	};
}
function allowAnyPermission(...required: Permission[]) {
	return async (req: Request, res: Response, next: NextFunction) => {
		const user = currentUser(req);
		if (!user) return sendError(res, 401, "Authentication is required");
		if (user.role === "teacher") return next();
		if (user.role === "admin") {
			const primary = await isPrimaryAdmin(req);
			if (primary || required.some((permission) => user.permissions?.includes(permission))) return next();
		}
		return sendError(res, 403, "لا تملك صلاحية تنفيذ هذا الإجراء");
	};
}
async function allowPrimaryAdmin(req: Request, res: Response, next: NextFunction) {
	if (await isPrimaryAdmin(req)) return next();
	return sendError(res, 403, "إدارة حسابات الفريق متاحة للأدمن الرئيسي فقط");
}
async function allowPrismaPrimaryAdmin(req: Request, res: Response, next: NextFunction) {
	if (await isPrimaryAdmin(req)) return next();
	return sendError(res, 403, "إدارة حسابات الفريق متاحة للأدمن الرئيسي فقط");
}
function validate<T extends z.ZodType>(schema: T) { return (req: Request, res: Response, next: NextFunction) => { const result = schema.safeParse(req.body); if (!result.success) return sendError(res, 400, "Invalid request body", result.error.flatten()); req.body = result.data; next(); }; }
function currentUser(req: Request) { return (req as AuthedRequest).user; }
function teacherName(teacherId: string) { return store.teachers.find((teacher) => teacher.id === teacherId)?.name || "مدرس"; }
const prismaReadsEnabled = process.env.PRISMA_READS_ENABLED === "true";
const prismaAuthEnabled = process.env.PRISMA_AUTH_ENABLED === "true";
function canUsePrismaReads() { return prismaReadsEnabled && Boolean(process.env.DATABASE_URL); }
function legacyUserId(email: string) {
	const knownIds: Record<string, string> = { "student@demo.com": "student-demo", "teacher@demo.com": "teacher-demo", "admin@demo.com": "admin-demo" };
	return knownIds[email.toLowerCase()] || undefined;
}
function prismaBearerToken(req: Request) {
	return req.header("authorization")?.replace(/^Bearer\s+/i, "");
}
function normalizeAdminInviteCode(value: string | undefined) {
	const cleaned = (value || "").replace(/[\u200e\u200f\u202a-\u202e\s]/g, "").trim();
	const marker = cleaned.indexOf("ADM-");
	return marker >= 0 ? cleaned.slice(marker) : cleaned;
}
async function adminInviteMatches(input: string | undefined, stored: string | null | undefined) {
	if (!stored) return false;
	const code = normalizeAdminInviteCode(input);
	const saved = normalizeAdminInviteCode(stored);
	if (!code) return false;
	if (/^\$2[aby]\$/.test(saved)) {
		try {
			return await bcrypt.compare(code, saved);
		} catch {
			return false;
		}
	}
	return code === saved;
}
async function requirePrismaPrimaryAdmin(req: Request) {
	if (!prismaAuthEnabled) {
		const user = currentUser(req);
		const primary = getPrimaryAdminMemoryUser();
		if (user && user.role === "admin" && primary && user.id === primary.id) {
			return { session: { user } };
		}
		return { error: { status: 403, message: "Primary admin access is required" } as const };
	}
	const session = await resolvePrismaSession(prismaBearerToken(req));
	if (!session || session.user.role !== "ADMIN" || session.user.status !== "APPROVED") {
		return { error: { status: 403, message: "Primary admin access is required" } as const };
	}
	const primary = await getPrimaryAdminPrismaUser();
	if (!primary || primary.id !== session.user.id) {
		return { error: { status: 403, message: "Primary admin access is required" } as const };
	}
	return { session };
}
type PrismaTeacherRead = { teacher: { id: string; email: string; name: string; subject: string | null; avatarUrl: string | null }; teacherProfile: { subject: string; bio: string; imageUrl: string | null; trustLabel: string } | null; courses: { courseId: string }[]; plans: { monthlyPrice: unknown; chapterPrice: unknown; lessonPrice: unknown; discountEnabled?: boolean; discountKind?: string | null; discountValue?: unknown }[] };
type PrismaCoursePlanRead = { teacherId: string; monthlyPrice: unknown; lessonPrice: unknown; chapterPrice: unknown; discountEnabled: boolean; discountKind: string | null; discountValue: unknown };
type PrismaCourseRead = { id: string; title: string; description: string; level: string; duration: string; imageUrl: string | null; lessonCount: number; price: unknown; published: boolean; targetGrades: { grade: string }[]; teachers: PrismaTeacherRead[]; teacherPlans: PrismaCoursePlanRead[] };
type PrismaLessonRead = { id: string; courseId: string; title: string; description: string; lectureUrl: string; resourceUrl: string | null; unit?: string | null; teacherId: string; published: boolean; createdAt: Date };
type PrismaExamQuestionRead = { id: string; prompt: string; choices: unknown; correctIndex: number; marks: unknown; position: number };
type PrismaExamRead = { id: string; courseId: string; title: string; description: string; durationMinutes: number; resultVisibility: string; teacherId: string; published: boolean; createdAt: Date; questions: PrismaExamQuestionRead[] };
function mapPrismaTeacher(teacher: PrismaTeacherRead) {
	const plan = teacher.plans[0];
	const plans = plan ? [
		{ label: "شهري", price: Number(plan.monthlyPrice) },
		{ label: "الباب الأول", price: Number(plan.chapterPrice) },
		{ label: "بالحصة", price: Number(plan.lessonPrice) },
	] : [];
	const discountValue = plan?.discountEnabled ? Number(plan.discountValue ?? 0) : undefined;
	const discountText = plan?.discountEnabled && discountValue !== undefined && Number.isFinite(discountValue)
		? `${discountValue}${plan.discountKind === "PERCENT" ? "%" : " جنيه"}`
		: undefined;
	return {
		id: teacher.teacher.id,
		name: teacher.teacher.name,
		subject: teacher.teacherProfile?.subject || teacher.teacher.subject || "",
		bio: teacher.teacherProfile?.bio || "",
		image: teacher.teacherProfile?.imageUrl || teacher.teacher.avatarUrl || "",
		courseIds: teacher.courses.map((item) => item.courseId),
		trustLabel: teacher.teacherProfile?.trustLabel || "مدرس",
		plans,
		...(discountText ? { discount: discountText } : {}),
		...(plan?.discountKind ? { discountKind: plan.discountKind.toLowerCase() } : {}),
	};
}
function mapPrismaCourse(course: PrismaCourseRead) {
	return {
		id: course.id,
		title: course.title,
		description: course.description,
		level: course.level,
		duration: course.duration,
		image: course.imageUrl || "",
		teacherIds: course.teachers.map((item) => legacyUserId(item.teacher.email) || item.teacher.id),
		targetGrades: course.targetGrades.map((item) => item.grade),
		teacherPlans: course.teacherPlans.map((plan) => ({
			teacherId: legacyUserId(course.teachers.find((item) => item.teacher.id === plan.teacherId)?.teacher.email || "") || plan.teacherId,
			monthlyPrice: Number(plan.monthlyPrice),
			lessonPrice: Number(plan.lessonPrice),
			chapterPrice: Number(plan.chapterPrice),
			discountEnabled: plan.discountEnabled,
			...(plan.discountKind ? { discountKind: plan.discountKind.toLowerCase() } : {}),
			...(plan.discountValue !== null ? { discountValue: Number(plan.discountValue) } : {}),
		})),
		lessonCount: course.lessonCount,
		price: Number(course.price),
		published: course.published,
		teachers: course.teachers.map(mapPrismaTeacher),
	};
}
function mapPrismaLesson(lesson: PrismaLessonRead) {
	return { id: lesson.id, courseId: lesson.courseId, title: lesson.title, description: lesson.description, lectureUrl: lesson.lectureUrl, ...(lesson.resourceUrl ? { resourceUrl: lesson.resourceUrl } : {}), ...(lesson.unit ? { unit: lesson.unit } : {}), teacherId: lesson.teacherId, published: lesson.published, createdAt: lesson.createdAt.toISOString() };
}
function mapPrismaExamQuestion(question: PrismaExamQuestionRead, includeAnswer: boolean) {
	return includeAnswer
		? { id: question.id, prompt: question.prompt, choices: question.choices, correctIndex: question.correctIndex, ...(question.marks !== null ? { marks: Number(question.marks) } : {}) }
		: { id: question.id, prompt: question.prompt, choices: question.choices };
}
function mapPrismaExam(exam: PrismaExamRead, includeAnswers: boolean) {
	return {
		id: exam.id,
		courseId: exam.courseId,
		title: exam.title,
		description: exam.description,
		duration: exam.durationMinutes,
		...(exam.resultVisibility !== "IMMEDIATE" ? { resultVisibility: exam.resultVisibility.toLowerCase() } : {}),
		questions: exam.questions.map((question) => mapPrismaExamQuestion(question, includeAnswers)),
		teacherId: exam.teacherId,
		published: exam.published,
		createdAt: exam.createdAt.toISOString(),
	};
}
function isTeacherForCourse(
	user: { id?: string; name?: string; email?: string; role?: string } | null | undefined,
	course: { teacherIds?: string[]; teachers?: Array<{ teacherId?: string; teacher?: { id?: string; name?: string; email?: string } }> } | null | undefined
): boolean {
	if (!user || !course) return false;
	if (user.role === "admin") return true;
	if (user.role !== "teacher") return false;

	const userEmail = user.email;
	const userName = user.name;
	const legacyId = userEmail ? legacyUserId(userEmail) : undefined;

	if (course.teachers && Array.isArray(course.teachers) && course.teachers.length > 0) {
		const isMatch = course.teachers.some((t) => {
			const tid = t.teacherId || t.teacher?.id;
			const temail = t.teacher?.email;
			const tname = t.teacher?.name;
			return (
				(user.id && tid === user.id) ||
				(userEmail && temail && temail.toLowerCase() === userEmail.toLowerCase()) ||
				(userName && tname && tname.toLowerCase() === userName.toLowerCase()) ||
				(legacyId && tid === legacyId)
			);
		});
		if (isMatch) return true;
	}

	const ids = course.teacherIds || [];
	if (ids.length === 0) return true;
	if (user.id && ids.includes(user.id)) return true;
	if (userName && ids.includes(userName)) return true;
	if (userEmail && ids.includes(userEmail)) return true;
	if (legacyId && ids.includes(legacyId)) return true;

	return false;
}
async function prismaReadOr503<T>(res: Response, query: () => Promise<T>) {
	try {
		return await query();
	} catch (error) {
		console.error("Prisma read failed:", error);
		sendError(res, 503, "Database is unavailable");
		return undefined;
	}
}

app.get("/health", (_req, res) => ok(res, {
	status: "ok",
	mode: prismaAuthEnabled ? "prisma" : prismaReadsEnabled ? "prisma-reads" : "in-memory",
	connectedServices: process.env.DATABASE_URL ? ["postgresql"] : [],
}));
app.get("/meta", (_req, res) => ok(res, {
	name: "Oxford Learning Platform API",
	version: "0.1.0",
	persistence: canUsePrismaReads() ? "prisma" : "in-memory",
	authentication: prismaAuthEnabled ? "prisma bearer sessions" : "demo bearer sessions",
	integrations: process.env.DATABASE_URL ? ["postgresql"] : [],
}));
app.get("/setup/status", async (_req, res) => {
	try {
		if (prismaAuthEnabled) {
			const primaryAdmin = await getPrimaryAdminPrismaUser();
			return ok(res, { setupRequired: !Boolean(primaryAdmin) });
		}
		const primaryAdmin = getPrimaryAdminMemoryUser();
		return ok(res, { setupRequired: !Boolean(primaryAdmin) });
	} catch (error) {
		console.error("Setup status check failed:", error);
		return sendError(res, 503, "Setup service is unavailable");
	}
});

const setupPrimaryAdminBody = z.object({
	name: z.string().trim().min(2).max(80),
	email: z.string().email(),
	password: z.string().min(6).max(100),
	phone: z.string().trim().min(8).max(20).optional(),
});

app.post("/setup/primary-admin", validate(setupPrimaryAdminBody), async (req, res) => {
	const secretHeader = req.header("x-primary-admin-bootstrap-secret") || req.header("authorization")?.replace(/^Bearer\s+/i, "");
	const configuredSecret = process.env.PRIMARY_ADMIN_BOOTSTRAP_SECRET;

	if (!configuredSecret || !secretHeader || secretHeader !== configuredSecret) {
		return sendError(res, 403, "رمز حماية الإعداد (Bootstrap Secret) غير صحيح أو غير مفعل");
	}

	const body = req.body as z.infer<typeof setupPrimaryAdminBody>;
	const normalizedEmail = body.email.toLowerCase();

	if (prismaAuthEnabled) {
		try {
			const existingPrimary = await getPrimaryAdminPrismaUser();
			if (existingPrimary) {
				return sendError(res, 409, "Primary admin setup has already been completed.");
			}

			const duplicateUser = await prisma.user.findFirst({
				where: {
					OR: [
						{ email: normalizedEmail },
						...(body.phone ? [{ phone: body.phone }] : []),
					],
				},
			});
			if (duplicateUser) {
				if (duplicateUser.email.toLowerCase() === normalizedEmail) {
					return sendError(res, 409, "البريد الإلكتروني مستخدم بالفعل");
				}
				return sendError(res, 409, "رقم الهاتف مستخدم بالفعل");
			}

			const passwordHash = await hashPassword(body.password);
			const createPermissions = permissionKeys.map((k) => ({ permission: permissionEnumMap[k] }));

			const createdUser = await prisma.user.create({
				data: {
					name: body.name,
					email: normalizedEmail,
					passwordHash,
					role: "ADMIN",
					status: "APPROVED",
					phone: body.phone || null,
					permissions: { create: createPermissions },
				},
				include: { permissions: true },
			});

			return ok(res, { message: "تم إنشاء حساب الأدمن الرئيسي بنجاح", user: mapPrismaUser(createdUser) }, 201);
		} catch (error) {
			console.error("Primary admin bootstrap failed:", error);
			return sendError(res, 503, "Database service is unavailable");
		}
	}

	const existingPrimary = getPrimaryAdminMemoryUser();
	if (existingPrimary) {
		return sendError(res, 409, "Primary admin setup has already been completed.");
	}

	const user: AuthUser = {
		id: id("admin"),
		name: body.name,
		email: normalizedEmail,
		password: body.password,
		role: "admin",
		status: "approved",
		phone: body.phone,
		permissions: [...permissionKeys],
	};
	store.users.push(user);
	return ok(res, { message: "تم إنشاء حساب الأدمن الرئيسي بنجاح", user: publicUser(user) }, 201);
});
app.post("/admin/invite-code", async (req, res) => {
	if (!prismaAuthEnabled) {
		const access = await requirePrismaPrimaryAdmin(req);
		if (!("session" in access)) return sendError(res, access.error.status, access.error.message);
		const inviteCode = `ADM-${randomBytes(18).toString("base64url")}`;
		store.settings.adminInviteCode = inviteCode;
		saveSettings();
		return ok(res, { inviteCode });
	}
	try {
		const access = await requirePrismaPrimaryAdmin(req);
		if (!("session" in access)) return sendError(res, access.error.status, access.error.message);
		const inviteCode = `ADM-${randomBytes(18).toString("base64url")}`;
		const inviteCodeHash = await bcrypt.hash(inviteCode, 12);
		await prisma.platformSetting.upsert({
			where: { id: 1 },
			update: { adminInviteCodeHash: inviteCodeHash },
			create: { id: 1, adminInviteCodeHash: inviteCodeHash },
		});
		return ok(res, { inviteCode });
	} catch (error) {
		console.error("Prisma admin invite generation failed:", error);
		return sendError(res, 503, "Authentication service is unavailable");
	}
});
app.get("/announcements", async (_req, res) => {
	return ok(res, store.announcements.filter(item => item.published).sort((a, b) => a.sortOrder - b.sortOrder));
});
app.get("/public/stats", async (_req, res) => {
	if (canUsePrismaReads()) {
		const enrolledStudents = await prismaReadOr503(res, () => prisma.enrollment.findMany({ where: { status: "APPROVED" }, select: { studentId: true }, distinct: ["studentId"] }));
		if (!enrolledStudents) return;
		return ok(res, { enrolledStudents: enrolledStudents.length });
	}
	return ok(res, { enrolledStudents: new Set(store.enrollments.filter(item => item.status === "approved" && item.studentId).map(item => item.studentId)).size });
});
app.get("/admin/announcements", auth(), allow("admin"), allowPermission("content"), (req, res) => ok(res, store.announcements.slice().sort((a, b) => a.sortOrder - b.sortOrder)));
app.post("/admin/announcements", auth(), allow("admin"), allowPermission("content"), validate(announcementBody), (req, res) => { const announcement = { id: id("announcement"), ...req.body, createdAt: timestamp() }; store.announcements.push(announcement); saveAnnouncements(); return ok(res, announcement, 201); });
app.patch("/admin/announcements/:announcementId", auth(), allow("admin"), allowPermission("content"), validate(announcementPatchBody), (req, res) => { const announcement = store.announcements.find(item => item.id === req.params.announcementId); if (!announcement) return sendError(res, 404, "الإعلان غير موجود"); Object.assign(announcement, req.body); saveAnnouncements(); return ok(res, announcement); });
app.delete("/admin/announcements/:announcementId", auth(), allow("admin"), allowPermission("content"), (req, res) => { const index = store.announcements.findIndex(item => item.id === req.params.announcementId); if (index < 0) return sendError(res, 404, "الإعلان غير موجود"); store.announcements.splice(index, 1); saveAnnouncements(); return res.sendStatus(204); });
app.get("/notifications", prismaProtectedAuth, async (req, res) => {
	if (prismaAuthEnabled) {
		const notifications = await prismaReadOr503(res, () => prisma.notification.findMany({ where: { userId: currentUser(req).id }, orderBy: { createdAt: "desc" } }));
		if (!notifications) return;
		return ok(res, notifications.map((item) => ({ ...item, type: item.type.toLowerCase(), createdAt: item.createdAt.toISOString() })));
	}
	return ok(res, store.notifications.filter((item) => item.userId === currentUser(req).id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});
app.patch("/notifications/:notificationId/read", prismaProtectedAuth, async (req, res) => {
	if (prismaAuthEnabled) {
		const notification = await prismaReadOr503(res, () => prisma.notification.findFirst({ where: { id: req.params.notificationId, userId: currentUser(req).id } }));
		if (!notification) return sendError(res, 404, "Notification not found");
		const updated = await prismaReadOr503(res, () => prisma.notification.update({ where: { id: notification.id }, data: { read: true, readAt: new Date() } }));
		if (!updated) return;
		return ok(res, { ...updated, type: updated.type.toLowerCase(), createdAt: updated.createdAt.toISOString() });
	}
	const notification = store.notifications.find((item) => item.id === req.params.notificationId && item.userId === currentUser(req).id);
	if (!notification) return sendError(res, 404, "Notification not found");
	notification.read = true;
	return ok(res, notification);
});

app.post("/auth/login", validate(loginBody), async (req, res) => {
	if (prismaAuthEnabled) {
		try {
			const found = await findPrismaUserByIdentifier(req.body.identifier);
			if (!found || !(await verifyPassword(req.body.password, found.passwordHash))) return sendError(res, 401, "بيانات الدخول غير صحيحة");
			if (found.status === "PENDING") return sendError(res, 403, "حسابك قيد المراجعة من قبل الإدارة، يرجى الانتظار");
			if (found.status === "REJECTED") return sendError(res, 403, "عذراً، تم رفض طلب انضمامك");
			const { rawToken } = await createPrismaSession(found.id, req);
			void prisma.user.update({ where: { id: found.id }, data: { lastLoginAt: new Date() } }).catch(() => console.error("Unable to update last login timestamp"));
			return ok(res, { token: rawToken, user: mapPrismaUser(found) }, 200);
		} catch {
			return sendError(res, 503, "Authentication service is unavailable");
		}
	}
	const identifier = req.body.identifier.toLowerCase(); const found = store.users.find((user) => user.email.toLowerCase() === identifier || user.phone?.toLowerCase() === identifier); if (!found || req.body.password !== (found.password || "123456")) return sendError(res, 401, "بيانات الدخول غير صحيحة"); if (found.status === "pending") return sendError(res, 403, "حسابك قيد المراجعة من قبل الإدارة، يرجى الانتظار"); if (found.status === "rejected") return sendError(res, 403, "عذراً، تم رفض طلب انضمامك"); const token = id("demo-session"); store.sessions.set(token, found.id); return ok(res, { token, user: publicUser(found) }, 200);
});
app.post("/auth/register", validate(registerBody), async (req, res) => {
	const body = req.body as z.infer<typeof registerBody>;
	if (!prismaAuthEnabled) {
		if (store.users.some((user) => user.email.toLowerCase() === body.email.toLowerCase())) return sendError(res, 409, "البريد الإلكتروني مستخدم بالفعل");
		if (body.role === "admin" && !(await adminInviteMatches(body.adminInviteCode, store.settings.adminInviteCode))) return sendError(res, 400, "كود دعوة الأدمن غير صحيح");
		const status = body.role === "student" ? "approved" : "pending";
		const user: AuthUser = { id: id(body.role), name: body.name, email: body.email.toLowerCase(), password: body.password, role: body.role, phone: body.phone, parentPhone: body.parentPhone, grade: body.grade, subject: body.subject, grades: body.grades, avatar: body.avatar, status, permissions: body.role === "admin" ? [...permissionKeys] : body.role === "teacher" ? ["content"] : [] };
		store.users.push(user);
		if (body.role === "teacher") store.teachers.push({ id: user.id, name: user.name, subject: body.subject || "", bio: "مدرس جديد على المنصة", image: body.avatar || "", courseIds: [], trustLabel: "مدرس جديد", plans: [] });
		if (status === "pending") return ok(res, { token: null, user: publicUser(user), message: "تم إرسال طلبك للإدارة وسيتم مراجعته قريباً" }, 201);
		const token = id("demo-session");
		store.sessions.set(token, user.id);
		return ok(res, { token, user: publicUser(user) }, 201);
	}
	try {
		const normalizedEmail = body.email.toLowerCase();
		const duplicateUser = await prisma.user.findFirst({
			where: {
				OR: [
					{ email: normalizedEmail },
					...(body.phone ? [{ phone: body.phone }] : []),
				],
			},
			select: { id: true, email: true, phone: true },
		});
		if (duplicateUser) {
			if (duplicateUser.email.toLowerCase() === normalizedEmail) return sendError(res, 409, "البريد الإلكتروني مستخدم بالفعل");
			if (body.phone && duplicateUser.phone === body.phone) return sendError(res, 409, "رقم الهاتف مستخدم بالفعل");
		}
		if (body.role === "admin") {
			const settings = await prisma.platformSetting.findUnique({ where: { id: 1 } });
			if (!settings?.adminInviteCodeHash) return sendError(res, 503, "Admin invitation code is not configured");
			const codeMatches = await adminInviteMatches(body.adminInviteCode, settings.adminInviteCodeHash);
			if (!codeMatches) return sendError(res, 400, "كود دعوة الأدمن غير صحيح");
		}
		const createPermissions = body.role === "admin"
			? permissionKeys.map((permissionKey) => ({ permission: permissionEnumMap[permissionKey] }))
			: body.role === "teacher"
				? [{ permission: "CONTENT" as const }]
				: [];
		const passwordHash = await hashPassword(body.password);
		const createdUser = await prisma.$transaction(async (tx) => {
			const user = await tx.user.create({
				data: {
					name: body.name,
					email: normalizedEmail,
					passwordHash,
					role: prismaRoleMap[body.role],
					phone: body.phone || null,
					parentPhone: body.parentPhone || null,
					grade: body.grade || null,
					subject: body.subject || null,
					avatarUrl: body.avatar || null,
					status: body.role === "student" ? "APPROVED" : "PENDING",
					...(createPermissions.length ? { permissions: { create: createPermissions } } : {}),
				},
				include: { permissions: true },
			});
			if (body.role === "teacher") {
				await tx.teacherProfile.upsert({
					where: { userId: user.id },
					update: { subject: body.subject || "", bio: "مدرس جديد على المنصة", imageUrl: body.avatar || null, trustLabel: "مدرس جديد" },
					create: { userId: user.id, subject: body.subject || "", bio: "مدرس جديد على المنصة", imageUrl: body.avatar || null, trustLabel: "مدرس جديد" },
				});
			}
			return user;
		});
		if (createdUser.status === "APPROVED") {
			const { rawToken } = await createPrismaSession(createdUser.id, req);
			void prisma.user.update({ where: { id: createdUser.id }, data: { lastLoginAt: new Date() } }).catch(() => console.error("Unable to update last login timestamp"));
			return ok(res, { token: rawToken, user: mapPrismaUser(createdUser) }, 201);
		}
		return ok(res, { token: null, user: mapPrismaUser(createdUser), message: "تم إرسال طلبك للإدارة وسيتم مراجعته قريباً" }, 201);
	} catch (error) {
		if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
			const target = "meta" in error && error.meta && typeof error.meta === "object" && "target" in error.meta ? error.meta.target : undefined;
			if (Array.isArray(target) && target.includes("phone")) return sendError(res, 409, "رقم الهاتف مستخدم بالفعل");
			return sendError(res, 409, "البريد الإلكتروني مستخدم بالفعل");
		}
		console.error("Prisma registration failed:", error);
		return sendError(res, 503, "Authentication service is unavailable");
	}
});
app.post("/auth/logout", async (req, res, next) => {
	if (prismaAuthEnabled) {
		try {
			await revokePrismaSession(req.header("authorization")?.replace(/^Bearer\s+/i, ""));
			return ok(res, { loggedOut: true });
		} catch {
			return sendError(res, 503, "Authentication service is unavailable");
		}
	}
	return next();
}, auth(), (req, res) => {
	const token = req.header("authorization")?.replace(/^Bearer\s+/i, ""); if (token) store.sessions.delete(token); return ok(res, { loggedOut: true });
});
app.get("/auth/me", async (req, res, next) => {
	if (prismaAuthEnabled) {
		try {
			const session = await resolvePrismaSession(req.header("authorization")?.replace(/^Bearer\s+/i, ""));
			if (!session) return sendError(res, 401, "Authentication is required");
			return ok(res, mapPrismaUser(session.user));
		} catch {
			return sendError(res, 503, "Authentication service is unavailable");
		}
	}
	return next();
}, auth(), (req, res) => ok(res, publicUser(currentUser(req))));
const forgotPasswordBody = z.object({ email: z.string().email() });
const resetPasswordBody = z.object({ token: z.string().trim().min(1), password: z.string().min(6).max(100) });
const PASSWORD_RESET_DURATION_MS = 60 * 60 * 1000;

app.post("/auth/forgot-password", validate(forgotPasswordBody), async (req, res) => {
	if (!prismaAuthEnabled) {
		return ok(res, { accepted: true, email: req.body.email, message: "Reset flow is prepared; email delivery is not connected." });
	}
	try {
		const email = req.body.email.toLowerCase();
		const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
		if (user) {
			const { tokenHash } = createPasswordResetToken();
			const now = new Date();
			await prisma.$transaction(async (tx) => {
				await tx.passwordResetToken.updateMany({
					where: { userId: user.id, usedAt: null, expiresAt: { gt: now } },
					data: { usedAt: now },
				});
				await tx.passwordResetToken.create({
					data: {
						userId: user.id,
						tokenHash,
						expiresAt: new Date(now.getTime() + PASSWORD_RESET_DURATION_MS),
					},
				});
			});
		}
		return ok(res, { accepted: true, email: req.body.email, message: "If an account exists for this email, password reset instructions will be sent." });
	} catch (error) {
		console.error("Prisma password reset request failed:", error);
		return sendError(res, 503, "Authentication service is unavailable");
	}
});

app.post("/auth/reset-password", validate(resetPasswordBody), async (req, res) => {
	if (!prismaAuthEnabled) {
		return sendError(res, 501, "Password reset is not available in legacy mode");
	}
	try {
		const passwordHash = await hashPassword(req.body.password);
		const now = new Date();
		const reset = await prisma.$transaction(async (tx) => {
			const token = await tx.passwordResetToken.findUnique({
				where: { tokenHash: hashToken(req.body.token) },
				select: { id: true, userId: true, usedAt: true, expiresAt: true },
			});
			if (!token || token.usedAt || token.expiresAt <= now) return null;
			const claimed = await tx.passwordResetToken.updateMany({
				where: { id: token.id, usedAt: null, expiresAt: { gt: now } },
				data: { usedAt: now },
			});
			if (claimed.count !== 1) return null;
			await tx.user.update({ where: { id: token.userId }, data: { passwordHash } });
			await tx.session.updateMany({
				where: { userId: token.userId, revokedAt: null },
				data: { revokedAt: now },
			});
			return token.userId;
		});
		if (!reset) return sendError(res, 400, "Invalid or expired password reset token");
		return ok(res, { reset: true });
	} catch (error) {
		console.error("Prisma password reset failed:", error);
		return sendError(res, 503, "Authentication service is unavailable");
	}
});

app.get("/courses", catalogAuth(false), async (req, res) => {
	const user = req.user;
	if (canUsePrismaReads()) {
		if (req.query.published === "false" && user?.role !== "admin" && user?.role !== "teacher") return sendError(res, 403, "Only admins and teachers can view unpublished courses");
		if (req.query.published === "false" && user?.role === "admin" && user.id !== "admin-demo" && !user.permissions?.includes("courses")) return sendError(res, 403, "لا تملك صلاحية الكورسات");
		const courses = await prismaReadOr503(res, () => prisma.course.findMany({
			where: req.query.published === "false" ? undefined : { published: true },
			include: { targetGrades: true, teachers: { include: { teacher: { include: { teacherProfile: true } } } }, teacherPlans: true },
		}));
		if (!courses) return;
		const prismaId = (req as Request & { prismaUserId?: string }).prismaUserId;
		const visibleCourses = user?.role === "student"
			? courses.filter((course) => !course.targetGrades.length || course.targetGrades.some((grade) => grade.grade === user.grade))
			: user?.role === "teacher"
				? courses.filter((course) => course.teachers.some((teacher) =>
					teacher.teacher.id === user.id ||
					teacher.teacherId === user.id ||
					(prismaId && (teacher.teacher.id === prismaId || teacher.teacherId === prismaId)) ||
					legacyUserId(teacher.teacher.email) === user.id ||
					(user.email && teacher.teacher.email.toLowerCase() === user.email.toLowerCase()) ||
					(user.name && teacher.teacher.name.toLowerCase() === user.name.toLowerCase())
				))
				: courses;
		return ok(res, visibleCourses.map((course) => mapPrismaCourse({
			...course,
			teachers: course.teachers.map((item) => ({
				teacher: item.teacher,
				teacherProfile: item.teacher.teacherProfile,
				courses: [{ courseId: course.id }],
				plans: course.teacherPlans.filter((plan) => plan.teacherId === item.teacherId),
			})),
		})));
	}
	if (user?.role === "admin" && user.id !== "admin-demo" && !user.permissions?.includes("courses")) return sendError(res, 403, "لا تملك صلاحية الكورسات");
	if (req.query.published === "false" && user?.role !== "admin" && user?.role !== "teacher") return sendError(res, 403, "Only admins and teachers can view unpublished courses");
	const visible = req.query.published === "false" ? store.courses : store.courses.filter((course) => course.published);
	const list = !user || user.role === "admin" ? visible : user.role === "student" ? visible.filter((course) => !course.targetGrades.length || course.targetGrades.includes(user.grade || "")) : visible.filter((course) => course.teacherIds.includes(user.id) || (user.name && course.teacherIds.includes(user.name)) || (user.email && course.teacherIds.includes(user.email)));
	return ok(res, list.map((course) => ({ ...course, teachers: course.teacherIds.map((teacherId) => store.teachers.find((teacher) => teacher.id === teacherId)).filter(Boolean) })));
});
app.get("/courses/:courseId", catalogAuth(false), async (req, res) => {
	const user = req.user;
	if (canUsePrismaReads()) {
		const prismaStudent = prismaAuthEnabled && user?.role === "student";
		const hasApprovedAccess = !prismaAuthEnabled || user?.role === "admin" || user?.role === "teacher"
			? true
			: prismaStudent
				? Boolean(await prisma.enrollment.findFirst({ where: { courseId: req.params.courseId, studentId: prismaUserId(req), status: "APPROVED" }, select: { id: true } }))
				: false;
		const course = await prismaReadOr503(res, () => prisma.course.findUnique({
			where: { id: req.params.courseId },
			include: {
				targetGrades: true,
				teachers: { include: { teacher: { include: { teacherProfile: true } } } },
				teacherPlans: true,
				lessons: { where: hasApprovedAccess ? undefined : { id: "00000000-0000-0000-0000-000000000000" } },
				exams: { where: hasApprovedAccess ? undefined : { id: "00000000-0000-0000-0000-000000000000" }, include: { questions: true } },
				_count: { select: { enrollments: { where: { status: "APPROVED" } } } },
			},
		}));
		if (!course) return sendError(res, 404, "Course not found");
		const prismaId = (req as Request & { prismaUserId?: string }).prismaUserId;
		if (user?.role === "teacher" && !course.teachers.some((teacher) =>
			teacher.teacher.id === user.id ||
			teacher.teacherId === user.id ||
			(prismaId && (teacher.teacher.id === prismaId || teacher.teacherId === prismaId)) ||
			legacyUserId(teacher.teacher.email) === user.id ||
			(user.email && teacher.teacher.email.toLowerCase() === user.email.toLowerCase()) ||
			(user.name && teacher.teacher.name.toLowerCase() === user.name.toLowerCase())
		)) return sendError(res, 403, "This course is not assigned to you");
		if (!course.published && user?.role !== "admin" && user?.role !== "teacher") return sendError(res, 404, "Course not found");
		const mappedCourse = mapPrismaCourse({
			...course,
			teachers: course.teachers.map((item) => ({
				teacher: item.teacher,
				teacherProfile: item.teacher.teacherProfile,
				courses: [{ courseId: course.id }],
				plans: course.teacherPlans.filter((plan) => plan.teacherId === item.teacherId),
			})),
		} as PrismaCourseRead);
		return ok(res, {
			...mappedCourse,
			enrolledStudentCount: course._count.enrollments,
			lessons: course.lessons.filter((lesson) => hasApprovedAccess || lesson.published).map(mapPrismaLesson),
			exams: course.exams.filter((exam) => hasApprovedAccess || exam.published).map((exam) => mapPrismaExam(exam, false)),
		});
	}
	const course = store.courses.find((item) => item.id === req.params.courseId);
	if (!course) return sendError(res, 404, "Course not found");
	if (user?.role === "admin" && user.id !== "admin-demo" && !user.permissions?.includes("courses")) return sendError(res, 403, "لا تملك صلاحية الكورسات");
	const isAssignedTeacher = user?.role === "teacher" && course.teacherIds.includes(user.id);
	if (!course.published && user?.role !== "admin" && !isAssignedTeacher) return sendError(res, 404, "Course not found");
	if (user?.role === "teacher" && !isAssignedTeacher) return sendError(res, 403, "This course is not assigned to you");
	const enrolledStudentIds = new Set(store.enrollments.filter((item) => item.courseId === course.id && item.status === "approved" && item.studentId).map((item) => item.studentId));
	return ok(res, { ...course, enrolledStudentCount: enrolledStudentIds.size, teachers: course.teacherIds.map((teacherId) => store.teachers.find((teacher) => teacher.id === teacherId)).filter(Boolean), lessons: store.lessons.filter((lesson) => lesson.courseId === course.id && (user?.role === "teacher" || user?.role === "admin" || lesson.published)), exams: store.exams.filter((exam) => exam.courseId === course.id && (user?.role === "teacher" || user?.role === "admin" || exam.published)).map((exam) => user?.role === "teacher" || user?.role === "admin" ? exam : { ...exam, questions: exam.questions.map(({ correctIndex: _correctIndex, ...question }) => question) }) });
});
app.post("/courses", catalogAuth(), allow("admin"), allowPermission("courses"), validate(courseBody), async (req, res) => {
	const body = req.body as z.infer<typeof courseBody>;
	if (prismaAuthEnabled) {
		try {
			const course = await createPrismaCourse(body);
			return ok(res, mapPrismaCourse({
				...course,
				teachers: course.teachers.map((item) => ({ teacher: item.teacher, teacherProfile: item.teacher.teacherProfile, courses: [{ courseId: course.id }], plans: course.teacherPlans.filter((plan) => plan.teacherId === item.teacherId) })),
			} as PrismaCourseRead), 201);
		} catch (error) {
			if (error instanceof Error && (error.message.includes("already exists") || error.message.includes("unique"))) return sendError(res, 400, "id, unique title, and a valid slug are required");
			if (error instanceof Error && error.message.includes("teacher")) return sendError(res, 400, error.message);
			console.error("Prisma course creation failed:", error);
			return sendError(res, 503, "Course service is unavailable");
		}
	}
	if (store.courses.some((item) => item.id === body.id)) return sendError(res, 400, "id, unique title, and a valid slug are required");
	const teacherIds = body.teacherPlans.map((plan) => plan.teacherId);
	if (new Set(teacherIds).size !== teacherIds.length) return sendError(res, 400, "A teacher can only be assigned once per course");
	if (teacherIds.some((teacherId) => !store.teachers.some((teacher) => teacher.id === teacherId))) return sendError(res, 400, "Every selected teacher must exist");
	const course = { ...body, teacherIds, lessonCount: 0 }; store.courses.push(course);
	teacherIds.forEach((teacherId) => { const teacher = store.teachers.find((item) => item.id === teacherId); if (teacher && !teacher.courseIds.includes(course.id)) teacher.courseIds.push(course.id); });
	return ok(res, course, 201);
});
app.patch("/courses/:courseId", catalogAuth(), allow("admin"), allowPermission("courses"), validate(coursePatchBody), async (req, res) => {
	const body = req.body as z.infer<typeof coursePatchBody>;
	if (prismaAuthEnabled) {
		try {
			const course = await updatePrismaCourse(req.params.courseId, body);
			if (!course) return sendError(res, 404, "Course not found");
			return ok(res, mapPrismaCourse({
				...course,
				teachers: course.teachers.map((item) => ({ teacher: item.teacher, teacherProfile: item.teacher.teacherProfile, courses: [{ courseId: course.id }], plans: course.teacherPlans.filter((plan) => plan.teacherId === item.teacherId) })),
			} as PrismaCourseRead));
		} catch (error) {
			if (error instanceof Error && error.message.includes("teacher")) return sendError(res, 400, error.message);
			console.error("Prisma course update failed:", error);
			return sendError(res, 503, "Course service is unavailable");
		}
	}
	const course = store.courses.find((item) => item.id === req.params.courseId);
	if (!course) return sendError(res, 404, "Course not found");
	if (body.teacherPlans) { const teacherIds = body.teacherPlans.map((plan) => plan.teacherId); if (new Set(teacherIds).size !== teacherIds.length) return sendError(res, 400, "A teacher can only be assigned once per course"); if (teacherIds.some((teacherId) => !store.teachers.some((teacher) => teacher.id === teacherId))) return sendError(res, 400, "Every selected teacher must exist"); const previousTeacherIds = course.teacherIds; course.teacherPlans = body.teacherPlans; course.teacherIds = teacherIds; previousTeacherIds.filter((teacherId) => !teacherIds.includes(teacherId)).forEach((teacherId) => { const teacher = store.teachers.find((item) => item.id === teacherId); if (teacher) teacher.courseIds = teacher.courseIds.filter((id) => id !== course.id); }); teacherIds.forEach((teacherId) => { const teacher = store.teachers.find((item) => item.id === teacherId); if (teacher && !teacher.courseIds.includes(course.id)) teacher.courseIds.push(course.id); }); }
	const { teacherPlans: _teacherPlans, ...courseFields } = body; Object.assign(course, courseFields); return ok(res, course);
});

app.get("/users", adminUsersAuth, allow("admin"), allowAnyPermission("users"), async (req, res) => {
	const requestedRole = role.safeParse(req.query.role);
	if (req.query.role && !requestedRole.success) return sendError(res, 400, "Invalid user role");
	if (prismaAuthEnabled) {
		const requestedStatus = z.enum(["pending", "approved", "rejected"]).safeParse(req.query.status);
		if (req.query.status && !requestedStatus.success) return sendError(res, 400, "Invalid user status");
		try {
			const users = await prisma.user.findMany({
				where: {
					...(requestedRole.success ? { role: prismaRoleMap[requestedRole.data] } : {}),
					...(requestedStatus.success ? { status: requestedStatus.data.toUpperCase() as "PENDING" | "APPROVED" | "REJECTED" } : {}),
				},
				include: { permissions: true },
				orderBy: { createdAt: "desc" },
			});
			return ok(res, users.map(mapPrismaUser));
		} catch {
			return sendError(res, 503, "User service is unavailable");
		}
	}
	const users = store.users.filter((user) => (!req.query.role || (requestedRole.success && user.role === requestedRole.data)) && (!req.query.status || user.status === req.query.status));
	return ok(res, users.map(publicUser));
});
app.patch("/users/:userId/status", adminUsersAuth, allow("admin"), allowAnyPermission("users"), async (req, res) => {
	const status = z.enum(["pending", "approved", "rejected"]).safeParse(req.body.status);
	if (!status.success) return sendError(res, 400, "Invalid status");
	if (prismaAuthEnabled) {
		try {
			const user = await prisma.user.update({
				where: { id: req.params.userId },
				data: { status: status.data.toUpperCase() as "PENDING" | "APPROVED" | "REJECTED" },
				include: { permissions: true },
			});
			return ok(res, mapPrismaUser(user));
		} catch (error) {
			if (error && typeof error === "object" && "code" in error && error.code === "P2025") return sendError(res, 404, "User not found");
			return sendError(res, 503, "User service is unavailable");
		}
	}
	const user = store.users.find(u => u.id === req.params.userId);
	if (!user) return sendError(res, 404, "User not found");
	user.status = status.data;
	return ok(res, publicUser(user));
});
app.patch("/users/:userId/permissions", adminUsersAuth, allow("admin"), allowPrismaPrimaryAdmin, async (req, res) => {
	const permissions = z.array(permission).safeParse(req.body.permissions);
	if (!permissions.success) return sendError(res, 400, "Invalid permissions");
	if (prismaAuthEnabled) {
		try {
			const updatedUser = await prisma.$transaction(async (tx) => {
				const targetUser = await tx.user.findUnique({ where: { id: req.params.userId } });
				if (!targetUser) return null;
				await tx.userPermission.deleteMany({ where: { userId: targetUser.id } });
				if (permissions.data.length) {
					await tx.userPermission.createMany({
						data: permissions.data.map((value) => ({ userId: targetUser.id, permission: permissionEnumMap[value] })),
					});
				}
				return tx.user.findUnique({ where: { id: targetUser.id }, include: { permissions: true } });
			});
			if (!updatedUser) return sendError(res, 404, "User not found");
			return ok(res, mapPrismaUser(updatedUser));
		} catch {
			return sendError(res, 503, "User service is unavailable");
		}
	}
	const user = store.users.find(item => item.id === req.params.userId);
	if (!user) return sendError(res, 404, "User not found");
	user.permissions = user.id === "admin-demo" ? [...permissionKeys] : permissions.data;
	return ok(res, publicUser(user));
});
app.get("/teachers", optionalTeacherAuth, async (_req, res) => {
	if (prismaAuthEnabled || canUsePrismaReads()) {
		const teachers = await prismaReadOr503(res, () => prisma.user.findMany({ where: { role: "TEACHER", status: "APPROVED" }, include: { teacherProfile: true, teachingCourses: true, coursePlans: true } }));
		if (!teachers) return;
		return ok(res, teachers.map((teacher) => mapPrismaTeacher({ teacher, teacherProfile: teacher.teacherProfile, courses: teacher.teachingCourses, plans: teacher.coursePlans })));
	}
	const visibleTeachers = store.teachers.filter(t => {
		const u = store.users.find(user => user.id === t.id);
		return !u || u.status === "approved";
	});
	ok(res, visibleTeachers);
});
app.get("/teachers/:teacherId", optionalTeacherAuth, async (req, res) => {
	if (prismaAuthEnabled || canUsePrismaReads()) {
		const teachers = await prismaReadOr503(res, () => prisma.user.findMany({ where: { role: "TEACHER", status: "APPROVED" }, include: { teacherProfile: true, teachingCourses: { include: { course: true } }, coursePlans: true } }));
		if (!teachers) return;
		const teacher = teachers.find((item) => item.id === req.params.teacherId || legacyUserId(item.email) === req.params.teacherId);
		if (!teacher) return sendError(res, 404, "Teacher not found");
		return ok(res, {
			...mapPrismaTeacher({ teacher, teacherProfile: teacher.teacherProfile, courses: teacher.teachingCourses, plans: teacher.coursePlans }),
			courses: teacher.teachingCourses.map((item) => {
				const mapped = mapPrismaCourse({ ...item.course, targetGrades: [], teachers: [], teacherPlans: [] });
				const { teachers: _teachers, ...course } = mapped;
				return course;
			}),
		});
	}
	const teacher = store.teachers.find((item) => item.id === req.params.teacherId);
	if (!teacher) return sendError(res, 404, "Teacher not found");
	return ok(res, { ...teacher, courses: store.courses.filter((course) => teacher.courseIds.includes(course.id)) });
});
app.post("/teachers", catalogAuth(), allow("admin"), allowPermission("users"), validate(teacherBody), async (req, res) => {
	if (prismaAuthEnabled) {
		try {
			const teacher = await createPrismaTeacher(req.body);
			return ok(res, mapPrismaTeacher({ teacher, teacherProfile: teacher.teacherProfile, courses: teacher.teachingCourses, plans: teacher.coursePlans }), 201);
		} catch (error) {
			console.error("Prisma teacher creation failed:", error);
			return sendError(res, 503, "Teacher service is unavailable");
		}
	}
	const teacher = { id: id("teacher"), ...req.body, courseIds: [], plans: [] };
	store.teachers.push(teacher);
	return ok(res, teacher, 201);
});
app.patch("/teachers/:teacherId", catalogAuth(), allow("admin", "teacher"), allowPermission("users"), validate(teacherPatchBody), async (req, res) => {
	if (prismaAuthEnabled) {
		try {
			const teacherId = await resolvePrismaTeacherId(prisma, req.params.teacherId);
			if (currentUser(req).role === "teacher" && req.params.teacherId !== currentUser(req).id && currentUser(req).id !== "teacher-demo") return sendError(res, 403, "Cannot edit another teacher");
			const teacher = await updatePrismaTeacher(req.params.teacherId, req.body);
			if (!teacher) return sendError(res, 404, "Teacher not found");
			return ok(res, mapPrismaTeacher({ teacher, teacherProfile: teacher.teacherProfile, courses: teacher.teachingCourses, plans: teacher.coursePlans }));
		} catch (error) {
			console.error("Prisma teacher update failed:", error);
			return sendError(res, 503, "Teacher service is unavailable");
		}
	}
	const teacher = store.teachers.find((item) => item.id === req.params.teacherId);
	if (!teacher) return sendError(res, 404, "Teacher not found");
	if (currentUser(req).role === "teacher" && currentUser(req).id !== teacher.id && currentUser(req).id !== "teacher-demo") return sendError(res, 403, "Cannot edit another teacher");
	Object.assign(teacher, req.body);
	return ok(res, teacher);
});

app.get("/lessons", prismaProtectedAuth, async (req, res) => {
	if (prismaAuthEnabled) {
		const user = currentUser(req);
		const where: any = {};
		if (req.query.courseId) {
			where.courseId = String(req.query.courseId);
			if (user.role === "student") {
				where.published = true;
			}
		} else if (user.role === "teacher") {
			const courseIds = (await prisma.courseTeacher.findMany({ where: { teacherId: prismaUserId(req) }, select: { courseId: true } })).map((item) => item.courseId);
			if (courseIds.length === 0) return ok(res, []);
			where.courseId = { in: courseIds };
		} else if (user.role === "student") {
			const approvedCourses = await prisma.enrollment.findMany({ where: { studentId: prismaUserId(req), status: "APPROVED" }, select: { courseId: true } });
			where.courseId = { in: approvedCourses.map((item) => item.courseId) };
			where.published = true;
		}
		const lessons = await prisma.lesson.findMany({ where, orderBy: { createdAt: "desc" } });
		return ok(res, lessons.map((lesson) => ({ id: lesson.id, courseId: lesson.courseId, title: lesson.title, description: lesson.description, lectureUrl: lesson.lectureUrl, ...(lesson.resourceUrl ? { resourceUrl: lesson.resourceUrl } : {}), ...(lesson.unit ? { unit: lesson.unit } : {}), teacherId: lesson.teacherId, published: lesson.published, createdAt: lesson.createdAt.toISOString() })));
	}
	const user = currentUser(req); const ownedCourseIds = user.role === "teacher" ? store.courses.filter((course) => course.teacherIds.includes(user.id)).map((course) => course.id) : undefined; const list = store.lessons.filter((lesson) => (!req.query.courseId || lesson.courseId === req.query.courseId) && (user.role !== "teacher" || ownedCourseIds?.includes(lesson.courseId)) && (user.role !== "student" || lesson.published)); return ok(res, list);
});
app.post("/lessons", prismaProtectedAuth, allow("teacher", "admin"), allowPermission("content"), validate(lessonBody), async (req, res) => {
	const body = req.body as z.infer<typeof lessonBody>;
	if (prismaAuthEnabled) {
		try {
			const course = await prisma.course.findUnique({ where: { id: body.courseId }, include: { teachers: { select: { teacherId: true } } } });
			if (!course) return sendError(res, 404, "Course not found");
			const current = currentUser(req);
			const teacherId = current.role === "teacher" ? prismaUserId(req) : course.teachers[0]?.teacherId || null;
			if (!teacherId) return sendError(res, 403, "You can only add lessons to your courses");
			if (current.role === "teacher" && !course.teachers.some((item) => item.teacherId === teacherId)) return sendError(res, 403, "You can only add lessons to your courses");
			const lesson = await prisma.$transaction(async (tx) => {
				const created = await tx.lesson.create({ data: { courseId: body.courseId, teacherId, title: body.title, description: body.description, lectureUrl: body.lectureUrl, resourceUrl: body.resourceUrl || null, unit: body.unit || null, published: body.published } });
				await tx.course.update({ where: { id: body.courseId }, data: { lessonCount: { increment: 1 } } });
				return created;
			});
			return ok(res, { id: lesson.id, courseId: lesson.courseId, title: lesson.title, description: lesson.description, lectureUrl: lesson.lectureUrl, ...(lesson.resourceUrl ? { resourceUrl: lesson.resourceUrl } : {}), ...(lesson.unit ? { unit: lesson.unit } : {}), teacherId: lesson.teacherId, published: lesson.published, createdAt: lesson.createdAt.toISOString() }, 201);
		} catch (error) {
			console.error("Prisma lesson creation failed:", error);
			return sendError(res, 503, "Lesson service is unavailable");
		}
	}
	const teacherId = currentUser(req).role === "teacher" ? currentUser(req).id : "teacher-demo"; const course = store.courses.find((item) => item.id === body.courseId); if (!course || (currentUser(req).role === "teacher" && !course.teacherIds.includes(teacherId))) return sendError(res, 403, "You can only add lessons to your courses"); const lesson = { id: id("lesson"), ...body, teacherId, createdAt: timestamp() }; store.lessons.unshift(lesson); course.lessonCount = store.lessons.filter((item) => item.courseId === course.id).length; return ok(res, lesson, 201);
});
app.patch("/lessons/:lessonId", prismaProtectedAuth, allow("teacher", "admin"), allowPermission("content"), async (req, res) => {
	if (prismaAuthEnabled) {
		const user = currentUser(req);
		const lesson = await prisma.lesson.findUnique({ where: { id: req.params.lessonId } });
		if (!lesson) return sendError(res, 404, "Lesson not found");
		if (user.role === "teacher") {
			const teacherInCourse = await prisma.courseTeacher.findFirst({ where: { courseId: lesson.courseId, teacherId: prismaUserId(req) } });
			if (!teacherInCourse) return sendError(res, 403, "This lesson is not in one of your courses");
		}
		const updates: { title?: string; description?: string; lectureUrl?: string; resourceUrl?: string | null; unit?: string | null; published?: boolean } = {};
		if (typeof req.body.title === "string") updates.title = req.body.title;
		if (typeof req.body.description === "string") updates.description = req.body.description;
		if (typeof req.body.lectureUrl === "string") updates.lectureUrl = req.body.lectureUrl;
		if (typeof req.body.resourceUrl === "string" || req.body.resourceUrl === null) updates.resourceUrl = req.body.resourceUrl || null;
		if (typeof req.body.unit === "string" || req.body.unit === null) updates.unit = req.body.unit || null;
		if (typeof req.body.published === "boolean") updates.published = req.body.published;
		if (Object.keys(updates).length === 0) return sendError(res, 400, "Invalid lesson update");
		const updated = await prisma.lesson.update({ where: { id: lesson.id }, data: updates });
		return ok(res, { id: updated.id, courseId: updated.courseId, title: updated.title, description: updated.description, lectureUrl: updated.lectureUrl, ...(updated.resourceUrl ? { resourceUrl: updated.resourceUrl } : {}), ...(updated.unit ? { unit: updated.unit } : {}), teacherId: updated.teacherId, published: updated.published, createdAt: updated.createdAt.toISOString() });
	}
	const lesson = store.lessons.find((item) => item.id === req.params.lessonId); if (!lesson) return sendError(res, 404, "Lesson not found"); if (currentUser(req).role === "teacher" && !store.courses.find((course) => course.id === lesson.courseId)?.teacherIds.includes(currentUser(req).id)) return sendError(res, 403, "This lesson is not in one of your courses"); Object.assign(lesson, req.body); return ok(res, lesson);
});
app.delete("/lessons/:lessonId", prismaProtectedAuth, allow("teacher", "admin"), allowPermission("content"), async (req, res) => {
	if (prismaAuthEnabled) {
		const user = currentUser(req);
		const lesson = await prisma.lesson.findUnique({ where: { id: req.params.lessonId } });
		if (!lesson) return sendError(res, 404, "Lesson not found");
		if (user.role === "teacher") {
			const teacherInCourse = await prisma.courseTeacher.findFirst({ where: { courseId: lesson.courseId, teacherId: prismaUserId(req) } });
			if (!teacherInCourse) return sendError(res, 403, "Cannot delete another teacher's lesson");
		}
		await prisma.$transaction(async (tx) => {
			await tx.lesson.delete({ where: { id: lesson.id } });
			await tx.course.update({ where: { id: lesson.courseId }, data: { lessonCount: { decrement: 1 } } });
		});
		return res.sendStatus(204);
	}
	const index = store.lessons.findIndex((item) => item.id === req.params.lessonId); if (index < 0) return sendError(res, 404, "Lesson not found"); if (currentUser(req).role === "teacher" && store.lessons[index].teacherId !== currentUser(req).id) return sendError(res, 403, "Cannot delete another teacher's lesson"); const courseId = store.lessons[index].courseId; store.lessons.splice(index, 1); const course = store.courses.find((item) => item.id === courseId); if (course) course.lessonCount = store.lessons.filter((item) => item.courseId === courseId).length; return res.sendStatus(204);
});

app.get("/exams", prismaProtectedAuth, async (req, res) => {
	if (prismaAuthEnabled) {
		const user = currentUser(req);
		const where: { courseId?: { in: string[] }; published?: boolean } = {};
		if (user.role === "teacher") {
			const courseIds = (await prisma.courseTeacher.findMany({ where: { teacherId: prismaUserId(req) }, select: { courseId: true } })).map((item) => item.courseId);
			if (courseIds.length === 0) return ok(res, []);
			where.courseId = { in: courseIds };
		} else if (user.role === "student") {
			const approvedCourses = await prisma.enrollment.findMany({ where: { studentId: prismaUserId(req), status: "APPROVED" }, select: { courseId: true } });
			where.courseId = { in: approvedCourses.map((item) => item.courseId) };
			where.published = true;
		}
		const exams = await prisma.exam.findMany({ where, include: { questions: true }, orderBy: { createdAt: "desc" } });
		return ok(res, exams.map((exam) => ({ id: exam.id, courseId: exam.courseId, title: exam.title, description: exam.description, duration: exam.durationMinutes, ...(exam.resultVisibility !== "IMMEDIATE" ? { resultVisibility: exam.resultVisibility.toLowerCase() } : {}), teacherId: exam.teacherId, published: exam.published, createdAt: exam.createdAt.toISOString(), questionCount: exam.questions.length })));
	}
	const user = currentUser(req); const ownedCourseIds = user.role === "teacher" ? store.courses.filter((course) => course.teacherIds.includes(user.id)).map((course) => course.id) : undefined; return ok(res, store.exams.filter((exam) => (!req.query.courseId || exam.courseId === req.query.courseId) && (user.role !== "teacher" || ownedCourseIds?.includes(exam.courseId)) && (user.role !== "student" || exam.published)).map(({ questions, ...exam }) => ({ ...exam, questionCount: questions.length })));
});
app.get("/exams/:examId", prismaProtectedAuth, async (req, res) => {
	if (prismaAuthEnabled) {
		const user = currentUser(req);
		const exam = await prisma.exam.findUnique({ where: { id: req.params.examId }, include: { questions: true } });
		if (!exam) return sendError(res, 404, "Exam not found");
		if (user.role === "teacher") {
			const teacherInCourse = await prisma.courseTeacher.findFirst({ where: { courseId: exam.courseId, teacherId: prismaUserId(req) } });
			if (!teacherInCourse) return sendError(res, 403, "This exam is not assigned to you");
		}
		if (user.role === "student" && !exam.published) return sendError(res, 404, "Exam not found");
		if (user.role === "student") {
			const approved = await prisma.enrollment.findFirst({ where: { courseId: exam.courseId, studentId: prismaUserId(req), status: "APPROVED" }, select: { id: true } });
			if (!approved) return sendError(res, 404, "Exam not found");
		}
		const response = {
			id: exam.id,
			courseId: exam.courseId,
			title: exam.title,
			description: exam.description,
			duration: exam.durationMinutes,
			...(exam.resultVisibility !== "IMMEDIATE" ? { resultVisibility: exam.resultVisibility.toLowerCase() } : {}),
			teacherId: exam.teacherId,
			published: exam.published,
			createdAt: exam.createdAt.toISOString(),
			questions: user.role === "student" ? exam.questions.map(({ correctIndex: _correctIndex, ...question }) => ({ ...question, ...(question.marks !== null ? { marks: Number(question.marks) } : {}) })) : exam.questions.map((question) => ({ ...question, ...(question.marks !== null ? { marks: Number(question.marks) } : {}) })),
		};
		return ok(res, response);
	}
	const exam = store.exams.find((item) => item.id === req.params.examId); if (!exam) return sendError(res, 404, "Exam not found"); const user = currentUser(req); if (user.role === "teacher" && !store.courses.find((course) => course.id === exam.courseId)?.teacherIds.includes(user.id)) return sendError(res, 403, "This exam is not assigned to you"); if (user.role === "student" && !exam.published) return sendError(res, 404, "Exam not found"); return ok(res, user.role === "student" ? { ...exam, questions: exam.questions.map(({ correctIndex: _correctIndex, ...question }) => question) } : exam);
});
app.post("/exams", prismaProtectedAuth, allow("teacher", "admin"), allowPermission("content"), validate(examBody), async (req, res) => {
	const body = req.body as z.infer<typeof examBody>;
	if (prismaAuthEnabled) {
		try {
			const course = await prisma.course.findUnique({ where: { id: body.courseId }, include: { teachers: { select: { teacherId: true } } } });
			if (!course) return sendError(res, 404, "Course not found");
			const current = currentUser(req);
			const teacherId = current.role === "teacher" ? prismaUserId(req) : course.teachers[0]?.teacherId || null;
			if (!teacherId) return sendError(res, 403, "You can only add exams to your courses");
			if (current.role === "teacher") {
				const courseTeacher = await prisma.courseTeacher.findFirst({ where: { courseId: body.courseId, teacherId } });
				if (!courseTeacher) return sendError(res, 403, "You can only add exams to your courses");
			}
			const exam = await prisma.exam.create({
				data: {
					courseId: body.courseId,
					teacherId,
					title: body.title,
					description: body.description,
					durationMinutes: body.duration,
					resultVisibility: body.resultVisibility === "after_review" ? "AFTER_REVIEW" : "IMMEDIATE",
					published: body.published,
					questions: { create: body.questions.map((question) => ({ prompt: question.prompt, choices: question.choices, correctIndex: question.correctIndex, marks: question.marks ?? 1, position: 0 })) },
				},
				include: { questions: true },
			});
			return ok(res, { id: exam.id, courseId: exam.courseId, title: exam.title, description: exam.description, duration: exam.durationMinutes, ...(exam.resultVisibility !== "IMMEDIATE" ? { resultVisibility: exam.resultVisibility.toLowerCase() } : {}), teacherId: exam.teacherId, published: exam.published, createdAt: exam.createdAt.toISOString(), questions: exam.questions.map((question) => ({ id: question.id, prompt: question.prompt, choices: question.choices as string[], correctIndex: question.correctIndex, marks: Number(question.marks) })) }, 201);
		} catch (error) {
			console.error("Prisma exam creation failed:", error);
			return sendError(res, 503, "Exam service is unavailable");
		}
	}
	const teacherId = currentUser(req).role === "teacher" ? currentUser(req).id : "teacher-demo"; const course = store.courses.find((item) => item.id === body.courseId); if (!course || (currentUser(req).role === "teacher" && !course.teacherIds.includes(teacherId))) return sendError(res, 403, "You can only add exams to your courses"); const exam = { id: id("exam"), ...body, questions: body.questions.map((item: z.infer<typeof question>) => ({ id: id("question"), ...item })), teacherId, createdAt: timestamp() }; store.exams.unshift(exam); return ok(res, exam, 201);
});
app.patch("/exams/:examId", prismaProtectedAuth, allow("teacher", "admin"), allowPermission("content"), async (req, res) => {
	if (prismaAuthEnabled) {
		const user = currentUser(req);
		const exam = await prisma.exam.findUnique({ where: { id: req.params.examId } });
		if (!exam) return sendError(res, 404, "Exam not found");
		if (user.role === "teacher") {
			const teacherInCourse = await prisma.courseTeacher.findFirst({ where: { courseId: exam.courseId, teacherId: prismaUserId(req) } });
			if (!teacherInCourse) return sendError(res, 403, "This exam is not in one of your courses");
		}
		const updates: { title?: string; description?: string; durationMinutes?: number; published?: boolean; resultVisibility?: "IMMEDIATE" | "AFTER_REVIEW" } = {};
		if (typeof req.body.title === "string") updates.title = req.body.title;
		if (typeof req.body.description === "string") updates.description = req.body.description;
		if (typeof req.body.duration === "number") updates.durationMinutes = req.body.duration;
		if (typeof req.body.published === "boolean") updates.published = req.body.published;
		if (typeof req.body.resultVisibility === "string") updates.resultVisibility = req.body.resultVisibility === "after_review" ? "AFTER_REVIEW" : "IMMEDIATE";
		if (Object.keys(updates).length === 0) return sendError(res, 400, "Invalid exam update");
		const updated = await prisma.exam.update({ where: { id: exam.id }, data: updates, include: { questions: true } });
		return ok(res, { id: updated.id, courseId: updated.courseId, title: updated.title, description: updated.description, duration: updated.durationMinutes, ...(updated.resultVisibility !== "IMMEDIATE" ? { resultVisibility: updated.resultVisibility.toLowerCase() } : {}), teacherId: updated.teacherId, published: updated.published, createdAt: updated.createdAt.toISOString(), questions: updated.questions.map((question) => ({ id: question.id, prompt: question.prompt, choices: question.choices as string[], correctIndex: question.correctIndex, marks: Number(question.marks) })) });
	}
	const exam = store.exams.find((item) => item.id === req.params.examId); if (!exam) return sendError(res, 404, "Exam not found"); if (currentUser(req).role === "teacher" && !store.courses.find((course) => course.id === exam.courseId)?.teacherIds.includes(currentUser(req).id)) return sendError(res, 403, "This exam is not in one of your courses"); Object.assign(exam, req.body); return ok(res, exam);
});

const submissionBody = z.object({ answers: z.array(z.number().int().nonnegative()) });
app.post("/exams/:examId/submissions", prismaProtectedAuth, allow("student"), validate(submissionBody), async (req, res) => {
	if (prismaAuthEnabled) {
		const exam = await prisma.exam.findUnique({ where: { id: req.params.examId }, include: { questions: true } });
		if (!exam) return sendError(res, 404, "Exam not found");
		const approved = await prisma.enrollment.findFirst({ where: { courseId: exam.courseId, studentId: prismaUserId(req), status: "APPROVED" }, select: { id: true } });
		if (!approved) return sendError(res, 403, "Course approval is required");
		const existing = await prisma.examSubmission.findUnique({ where: { examId_studentId: { examId: exam.id, studentId: prismaUserId(req) } } });
		if (existing) {
			return sendError(res, 400, "لقد قمت بتسليم هذا الامتحان بالفعل ولا يمكن تعديل الإجابات");
		}
		const answers = req.body.answers as number[];
		const totalMarks = exam.questions.reduce((sum, item) => sum + Number(item.marks || 1), 0);
		const earnedMarks = exam.questions.reduce((sum, item, index) => sum + (answers[index] === item.correctIndex ? Number(item.marks || 1) : 0), 0);
		const score = totalMarks > 0 ? Math.round((earnedMarks / totalMarks) * 100) : 0;
		const created = await prisma.examSubmission.create({ data: { examId: exam.id, studentId: prismaUserId(req), score: score, reviewed: false, answers: { create: answers.map((selectedIndex, index) => ({ questionId: exam.questions[index].id, selectedIndex })) } } });
		return ok(res, { id: created.id, examId: created.examId, studentId: created.studentId, answers, score: Number(created.score), reviewed: created.reviewed, submittedAt: created.submittedAt.toISOString() }, 201);
	}
	const exam = store.exams.find((item) => item.id === req.params.examId); if (!exam) return sendError(res, 404, "Exam not found"); const existing = store.submissions.find((item) => item.examId === exam.id && item.studentId === currentUser(req).id); if (existing) return sendError(res, 400, "لقد قمت بتسليم هذا الامتحان بالفعل ولا يمكن تعديل الإجابات"); const answers = req.body.answers as number[]; const totalMarks = exam.questions.reduce((sum, item) => sum + (item.marks || 1), 0); const earnedMarks = exam.questions.reduce((sum, item, index) => sum + (answers[index] === item.correctIndex ? item.marks || 1 : 0), 0); const submission = { id: id("submission"), examId: exam.id, studentId: currentUser(req).id, score: Math.round((earnedMarks / totalMarks) * 100), reviewed: false, submittedAt: timestamp(), answers }; store.submissions.push(submission); return ok(res, submission, 201);
});
app.get("/submissions", prismaProtectedAuth, async (req, res) => {
	if (prismaAuthEnabled) {
		const user = currentUser(req);
		const submissions = await prisma.examSubmission.findMany({
			where: user.role === "student"
				? { studentId: prismaUserId(req), exam: { course: { enrollments: { some: { studentId: prismaUserId(req), status: "APPROVED" as const } } } } }
				: user.role === "teacher"
					? { exam: { teacherId: prismaUserId(req) } }
					: undefined,
			include: { exam: { include: { questions: true } }, student: true, answers: true },
			orderBy: { submittedAt: "desc" },
		});
		return ok(res, submissions.map((submission) => ({
			id: submission.id,
			examId: submission.examId,
			studentId: submission.studentId,
			score: user.role === "student" && submission.exam.resultVisibility === "AFTER_REVIEW" && !submission.reviewed ? null : Number(submission.score),
			reviewed: submission.reviewed,
			submittedAt: submission.submittedAt.toISOString(),
			studentName: submission.student.name,
			exam: {
				id: submission.exam.id,
				title: submission.exam.title,
				questions: submission.exam.questions.map((q) => ({
					id: q.id,
					prompt: q.prompt,
					choices: q.choices as string[],
					correctIndex: q.correctIndex,
					marks: Number(q.marks),
				})),
			},
			answers: submission.answers.map((a) => ({
				questionId: a.questionId,
				selectedIndex: a.selectedIndex,
			})),
		})));
	}
	const user = currentUser(req); const list = user.role === "student" ? store.submissions.filter((item) => item.studentId === user.id) : user.role === "teacher" ? store.submissions.filter((item) => store.exams.find((exam) => exam.id === item.examId)?.teacherId === user.id) : store.submissions; return ok(res, list.map((item) => { const exam = store.exams.find((candidate) => candidate.id === item.examId); const hidden = user.role === "student" && exam?.resultVisibility === "after_review" && !item.reviewed; return { ...item, score: hidden ? null : item.score, studentName: store.users.find((student) => student.id === item.studentId)?.name || "طالب", exam }; }));
});
const scoreReviewPatch = async (req: Request, res: Response) => {
	if (prismaAuthEnabled) {
		const user = currentUser(req);
		const submission = await prisma.examSubmission.findUnique({ where: { id: req.params.submissionId }, include: { exam: true } });
		if (!submission) return sendError(res, 404, "Submission not found");
		if (user.role === "teacher" && submission.exam.teacherId !== prismaUserId(req)) return sendError(res, 403, "Cannot review this submission");
		const score = z.number().min(0).max(1000).nullable().safeParse(req.body.score); if (!score.success) return sendError(res, 400, "score must be between 0 and 1000");
		const updated = await prisma.examSubmission.update({ where: { id: submission.id }, data: { score: score.data === null ? null : score.data, reviewed: true, reviewedAt: new Date(), reviewedBy: user.role === "admin" ? null : prismaUserId(req) } });
		return ok(res, { id: updated.id, examId: updated.examId, studentId: updated.studentId, score: updated.score === null ? null : Number(updated.score), reviewed: updated.reviewed, submittedAt: updated.submittedAt.toISOString() });
	}
	const submission = store.submissions.find((item) => item.id === req.params.submissionId); if (!submission) return sendError(res, 404, "Submission not found"); if (currentUser(req).role === "teacher" && store.exams.find((exam) => exam.id === submission.examId)?.teacherId !== currentUser(req).id) return sendError(res, 403, "Cannot review this submission"); const score = z.number().min(0).max(1000).nullable().safeParse(req.body.score); if (!score.success) return sendError(res, 400, "score must be between 0 and 1000"); Object.assign(submission, { score: score.data, reviewed: true }); return ok(res, submission);
};
app.patch("/submissions/:submissionId", prismaProtectedAuth, allow("teacher", "admin"), scoreReviewPatch);
app.patch("/submissions/:submissionId/score", prismaProtectedAuth, allow("teacher", "admin"), scoreReviewPatch);
app.patch("/submissions/:submissionId/grade", prismaProtectedAuth, allow("teacher", "admin"), scoreReviewPatch);

app.get("/enrollments", prismaProtectedAuth, async (req, res) => {
	if (prismaAuthEnabled) {
		const user = currentUser(req);
		const where = user.role === "student"
			? { studentId: prismaUserId(req), status: "APPROVED" as const }
			: user.role === "teacher"
				? { teacherId: prismaUserId(req) }
				: {};
		const enrollments = await prisma.enrollment.findMany({ where, include: { course: true, student: true }, orderBy: { createdAt: "desc" } });
		return ok(res, enrollments.map((item) => ({ id: item.id, studentId: item.studentId, courseId: item.courseId, teacherId: item.teacherId, studentName: item.studentNameSnapshot, studentPhone: item.studentPhoneSnapshot, parentPhone: item.parentPhoneSnapshot, grade: item.gradeSnapshot, bookingType: item.bookingType, unit: item.unit || undefined, amount: Number(item.amount), transferImage: item.transferImageUrl || undefined, status: item.status.toLowerCase(), createdAt: item.createdAt.toISOString(), courseTitle: item.course.title, student: item.student ? { id: item.student.id, name: item.student.name, email: item.student.email, role: item.student.role.toLowerCase(), status: item.student.status.toLowerCase() } : undefined })));
	}
	const user = currentUser(req);
	store.enrollments.forEach((e) => {
		const course = store.courses.find((c) => c.id === e.courseId);
		const plan = course?.teacherPlans?.find((p) => p.teacherId === e.teacherId);
		const teacherObj = store.teachers.find((t) => t.id === e.teacherId);
		const basePrice = Number(e.bookingType === "شهري" ? plan?.monthlyPrice : e.bookingType === "بالحصة" ? plan?.lessonPrice : plan?.chapterPrice);
		if (basePrice > 0) {
			const discountEnabled = plan?.discountEnabled ?? (teacherObj as any)?.discountEnabled;
			const discountKind = plan?.discountKind ?? (teacherObj as any)?.discountKind;
			const discountValue = plan?.discountValue ?? (teacherObj as any)?.discountValue;
			const discounted = calculateEnrollmentAmount(basePrice, discountEnabled, discountKind, discountValue);
			if (discounted > 0) {
				(e as any).amount = discounted;
			}
		}
	});
	const list = user.role === "student" ? store.enrollments.filter((item) => item.studentId === user.id) : user.role === "teacher" ? store.enrollments.filter((item) => store.courses.find((course) => course.id === item.courseId)?.teacherIds.includes(user.id)) : store.enrollments;
	if (!['admin', 'teacher', 'student'].includes(user.role)) return sendError(res, 403, "This role cannot view enrollments");
	return ok(res, list.map((item) => ({ ...item, courseTitle: store.courses.find((course) => course.id === item.courseId)?.title || item.courseId, student: item.studentId ? store.users.find((student) => student.id === item.studentId) : undefined })));
});
app.post("/enrollments", prismaProtectedAuth, allow("student"), validate(enrollmentBody), async (req, res) => {
	if (prismaAuthEnabled) {
		const body = req.body as z.infer<typeof enrollmentBody>;
		const student = currentUser(req);
		const course = await prisma.course.findUnique({ where: { id: body.courseId }, include: { teachers: { include: { teacher: true } } } });
		if (!course) return sendError(res, 404, "Course not found");
		const selectedTeacher = course.teachers.find((teacher) => teacher.teacherId === body.teacherId || legacyUserId(teacher.teacher.email) === body.teacherId);
		if (!selectedTeacher) return sendError(res, 400, "اختر مدرسًا مسندًا إلى هذا الكورس");
		const existingList = await prisma.enrollment.findMany({
			where: { studentId: prismaUserId(req), courseId: body.courseId, teacherId: selectedTeacher.teacherId, status: { in: ["PENDING", "APPROVED"] } },
			select: { id: true, status: true, bookingType: true, unit: true },
		});
		const pendingRequest = existingList.find((e) => e.status === "PENDING");
		if (pendingRequest) {
			return sendError(res, 409, "A pending enrollment request already exists");
		}
		const oldApproved = existingList.filter((e) => e.status === "APPROVED");
		if (oldApproved.length > 0) {
			await prisma.enrollment.updateMany({
				where: { id: { in: oldApproved.map((e) => e.id) } },
				data: { status: "REJECTED" },
			});
		}
		const plan = await prisma.courseTeacherPlan.findUnique({ where: { courseId_teacherId: { courseId: body.courseId, teacherId: selectedTeacher.teacherId } } });
		const basePrice = Number(body.bookingType === "شهري" ? plan?.monthlyPrice : body.bookingType === "بالحصة" ? plan?.lessonPrice : plan?.chapterPrice) || Number(course.price);
		const calculatedAmount = calculateEnrollmentAmount(basePrice, plan?.discountEnabled, plan?.discountKind, plan?.discountValue);
		const amount = body.amount ?? calculatedAmount;
		const enrollment = await prisma.enrollment.create({ data: { studentId: prismaUserId(req), courseId: body.courseId, teacherId: selectedTeacher.teacherId, studentNameSnapshot: student.name, studentPhoneSnapshot: student.phone || body.studentPhone, parentPhoneSnapshot: student.parentPhone || body.parentPhone, gradeSnapshot: student.grade || body.grade, bookingType: body.bookingType, unit: body.unit || null, amount, transferImageUrl: body.transferImage || null, status: "PENDING" } });
		await prisma.notification.create({ data: { userId: (await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } }))?.id || student.id, type: "ENROLLMENT", title: "طلب اشتراك جديد", message: `${student.name} أرسل طلب اشتراك في ${course.title} مع صورة التحويل.`, enrollmentId: enrollment.id } });
		return ok(res, { id: enrollment.id, studentId: enrollment.studentId, courseId: enrollment.courseId, teacherId: enrollment.teacherId, studentName: enrollment.studentNameSnapshot, studentPhone: enrollment.studentPhoneSnapshot, parentPhone: enrollment.parentPhoneSnapshot, grade: enrollment.gradeSnapshot, bookingType: enrollment.bookingType, unit: enrollment.unit || undefined, amount: Number(enrollment.amount), transferImage: enrollment.transferImageUrl || undefined, status: enrollment.status.toLowerCase(), createdAt: enrollment.createdAt.toISOString() }, 201);
	}
	const body = req.body;
	const student = currentUser(req);
	const course = store.courses.find((item) => item.id === body.courseId);
	if (!course || !course.teacherIds.includes(body.teacherId)) return sendError(res, 400, "اختر مدرسًا مسندًا إلى هذا الكورس");
	const existingList = store.enrollments.filter((e) => e.studentId === student.id && e.courseId === body.courseId && e.teacherId === body.teacherId && (e.status === "pending" || e.status === "approved"));
	const pendingRequest = existingList.find((e) => e.status === "pending");
	if (pendingRequest) {
		return sendError(res, 409, "A pending enrollment request already exists");
	}
	store.enrollments = store.enrollments.filter((e) => !(e.studentId === student.id && e.courseId === body.courseId && e.teacherId === body.teacherId && e.status === "approved"));
	const plan = course.teacherPlans.find((item) => item.teacherId === body.teacherId);
	const teacherObj = store.teachers.find((t) => t.id === body.teacherId);
	const basePrice = Number(body.bookingType === "شهري" ? plan?.monthlyPrice : body.bookingType === "بالحصة" ? plan?.lessonPrice : plan?.chapterPrice) || Number(course.price);
	const discountEnabled = plan?.discountEnabled ?? (teacherObj as any)?.discountEnabled;
	const discountKind = plan?.discountKind ?? (teacherObj as any)?.discountKind;
	const discountValue = plan?.discountValue ?? (teacherObj as any)?.discountValue;
	const calculatedAmount = calculateEnrollmentAmount(basePrice, discountEnabled, discountKind, discountValue);
	const amount = body.amount ?? calculatedAmount;
	const enrollment = { id: id("enrollment"), ...body, studentId: student.id, studentName: student.name, studentPhone: student.phone || body.studentPhone, parentPhone: student.parentPhone || body.parentPhone, grade: student.grade || body.grade, amount, status: "pending" as const, createdAt: timestamp() };
	store.enrollments.push(enrollment);
	const admins = store.users.filter((user) => user.role === "admin");
	admins.forEach((admin) => store.notifications.push({ id: id("notification"), userId: admin.id, type: "enrollment", title: "طلب اشتراك جديد", message: `${student.name} أرسل طلب اشتراك في ${course.title} مع صورة التحويل.`, enrollmentId: enrollment.id, read: false, createdAt: timestamp() }));
	return ok(res, enrollment, 201);
});
app.patch("/enrollments/:enrollmentId", prismaProtectedAuth, allow("admin"), allowAnyPermission("users", "payments"), async (req, res) => {
	if (prismaAuthEnabled) {
		const status = z.enum(["pending", "approved", "rejected"]).safeParse(req.body.status); if (!status.success) return sendError(res, 400, "Invalid enrollment status");
		let enrollment;
		try {
			enrollment = await prisma.enrollment.update({ where: { id: req.params.enrollmentId }, data: { status: status.data.toUpperCase() as "PENDING" | "APPROVED" | "REJECTED" }, include: { course: true, student: true } });
		} catch (error) {
			if (error && typeof error === "object" && "code" in error && error.code === "P2025") return sendError(res, 404, "Enrollment not found");
			console.error("Prisma enrollment update failed:", error);
			return sendError(res, 503, "Enrollment service is unavailable");
		}
		if (enrollment.studentId) { await prisma.notification.create({ data: { userId: enrollment.studentId, type: "ENROLLMENT", title: status.data === "approved" ? "تم تفعيل الاشتراك" : "تم تحديث طلب الاشتراك", message: status.data === "approved" ? `تم قبول اشتراكك في ${enrollment.course.title}.` : `تم ${status.data === "rejected" ? "رفض" : "تحديث"} طلب اشتراكك في ${enrollment.course.title}.`, enrollmentId: enrollment.id } }); }
		return ok(res, { id: enrollment.id, studentId: enrollment.studentId, courseId: enrollment.courseId, teacherId: enrollment.teacherId, studentName: enrollment.studentNameSnapshot, studentPhone: enrollment.studentPhoneSnapshot, parentPhone: enrollment.parentPhoneSnapshot, grade: enrollment.gradeSnapshot, bookingType: enrollment.bookingType, unit: enrollment.unit || undefined, amount: Number(enrollment.amount), transferImage: enrollment.transferImageUrl || undefined, status: enrollment.status.toLowerCase(), createdAt: enrollment.createdAt.toISOString(), courseTitle: enrollment.course.title, student: enrollment.student ? { id: enrollment.student.id, name: enrollment.student.name, email: enrollment.student.email, role: enrollment.student.role.toLowerCase(), status: enrollment.student.status.toLowerCase() } : undefined });
	}
	const enrollment = store.enrollments.find((item) => item.id === req.params.enrollmentId); if (!enrollment) return sendError(res, 404, "Enrollment not found"); const status = z.enum(["pending", "approved", "rejected"]).safeParse(req.body.status); if (!status.success) return sendError(res, 400, "Invalid enrollment status"); enrollment.status = status.data; if (enrollment.studentId) { const course = store.courses.find((item) => item.id === enrollment.courseId); store.notifications.push({ id: id("notification"), userId: enrollment.studentId, type: "enrollment", title: status.data === "approved" ? "تم تفعيل الاشتراك" : "تم تحديث طلب الاشتراك", message: status.data === "approved" ? `تم قبول اشتراكك في ${course?.title || "الكورس"}.` : `تم ${status.data === "rejected" ? "رفض" : "تحديث"} طلب اشتراكك في ${course?.title || "الكورس"}.`, enrollmentId: enrollment.id, read: false, createdAt: timestamp() }); } return ok(res, enrollment);
});

app.delete("/enrollments/:enrollmentId", prismaProtectedAuth, allow("student", "admin"), async (req, res) => {
	if (prismaAuthEnabled) {
		try {
			const current = currentUser(req);
			const where = current.role === "student"
				? { id: req.params.enrollmentId, studentId: prismaUserId(req) }
				: { id: req.params.enrollmentId };
			const enrollment = await prisma.enrollment.findFirst({ where });
			if (!enrollment) return sendError(res, 404, "Enrollment not found");
			await prisma.enrollment.update({ where: { id: enrollment.id }, data: { status: "REJECTED" } });
			return ok(res, { success: true, message: "Enrollment cancelled" });
		} catch (error) {
			console.error("Prisma enrollment cancel failed:", error);
			return sendError(res, 503, "Enrollment service unavailable");
		}
	}
	const user = currentUser(req);
	const index = store.enrollments.findIndex((item) => item.id === req.params.enrollmentId && (user.role === "admin" || item.studentId === user.id));
	if (index === -1) return sendError(res, 404, "Enrollment not found");
	store.enrollments[index].status = "rejected";
	return ok(res, { success: true, message: "Enrollment cancelled" });
});

app.get("/cart", auth(), allow("student"), (req, res) => ok(res, store.carts.get(currentUser(req).id) || []));
app.put("/cart", auth(), allow("student"), (req, res) => { const items = z.array(z.object({ courseId, quantity: z.number().int().positive() })).safeParse(req.body.items); if (!items.success) return sendError(res, 400, "Invalid cart items"); store.carts.set(currentUser(req).id, items.data); return ok(res, items.data); });
app.delete("/cart/:courseId", auth(), allow("student"), (req, res) => { const items = (store.carts.get(currentUser(req).id) || []).filter((item) => item.courseId !== req.params.courseId); store.carts.set(currentUser(req).id, items); return ok(res, items); });

app.get("/attendance", prismaProtectedAuth, async (req, res) => {
	if (prismaAuthEnabled) {
		const user = currentUser(req);
		const where = user.role === "student" ? { studentId: prismaUserId(req) } : user.role === "teacher" ? { course: { teachers: { some: { teacherId: prismaUserId(req) } } } } : {};
		const records = await prisma.attendanceRecord.findMany({ where, include: { course: true, student: true }, orderBy: { date: "desc" } });
		return ok(res, records.map((item) => ({ id: item.id, studentId: item.studentId, courseId: item.courseId, date: item.date.toISOString(), status: item.status.toLowerCase(), note: item.note || undefined, studentName: item.student.name, courseTitle: item.course.title })));
	}
	const user = currentUser(req); const records = store.attendance.filter((item) => user.role === "student" ? item.studentId === user.id : user.role === "teacher" ? store.courses.find((course) => course.id === item.courseId)?.teacherIds.includes(user.id) : true); return ok(res, records.map((item) => ({ ...item, studentName: store.users.find((student) => student.id === item.studentId)?.name || "طالب", courseTitle: store.courses.find((course) => course.id === item.courseId)?.title || item.courseId })));
});
app.post("/attendance", prismaProtectedAuth, allow("teacher", "admin"), allowPermission("reports"), async (req, res) => {
	const result = z.object({ studentId: z.string(), courseId, date: z.string().trim().min(1).refine((value) => !Number.isNaN(Date.parse(value)), "date must be valid"), status: z.enum(["present", "absent", "late"]), note: z.string().max(500).optional() }).safeParse(req.body); if (!result.success) return sendError(res, 400, "Invalid attendance record", result.error.flatten());
	if (prismaAuthEnabled) {
		const current = currentUser(req);
		const course = await prisma.course.findUnique({ where: { id: result.data.courseId }, include: { teachers: { select: { teacherId: true } } } });
		const student = await prisma.user.findUnique({ where: { id: result.data.studentId } });
		if (!course || !student || student.role !== "STUDENT") return sendError(res, 400, "Course and student must exist");
		if (current.role === "teacher" && !course.teachers.some((item) => item.teacherId === prismaUserId(req))) return sendError(res, 403, "You can only record attendance for your courses");
		const created = await prisma.attendanceRecord.create({ data: { studentId: result.data.studentId, courseId: result.data.courseId, date: new Date(result.data.date), status: result.data.status.toUpperCase() as "PRESENT" | "ABSENT" | "LATE", note: result.data.note || null, recordedBy: prismaUserId(req) } });
		return ok(res, { id: created.id, studentId: created.studentId, courseId: created.courseId, date: created.date.toISOString(), status: created.status.toLowerCase(), note: created.note || undefined }, 201);
	}
	const course = store.courses.find((item) => item.id === result.data.courseId); const student = store.users.find((item) => item.id === result.data.studentId && item.role === "student"); if (!course || !student) return sendError(res, 400, "Course and student must exist"); if (currentUser(req).role === "teacher" && !course.teacherIds.includes(currentUser(req).id)) return sendError(res, 403, "You can only record attendance for your courses"); const item = { id: id("attendance"), ...result.data }; store.attendance.push(item); return ok(res, item, 201);
});

app.post("/lessons/:lessonId/attend", prismaProtectedAuth, allow("student"), async (req, res) => {
	const user = currentUser(req);
	let targetCourseId: string | null = null;
	let lessonTitle = "درس";
	if (prismaAuthEnabled) {
		const lesson = await prisma.lesson.findUnique({ where: { id: req.params.lessonId } });
		if (!lesson) return sendError(res, 404, "Lesson not found");
		targetCourseId = lesson.courseId;
		lessonTitle = lesson.title;
	} else {
		const lesson = store.lessons.find((l) => l.id === req.params.lessonId);
		if (!lesson) return sendError(res, 404, "Lesson not found");
		targetCourseId = lesson.courseId;
		lessonTitle = lesson.title;
	}

	const dateStr = new Date().toISOString().split("T")[0];

	if (prismaAuthEnabled) {
		const studentPrismaId = prismaUserId(req);
		const existing = await prisma.attendanceRecord.findFirst({
			where: {
				studentId: studentPrismaId,
				courseId: targetCourseId,
				date: {
					gte: new Date(dateStr + "T00:00:00.000Z"),
					lte: new Date(dateStr + "T23:59:59.999Z"),
				},
			},
		});
		if (!existing) {
			await prisma.attendanceRecord.create({
				data: {
					studentId: studentPrismaId,
					courseId: targetCourseId,
					date: new Date(),
					status: "PRESENT",
					note: `حضور تلقائي لمشاهدة درس: ${lessonTitle}`,
					recordedBy: studentPrismaId,
				},
			});
		}
		return ok(res, { recorded: true });
	}

	const existingInStore = store.attendance.find(a => a.studentId === user.id && a.courseId === targetCourseId && a.date.startsWith(dateStr));
	if (!existingInStore) {
		store.attendance.push({
			id: id("attendance"),
			studentId: user.id,
			courseId: targetCourseId,
			date: new Date().toISOString(),
			status: "present",
			note: `حضور تلقائي لمشاهدة درس: ${lessonTitle}`,
		});
	}
	return ok(res, { recorded: true });
});

app.get("/assignments", prismaProtectedAuth, async (req, res) => {
	if (prismaAuthEnabled) {
		const user = currentUser(req);
		const where: any = {};
		if (user.role === "student") {
			const approvedEnrollments = await prisma.enrollment.findMany({
				where: { studentId: prismaUserId(req), status: "APPROVED" },
				select: { courseId: true },
			});
			where.courseId = { in: approvedEnrollments.map((e) => e.courseId) };
			where.published = true;
		} else if (user.role === "teacher") {
			const taughtCourses = await prisma.courseTeacher.findMany({
				where: { teacherId: prismaUserId(req) },
				select: { courseId: true },
			});
			where.courseId = { in: taughtCourses.map((c) => c.courseId) };
		}
		if (req.query.courseId) {
			where.courseId = req.query.courseId as string;
		}
		const assignments = await prisma.assignment.findMany({
			where,
			include: { course: true, teacher: true },
			orderBy: { createdAt: "desc" },
		});
		return ok(res, assignments.map((item) => ({
			id: item.id,
			courseId: item.courseId,
			teacherId: item.teacherId,
			title: item.title,
			description: item.description,
			dueDate: item.dueDate.toISOString().split("T")[0],
			published: item.published,
			createdAt: item.createdAt.toISOString(),
			courseTitle: item.course.title,
			teacherName: item.teacher.name,
		})));
	}
	const user = currentUser(req);
	const ownedCourseIds = user.role === "teacher" ? store.courses.filter((course) => isTeacherForCourse(user, course)).map((course) => course.id) : undefined;
	return ok(res, store.assignments.filter((item) => (!req.query.courseId || item.courseId === req.query.courseId) && (user.role !== "teacher" || ownedCourseIds?.includes(item.courseId)) && (user.role !== "student" || item.published)));
});

app.post("/assignments", prismaProtectedAuth, allow("teacher", "admin"), async (req, res) => {
	const result = z.object({
		courseId,
		title: z.string().min(1),
		description: z.string().default(""),
		dueDate: z.string(),
		published: z.boolean().default(true),
	}).safeParse(req.body);
	if (!result.success) return sendError(res, 400, "Invalid assignment", result.error.flatten());

	if (prismaAuthEnabled) {
		const user = currentUser(req);
		const course = await prisma.course.findUnique({
			where: { id: result.data.courseId },
			include: { teachers: { select: { teacherId: true } } },
		});
		if (!course) return sendError(res, 404, "Course not found");
		const teacherId = user.role === "teacher" ? prismaUserId(req) : (course.teachers[0]?.teacherId || prismaUserId(req));
		if (user.role === "teacher") {
			const courseTeacher = await prisma.courseTeacher.findFirst({ where: { courseId: result.data.courseId, teacherId: prismaUserId(req) } });
			if (!courseTeacher) return sendError(res, 403, "You can only add assignments to your courses");
		}
		const assignment = await prisma.assignment.create({
			data: {
				courseId: result.data.courseId,
				teacherId,
				title: result.data.title,
				description: result.data.description,
				dueDate: new Date(result.data.dueDate),
				published: result.data.published,
			},
		});
		return ok(res, {
			id: assignment.id,
			courseId: assignment.courseId,
			teacherId: assignment.teacherId,
			title: assignment.title,
			description: assignment.description,
			dueDate: assignment.dueDate.toISOString().split("T")[0],
			published: assignment.published,
			createdAt: assignment.createdAt.toISOString(),
		}, 201);
	}

	const course = store.courses.find((item) => item.id === result.data.courseId);
	if (!course || !isTeacherForCourse(currentUser(req), course)) return sendError(res, 403, "You can only add assignments to your courses");
	const item = { id: id("assignment"), ...result.data, teacherId: currentUser(req).id };
	store.assignments.push(item);
	return ok(res, item, 201);
});

app.post("/assignments/:assignmentId/submissions", prismaProtectedAuth, allow("student"), async (req, res) => {
	const result = z.object({ content: z.string().min(1) }).safeParse(req.body);
	if (!result.success) return sendError(res, 400, "Assignment content is required");

	if (prismaAuthEnabled) {
		const assignment = await prisma.assignment.findUnique({ where: { id: req.params.assignmentId } });
		if (!assignment) return sendError(res, 404, "Assignment not found");
		const approved = await prisma.enrollment.findFirst({
			where: { courseId: assignment.courseId, studentId: prismaUserId(req), status: "APPROVED" },
			select: { id: true },
		});
		if (!approved) return sendError(res, 403, "Course approval is required");
		const submission = await prisma.assignmentSubmission.create({
			data: {
				assignmentId: assignment.id,
				studentId: prismaUserId(req),
				content: result.data.content,
			},
		});
		return ok(res, {
			id: submission.id,
			assignmentId: submission.assignmentId,
			studentId: submission.studentId,
			content: submission.content,
			score: submission.score ? Number(submission.score) : null,
			submittedAt: submission.submittedAt.toISOString(),
		}, 201);
	}

	const item = { id: id("assignment-submission"), assignmentId: req.params.assignmentId, studentId: currentUser(req).id, content: result.data.content, score: null, submittedAt: timestamp() };
	store.assignmentSubmissions.push(item);
	return ok(res, item, 201);
});

app.get("/assignment-submissions", prismaProtectedAuth, async (req, res) => {
	if (prismaAuthEnabled) {
		const user = currentUser(req);
		const where: any = {};
		if (user.role === "student") {
			where.studentId = prismaUserId(req);
		} else if (user.role === "teacher") {
			where.assignment = { teacherId: prismaUserId(req) };
		}
		const submissions = await prisma.assignmentSubmission.findMany({
			where,
			include: { student: true, assignment: true },
			orderBy: { submittedAt: "desc" },
		});
		return ok(res, submissions.map((item) => ({
			id: item.id,
			assignmentId: item.assignmentId,
			studentId: item.studentId,
			content: item.content,
			score: item.score ? Number(item.score) : null,
			submittedAt: item.submittedAt.toISOString(),
			studentName: item.student.name,
			assignment: {
				id: item.assignment.id,
				title: item.assignment.title,
				courseId: item.assignment.courseId,
				dueDate: item.assignment.dueDate.toISOString().split("T")[0],
			},
		})));
	}
	const user = currentUser(req);
	const list = user.role === "student" ? store.assignmentSubmissions.filter((item) => item.studentId === user.id) : user.role === "teacher" ? store.assignmentSubmissions.filter((item) => store.assignments.find((assignment) => assignment.id === item.assignmentId)?.teacherId === user.id) : store.assignmentSubmissions;
	return ok(res, list.map((item) => ({ ...item, studentName: store.users.find((student) => student.id === item.studentId)?.name || "طالب", assignment: store.assignments.find((assignment) => assignment.id === item.assignmentId) })));
});

const assignmentSubmissionReviewPatch = async (req: Request, res: Response) => {
	const score = z.number().min(0).max(100).nullable().safeParse(req.body.score);
	if (!score.success) return sendError(res, 400, "Invalid score");
	if (prismaAuthEnabled) {
		const user = currentUser(req);
		const submission = await prisma.assignmentSubmission.findUnique({ where: { id: req.params.submissionId }, include: { assignment: true } });
		if (!submission) return sendError(res, 404, "Assignment submission not found");
		if (user.role === "teacher" && submission.assignment.teacherId !== prismaUserId(req)) return sendError(res, 403, "Cannot review this submission");
		const updated = await prisma.assignmentSubmission.update({
			where: { id: submission.id },
			data: { score: score.data, reviewedAt: new Date(), reviewedBy: user.role === "admin" ? null : prismaUserId(req) },
		});
		return ok(res, {
			id: updated.id,
			assignmentId: updated.assignmentId,
			studentId: updated.studentId,
			content: updated.content,
			score: updated.score ? Number(updated.score) : null,
			submittedAt: updated.submittedAt.toISOString(),
		});
	}
	const submission = store.assignmentSubmissions.find((item) => item.id === req.params.submissionId);
	if (!submission) return sendError(res, 404, "Submission not found");
	submission.score = score.data;
	return ok(res, submission);
};
app.patch("/assignment-submissions/:submissionId", prismaProtectedAuth, allow("teacher", "admin"), assignmentSubmissionReviewPatch);
app.patch("/assignment-submissions/:submissionId/score", prismaProtectedAuth, allow("teacher", "admin"), assignmentSubmissionReviewPatch);
app.patch("/assignment-submissions/:submissionId/grade", prismaProtectedAuth, allow("teacher", "admin"), assignmentSubmissionReviewPatch);

app.get("/conversations", prismaProtectedAuth, (req, res) => ok(res, store.conversations.filter((item) => item.participantIds.includes(currentUser(req).id)).map(({ messages, ...conversation }) => ({ ...conversation, messageCount: messages.length }))));
app.post("/conversations", prismaProtectedAuth, (req, res) => { const result = z.object({ participantIds: z.array(z.string()).min(1), title: z.string().min(1) }).safeParse(req.body); if (!result.success) return sendError(res, 400, "Invalid conversation"); const conversation = { id: id("conversation"), participantIds: Array.from(new Set([currentUser(req).id, ...result.data.participantIds])), title: result.data.title, messages: [] }; store.conversations.push(conversation); return ok(res, conversation, 201); });
app.get("/conversations/:conversationId/messages", prismaProtectedAuth, (req, res) => { const conversation = store.conversations.find((item) => item.id === req.params.conversationId); if (!conversation || !conversation.participantIds.includes(currentUser(req).id)) return sendError(res, 404, "Conversation not found"); return ok(res, conversation.messages); });
app.post("/conversations/:conversationId/messages", prismaProtectedAuth, (req, res) => { const conversation = store.conversations.find((item) => item.id === req.params.conversationId); if (!conversation || !conversation.participantIds.includes(currentUser(req).id)) return sendError(res, 404, "Conversation not found"); const result = z.object({ body: z.string().min(1) }).safeParse(req.body); if (!result.success) return sendError(res, 400, "Message body is required"); const message = { id: id("message"), senderId: currentUser(req).id, body: result.data.body, createdAt: timestamp() }; conversation.messages.push(message); return ok(res, message, 201); });

app.get("/calendar", prismaProtectedAuth, (_req, res) => ok(res, store.calendar));
app.post("/calendar", prismaProtectedAuth, allow("teacher", "admin"), (req, res) => { const result = z.object({ title: z.string().min(1), courseId: courseId.optional(), startsAt: z.string(), endsAt: z.string(), type: z.enum(["lesson", "exam", "event"]), meetingUrl: z.string().url().optional() }).safeParse(req.body); if (!result.success) return sendError(res, 400, "Invalid calendar event", result.error.flatten()); const item = { id: id("calendar"), ...result.data }; store.calendar.push(item); return ok(res, item, 201); });

app.get("/dashboard", auth(), async (req, res) => {
	const user = currentUser(req);
	const ownedCourseIds = user.role === "teacher" ? store.courses.filter((course) => course.teacherIds.includes(user.id)).map((course) => course.id) : undefined;
	const lessons = ownedCourseIds ? store.lessons.filter((lesson) => ownedCourseIds.includes(lesson.courseId)) : store.lessons;
	const exams = ownedCourseIds ? store.exams.filter((exam) => ownedCourseIds.includes(exam.courseId)) : store.exams;
	const submissions = ownedCourseIds ? store.submissions.filter((submission) => exams.some((exam) => exam.id === submission.examId)) : store.submissions;
	const enrollments = ownedCourseIds ? store.enrollments.filter((enrollment) => ownedCourseIds.includes(enrollment.courseId)) : store.enrollments;
	const attendance = store.attendance.filter((item) => !ownedCourseIds || ownedCourseIds.includes(item.courseId));
	const present = attendance.filter((item) => item.status === "present" || item.status === "late").length;

	let totalStudents = 0;
	let recentStudents: Array<{ name: string; grade: string; course: string; attendance: string; status: string }> = [];

	if (prismaAuthEnabled || Boolean(process.env.DATABASE_URL)) {
		try {
			totalStudents = await prisma.user.count({ where: { role: "STUDENT" } });
			const dbStudents = await prisma.user.findMany({
				where: { role: "STUDENT" },
				orderBy: { createdAt: "desc" },
				take: 5,
			});
			recentStudents = dbStudents.map((s) => {
				const enrollment = enrollments.find((e) => e.studentId === s.id);
				const course = enrollment ? store.courses.find((c) => c.id === enrollment.courseId) : undefined;
				return {
					name: s.name,
					grade: s.grade || "الصف الأول الثانوي",
					course: course?.title || (enrollment ? enrollment.courseId : "طالب جديد بالمنصة"),
					attendance: "100%",
					status: s.status === "APPROVED" ? "نشط" : "قيد المراجعة",
				};
			});
		} catch {
			totalStudents = store.users.filter((item) => item.role === "student").length;
		}
	}

	if (recentStudents.length === 0) {
		recentStudents = Array.from(
			new Map(
				enrollments
					.filter((item) => item.studentId)
					.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
					.map((enrollment) => {
						const student = store.users.find((item) => item.id === enrollment.studentId);
						const records = store.attendance.filter((item) => item.studentId === enrollment.studentId && (!ownedCourseIds || ownedCourseIds.includes(item.courseId)));
						const presentRecords = records.filter((item) => item.status === "present" || item.status === "late").length;
						return [
							enrollment.studentId!,
							{
								name: student?.name || enrollment.studentName,
								grade: student?.grade || enrollment.grade,
								course: store.courses.find((item) => item.id === enrollment.courseId)?.title || enrollment.courseId,
								attendance: records.length ? `${Math.round((presentRecords / records.length) * 100)}%` : "—",
								status: enrollment.status === "approved" ? "نشط" : "قيد المراجعة",
							},
						];
					})
			).values()
		).slice(0, 5);

		if (recentStudents.length === 0) {
			const storeStudents = store.users.filter((u) => u.role === "student");
			recentStudents = storeStudents.slice(0, 5).map((s) => ({
				name: s.name,
				grade: s.grade || "الصف الأول الثانوي",
				course: "طالب جديد بالمنصة",
				attendance: "100%",
				status: s.status === "approved" ? "نشط" : "قيد المراجعة",
			}));
		}
	}

	if (!totalStudents) {
		totalStudents = user.role === "teacher"
			? new Set(enrollments.map((item) => item.studentId || item.studentName)).size
			: store.users.filter((item) => item.role === "student").length;
	}

	let allStudentGrades: (string | null | undefined)[] = [];
	if (prismaAuthEnabled || Boolean(process.env.DATABASE_URL)) {
		try {
			const dbStudents = await prisma.user.findMany({ where: { role: "STUDENT" }, select: { grade: true } });
			allStudentGrades = dbStudents.map(s => s.grade);
		} catch {
			allStudentGrades = store.users.filter(u => u.role === "student").map(u => u.grade);
		}
	} else {
		allStudentGrades = store.users.filter(u => u.role === "student").map(u => u.grade);
	}

	const stageConfig = [
		{ name: "أولى ثانوي", color: "#F47B20" },
		{ name: "ثانية ثانوي", color: "#5A4033" },
		{ name: "ثالثة ثانوي", color: "#D99000" },
		{ name: "أولى إعدادي", color: "#2E9B68" },
		{ name: "ثانية إعدادي", color: "#3B82F6" },
		{ name: "ثالثة إعدادي", color: "#8B5CF6" },
	];

	const counts: Record<string, number> = {
		"أولى ثانوي": 0,
		"ثانية ثانوي": 0,
		"ثالثة ثانوي": 0,
		"أولى إعدادي": 0,
		"ثانية إعدادي": 0,
		"ثالثة إعدادي": 0,
	};

	allStudentGrades.forEach(g => {
		const str = (g || "").trim();
		let stage = "أولى ثانوي";
		if (str.includes("ثان") && str.includes("ثانو")) stage = "ثانية ثانوي";
		else if (str.includes("ثالث") && str.includes("ثانو")) stage = "ثالثة ثانوي";
		else if (str.includes("أول") && str.includes("ثانو")) stage = "أولى ثانوي";
		else if (str.includes("ثان") && str.includes("إعداد")) stage = "ثانية إعدادي";
		else if (str.includes("ثالث") && str.includes("إعداد")) stage = "ثالثة إعدادي";
		else if (str.includes("أول") && str.includes("إعداد")) stage = "أولى إعدادي";
		else if (str.includes("ثانوي")) stage = "أولى ثانوي";
		else if (str.includes("إعدادي")) stage = "أولى إعدادي";
		counts[stage] = (counts[stage] || 0) + 1;
	});

	const totalS = allStudentGrades.length;
	const stageDistribution = stageConfig.map(s => ({
		name: s.name,
		value: totalS > 0 ? Math.round(((counts[s.name] || 0) / totalS) * 100) : 0,
		count: counts[s.name] || 0,
		color: s.color,
	}));

	return ok(res, {
		role: user.role,
		stats: {
			students: totalStudents,
			courses: ownedCourseIds ? ownedCourseIds.length : store.courses.filter((item) => item.published).length,
			lessons: lessons.filter((item) => item.published).length,
			exams: exams.filter((item) => item.published).length,
			submissions: submissions.length,
			attendanceRate: attendance.length ? Math.round((present / attendance.length) * 100) : undefined,
		},
		recentLessons: lessons.slice(0, 5).map((lesson) => ({ ...lesson, teacher: teacherName(lesson.teacherId) })),
		recentStudents,
		stageDistribution,
	});
});
app.get("/reports/overview", auth(), allow("admin", "teacher"), allowPermission("reports"), async (_req, res) => {
	let approvedEnrollments: Array<{ amount: number; createdAt: Date | string }> = [];
	if (prismaAuthEnabled || Boolean(process.env.DATABASE_URL)) {
		try {
			const dbEnrollments = await prisma.enrollment.findMany({
				where: { status: "APPROVED" },
				select: { amount: true, createdAt: true },
			});
			approvedEnrollments = dbEnrollments.map(e => ({ amount: Number(e.amount), createdAt: e.createdAt }));
		} catch {
			approvedEnrollments = store.enrollments
				.filter(item => item.status === "approved")
				.map(e => ({ amount: Number(e.amount), createdAt: e.createdAt }));
		}
	} else {
		approvedEnrollments = store.enrollments
			.filter(item => item.status === "approved")
			.map(e => ({ amount: Number(e.amount), createdAt: e.createdAt }));
	}

	const totalRevenue = approvedEnrollments.reduce((sum, e) => sum + (e.amount || 0), 0);
	const daysRevenue = [0, 0, 0, 0, 0, 0, 0];
	approvedEnrollments.forEach(e => {
		const date = new Date(e.createdAt);
		const dayIdx = (date.getDay() + 1) % 7;
		daysRevenue[dayIdx] += (e.amount || 0);
	});

	const activeStudents = store.users.filter((user) => user.role === "student").length;
	const pendingEnrollments = store.enrollments.filter((item) => item.status === "pending").length;

	return ok(res, {
		totalRevenue,
		monthlyRevenue: daysRevenue,
		attendanceRate: 86,
		activeStudents,
		pendingEnrollments,
	});
});
app.get("/profile", prismaProtectedAuth, async (req, res) => {
	if (prismaAuthEnabled) {
		const user = await prismaReadOr503(res, () => prisma.user.findUnique({ where: { id: currentUser(req).id }, include: { permissions: true } }));
		if (!user) return sendError(res, 401, "Authentication is required");
		return ok(res, {
			...mapPrismaUser(user),
			phone: user.phone || undefined,
			grade: user.grade || (user.role === "STUDENT" ? "الثاني الثانوي" : undefined),
		});
	}
	return ok(res, { ...publicUser(currentUser(req)), phone: currentUser(req).phone || "010 555 2841", grade: currentUser(req).grade || (currentUser(req).role === "student" ? "الثاني الثانوي" : undefined) });
});
app.patch("/profile", prismaProtectedAuth, async (req, res) => {
	if (prismaAuthEnabled) {
		const updates: { name?: string; phone?: string | null; subject?: string | null; grade?: string | null; avatarUrl?: string | null } = {};
		if (typeof req.body.name === "string" && req.body.name.trim()) updates.name = req.body.name.trim();
		if (typeof req.body.phone === "string") updates.phone = req.body.phone.trim() || null;
		if (typeof req.body.grade === "string") updates.grade = req.body.grade.trim() || null;
		if (typeof req.body.subject === "string") updates.subject = req.body.subject.trim() || null;
		if (typeof req.body.avatar === "string") updates.avatarUrl = req.body.avatar.trim() || null;
		if (Object.keys(updates).length === 0) return sendError(res, 400, "Invalid profile update");
		try {
			const user = await prisma.user.update({ where: { id: currentUser(req).id }, data: updates, include: { permissions: true, teacherProfile: true } });
			if (user.role === "TEACHER") {
				await prisma.teacherProfile.upsert({
					where: { userId: user.id },
					update: {
						...(updates.subject !== undefined ? { subject: updates.subject || "" } : {}),
						...(updates.avatarUrl !== undefined ? { imageUrl: updates.avatarUrl || null } : {}),
						bio: user.teacherProfile?.bio || "مدرس جديد على المنصة",
						trustLabel: user.teacherProfile?.trustLabel || "مدرس جديد",
					},
					create: {
						userId: user.id,
						subject: updates.subject || user.subject || "",
						bio: "مدرس جديد على المنصة",
						imageUrl: updates.avatarUrl || user.avatarUrl || null,
						trustLabel: "مدرس جديد",
					},
				});
			}
			return ok(res, mapPrismaUser(user));
		} catch (error) {
			if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return sendError(res, 409, "Phone number is already in use");
			console.error("Prisma profile update failed:", error);
			return sendError(res, 503, "Profile service is unavailable");
		}
	}
	const user = currentUser(req);
	if (typeof req.body.name === "string" && req.body.name.trim()) user.name = req.body.name.trim();
	if (typeof req.body.phone === "string") user.phone = req.body.phone.trim() || undefined;
	if (typeof req.body.grade === "string") user.grade = req.body.grade.trim() || undefined;
	if (typeof req.body.subject === "string") user.subject = req.body.subject.trim() || undefined;
	if (typeof req.body.avatar === "string") user.avatar = req.body.avatar.trim() || undefined;
	const teacher = store.teachers.find((item) => item.id === user.id);
	if (teacher) { teacher.name = user.name; if (user.subject) teacher.subject = user.subject; if (user.avatar) teacher.image = user.avatar; }
	return ok(res, publicUser(user));
});
app.get("/settings", auth(false), async (req, res) => {
	let events = { newYear: store.settings.newYear, ramadan: store.settings.ramadan };
	if (prismaAuthEnabled || Boolean(process.env.DATABASE_URL)) {
		try {
			const setting = await prisma.platformSetting.findUnique({ where: { id: 1 } });
			if (setting) {
				events = { newYear: setting.newYear, ramadan: setting.ramadan };
				store.settings.newYear = setting.newYear;
				store.settings.ramadan = setting.ramadan;
			}
		} catch {
			// fallback
		}
	}
	const primary = await isPrimaryAdmin(req);
	return ok(res, { locale: "ar-EG", timezone: "Africa/Cairo", notifications: { email: true, push: true }, events, ...(req.user?.role === "admin" && primary ? { adminInviteCode: store.settings.adminInviteCode } : {}) });
});
app.patch("/settings", prismaProtectedAuth, allow("admin"), allowPermission("settings"), async (req, res) => {
	const value = z.object({ events: z.object({ newYear: z.boolean().optional(), ramadan: z.boolean().optional() }).optional(), adminInviteCode: z.string().trim().min(6).max(100).optional() }).safeParse(req.body);
	if (!value.success) return sendError(res, 400, "Invalid settings");
	if (prismaAuthEnabled || Boolean(process.env.DATABASE_URL)) {
		if (value.data.adminInviteCode) return sendError(res, 403, "Admin invitation codes are managed by the primary admin invite endpoint");
		const updated = await prismaReadOr503(res, () => prisma.platformSetting.upsert({ where: { id: 1 }, create: { id: 1, ...value.data.events }, update: value.data.events || {} }));
		if (!updated) return;
		if (value.data.events?.newYear !== undefined) store.settings.newYear = updated.newYear;
		if (value.data.events?.ramadan !== undefined) store.settings.ramadan = updated.ramadan;
		return ok(res, { locale: updated.locale, timezone: updated.timezone, notifications: { email: true, push: true }, events: { newYear: updated.newYear, ramadan: updated.ramadan } });
	}
	if (value.data.adminInviteCode && !(await isPrimaryAdmin(req))) return sendError(res, 403, "كود دعوة الأدمن متاح للأدمن الرئيسي فقط");
	store.settings = { ...store.settings, ...value.data.events, ...(value.data.adminInviteCode ? { adminInviteCode: value.data.adminInviteCode } : {}) };
	saveSettings();
	return ok(res, store.settings);
});
app.patch("/settings/events", prismaProtectedAuth, allow("admin"), allowPermission("settings"), async (req, res) => {
	const value = z.object({ newYear: z.boolean().optional(), ramadan: z.boolean().optional() }).safeParse(req.body);
	if (!value.success) return sendError(res, 400, "Invalid event settings");
	if (prismaAuthEnabled || Boolean(process.env.DATABASE_URL)) {
		const updated = await prismaReadOr503(res, () => prisma.platformSetting.upsert({ where: { id: 1 }, create: { id: 1, ...value.data }, update: value.data }));
		if (!updated) return;
		if (value.data.newYear !== undefined) store.settings.newYear = updated.newYear;
		if (value.data.ramadan !== undefined) store.settings.ramadan = updated.ramadan;
		saveSettings();
		return ok(res, { newYear: updated.newYear, ramadan: updated.ramadan });
	}
	store.settings = { ...store.settings, ...value.data };
	saveSettings();
	return ok(res, store.settings);
});
app.use((_req, res) => sendError(res, 404, "Route not found"));
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => { console.error(error); return sendError(res, 500, "Unexpected server error"); });

export default app;
