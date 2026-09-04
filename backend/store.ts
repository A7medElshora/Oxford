import { randomUUID } from "node:crypto";
import type { Store } from "./types";

const now = "2026-06-24T10:00:00.000Z";

export const store: Store = {
  users: [
    { id: "student-demo", email: "student@demo.com", name: "سلمى إبراهيم", role: "student" },
    { id: "teacher-demo", email: "teacher@demo.com", name: "نورهان عادل", role: "teacher" },
    { id: "admin-demo", email: "admin@demo.com", name: "محمود الشاذلي", role: "admin" },
  ],
  courses: [
    { id: "programming", title: "أساسيات البرمجة", description: "ابنِ فهمًا عمليًا للتفكير البرمجي من أول خطوة.", level: "مبتدئ", duration: "6 أسابيع", image: "/manus-storage/tafra-course-programming_a75d5b1c.png", teacherIds: ["teacher-demo"], lessonCount: 24, price: 450, published: true },
    { id: "science", title: "فيزياء الحركة والطاقة", description: "مراجعة واضحة للمفاهيم الأساسية مع تطبيقات يومية.", level: "متوسط", duration: "5 أسابيع", image: "/manus-storage/tafra-course-science_d8c92127.png", teacherIds: [], lessonCount: 18, price: 380, published: true },
    { id: "skills", title: "مهارات حل الامتحان", description: "نظّم وقتك وابنِ عادات تعلم تستمر معك.", level: "كل المستويات", duration: "3 أسابيع", image: "/manus-storage/tafra-hero_39e40131.png", teacherIds: [], lessonCount: 12, price: 220, published: true },
  ],
  teachers: [{ id: "teacher-demo", name: "نورهان عادل", subject: "البرمجة وعلوم الحاسب", bio: "مدرسة برمجة تساعد الطلاب على بناء أساس عملي واضح.", image: "/manus-storage/tafra-course-programming_a75d5b1c.png", courseIds: ["programming"], trustLabel: "مدرسة موصى بها", plans: [{ label: "شهري", price: 450 }, { label: "الباب الأول", price: 180 }, { label: "بالحصة", price: 90 }] }],
  lessons: [
    { id: "lesson-seed-1", courseId: "programming", title: "مدخل إلى التفكير البرمجي", description: "كيف نقسم أي مشكلة كبيرة إلى خطوات واضحة.", lectureUrl: "https://meet.google.com/taf-demo-lesson", resourceUrl: "https://drive.google.com/tafra-demo-notes", teacherId: "teacher-demo", published: true, createdAt: now },
    { id: "lesson-seed-2", courseId: "programming", title: "المتغيرات والمنطق", description: "فهم المتغيرات والمقارنات وبناء أول خوارزمية.", lectureUrl: "https://meet.google.com/taf-demo-variables", resourceUrl: "https://drive.google.com/tafra-demo-variables", teacherId: "teacher-demo", published: true, createdAt: now },
  ],
  exams: [{ id: "exam-seed-1", courseId: "programming", title: "اختبار الوحدة الأولى", description: "اختبار قصير يقيس فهم أساسيات التفكير البرمجي.", duration: 20, teacherId: "teacher-demo", published: true, createdAt: now, questions: [{ id: "question-seed-1", prompt: "ما الخطوة الأولى عند مواجهة مشكلة برمجية؟", choices: ["كتابة الكود مباشرة", "تقسيم المشكلة وفهم المطلوب", "تغيير لغة البرمجة", "حذف المشروع"], correctIndex: 1 }, { id: "question-seed-2", prompt: "ما الذي يصف الخوارزمية بشكل أفضل؟", choices: ["مجموعة خطوات مرتبة لحل مشكلة", "صورة للمشروع", "اسم المتغير", "نوع جهاز الكمبيوتر"], correctIndex: 0 }] }],
  submissions: [],
  enrollments: [],
  attendance: [],
  assignments: [],
  assignmentSubmissions: [],
  conversations: [],
  calendar: [],
  carts: new Map(),
  sessions: new Map(),
};

export function id(prefix: string) { return `${prefix}-${randomUUID()}`; }
export function timestamp() { return new Date().toISOString(); }
