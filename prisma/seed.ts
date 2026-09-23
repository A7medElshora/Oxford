import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const seedPassword = process.env.DEMO_SEED_PASSWORD ?? "";

if (!seedPassword) {
  throw new Error("DEMO_SEED_PASSWORD must be set when running the demo seed.");
}

const now = new Date("2026-06-24T10:00:00.000Z");
const demoUserIds = {
  student: "00000000-0000-0000-0000-000000000010",
  teacher: "00000000-0000-0000-0000-000000000011",
  admin: "00000000-0000-0000-0000-000000000012",
} as const;
const permissionKeys = ["USERS", "COURSES", "CONTENT", "REPORTS", "PAYMENTS", "SETTINGS"] as const;

const users = [
  { id: demoUserIds.student, email: "student@demo.com", name: "هايدي محمد", role: "STUDENT" as const, phone: "01000000001", status: "APPROVED" as const },
  { id: demoUserIds.teacher, email: "teacher@demo.com", name: "نورهان عادل", role: "TEACHER" as const, phone: "01000000002", status: "APPROVED" as const },
  { id: demoUserIds.admin, email: "admin@demo.com", name: "محمود الشاذلي", role: "ADMIN" as const, phone: "01000000003", status: "APPROVED" as const },
];

const courses = [
  {
    id: "programming",
    title: "أساسيات البرمجة",
    description: "ابنِ فهمًا عمليًا للتفكير البرمجي من أول خطوة.",
    level: "مبتدئ",
    duration: "6 أسابيع",
    imageUrl: "/assets/learning.png",
    lessonCount: 24,
    price: "450",
    published: true,
    targetGrades: ["الأول الثانوي", "الثاني الثانوي", "الثالث الثانوي"],
    teacherIds: [demoUserIds.teacher],
    plans: [{ teacherId: demoUserIds.teacher, monthlyPrice: "450", lessonPrice: "90", chapterPrice: "180", discountEnabled: false }],
  },
  {
    id: "science",
    title: "فيزياء الحركة والطاقة",
    description: "مراجعة واضحة للمفاهيم الأساسية مع تطبيقات يومية.",
    level: "متوسط",
    duration: "5 أسابيع",
    imageUrl: "/assets/learning.png",
    lessonCount: 18,
    price: "380",
    published: true,
    targetGrades: ["الأول الثانوي", "الثاني الثانوي", "الثالث الثانوي"],
    teacherIds: [],
    plans: [],
  },
  {
    id: "skills",
    title: "مهارات حل الامتحان",
    description: "نظّم وقتك وابنِ عادات تعلم تستمر معك.",
    level: "كل المستويات",
    duration: "3 أسابيع",
    imageUrl: "/assets/learning.png",
    lessonCount: 12,
    price: "220",
    published: true,
    targetGrades: [],
    teacherIds: [],
    plans: [],
  },
];

const announcements = [
  { id: "announcement-1", kicker: "OXFORD / ANNOUNCEMENT 01", title: "خصم على مسارات المراجعة قبل الامتحان", body: "اختَر مدرسك ومسارك، واطلع على سعر الحجز قبل تسجيل بياناتك.", cta: "شاهد المدرسين", target: "TEACHERS" as const, mediaType: "NONE" as const, published: true, sortOrder: 1, createdAt: now },
  { id: "announcement-2", kicker: "OXFORD / OPEN WEEK", title: "محاضرة تعريفية مفتوحة للزوار", body: "تعرّف على طريقة شرح المدرسين قبل حفظ التقدم في حسابك.", cta: "تصفح المحاضرات", target: "LESSONS" as const, mediaType: "NONE" as const, published: true, sortOrder: 2, createdAt: now },
  { id: "announcement-3", kicker: "OXFORD / SMART PRACTICE", title: "نماذج امتحانات لمراجعة أهدأ", body: "استكشف شكل الأسئلة والوقت المتوقع، ثم سجّل الدخول عند بدء الحل.", cta: "استكشف الامتحانات", target: "EXAMS" as const, mediaType: "IMAGE" as const, published: true, sortOrder: 3, createdAt: now },
];

