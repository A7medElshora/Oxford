import { ArrowLeft, BookOpen, CalendarClock, ExternalLink, LockKeyhole } from "lucide-react";
import { isSubscriptionActive, readGovernance, type GovernanceStore } from "@/lib/learningGovernance";

type CourseId = "programming" | "science" | "skills";
type Lesson = { id: string; courseId: CourseId; title: string; description: string; lectureUrl: string; resourceUrl?: string; published: boolean; approvalStatus?: "pending" | "approved" | "rejected"; createdAt: string };
type Learning = { lessons: Lesson[] };

type Props = { onNavigate: (page: string) => void; learning: Learning };

export default function CourseDetailContent({ onNavigate, learning }: Props) {
  const governance: GovernanceStore = readGovernance();
  const subscription = governance.subscriptions.find((item) => item.courseId === "programming" && item.studentId === "student-demo" && item.status !== "ended");
  const active = subscription ? isSubscriptionActive(subscription) : false;
  const lessons = learning.lessons.filter((lesson) => lesson.courseId === "programming" && lesson.published && lesson.approvalStatus !== "pending" && lesson.approvalStatus !== "rejected");

  if (!active || !subscription) {
    const pending = subscription?.status === "pending";
    return <div className="access-gate paper-card"><div className="access-gate-icon"><LockKeyhole size={25} /></div><span className="eyebrow">PRIVATE COURSE ACCESS</span><h1>{pending ? "طلبك قيد مراجعة الأدمن" : "الكورس مغلق لحسابك"}</h1><p>{pending ? "سيصلك فتح الكورس بعد مراجعة طلب الاشتراك والموافقة عليه." : "اختاري المدرس والخطة أولًا. لا يمكن دخول المحاضرات أو الامتحانات قبل موافقة الأدمن."}</p>{subscription && <div className="access-gate-meta"><span>{subscription.teacherName}</span><span>{subscription.planType}</span></div>}<button className="primary-btn" onClick={() => onNavigate("browse")}>اختيار مدرس واشتراك <ArrowLeft size={16} /></button></div>;
  }

  return <div className="course-access-view"><div className="detail-cover"><img src="/manus-storage/tafra-course-programming_a75d5b1c.png" alt="" /><div><span className="eyebrow light">ACTIVE SUBSCRIPTION</span><h1>أساسيات البرمجة</h1><p>وصولك فعال حتى {new Date(subscription.endsAt).toLocaleDateString("ar-EG")} · {subscription.planType}</p></div></div><div className="paper-card syllabus"><div className="card-title"><div><span className="eyebrow">APPROVED CONTENT</span><h2>المحاضرات المتاحة</h2></div><span className="signal-chip">{lessons.length} محاضرات</span></div>{lessons.length === 0 ? <p className="muted">لا توجد محاضرات معتمدة حاليًا.</p> : lessons.map((lesson, index) => <div className="lesson-row" key={lesson.id}><span className="lesson-num">{String(index + 1).padStart(2, "0")}</span><span><strong>{lesson.title}</strong><small>{lesson.description}</small></span><a className="row-action" href={lesson.lectureUrl} target="_blank" rel="noreferrer">فتح <ExternalLink size={14} /></a></div>)}</div><div className="private-access-note"><CalendarClock size={17} /><span>الاشتراك ينتهي تلقائيًا في الموعد المحدد. أي تمديد أو إنهاء يتم من الأدمن فقط.</span><BookOpen size={17} /></div></div>;
}
