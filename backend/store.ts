import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Announcement, Store } from "./types";

const now = "2026-06-24T10:00:00.000Z";
const settingsPath = path.resolve(process.cwd(), "backend", "settings.json");
const announcementsPath = path.resolve(process.cwd(), "backend", "announcements.json");
const defaultSettings = { newYear: false, ramadan: false, adminInviteCode: process.env.ADMIN_INVITE_CODE || "oxford-ADMIN" };
const defaultAnnouncements: Announcement[] = [
  { id: "announcement-1", kicker: "OXFORD / ANNOUNCEMENT 01", title: "خصم على مسارات المراجعة قبل الامتحان", body: "اختَر مدرسك ومسارك، واطلع على سعر الحجز قبل تسجيل بياناتك.", cta: "شاهد المدرسين", target: "teachers", mediaType: "none", published: true, sortOrder: 1, createdAt: now },
  { id: "announcement-2", kicker: "OXFORD / OPEN WEEK", title: "محاضرة تعريفية مفتوحة للزوار", body: "تعرّف على طريقة شرح المدرسين قبل حفظ التقدم في حسابك.", cta: "تصفح المحاضرات", target: "lessons", mediaType: "none", published: true, sortOrder: 2, createdAt: now },
  { id: "announcement-3", kicker: "OXFORD / SMART PRACTICE", title: "نماذج امتحانات لمراجعة أهدأ", body: "استكشف شكل الأسئلة والوقت المتوقع، ثم سجّل الدخول عند بدء الحل.", cta: "استكشف الامتحانات", target: "exams", mediaType: "none", published: true, sortOrder: 3, createdAt: now },
];

function readSettings() {
  try {
    const saved = JSON.parse(fs.readFileSync(settingsPath, "utf8")) as Partial<typeof defaultSettings>;
    return { ...defaultSettings, ...saved };
  } catch {
    return defaultSettings;
  }
}

function readAnnouncements(): Announcement[] {
  try {
    const saved = JSON.parse(fs.readFileSync(announcementsPath, "utf8")) as Announcement[];
    return Array.isArray(saved) ? saved : defaultAnnouncements;
  } catch {
    return defaultAnnouncements;
  }
}

export const store: Store = {
  users: [
    { id: "student-demo", email: "student@demo.com", name: "هايدي محمد", role: "student", phone: "01000000001", status: "approved" },
    { id: "teacher-demo", email: "teacher@demo.com", name: "نورهان عادل", role: "teacher", phone: "01000000002", status: "approved", permissions: ["content"] },
    { id: "admin-demo", email: "admin@demo.com", name: "محمود الشاذلي", role: "admin", phone: "01000000003", status: "approved", permissions: ["users", "courses", "content", "reports", "payments", "settings"] },
  ],
  courses: [
    { id: "programming", title: "أساسيات البرمجة", description: "ابنِ فهمًا عمليًا للتفكير البرمجي من أول خطوة.", level: "مبتدئ", duration: "6 أسابيع", image: "/assets/learning.png", teacherIds: ["teacher-demo"], targetGrades: ["الأول الثانوي", "الثاني الثانوي", "الثالث الثانوي"], teacherPlans: [{ teacherId: "teacher-demo", monthlyPrice: 450, lessonPrice: 90, chapterPrice: 180, discountEnabled: false }], lessonCount: 24, price: 450, published: true },
    { id: "science", title: "فيزياء الحركة والطاقة", description: "مراجعة واضحة للمفاهيم الأساسية مع تطبيقات يومية.", level: "متوسط", duration: "5 أسابيع", image: "/assets/learning.png", teacherIds: [], targetGrades: ["الأول الثانوي", "الثاني الثانوي", "الثالث الثانوي"], teacherPlans: [], lessonCount: 18, price: 380, published: true },
    { id: "skills", title: "مهارات حل الامتحان", description: "نظّم وقتك وابنِ عادات تعلم تستمر معك.", level: "كل المستويات", duration: "3 أسابيع", image: "/assets/learning.png", teacherIds: [], targetGrades: [], teacherPlans: [], lessonCount: 12, price: 220, published: true },
  ],
  teachers: [{ id: "teacher-demo", name: "نورهان عادل", subject: "البرمجة وعلوم الحاسب", bio: "مدرسة برمجة تساعد الطلاب على بناء أساس عملي واضح.", image: "/assets/learning.png", courseIds: ["programming"], trustLabel: "مدرسة موصى بها", plans: [{ label: "شهري", price: 450 }, { label: "الباب الأول", price: 180 }, { label: "بالحصة", price: 90 }] }],
  lessons: [
    { id: "lesson-seed-1", courseId: "programming", title: "مدخل إلى التفكير البرمجي", description: "كيف نقسم أي مشكلة كبيرة إلى خطوات واضحة.", lectureUrl: "https://meet.google.com/taf-demo-lesson", resourceUrl: "https://drive.google.com/oxford-demo-notes", teacherId: "teacher-demo", published: true, createdAt: now },
    { id: "lesson-seed-2", courseId: "programming", title: "المتغيرات والمنطق", description: "فهم المتغيرات والمقارنات وبناء أول خوارزمية.", lectureUrl: "https://meet.google.com/taf-demo-variables", resourceUrl: "https://drive.google.com/oxford-demo-variables", teacherId: "teacher-demo", published: true, createdAt: now },
  ],
  exams: [{ id: "exam-seed-1", courseId: "programming", title: "اختبار الوحدة الأولى", description: "اختبار قصير يقيس فهم أساسيات التفكير البرمجي.", duration: 20, teacherId: "teacher-demo", published: true, createdAt: now, questions: [{ id: "question-seed-1", prompt: "ما الخطوة الأولى عند مواجهة مشكلة برمجية؟", choices: ["كتابة الكود مباشرة", "تقسيم المشكلة وفهم المطلوب", "تغيير لغة البرمجة", "حذف المشروع"], correctIndex: 1 }, { id: "question-seed-2", prompt: "ما الذي يصف الخوارزمية بشكل أفضل؟", choices: ["مجموعة خطوات مرتبة لحل مشكلة", "صورة للمشروع", "اسم المتغير", "نوع جهاز الكمبيوتر"], correctIndex: 0 }] }],
  submissions: [],
  enrollments: [],
  notifications: [],
  attendance: [],
  assignments: [],
  assignmentSubmissions: [],
  conversations: [],
  calendar: [],
  carts: new Map(),
  sessions: new Map(),
  settings: readSettings(),
  announcements: readAnnouncements(),
  paymentMethods: [],
  coursePaymentMethods: new Map(),
};

export function id(prefix: string) { return `${prefix}-${randomUUID()}`; }
export function timestamp() { return new Date().toISOString(); }
export function saveSettings() {
	fs.writeFileSync(settingsPath, `${JSON.stringify(store.settings, null, 2)}\n`, "utf8");
}
export function saveAnnouncements() {
  fs.writeFileSync(announcementsPath, `${JSON.stringify(store.announcements, null, 2)}\n`, "utf8");
}
