import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { hashPassword } from "./auth";
import { prisma } from "./prisma";

const legacyTeacherIds: Record<string, string> = {
	"teacher-demo": "teacher@demo.com",
};

type TeacherInput = {
	name: string;
	subject: string;
	bio?: string;
	image?: string;
	trustLabel?: string;
};

type CoursePlanInput = {
	teacherId: string;
	monthlyPrice: number;
	lessonPrice: number;
	chapterPrice: number;
	discountEnabled: boolean;
	discountKind?: "percent" | "amount";
	discountValue?: number;
};

type CourseInput = {
	id: string;
	title: string;
	description: string;
	level: string;
	duration: string;
	image: string;
	price: number;
	published: boolean;
	targetGrades: string[];
	teacherPlans: CoursePlanInput[];
};

type DbClient = typeof prisma | Prisma.TransactionClient;

function isUuid(value: string) {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function resolvePrismaTeacherId(client: DbClient, apiId: string) {
	const legacyEmail = legacyTeacherIds[apiId];
	if (legacyEmail) {
		const teacher = await client.user.findUnique({ where: { email: legacyEmail }, select: { id: true, role: true } });
		if (teacher && teacher.role === "TEACHER") return teacher.id;
	}
	if (isUuid(apiId)) {
		const teacher = await client.user.findUnique({ where: { id: apiId }, select: { id: true, role: true } });
		if (teacher && teacher.role === "TEACHER") return teacher.id;
	}
	const teacher = await client.user.findFirst({
		where: {
			role: "TEACHER",
			OR: [
				{ id: apiId },
				{ email: { equals: apiId.toLowerCase(), mode: "insensitive" } },
				{ name: { equals: apiId, mode: "insensitive" } },
			],
		},
		select: { id: true },
	});
	return teacher?.id || null;
}

export async function createPrismaTeacher(input: TeacherInput) {
	const email = `teacher-${randomUUID()}@local.invalid`;
	const passwordHash = await hashPassword(randomUUID());
	return prisma.user.create({
		data: {
			name: input.name,
			email,
			passwordHash,
			role: "TEACHER",
			status: "APPROVED",
			subject: input.subject,
			permissions: { create: { permission: "CONTENT" } },
			teacherProfile: {
				create: {
					subject: input.subject,
					bio: input.bio || "",
					imageUrl: input.image || null,
					trustLabel: input.trustLabel || "مدرس جديد",
				},
			},
		},
		include: { teacherProfile: true, teachingCourses: true, coursePlans: true },
	});
}

export async function updatePrismaTeacher(apiId: string, input: Partial<TeacherInput>) {
	const teacherId = await resolvePrismaTeacherId(prisma, apiId);
	if (!teacherId) return null;
	await prisma.$transaction(async (tx) => {
		await tx.user.update({
			where: { id: teacherId },
			data: {
				...(input.name !== undefined ? { name: input.name } : {}),
				...(input.subject !== undefined ? { subject: input.subject } : {}),
			},
		});
		await tx.teacherProfile.upsert({
			where: { userId: teacherId },
			update: {
				...(input.subject !== undefined ? { subject: input.subject } : {}),
				...(input.bio !== undefined ? { bio: input.bio } : {}),
				...(input.image !== undefined ? { imageUrl: input.image || null } : {}),
				...(input.trustLabel !== undefined ? { trustLabel: input.trustLabel } : {}),
			},
			create: {
				userId: teacherId,
				subject: input.subject || "",
				bio: input.bio || "",
				imageUrl: input.image || null,
				trustLabel: input.trustLabel || "مدرس",
			},
		});
	});
	return prisma.user.findUnique({ where: { id: teacherId }, include: { teacherProfile: true, teachingCourses: true, coursePlans: true } });
}

function planData(plan: CoursePlanInput, teacherId: string) {
	return {
		teacherId,
		monthlyPrice: plan.monthlyPrice,
		lessonPrice: plan.lessonPrice,
		chapterPrice: plan.chapterPrice,
		discountEnabled: plan.discountEnabled,
		discountKind: plan.discountKind ? plan.discountKind.toUpperCase() as "PERCENT" | "AMOUNT" : null,
		discountValue: plan.discountValue ?? null,
	};
}

async function resolvedPlans(client: DbClient, plans: CoursePlanInput[]) {
	const resolved = await Promise.all(plans.map(async (plan) => ({ plan, teacherId: await resolvePrismaTeacherId(client, plan.teacherId) })));
	if (resolved.some((item) => !item.teacherId)) throw new Error("Every selected teacher must exist");
	const teacherIds = resolved.map((item) => item.teacherId as string);
	if (new Set(teacherIds).size !== teacherIds.length) throw new Error("A teacher can only be assigned once per course");
	return resolved.map(({ plan, teacherId }) => planData(plan, teacherId as string));
}

export async function createPrismaCourse(input: CourseInput) {
	const plans = await resolvedPlans(prisma, input.teacherPlans);
	return prisma.$transaction(async (tx) => {
		await tx.course.create({
			data: {
				id: input.id,
				title: input.title,
				description: input.description,
				level: input.level,
				duration: input.duration,
				imageUrl: input.image || null,
				price: input.price,
				published: input.published,
				targetGrades: { create: input.targetGrades.map((grade) => ({ grade })) },
				teachers: { create: plans.map((plan) => ({ teacherId: plan.teacherId })) },
				teacherPlans: { create: plans },
			},
		});
		return tx.course.findUniqueOrThrow({ where: { id: input.id }, include: { targetGrades: true, teachers: { include: { teacher: { include: { teacherProfile: true } } } }, teacherPlans: true } });
	}, { maxWait: 15000, timeout: 30000 });
}

export async function updatePrismaCourse(courseId: string, input: Partial<Omit<CourseInput, "id">>) {
	const existing = await prisma.course.findUnique({ where: { id: courseId } });
	if (!existing) return null;
	const plans = input.teacherPlans === undefined ? undefined : await resolvedPlans(prisma, input.teacherPlans);
	return prisma.$transaction(async (tx) => {
		await tx.course.update({
			where: { id: courseId },
			data: {
				...(input.title !== undefined ? { title: input.title } : {}),
				...(input.description !== undefined ? { description: input.description } : {}),
				...(input.level !== undefined ? { level: input.level } : {}),
				...(input.duration !== undefined ? { duration: input.duration } : {}),
				...(input.image !== undefined ? { imageUrl: input.image || null } : {}),
				...(input.price !== undefined ? { price: input.price } : {}),
				...(input.published !== undefined ? { published: input.published } : {}),
				...(input.targetGrades !== undefined ? { targetGrades: { deleteMany: {}, create: input.targetGrades.map((grade) => ({ grade })) } } : {}),
				...(plans !== undefined ? { teachers: { deleteMany: {}, create: plans.map((plan) => ({ teacherId: plan.teacherId })) }, teacherPlans: { deleteMany: {}, create: plans } } : {}),
			},
		});
		return tx.course.findUniqueOrThrow({ where: { id: courseId }, include: { targetGrades: true, teachers: { include: { teacher: { include: { teacherProfile: true } } } }, teacherPlans: true } });
	}, { maxWait: 15000, timeout: 30000 });
}
