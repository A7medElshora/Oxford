import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FileText, LockKeyhole } from "lucide-react";
import { governanceId, readGovernance, writeGovernance } from "@/lib/learningGovernance";

type CourseId = "programming" | "science" | "skills";
type Lesson = { id: string; courseId: CourseId; title: string; description: string; lectureUrl: string; resourceUrl?: string; teacher: string; published: boolean; approvalStatus?: "pending" | "approved" | "rejected"; createdAt: string };
type Learning = { lessons: Lesson[] };
type Props = { learning: any; updateLearning: (updater: (previous: any) => any) => void };

export default function TeacherLessonManager({ learning, updateLearning }: Props) {
  const [form, setForm] = useState({ title: "", description: "", lectureUrl: "", resourceUrl: "", courseId: "programming" as CourseId });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.lectureUrl.trim()) { toast.error("اكتب عنوان المحاضرة ورابطها أولًا"); return; }
    const lesson = { ...form, id: `lesson-${Date.now()}`, teacher: "نورهان عادل", published: false, approvalStatus: "pending" as const, createdAt: new Date().toISOString() };
    updateLearning((previous) => ({ ...previous, lessons: [lesson, ...previous.lessons] }));
    const governance = readGovernance();
    governance.contentApprovals.unshift({ id: governanceId("approval"), type: "lesson", contentId: lesson.id, title: lesson.title, teacher: lesson.teacher, status: "pending", createdAt: lesson.createdAt });
    writeGovernance(governance);
    setForm({ title: "", description: "", lectureUrl: "", resourceUrl: "", courseId: "programming" });
    toast.success("تم إرسال المحاضرة للأدمن للمراجعة، ولن تظهر للطلاب قبل الموافقة");
  };
  return <><PageHeader eyebrow="TEACHER STUDIO / REVIEW" title="مكتبة المحاضرات" description="كل مادة جديدة تمر على موافقة الأدمن قبل نشرها للطلاب." /><div className="teacher-workspace-grid"><form className="paper-card creator-form" onSubmit={submit}><div className="form-heading"><span className="eyebrow">ADMIN APPROVAL REQUIRED</span><h2>إضافة مادة تعليمية</h2><p>الحفظ ينشئ طلب مراجعة فقط، ولا ينشر المحتوى مباشرة.</p></div><Field label="عنوان المحاضرة"><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field><Field label="الكورس"><select value={form.courseId} onChange={(event) => setForm({ ...form, courseId: event.target.value as CourseId })}><option value="programming">أساسيات البرمجة</option><option value="science">فيزياء الحركة والطاقة</option><option value="skills">مهارات حل الامتحان</option></select></Field><Field label="وصف المادة"><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field><Field label="رابط المحاضرة"><input required type="url" value={form.lectureUrl} onChange={(event) => setForm({ ...form, lectureUrl: event.target.value })} /></Field><Field label="رابط المصادر"><input type="url" value={form.resourceUrl} onChange={(event) => setForm({ ...form, resourceUrl: event.target.value })} /></Field><button className="primary-btn" type="submit"><LockKeyhole size={15} /> إرسال للمراجعة</button></form><div className="paper-card published-panel"><div className="card-title"><div><span className="eyebrow">CONTENT STATUS</span><h3>حالة المواد</h3></div></div>{learning.lessons.filter((lesson: Lesson) => lesson.teacher === "نورهان عادل").map((lesson: Lesson) => <div className="published-row" key={lesson.id}><span className="lesson-num"><FileText size={15} /></span><div><strong>{lesson.title}</strong><small>{lesson.approvalStatus === "pending" ? "في انتظار موافقة الأدمن" : lesson.approvalStatus === "rejected" ? "مرفوضة" : "معتمدة ومنشورة"}</small></div><span className={`status ${lesson.approvalStatus === "approved" || (!lesson.approvalStatus && lesson.published) ? "success" : "warning"}`}><i />{lesson.approvalStatus === "approved" || (!lesson.approvalStatus && lesson.published) ? "منشورة" : "قيد المراجعة"}</span></div>)}</div></div></>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="form-field"><span>{label}</span>{children}</label>; }
function PageHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) { return <div className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div></div>; }