async function main() {
  const passwordHash = await bcrypt.hash(seedPassword, 12);

  for (const user of users) {
    await prisma.user.upsert({
        where: { id: user.id },
        update: { email: user.email, name: user.name, role: user.role, phone: user.phone, status: user.status, passwordHash },
        create: { ...user, passwordHash },
    });
  }

  await prisma.teacherProfile.upsert({
      where: { userId: demoUserIds.teacher },
      update: { subject: "البرمجة وعلوم الحاسب", bio: "مدرسة برمجة تساعد الطلاب على بناء أساس عملي واضح.", imageUrl: "/assets/learning.png", trustLabel: "مدرسة موصى بها" },
      create: { userId: demoUserIds.teacher, subject: "البرمجة وعلوم الحاسب", bio: "مدرسة برمجة تساعد الطلاب على بناء أساس عملي واضح.", imageUrl: "/assets/learning.png", trustLabel: "مدرسة موصى بها" },
  });

  for (const permission of permissionKeys) {
    await prisma.userPermission.upsert({
        where: { userId_permission: { userId: demoUserIds.admin, permission } },
        update: {},
        create: { userId: demoUserIds.admin, permission },
    });
  }
  await prisma.userPermission.upsert({
      where: { userId_permission: { userId: demoUserIds.teacher, permission: "CONTENT" } },
      update: {},
      create: { userId: demoUserIds.teacher, permission: "CONTENT" },
  });

  for (const course of courses) {
    await prisma.course.upsert({
        where: { id: course.id },
        update: { title: course.title, description: course.description, level: course.level, duration: course.duration, imageUrl: course.imageUrl, lessonCount: course.lessonCount, price: course.price, published: course.published },
        create: { id: course.id, title: course.title, description: course.description, level: course.level, duration: course.duration, imageUrl: course.imageUrl, lessonCount: course.lessonCount, price: course.price, published: course.published },
    });
    for (const grade of course.targetGrades) {
      await prisma.courseTargetGrade.upsert({ where: { courseId_grade: { courseId: course.id, grade } }, update: {}, create: { courseId: course.id, grade } });
    }
    for (const teacherId of course.teacherIds) {
      await prisma.courseTeacher.upsert({ where: { courseId_teacherId: { courseId: course.id, teacherId } }, update: {}, create: { courseId: course.id, teacherId } });
    }
    for (const plan of course.plans) {
      await prisma.courseTeacherPlan.upsert({
          where: { courseId_teacherId: { courseId: course.id, teacherId: plan.teacherId } },
          update: { monthlyPrice: plan.monthlyPrice, lessonPrice: plan.lessonPrice, chapterPrice: plan.chapterPrice, discountEnabled: plan.discountEnabled },
          create: { courseId: course.id, teacherId: plan.teacherId, monthlyPrice: plan.monthlyPrice, lessonPrice: plan.lessonPrice, chapterPrice: plan.chapterPrice, discountEnabled: plan.discountEnabled },
      });
    }
  }

  await prisma.lesson.upsert({
      where: { id: "00000000-0000-0000-0000-000000000001" },
      update: { unit: "الباب الأول" },
      create: { id: "00000000-0000-0000-0000-000000000001", courseId: "programming", title: "مدخل إلى التفكير البرمجي", description: "كيف نقسم أي مشكلة كبيرة إلى خطوات واضحة.", lectureUrl: "https://meet.google.com/taf-demo-lesson", resourceUrl: "https://drive.google.com/oxford-demo-notes", teacherId: demoUserIds.teacher, unit: "الباب الأول", published: true, createdAt: now },
  });
  await prisma.lesson.upsert({
      where: { id: "00000000-0000-0000-0000-000000000002" },
      update: { unit: "الباب الثاني" },
      create: { id: "00000000-0000-0000-0000-000000000002", courseId: "programming", title: "المتغيرات والمنطق", description: "فهم المتغيرات والمقارنات وبناء أول خوارزمية.", lectureUrl: "https://meet.google.com/taf-demo-variables", resourceUrl: "https://drive.google.com/oxford-demo-variables", teacherId: demoUserIds.teacher, unit: "الباب الثاني", published: true, createdAt: new Date("2026-06-23T10:00:00.000Z") },
  });

  await prisma.exam.upsert({
      where: { id: "00000000-0000-0000-0000-000000000003" },
      update: {},
      create: {
        id: "00000000-0000-0000-0000-000000000003", courseId: "programming", title: "اختبار الوحدة الأولى", description: "اختبار قصير يقيس فهم أساسيات التفكير البرمجي.", durationMinutes: 20, teacherId: demoUserIds.teacher, published: true, createdAt: now,
      },
  });
  await prisma.examQuestion.upsert({
    where: { id: "00000000-0000-0000-0000-000000000004" },
    update: { prompt: "ما الخطوة الأولى عند مواجهة مشكلة برمجية؟", choices: ["كتابة الكود مباشرة", "تقسيم المشكلة وفهم المطلوب", "تغيير لغة البرمجة", "حذف المشروع"], correctIndex: 1, marks: 1, position: 0 },
    create: { id: "00000000-0000-0000-0000-000000000004", examId: "00000000-0000-0000-0000-000000000003", prompt: "ما الخطوة الأولى عند مواجهة مشكلة برمجية؟", choices: ["كتابة الكود مباشرة", "تقسيم المشكلة وفهم المطلوب", "تغيير لغة البرمجة", "حذف المشروع"], correctIndex: 1, marks: 1, position: 0 },
  });
  await prisma.examQuestion.upsert({
    where: { id: "00000000-0000-0000-0000-000000000005" },
    update: { prompt: "ما الذي يصف الخوارزمية بشكل أفضل؟", choices: ["مجموعة خطوات مرتبة لحل مشكلة", "صورة للمشروع", "اسم المتغير", "نوع جهاز الكمبيوتر"], correctIndex: 0, marks: 1, position: 1 },
    create: { id: "00000000-0000-0000-0000-000000000005", examId: "00000000-0000-0000-0000-000000000003", prompt: "ما الذي يصف الخوارزمية بشكل أفضل؟", choices: ["مجموعة خطوات مرتبة لحل مشكلة", "صورة للمشروع", "اسم المتغير", "نوع جهاز الكمبيوتر"], correctIndex: 0, marks: 1, position: 1 },
  });

  for (const announcement of announcements) {
    await prisma.announcement.upsert({ where: { id: announcement.id }, update: announcement, create: announcement });
  }
  await prisma.platformSetting.upsert({ where: { id: 1 }, update: { newYear: false, ramadan: false, locale: "ar-EG", timezone: "Africa/Cairo" }, create: { id: 1, newYear: false, ramadan: false, locale: "ar-EG", timezone: "Africa/Cairo" } });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error("Prisma seed failed:", error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
