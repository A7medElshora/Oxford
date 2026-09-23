import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, Save, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

type Teacher = { id: string; name: string; subject: string };
type Plan = { teacherId: string; monthlyPrice: number; lessonPrice: number; chapterPrice: number; discountEnabled: boolean; discountKind?: "percent" | "amount"; discountValue?: number };
type Lesson = { id: string; title: string; description: string; published: boolean; createdAt: string };
type Course = { id: string; title: string; description: string; level: string; duration: string; image: string; price: number; published: boolean; lessonCount: number; teacherIds: string[]; teacherPlans: Plan[]; enrolledStudentCount: number; teachers: Teacher[]; lessons: Lesson[] };

type Props = { courseId: string; onBack: () => void };

export default function AdminCourseDetail({ courseId, onBack }: Props) {
  const [course, setCourse] = useState<Course | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [nextCourse, nextTeachers] = await Promise.all([api<Course>(`/courses/${courseId}`), api<Teacher[]>("/teachers")]);
    setCourse(nextCourse);
    setTeachers(nextTeachers);
    setPlans(nextCourse.teacherPlans || []);
  };
  useEffect(() => {
    void load().catch((error) => toast.error(error instanceof Error ? error.message : "تعذر تحميل تفاصيل الكورس"));
  }, [courseId]);

  const availableTeachers = useMemo(() => teachers.filter((teacher) => !plans.some((plan) => plan.teacherId === teacher.id)), [plans, teachers]);
  const addTeacher = () => {
    const teacher = availableTeachers[0];
    if (!teacher) return toast.info("تم إسناد كل المدرسين المتاحين");
    setPlans((current) => [...current, { teacherId: teacher.id, monthlyPrice: 0, lessonPrice: 0, chapterPrice: 0, discountEnabled: false }]);
  };
  const updatePlan = (index: number, patch: Partial<Plan>) => setPlans((current) => current.map((plan, itemIndex) => itemIndex === index ? { ...plan, ...patch } : plan));
  const save = async () => {
    if (!plans.every((plan) => plan.teacherId && plan.monthlyPrice >= 0 && plan.lessonPrice >= 0 && plan.chapterPrice >= 0)) return toast.error("تحقق من بيانات خطط الأسعار");
    setSaving(true);
    try {
      const next = await api<Course>(`/courses/${courseId}`, { method: "PATCH", body: JSON.stringify({ teacherPlans: plans }) });
      setCourse((current) => current ? { ...current, ...next, teachers: next.teacherIds.map((id) => teachers.find((teacher) => teacher.id === id)).filter(Boolean) as Teacher[] } : next);
      toast.success("تم تحديث المدرسين وخطط الأسعار");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ التعديلات");
    } finally {
      setSaving(false);
    }
  };

  if (!course) return <div className="paper-card"><p className="muted">جارٍ تحميل تفاصيل الكورس...</p></div>;
  return (
    <div className="admin-course-detail">
      <div className="page-header">
        <div><span className="eyebrow">ADMIN / COURSE DETAIL</span><h1>{course.title}</h1><p>{course.description}</p></div>
        <button className="secondary-btn" type="button" onClick={onBack}><ArrowRight size={16} /> العودة للكورسات</button>
      </div>
      <div className="stats-grid">
        <div className="stat-card"><BookOpen size={18} /><strong>{course.lessons.length || course.lessonCount}</strong><span>درس منشور</span></div>
        <div className="stat-card"><Users size={18} /><strong>{course.enrolledStudentCount}</strong><span>طالب مشترك</span></div>
        <div className="stat-card"><strong>{course.teacherIds.length}</strong><span>مدرسون مسندون</span></div>
      </div>
      <div className="course-detail-grid">
        <section className="paper-card">
          <div className="card-title"><div><span className="eyebrow">COURSE CONTENT</span><h2>المحتوى والدروس</h2></div></div>
          {course.lessons.length ? course.lessons.map((lesson) => <div className="published-row" key={lesson.id}><div><strong>{lesson.title}</strong><small>{lesson.description || "بدون وصف"} · {lesson.published ? "منشور" : "مسودة"}</small></div></div>) : <p className="muted">لا توجد دروس مضافة لهذا الكورس.</p>}
        </section>
        <section className="paper-card editor-plans">
          <div className="card-title"><div><span className="eyebrow">TEACHERS / PRICING</span><h2>المدرسون وخطط الأسعار</h2></div><button className="secondary-btn" type="button" onClick={addTeacher}>إضافة مدرس</button></div>
          {!plans.length && <p className="muted">لا يوجد مدرسون مسندون.</p>}
          {plans.map((plan, index) => <div className="teacher-plan-editor" key={`${plan.teacherId}-${index}`}>
            <div className="plan-header"><select value={plan.teacherId} onChange={(event) => updatePlan(index, { teacherId: event.target.value })}>{teachers.filter((teacher) => teacher.id === plan.teacherId || !plans.some((other, otherIndex) => otherIndex !== index && other.teacherId === teacher.id)).map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name} · {teacher.subject}</option>)}</select><button className="icon-btn" type="button" title="إزالة المدرس" onClick={() => setPlans((current) => current.filter((_item, itemIndex) => itemIndex !== index))}><Trash2 size={16} /></button></div>
            <div className="form-three-col">
              <label className="form-field"><span>شهري</span><input type="number" min="0" value={plan.monthlyPrice} onChange={(event) => updatePlan(index, { monthlyPrice: Number(event.target.value) || 0 })} /></label>
              <label className="form-field"><span>بالحصة</span><input type="number" min="0" value={plan.lessonPrice} onChange={(event) => updatePlan(index, { lessonPrice: Number(event.target.value) || 0 })} /></label>
              <label className="form-field"><span>بالباب</span><input type="number" min="0" value={plan.chapterPrice} onChange={(event) => updatePlan(index, { chapterPrice: Number(event.target.value) || 0 })} /></label>
            </div>
            <label className="switch-row"><input type="checkbox" checked={plan.discountEnabled} onChange={(event) => updatePlan(index, { discountEnabled: event.target.checked })} /> يوجد خصم</label>
            {plan.discountEnabled && <div className="form-two-col"><label className="form-field"><span>نوع الخصم</span><select value={plan.discountKind || "percent"} onChange={(event) => updatePlan(index, { discountKind: event.target.value as Plan["discountKind"] })}><option value="percent">نسبة مئوية</option><option value="amount">مبلغ ثابت</option></select></label><label className="form-field"><span>قيمة الخصم</span><input type="number" min="0" value={plan.discountValue || 0} onChange={(event) => updatePlan(index, { discountValue: Number(event.target.value) || 0 })} /></label></div>}
          </div>)}
          <button className="primary-btn" type="button" disabled={saving} onClick={() => void save()}><Save size={16} />{saving ? "جارٍ الحفظ..." : "حفظ التعديلات"}</button>
        </section>
      </div>
    </div>
  );
}
