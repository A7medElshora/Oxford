import type { Request } from "express";

export type Role = "student" | "teacher" | "admin";
export type CourseId = string;
export const permissionKeys = ["users", "courses", "content", "reports", "payments", "settings"] as const;
export type Permission = (typeof permissionKeys)[number];

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  password?: string;
  phone?: string;
  parentPhone?: string;
  grade?: string;
  subject?: string;
  grades?: string[];
  avatar?: string;
  status?: "pending" | "approved" | "rejected";
  permissions?: Permission[];
};

export type Course = {
  id: CourseId;
  title: string;
  description: string;
  level: string;
  duration: string;
  image: string;
  teacherIds: string[];
  lessonCount: number;
  price: number;
  published: boolean;
  targetGrades: string[];
  teacherPlans: CourseTeacherPlan[];
};

export type CourseTeacherPlan = {
  teacherId: string;
  monthlyPrice: number;
  lessonPrice: number;
  chapterPrice: number;
  discountEnabled: boolean;
  discountKind?: "percent" | "amount";
  discountValue?: number;
};

export type Teacher = {
  id: string;
  name: string;
  subject: string;
  bio: string;
  image: string;
  courseIds: CourseId[];
  trustLabel: string;
  plans: { label: string; price: number }[];
};

export type Lesson = {
  id: string;
  courseId: CourseId;
  title: string;
  description: string;
  lectureUrl: string;
  resourceUrl?: string;
  teacherId: string;
  published: boolean;
  createdAt: string;
};

export type ExamQuestion = { id: string; prompt: string; choices: string[]; correctIndex: number; marks?: number };
export type Exam = {
  id: string;
  courseId: CourseId;
  title: string;
  description: string;
  duration: number;
  resultVisibility?: "immediate" | "after_review";
  questions: ExamQuestion[];
  teacherId: string;
  published: boolean;
  createdAt: string;
};

export type Submission = {
  id: string;
  examId: string;
  studentId: string;
  answers: number[];
  score: number | null;
  reviewed: boolean;
  submittedAt: string;
};

export type Enrollment = {
  id: string;
  studentId?: string;
  courseId: CourseId;
  teacherId: string;
  studentName: string;
  studentPhone: string;
  parentPhone: string;
  grade: string;
  bookingType: string;
  unit?: string;
  amount: number;
  transferImage?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

export type Notification = {
  id: string;
  userId: string;
  type: "enrollment" | "system";
  title: string;
  message: string;
  enrollmentId?: string;
  read: boolean;
  createdAt: string;
};

export type AttendanceRecord = {
  id: string;
  studentId: string;
  courseId: CourseId;
  date: string;
  status: "present" | "absent" | "late";
  note?: string;
};

export type Assignment = {
  id: string;
  courseId: CourseId;
  title: string;
  description: string;
  dueDate: string;
  teacherId: string;
  published: boolean;
};

export type AssignmentSubmission = {
  id: string;
  assignmentId: string;
  studentId: string;
  content: string;
  score: number | null;
  submittedAt: string;
};

export type Message = { id: string; senderId: string; body: string; createdAt: string; readAt?: string };
export type Conversation = { id: string; participantIds: string[]; title: string; messages: Message[] };
export type CalendarEvent = { id: string; title: string; courseId?: CourseId; startsAt: string; endsAt: string; type: "lesson" | "exam" | "event"; meetingUrl?: string };
export type CartItem = { courseId: CourseId; quantity: number };
export type PlatformSettings = { newYear: boolean; ramadan?: boolean; adminInviteCode: string };
export type Announcement = {
  id: string;
  kicker: string;
  title: string;
  body: string;
  cta: string;
  target: "home" | "courses" | "teachers" | "lessons" | "exams" | "assignments";
  mediaType: "none" | "image" | "video";
  mediaUrl?: string;
  published: boolean;
  sortOrder: number;
  createdAt: string;
};

export type Store = {
  users: AuthUser[];
  courses: Course[];
  teachers: Teacher[];
  lessons: Lesson[];
  exams: Exam[];
  submissions: Submission[];
  enrollments: Enrollment[];
  notifications: Notification[];
  attendance: AttendanceRecord[];
  assignments: Assignment[];
  assignmentSubmissions: AssignmentSubmission[];
  conversations: Conversation[];
  calendar: CalendarEvent[];
  carts: Map<string, CartItem[]>;
  sessions: Map<string, string>;
  settings: PlatformSettings;
  announcements: Announcement[];
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export type AuthedRequest = Request & { user: AuthUser };
