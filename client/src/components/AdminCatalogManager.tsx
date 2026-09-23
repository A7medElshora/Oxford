import { FormEvent, useEffect, useState, type ChangeEvent } from "react";
import { Plus, Save, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { compressImage } from "@/lib/image";
import ImageCropDialog from "@/components/ImageCropDialog";

type Course = { id: string; title: string; description: string; level: string; duration: string; price: number; published: boolean; teacherIds: string[]; targetGrades?: string[] };
type Teacher = { id: string; name: string; subject: string; bio: string; image?: string; courseIds: string[]; plans: { label: string; price: number }[] };
type Props = { page: "teachers" | "courses"; onNavigate: (page: string) => void };

export default function AdminCatalogManager({ page, onNavigate }: Props) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [pendingTeachers, setPendingTeachers] = useState<any[]>([]);
  const [teacher, setTeacher] = useState({ name: "", subject: "", bio: "" });
  const [teacherImage, setTeacherImage] = useState("");
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [savingTeacher, setSavingTeacher] = useState(false);
  const load = async () => { const [nextCourses, nextTeachers, users] = await Promise.all([api<Course[]>("/courses?published=false"), api<Teacher[]>("/teachers"), api<any[]>("/users?status=pending")]); setCourses(nextCourses); setTeachers(nextTeachers); setPendingTeachers(users.filter(u => u.status === "pending" && (u.role === "teacher" || u.role === "admin"))); };
  useEffect(() => { void load().catch((error) => toast.error(error instanceof Error ? error.message : "تعذر تحميل الكتالوج")); }, []);
  
  const reviewUser = async (userId: string, status: "approved" | "rejected") => { try { await api(`/users/${userId}/status`, { method: "PATCH", body: JSON.stringify({ status }) }); await load(); toast.success(status === "approved" ? "تم الموافقة تمت الإضافة للمدرسين" : "تم رفض الانضمام"); } catch (error) { toast.error("تعذر تحديث حالة المستخدم"); } };
  const chooseTeacherImage = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) setCropFile(file); };
  const addTeacher = async (event: FormEvent) => { event.preventDefault(); setSavingTeacher(true); try { await api<Teacher>("/teachers", { method: "POST", body: JSON.stringify({ ...teacher, image: teacherImage, courseIds: [], trustLabel: "مدرس جديد", plans: [] }) }); setTeacher({ name: "", subject: "", bio: "" }); setTeacherImage(""); await load(); toast.success("تمت إضافة المدرس من الخادم"); } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر إضافة المدرس"); } finally { setSavingTeacher(false); } };
  const toggleCourse = async (item: Course) => { try { await api<Course>(`/courses/${item.id}`, { method: "PATCH", body: JSON.stringify({ published: !item.published }) }); await load(); toast.success(item.published ? "تم إخفاء الكورس" : "تم نشر الكورس"); } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر تحديث الكورس"); } };
  if (page === "courses") {
    return <div className="admin-catalog-grid">
      <section className="paper-card published-panel admin-catalog-full">
        <div className="card-title">
          <div><span className="eyebrow">LIVE CATALOG</span><h2>الكورسات المتاحة</h2><p>راجع الكورسات المنشورة والمخفية، وأضف كورسًا جديدًا مع مدرسين وأسعارهم.</p></div>
          <button className="primary-btn" type="button" onClick={() => onNavigate("course-new")}><Plus size={15} /> إضافة كورس</button>
        </div>
        {courses.map((item) => <div className="published-row" key={item.id}>
          <button className="link-action" type="button" onClick={() => onNavigate(`course-detail:${item.id}`)}><div><strong>{item.title}</strong><small>{item.id} · {item.price} جنيه · {item.teacherIds.length} مدرسين{item.targetGrades?.length ? ` · ${item.targetGrades.join("، ")}` : ""}</small></div></button>
          <button className="link-action" type="button" onClick={() => void toggleCourse(item)}>{item.published ? "إخفاء" : "نشر"}</button>
        </div>)}
        {courses.length === 0 && <p className="muted">لا توجد كورسات مضافة حتى الآن.</p>}
      </section>
    </div>;
  }

  return <><div className="admin-catalog-grid">
    <div style={{ display: "flex", flexDirection: "column", gap: "25px", gridColumn: "1 / -1" }}>
      {pendingTeachers.length > 0 && (
        <section className="paper-card published-panel" style={{ borderColor: "var(--accent)" }}>
          <div className="card-title">
             <div><span className="eyebrow" style={{ color: "var(--accent)" }}>NEW REQUESTS</span><h2 style={{ color: "var(--accent)" }}>طلبات الانضمام وتوثيق الحسابات ({pendingTeachers.length})</h2><p>قام هؤلاء بإنشاء حسابات وينتظرون موافقة الإدارة (Admins/Teachers)</p></div>
          </div>
          {pendingTeachers.map((item) => (
             <div className="published-row" key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
               <div><strong>{item.name}</strong><small>{item.role === "teacher" ? `مدرس (${item.subject || "غير محدد"})` : "أدمن"} · {item.email}</small></div>
               <div style={{ display: "flex", gap: "10px" }}>
                 <button className="primary-btn compact" onClick={() => void reviewUser(item.id, "approved")}>موافقة</button>
                 <button className="secondary-btn compact" onClick={() => void reviewUser(item.id, "rejected")}>رفض الحساب</button>
               </div>
             </div>
          ))}
        </section>
      )}
    </div>

    <section className="paper-card creator-form">
      <div className="form-heading"><span className="eyebrow">ADMIN / TEACHERS</span><h2>إضافة مدرس</h2><p>الإدارة هي الجهة الوحيدة التي تنشئ حسابات المدرسين.</p></div>
      <form onSubmit={addTeacher}>
        <Field label="الاسم"><input required value={teacher.name} onChange={(event) => setTeacher({ ...teacher, name: event.target.value })} /></Field>
        <Field label="التخصص"><input required value={teacher.subject} onChange={(event) => setTeacher({ ...teacher, subject: event.target.value })} /></Field>
        <label className="image-upload"><span>صورة المدرس</span><input type="file" accept="image/*" onChange={chooseTeacherImage} />{teacherImage && <img className="teacher-image-preview" src={teacherImage} alt="معاينة صورة المدرس" />}</label>
        <Field label="نبذة"><textarea value={teacher.bio} onChange={(event) => setTeacher({ ...teacher, bio: event.target.value })} /></Field>
        <button className="primary-btn" type="submit" disabled={savingTeacher}><UserPlus size={15} /> {savingTeacher ? "جارٍ الإضافة..." : "إضافة المدرس"}</button>
      </form>
    </section>
    <section className="paper-card published-panel">
      <div className="card-title"><div><span className="eyebrow">TEACHER DIRECTORY</span><h2>المدرسون الحاليون</h2></div><Save size={17} /></div>
      {teachers.map((item) => <div className="published-row" key={item.id}>{item.image && <img className="teacher-image-preview" src={item.image} alt="" />}<div><strong>{item.name}</strong><small>{item.subject} · {item.courseIds.length} كورسات</small></div></div>)}
      {teachers.length === 0 && <p className="muted">لا يوجد مدرسون مضافون حتى الآن.</p>}
    </section>
  </div>{cropFile && <ImageCropDialog file={cropFile} onCancel={() => setCropFile(null)} onComplete={value => { setTeacherImage(value); setCropFile(null); }} />}</>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="form-field"><span>{label}</span>{children}</label>; }
