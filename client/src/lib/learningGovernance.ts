export type GovernanceStatus = "pending" | "approved" | "rejected" | "ended";
export type PlanType = "شهري" | "بالحصة" | "الباب";

export type SubscriptionRequest = {
  id: string;
  courseId: "programming" | "science" | "skills";
  teacherId: string;
  teacherName: string;
  studentId: string;
  studentName: string;
  planType: PlanType;
  selectedUnit?: string;
  selectedLesson?: string;
  startsAt: string;
  endsAt: string;
  status: GovernanceStatus;
  createdAt: string;
  adminNote?: string;
};

export type GovernanceStore = {
  subscriptions: SubscriptionRequest[];
  contentApprovals: { id: string; type: "lesson" | "exam"; contentId: string; title: string; teacher: string; status: GovernanceStatus; createdAt: string }[];
};

const key = "oxford-learning-governance";
const demoStart = "2026-06-24T00:00:00.000Z";
const demoEnd = "2026-12-31T23:59:59.000Z";

const initial: GovernanceStore = {
  subscriptions: [{ id: "subscription-demo", courseId: "programming", teacherId: "nourhan", teacherName: "نورهان عادل", studentId: "student-demo", studentName: "سلمى إبراهيم", planType: "شهري", startsAt: demoStart, endsAt: demoEnd, status: "approved", createdAt: demoStart }],
  contentApprovals: [],
};

export function readGovernance(): GovernanceStore {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) as GovernanceStore : initial;
  } catch {
    return initial;
  }
}

export function writeGovernance(value: GovernanceStore) { localStorage.setItem(key, JSON.stringify(value)); }
export function governanceId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
export function currentStudentId() { return localStorage.getItem("oxford-demo-student-id") ?? "student-demo"; }
export function buildPendingSubscription({ courseId, teacherId, teacherName, studentId, studentName, planType, selectedUnit, selectedLesson }: {
  courseId: SubscriptionRequest["courseId"];
  teacherId: string;
  teacherName: string;
  studentId?: string;
  studentName: string;
  planType: PlanType;
  selectedUnit?: string;
  selectedLesson?: string;
}): SubscriptionRequest {
  const now = new Date();
  const startsAt = now.toISOString();
  const endsAtDate = new Date(now);
  if (planType === "شهري") endsAtDate.setMonth(endsAtDate.getMonth() + 1);
  else if (planType === "بالحصة") endsAtDate.setDate(endsAtDate.getDate() + 7);
  else endsAtDate.setDate(endsAtDate.getDate() + 30);
  return {
    id: governanceId("subscription"),
    courseId,
    teacherId,
    teacherName,
    studentId: studentId ?? currentStudentId(),
    studentName,
    planType,
    selectedUnit,
    selectedLesson,
    startsAt,
    endsAt: endsAtDate.toISOString(),
    status: "pending",
    createdAt: startsAt,
  };
}
export function isSubscriptionActive(item: SubscriptionRequest, now = new Date()) { return item.status === "approved" && new Date(item.startsAt) <= now && new Date(item.endsAt) >= now; }
export function activeSubscriptions(store: GovernanceStore, studentId: string) { return store.subscriptions.filter((item) => item.studentId === studentId && isSubscriptionActive(item)); }
export function dateInput(value: Date) { return value.toISOString().slice(0, 10); }
