import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import {
  ArrowRight, BookOpen, CheckCircle2, ClipboardCheck, FileText, GraduationCap,
  LayoutDashboard, LogOut, MessageCircle, Pencil, Plus, Send, UserRound, Users, Video, X,
} from "lucide-react";
import { toast } from "sonner";
import { api, type ApiUser } from "@/lib/api";
import ImageCropDialog from "@/components/ImageCropDialog";

type Course = { id: string; title: string; description: string; level: string; duration: string; image: string; teacherIds: string[]; lessonCount: number; price: number; published: boolean };
type Lesson = { id: string; courseId: string; title: string; description: string; lectureUrl: string; resourceUrl?: string; unit?: string; published: boolean; createdAt: string };
type Exam = { id: string; courseId: string; title: string; description: string; duration: number; resultVisibility?: "immediate" | "after_review"; published: boolean; questionCount: number; questions?: any[] };
type Submission = { id: string; examId: string; studentId: string; studentName: string; answers: number[]; score: number | null; reviewed: boolean; submittedAt: string };
type Assignment = { id: string; courseId: string; title: string; description: string; dueDate: string; published: boolean };
type AssignmentSubmission = { id: string; assignmentId: string; studentId: string; studentName: string; content: string; score: number | null; submittedAt: string; assignment?: Assignment };
type Enrollment = { id: string; courseId: string; courseTitle: string; studentId?: string; studentName: string; studentPhone: string; grade: string; status: string; createdAt: string };
type Conversation = { id: string; title: string; participantIds: string[]; messageCount?: number };
type Message = { id: string; senderId: string; body: string; createdAt: string };
type Props = { user: ApiUser; initialPage?: string; onLogout: () => void };

const pages = [
  { id: "overview", label: "نظرة عامة", icon: LayoutDashboard },
  { id: "courses", label: "كورساتي", icon: BookOpen },
  { id: "students", label: "الطلاب", icon: Users },
  { id: "lessons", label: "الدروس", icon: Video },
  { id: "follow-up", label: "المتابعة", icon: ClipboardCheck },
  { id: "messages", label: "الرسائل", icon: MessageCircle },
  { id: "profile", label: "ملفي الشخصي", icon: UserRound },
];

export default function TeacherWorkspace({ user, initialPage = "overview", onLogout }: Props) {
  const [page, setPage] = useState(initialPage === "exams" || initialPage === "grades" || initialPage === "assignments" ? "follow-up" : initialPage);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [students, setStudents] = useState<Enrollment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [assignmentSubmissions, setAssignmentSubmissions] = useState<AssignmentSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [nextCourses, nextLessons, nextExams, nextAssignments, nextStudents, nextSubmissions, nextAssignmentSubmissions] = await Promise.all([
        api<Course[]>("/courses?published=false"), api<Lesson[]>("/lessons"), api<Exam[]>("/exams"), api<Assignment[]>("/assignments"),
        api<Enrollment[]>("/enrollments"), api<Submission[]>("/submissions"), api<AssignmentSubmission[]>("/assignment-submissions"),
      ]);
      setCourses(nextCourses); setLessons(nextLessons); setExams(nextExams); setAssignments(nextAssignments);
      setStudents(nextStudents); setSubmissions(nextSubmissions); setAssignmentSubmissions(nextAssignmentSubmissions);
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر تحميل مساحة المدرس"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const navigate = (next: string) => { setPage(next); localStorage.setItem("oxford-page", next); };
  const course = courses[0];
  const title = pages.find((item) => item.id === page)?.label || "مساحة المدرس";

  return <div className="teacher-workspace min-h-screen bg-[#f7f9fc] text-[#18283d]" dir="rtl">
    <header className="border-b border-[#e5ebf2] bg-white/90 px-5 py-4 shadow-sm backdrop-blur md:px-10">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div><p className="text-xs font-bold tracking-[.2em] text-[#1a72d5]">oxford TEACHER STUDIO</p><h1 className="mt-1 text-xl font-extrabold md:text-2xl">{title}</h1></div>
        <div className="flex items-center gap-2"><span className="hidden text-sm text-slate-500 sm:inline">{user.name}</span><button className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" onClick={onLogout} title="تسجيل الخروج"><LogOut size={18} /></button></div>
      </div>
    </header>
    <main className="mx-auto max-w-7xl px-5 py-6 md:px-10 md:py-10">
      {loading ? <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-500">جارٍ تحميل مساحتك...</div> : page === "overview" ? <Overview courses={courses} students={students} lessons={lessons} exams={exams} onNavigate={navigate} user={user} /> :
        page === "courses" ? <CoursesPage courses={courses} /> :
        page === "students" ? <StudentsPage students={students} /> :
        page === "lessons" ? <LessonsPage courses={courses} lessons={lessons} onSaved={load} /> :
        page === "follow-up" ? <FollowUp courses={courses} exams={exams} assignments={assignments} submissions={submissions} assignmentSubmissions={assignmentSubmissions} onSaved={load} /> :
        page === "messages" ? <MessagesPage user={user} students={students} /> : <ProfilePage user={user} onSaved={load} />}
    </main>
    <nav className="mx-auto grid max-w-7xl grid-cols-4 gap-2 px-5 pb-6 sm:grid-cols-7 md:px-10">
      {pages.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => navigate(id)} className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-xs font-semibold transition ${page === id ? "bg-[#e8f3ff] text-[#1a72d5]" : "text-slate-500 hover:bg-white"}`}><Icon size={19} /><span>{label}</span></button>)}
    </nav>
  </div>;
}

function Overview({ courses, students, lessons, exams, user, onNavigate }: { courses: Course[]; students: Enrollment[]; lessons: Lesson[]; exams: Exam[]; user: ApiUser; onNavigate: (page: string) => void }) {
  const cards: { id: string; label: string; value: number | string; icon: typeof BookOpen; color: string }[] = [
    { id: "courses", label: "كورساتي", value: courses.length, icon: BookOpen, color: "bg-blue-50 text-blue-600" },
    { id: "students", label: "الطلاب المسجلون", value: new Set(students.map((item) => item.studentId || item.studentName)).size, icon: Users, color: "bg-emerald-50 text-emerald-600" },
    { id: "lessons", label: "الدروس", value: lessons.length, icon: Video, color: "bg-amber-50 text-amber-600" },
    { id: "follow-up", label: "الاختبارات", value: exams.length, icon: ClipboardCheck, color: "bg-rose-50 text-rose-600" },
    { id: "messages", label: "الرسائل", value: "فتح", icon: MessageCircle, color: "bg-violet-50 text-violet-600" },
    { id: "profile", label: "ملفي الشخصي", value: "فتح", icon: UserRound, color: "bg-slate-100 text-slate-600" },
  ];
  return <div className="space-y-8">
    <section className="rounded-[2rem] bg-gradient-to-l from-[#155eb7] to-[#3b8ce0] p-7 text-white shadow-xl md:p-10"><p className="text-sm text-blue-100">مساحتك التعليمية الخاصة</p><h2 className="mt-2 text-3xl font-extrabold">أهلًا يا {user.name.split(" ")[0]} 👋</h2><p className="mt-3 max-w-xl text-blue-100">أدر كورساتك ودروسك وتابع تقدّم طلابك من لوحة واحدة واضحة.</p></section>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(({ id, label, value, icon: Icon, color }) => <button key={id} onClick={() => onNavigate(id)} className="rounded-3xl border border-slate-200 bg-white p-5 text-right shadow-sm transition hover:-translate-y-1 hover:shadow-md"><span className={`mb-5 inline-flex rounded-2xl p-3 ${color}`}><Icon size={22} /></span><p className="text-sm text-slate-500">{label}</p><strong className="mt-1 block text-3xl">{value}</strong></button>)}</div>
    <div className="grid gap-5 lg:grid-cols-2"><QuickCard title="ابدأ بإدارة الدروس" text="أضف فيديو YouTube أو Drive وشارك ملف PDF أو عرض تقديمي مع طلابك." icon={Video} action="فتح الدروس" onClick={() => onNavigate("lessons")} /><QuickCard title="تابع أداء طلابك" text="أنشئ امتحانًا أو واجبًا، ثم راجع المحاولات والتسليمات." icon={ClipboardCheck} action="فتح المتابعة" onClick={() => onNavigate("follow-up")} /></div>
  </div>;
}
function QuickCard({ title, text, icon: Icon, action, onClick }: { title: string; text: string; icon: typeof Video; action: string; onClick: () => void }) {
  return <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><Icon className="text-[#1a72d5]" size={24} /><h3 className="mt-4 text-xl font-bold">{title}</h3><p className="mt-2 text-sm leading-7 text-slate-500">{text}</p><button className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#1a72d5] px-4 py-2 text-sm font-bold text-white" onClick={onClick}>{action}<ArrowRight size={15} /></button></section>;
}

function CoursesPage({ courses }: { courses: Course[] }) {
  return <section><Heading eyebrow="MY COURSES" title="الكورسات المخصصة لك" text="هذه القائمة تأتي من الخادم وتحتوي فقط على الكورسات التي أُسندت إلى حسابك." />{courses.length === 0 ? <Empty text="لم يُسند إليك أي كورس بعد." /> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{courses.map((course) => <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm" key={course.id}><div className="h-36 bg-slate-100">{course.image && <img src={course.image} alt="" className="h-full w-full object-cover" />}</div><div className="p-5"><div className="flex items-center justify-between text-xs text-slate-500"><span>{course.level}</span><b className="text-[#1a72d5]">{course.lessonCount} درس</b></div><h3 className="mt-3 text-lg font-bold">{course.title}</h3><p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{course.description}</p><p className="mt-4 text-xs text-slate-400">{course.duration} · {course.price} جنيه</p></div></article>)}</div>}</section>;
}

function StudentsPage({ students }: { students: Enrollment[] }) {
  const [query, setQuery] = useState("");
  const rows = students.filter((item) => [item.studentName, item.grade, item.courseTitle, item.studentPhone].some((value) => value?.includes(query)));
  return <section><Heading eyebrow="STUDENT ROSTER" title="طلاب كورساتك" text="بيانات التسجيل والصف والهاتف والكورس تظهر من سجلات الاشتراك الخاصة بك." /><div className="mb-4 max-w-sm"><input className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-400" placeholder="ابحث باسم الطالب..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-right text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-4">الطالب</th><th className="p-4">الصف</th><th className="p-4">الهاتف</th><th className="p-4">الكورس</th><th className="p-4">الحالة</th></tr></thead><tbody>{rows.map((item) => <tr className="border-t border-slate-100" key={item.id}><td className="p-4 font-bold">{item.studentName}</td><td className="p-4 text-slate-600">{item.grade}</td><td className="p-4 text-slate-600" dir="ltr">{item.studentPhone}</td><td className="p-4 text-slate-600">{item.courseTitle}</td><td className="p-4"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">{item.status === "approved" ? "مقبول" : item.status}</span></td></tr>)}</tbody></table></div>{rows.length === 0 && <Empty text="لا يوجد طلاب مسجلون في كورساتك حتى الآن." />}</div></section>;
}

function LessonsPage({ courses, lessons, onSaved }: { courses: Course[]; lessons: Lesson[]; onSaved: () => Promise<void> }) {
  const [selectedCourse, setSelectedCourse] = useState(courses[0]?.id || "");
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", lectureUrl: "", resourceUrl: "", unit: "الباب الأول", published: true });
  useEffect(() => { if (!selectedCourse && courses[0]) setSelectedCourse(courses[0].id); }, [courses, selectedCourse]);
  const shown = lessons.filter((lesson) => lesson.courseId === selectedCourse);
  const edit = (lesson?: Lesson) => { setEditing(lesson || null); setFormOpen(true); setForm(lesson ? { title: lesson.title, description: lesson.description, lectureUrl: lesson.lectureUrl, resourceUrl: lesson.resourceUrl || "", unit: lesson.unit || "الباب الأول", published: lesson.published } : { title: "", description: "", lectureUrl: "", resourceUrl: "", unit: "الباب الأول", published: true }); };
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!selectedCourse) return toast.error("اختر كورسًا أولًا"); if (!/^https?:\/\//i.test(form.lectureUrl)) return toast.error("أدخل رابط فيديو صحيحًا"); try { const wasEditing = Boolean(editing); const payload = { ...form, courseId: selectedCourse, resourceUrl: form.resourceUrl || undefined, unit: form.unit || "الباب الأول" }; if (editing) await api(`/lessons/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) }); else await api("/lessons", { method: "POST", body: JSON.stringify(payload) }); await onSaved(); setFormOpen(false); setEditing(null); toast.success(wasEditing ? "تم تحديث الدرس" : "تمت إضافة الدرس"); } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر حفظ الدرس"); } };
  const chooseResource = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 500_000) return toast.error("الملف كبير جدًا؛ استخدم رابط Drive أو ملفًا أقل من 500KB"); const reader = new FileReader(); reader.onload = () => setForm((previous) => ({ ...previous, resourceUrl: String(reader.result) })); reader.readAsDataURL(file); };
  return <section><Heading eyebrow="LESSON STUDIO" title="دروس كورساتك" text="اختر كورسًا، ثم أضف أو عدّل فيديو الدرس والموارد المساندة." action={<button className="inline-flex items-center gap-2 rounded-xl bg-[#1a72d5] px-4 py-2 text-sm font-bold text-white" onClick={() => edit()}><Plus size={16} />درس جديد</button>} /><div className="mb-5 flex flex-wrap gap-2">{courses.map((course) => <button key={course.id} className={`rounded-xl px-4 py-2 text-sm font-bold ${selectedCourse === course.id ? "bg-[#1a72d5] text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`} onClick={() => setSelectedCourse(course.id)}>{course.title}</button>)}</div><div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><div className="space-y-3">{shown.map((lesson) => <article key={lesson.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex min-w-0 items-center gap-3"><span className="rounded-xl bg-blue-50 p-3 text-blue-600"><Video size={18} /></span><span className="min-w-0"><b className="block truncate">{lesson.title}</b><small className="block truncate text-slate-500">{lesson.description || "بدون وصف"}</small></span></div><div className="flex shrink-0 gap-2"><a className="rounded-lg p-2 text-blue-600 hover:bg-blue-50" href={lesson.lectureUrl} target="_blank" rel="noreferrer"><ArrowRight size={16} /></a><button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => edit(lesson)}><Pencil size={16} /></button></div></article>)}{shown.length === 0 && <Empty text="لا توجد دروس لهذا الكورس بعد." />}</div>{formOpen ? <LessonForm form={form} setForm={setForm} onSubmit={submit} onFile={chooseResource} onCancel={() => { setFormOpen(false); setEditing(null); }} editing={Boolean(editing)} /> : <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">اضغط «درس جديد» لإضافة محتوى إلى الكورس المحدد.</div>}</div></section>;
}
function LessonForm({ form, setForm, onSubmit, onFile, onCancel, editing }: { form: { title: string; description: string; lectureUrl: string; resourceUrl: string; unit: string; published: boolean }; setForm: (value: typeof form) => void; onSubmit: (event: FormEvent) => void; onFile: (event: ChangeEvent<HTMLInputElement>) => void; onCancel: () => void; editing: boolean }) {
  return <form className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={onSubmit}><div className="mb-4 flex items-center justify-between"><h3 className="font-bold">{editing ? "تعديل الدرس" : "درس جديد"}</h3><button type="button" onClick={onCancel}><X size={18} /></button></div><Field label="عنوان الدرس"><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field><Field label="الوصف"><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field><Field label="الباب / الوحدة"><select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}><option value="الباب الأول">الباب الأول</option><option value="الباب الثاني">الباب الثاني</option><option value="الباب الثالث">الباب الثالث</option><option value="الباب الرابع">الباب الرابع</option><option value="وحدة مراجعة شاملة">وحدة مراجعة شاملة</option></select></Field><Field label="رابط الفيديو (YouTube أو Drive)"><input required type="url" placeholder="https://..." value={form.lectureUrl} onChange={(event) => setForm({ ...form, lectureUrl: event.target.value })} /></Field><Field label="رابط PDF / العرض التقديمي (اختياري)"><input value={form.resourceUrl.startsWith("data:") ? "تم اختيار ملف محلي" : form.resourceUrl} placeholder="https://drive.google.com/..." onChange={(event) => setForm({ ...form, resourceUrl: event.target.value })} /></Field><label className="mb-4 block text-sm font-semibold text-slate-600">أو ارفع ملفًا صغيرًا <input className="mt-2 block w-full text-xs" type="file" accept=".pdf,.ppt,.pptx,application/pdf" onChange={onFile} /></label><label className="mb-5 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.published} onChange={(event) => setForm({ ...form, published: event.target.checked })} />نشر الدرس للطلاب</label><button className="w-full rounded-xl bg-[#1a72d5] px-4 py-3 font-bold text-white" type="submit">حفظ الدرس</button></form>;
}

function FollowUp({ courses, exams, assignments, submissions, assignmentSubmissions, onSaved }: { courses: Course[]; exams: Exam[]; assignments: Assignment[]; submissions: Submission[]; assignmentSubmissions: AssignmentSubmission[]; onSaved: () => Promise<void> }) {
  const [tab, setTab] = useState<"exams" | "assignments">("exams");
  return <section><Heading eyebrow="FOLLOW-UP" title="المتابعة والتقييم" text="أنشئ امتحانات واختبارات قصيرة، أو أرسل واجبات وراجع تسليمات طلابك." action={<div className="flex rounded-xl bg-white p-1 ring-1 ring-slate-200"><button className={`rounded-lg px-3 py-2 text-sm font-bold ${tab === "exams" ? "bg-blue-50 text-blue-600" : "text-slate-500"}`} onClick={() => setTab("exams")}>الامتحانات</button><button className={`rounded-lg px-3 py-2 text-sm font-bold ${tab === "assignments" ? "bg-blue-50 text-blue-600" : "text-slate-500"}`} onClick={() => setTab("assignments")}>الواجبات</button></div>} />{tab === "exams" ? <ExamPanel courses={courses} exams={exams} submissions={submissions} onSaved={onSaved} /> : <AssignmentPanel courses={courses} assignments={assignments} submissions={assignmentSubmissions} onSaved={onSaved} />}</section>;
}
function ExamPanel({ courses, exams, submissions, onSaved }: { courses: Course[]; exams: Exam[]; submissions: Submission[]; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState(courses[0]?.id || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("30");
  const [visibility, setVisibility] = useState<"immediate" | "after_review">("immediate");
  const [questions, setQuestions] = useState([{ prompt: "", choices: ["", "", "", ""], correctIndex: 0, marks: 1 }]);
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  const [reviewScore, setReviewScore] = useState<number>(0);
  const [savingReview, setSavingReview] = useState(false);

  useEffect(() => {
    if (courses.length > 0 && !courseId) {
      setCourseId(courses[0].id);
    }
  }, [courses]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const activeCourseId = courseId || courses[0]?.id;
    if (!activeCourseId || questions.some((question) => !question.prompt.trim() || question.choices.some((choice) => !choice.trim()))) return toast.error("أكمل بيانات الأسئلة والاختيارات");
    try {
      await api("/exams", { method: "POST", body: JSON.stringify({ courseId: activeCourseId, title, description, duration: Number(duration), resultVisibility: visibility, questions, published: true }) });
      setOpen(false);
      setTitle("");
      setDescription("");
      setQuestions([{ prompt: "", choices: ["", "", "", ""], correctIndex: 0, marks: 1 }]);
      await onSaved();
      toast.success("تم إنشاء الامتحان بنجاح");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إنشاء الامتحان");
    }
  };

  const handleSaveReview = async () => {
    if (!selectedSubmission) return;
    setSavingReview(true);
    try {
      await api(`/submissions/${selectedSubmission.id}`, {
        method: "PATCH",
        body: JSON.stringify({ score: Number(reviewScore) }),
      });
      toast.success("تم اعتماد الدرجة ومراجعة الامتحان بنجاح");
      setSelectedSubmission(null);
      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ المراجعة");
    } finally {
      setSavingReview(false);
    }
  };

  return (
    <div className="space-y-5">
      <button className="inline-flex items-center gap-2 rounded-xl bg-[#1a72d5] px-4 py-2 text-sm font-bold text-white" onClick={() => setOpen(true)}>
        <Plus size={16} /> إنشـاء امتحـان جديد
      </button>

      {open && (
        <div className="rounded-3xl border border-blue-100 bg-blue-50/50 p-5">
          <form onSubmit={submit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="الكورس">
                <select value={courseId || courses[0]?.id || ""} onChange={(event) => setCourseId(event.target.value)}>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="اسم الامتحان">
                <input required value={title} onChange={(event) => setTitle(event.target.value)} />
              </Field>
            </div>
            <Field label="الوصف">
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="المدة بالدقائق">
                <input type="number" min="1" value={duration} onChange={(event) => setDuration(event.target.value)} />
              </Field>
              <Field label="ظهور النتيجة">
                <select value={visibility} onChange={(event) => setVisibility(event.target.value as typeof visibility)}>
                  <option value="immediate">فور التسليم</option>
                  <option value="after_review">بعد المراجعة</option>
                </select>
              </Field>
            </div>
            {questions.map((question, index) => (
              <div key={index} className="rounded-2xl bg-white p-4 ring-1 ring-blue-100">
                <div className="mb-3 flex items-center justify-between">
                  <b>السؤال {index + 1}</b>
                  {questions.length > 1 && (
                    <button type="button" onClick={() => setQuestions(questions.filter((_, itemIndex) => itemIndex !== index))}>
                      <X size={16} />
                    </button>
                  )}
                </div>
                <input
                  className="mb-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="نص السؤال"
                  value={question.prompt}
                  onChange={(event) =>
                    setQuestions(questions.map((item, itemIndex) => (itemIndex === index ? { ...item, prompt: event.target.value } : item)))
                  }
                />
                {question.choices.map((choice, choiceIndex) => (
                  <div className="mb-2 flex gap-2" key={choiceIndex}>
                    <input
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder={`الاختيار ${choiceIndex + 1}`}
                      value={choice}
                      onChange={(event) =>
                        setQuestions(
                          questions.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  choices: item.choices.map((value, valueIndex) => (valueIndex === choiceIndex ? event.target.value : value)),
                                }
                              : item
                          )
                        )
                      }
                    />
                    <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                      <input
                        type="radio"
                        checked={question.correctIndex === choiceIndex}
                        onChange={() => setQuestions(questions.map((item, itemIndex) => (itemIndex === index ? { ...item, correctIndex: choiceIndex } : item)))}
                      />
                      صحيح
                    </label>
                  </div>
                ))}
                <Field label="الدرجة">
                  <input
                    type="number"
                    min="1"
                    value={question.marks}
                    onChange={(event) =>
                      setQuestions(questions.map((item, itemIndex) => (itemIndex === index ? { ...item, marks: Number(event.target.value) } : item)))
                    }
                  />
                </Field>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-xl bg-white px-4 py-2 text-sm font-bold ring-1 ring-slate-200"
                onClick={() => setQuestions([...questions, { prompt: "", choices: ["", "", "", ""], correctIndex: 0, marks: 1 }])}
              >
                + سؤال آخر
              </button>
              <button className="rounded-xl bg-[#1a72d5] px-4 py-2 text-sm font-bold text-white">حفظ الامتحان</button>
            </div>
          </form>
        </div>
      )}

      {/* Exam Review Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">مراجعة إجابات الطالب: {selectedSubmission.studentName}</h3>
                <p className="text-xs text-slate-500">استعرض الأسئلة والإجابات المحددة من الطالب ورصّد الدرجة المناسبة.</p>
              </div>
              <button className="rounded-xl p-2 hover:bg-slate-100" onClick={() => setSelectedSubmission(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="my-6 space-y-4">
              {selectedSubmission.exam?.questions?.map((q: any, idx: number) => {
                const studentAnsObj = selectedSubmission.answers?.find((a: any) => a.questionId === q.id);
                const studentAnsIndex = studentAnsObj ? studentAnsObj.selectedIndex : selectedSubmission.answers?.[idx];
                const isCorrect = studentAnsIndex === q.correctIndex;

                return (
                  <div key={q.id || idx} className={`rounded-2xl border p-4 text-sm ${isCorrect ? "border-emerald-200 bg-emerald-50/40" : "border-red-200 bg-red-50/40"}`}>
                    <div className="flex justify-between font-bold text-slate-900 mb-2">
                      <span>السؤال {idx + 1}: {q.prompt}</span>
                      <span className={isCorrect ? "text-emerald-700" : "text-red-700"}>
                        {isCorrect ? "إجابة صحيحة ✓" : "إجابة خاطئة ✗"}
                      </span>
                    </div>
                    <div className="grid gap-2">
                      {q.choices?.map((c: string, cIdx: number) => {
                        const isStudentChoice = studentAnsIndex === cIdx;
                        const isRightChoice = q.correctIndex === cIdx;
                        return (
                          <div
                            key={cIdx}
                            className={`rounded-xl px-3 py-2 text-xs flex justify-between items-center ${
                              isStudentChoice
                                ? isRightChoice
                                  ? "bg-emerald-600 text-white font-bold"
                                  : "bg-red-600 text-white font-bold"
                                : isRightChoice
                                ? "bg-emerald-100 text-emerald-900 font-bold border border-emerald-300"
                                : "bg-white text-slate-700 border border-slate-200"
                            }`}
                          >
                            <span>{c}</span>
                            {isStudentChoice && <span>(إجابة الطالب)</span>}
                            {isRightChoice && !isStudentChoice && <span>(الإجابة الصحيحة)</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }) || <p className="text-center text-slate-400 py-4">بيانات الأسئلة غير متاحة للسيشن الحالي</p>}
            </div>

            {(() => {
              const examMaxScore = selectedSubmission?.exam?.questions?.reduce((sum: number, q: any) => sum + Number(q.marks || 1), 0) || 100;
              return (
                <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                  <label className="block text-sm font-bold text-slate-800 mb-2">
                    درجة الطالب النهائية (من {examMaxScore}):
                  </label>
                  <div className="flex gap-3 items-center">
                    <input
                      type="number"
                      min="0"
                      max={examMaxScore}
                      className="w-32 rounded-xl border border-slate-300 p-2 text-lg font-black text-center"
                      value={reviewScore}
                      onChange={(e) => setReviewScore(Number(e.target.value))}
                    />
                    <span className="text-slate-500 font-bold">/ {examMaxScore}</span>
                  </div>
                </div>
              );
            })()}

            <div className="mt-6 flex justify-end gap-3">
              <button className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600" onClick={() => setSelectedSubmission(null)}>
                إلغاء
              </button>
              <button
                className="rounded-xl bg-[#1a72d5] px-6 py-2 font-bold text-white shadow-md hover:bg-blue-600"
                disabled={savingReview}
                onClick={handleSaveReview}
              >
                {savingReview ? "جاري الحفظ..." : "حفظ الدرجة وتوثيق المراجعة ✓"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {exams.map((exam) => (
          <article key={exam.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-lg text-slate-900">{exam.title}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {courses.find((course) => course.id === exam.courseId)?.title} · {exam.questionCount || exam.questions?.length} أسئلة · {exam.duration} دقيقة
                </p>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600">
                {submissions.filter((item) => item.examId === exam.id).length} محاولة
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {submissions
                .filter((item) => item.examId === exam.id)
                .map((submission) => (
                  <div
                    className="flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm border border-slate-100 transition-all hover:border-blue-200 hover:bg-blue-50/30"
                    key={submission.id}
                  >
                    <div>
                      <strong className="block font-bold text-slate-900">{submission.studentName}</strong>
                      <small className="text-xs text-slate-500">
                        {submission.submittedAt ? new Date(submission.submittedAt).toLocaleDateString("ar-EG") : "مؤخراً"}
                      </small>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${submission.reviewed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                        {submission.reviewed ? `معتمد: ${submission.score}` : "بانتظار المراجعة"}
                      </span>
                      <button
                        className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                        onClick={() => {
                          setSelectedSubmission(submission);
                          setReviewScore(submission.score ?? 0);
                        }}
                      >
                        مراجعة ودعم الإجابة 📝
                      </button>
                    </div>
                  </div>
                ))}
              {submissions.filter((item) => item.examId === exam.id).length === 0 && (
                <p className="py-2 text-center text-xs text-slate-400">لا توجد محاولات تسليم لهذا الامتحان بعد</p>
              )}
            </div>
          </article>
        ))}
      </div>
      {exams.length === 0 && <Empty text="لم تنشئ امتحانات بعد." />}
    </div>
  );
}

function renderSubmissionContent(text: string) {
  if (!text) return null;
  const match = text.match(/\[صورة المرفق\]:\s*(\S+)/);
  const imageUrl = match ? match[1] : (text.startsWith("data:image/") || text.startsWith("http") ? text : null);
  const plainText = match 
    ? text.replace(/\[صورة المرفق\]:\s*\S+/, "").trim() 
    : (imageUrl ? "" : text.trim());

  return (
    <div className="space-y-2 break-words max-w-full overflow-hidden">
      {plainText && <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line break-all">{plainText}</p>}
      {imageUrl && (
        <div className="mt-2 rounded-xl bg-slate-100 p-2 border border-slate-200">
          <span className="block text-xs font-bold text-slate-600 mb-1">📸 الصورة المرفقة بالحل:</span>
          <img
            src={imageUrl}
            alt="صورة الحل"
            className="max-h-48 max-w-full rounded-lg object-contain shadow-sm cursor-pointer hover:opacity-95 transition-opacity"
            onClick={() => {
              const w = window.open("");
              w?.document.write(`<title>صورة الحل المرفقة</title><img src="${imageUrl}" style="max-width:100%" />`);
            }}
          />
        </div>
      )}
    </div>
  );
}

function AssignmentPanel({
  courses,
  assignments,
  submissions,
  onSaved,
}: {
  courses: Course[];
  assignments: Assignment[];
  submissions: AssignmentSubmission[];
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState({ courseId: "", title: "", description: "", dueDate: "" });
  const [reviewModal, setReviewModal] = useState<AssignmentSubmission | null>(null);
  const [reviewScore, setReviewScore] = useState<number>(100);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (courses.length > 0 && !form.courseId) {
      setForm((prev) => ({ ...prev, courseId: courses[0].id }));
    }
  }, [courses]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const activeCourseId = form.courseId || courses[0]?.id;
    if (!activeCourseId) return toast.error("يرجى اختيار الكورس أولاً");
    try {
      await api("/assignments", { method: "POST", body: JSON.stringify({ ...form, courseId: activeCourseId, published: true }) });
      setForm({ courseId: courses[0]?.id || "", title: "", description: "", dueDate: "" });
      await onSaved();
      toast.success("تم إنشاء الواجب بنجاح");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إنشاء الواجب");
    }
  };

  const saveAssignmentReview = async () => {
    if (!reviewModal) return;
    setSaving(true);
    try {
      await api(`/assignment-submissions/${reviewModal.id}`, {
        method: "PATCH",
        body: JSON.stringify({ score: reviewScore }),
      });
      toast.success("تم تسجيل تقييم الواجب بنجاح ✓");
      setReviewModal(null);
      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ التقييم");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Assignment Review Modal */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900">مراجعة وتقييم الواجب</h3>
                <p className="text-xs text-slate-500">الطالب: {reviewModal.studentName}</p>
              </div>
              <button className="rounded-full p-2 hover:bg-slate-100" onClick={() => setReviewModal(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="my-4 space-y-3">
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                <span className="block text-xs font-bold text-slate-500 mb-2">إجابة الطالب والملفات المرفقة:</span>
                {renderSubmissionContent(reviewModal.content)}
              </div>

              <div className="rounded-2xl bg-blue-50/60 p-4 border border-blue-200">
                <label className="block text-sm font-bold text-slate-800 mb-2">
                  درجة الطالب على الواجب (من 100):
                </label>
                <div className="flex gap-3 items-center">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="w-32 rounded-xl border border-slate-300 p-2 text-lg font-black text-center bg-white"
                    value={reviewScore}
                    onChange={(e) => setReviewScore(Number(e.target.value))}
                  />
                  <span className="text-slate-600 font-bold">/ 100</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600" onClick={() => setReviewModal(null)}>
                إلغاء
              </button>
              <button
                className="rounded-xl bg-[#1a72d5] px-6 py-2 font-bold text-white shadow-md hover:bg-blue-600"
                disabled={saving}
                onClick={saveAssignmentReview}
              >
                {saving ? "جاري الحفظ..." : "حفظ التقييم ورصد الدرجة ✓"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <form className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={submit}>
          <h3 className="mb-4 text-lg font-bold">إنشاء واجب جديد</h3>
          <Field label="الكورس">
            <select value={form.courseId || courses[0]?.id || ""} onChange={(event) => setForm({ ...form, courseId: event.target.value })}>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="عنوان الواجب">
            <input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </Field>
          <Field label="الوصف">
            <textarea required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </Field>
          <Field label="موعد التسليم">
            <input required type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
          </Field>
          <button className="w-full rounded-xl bg-[#1a72d5] px-4 py-3 font-bold text-white">نشر الواجب للطلاب</button>
        </form>
        <div className="space-y-3">
          {assignments.map((assignment) => (
            <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" key={assignment.id}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold">{assignment.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {courses.find((course) => course.id === assignment.courseId)?.title} · التسليم {assignment.dueDate}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700 font-bold">
                  {submissions.filter((item) => item.assignmentId === assignment.id).length} تسليم
                </span>
              </div>
              {submissions
                .filter((item) => item.assignmentId === assignment.id)
                .map((item) => (
                  <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm border border-slate-100 overflow-hidden" key={item.id}>
                    <div className="flex items-center justify-between font-bold mb-2">
                      <span className="text-slate-900">{item.studentName}</span>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${item.score !== null ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                          {item.score !== null ? `الدرجة: ${item.score}/100` : "لم تُرصد درجة"}
                        </span>
                        <button
                          className="rounded-xl bg-blue-600 px-3 py-1 text-xs font-bold text-white hover:bg-blue-700"
                          onClick={() => { setReviewModal(item); setReviewScore(item.score || 100); }}
                        >
                          مراجعة وتقييم الواجب 📝
                        </button>
                      </div>
                    </div>
                    {renderSubmissionContent(item.content)}
                  </div>
                ))}
            </article>
          ))}
          {assignments.length === 0 && <Empty text="لم تنشئ واجبات بعد." />}
        </div>
      </div>
    </>
  );
}

function MessagesPage({ user, students }: { user: ApiUser; students: Enrollment[] }) {
  const [body, setBody] = useState(""); const [conversations, setConversations] = useState<Conversation[]>([]); const [selected, setSelected] = useState<Conversation | null>(null); const [messages, setMessages] = useState<Message[]>([]);
  useEffect(() => { void api<Conversation[]>("/conversations").then((items) => { setConversations(items); setSelected(items[0] || null); }).catch(() => undefined); }, []);
  useEffect(() => { if (selected) void api<Message[]>(`/conversations/${selected.id}/messages`).then(setMessages).catch(() => undefined); }, [selected]);
  const startConversation = async () => { const student = students.find((item) => item.studentId); if (!student?.studentId) return toast.info("لا يوجد طالب بحساب يمكن بدء محادثة معه"); try { const conversation = await api<Conversation>("/conversations", { method: "POST", body: JSON.stringify({ participantIds: [student.studentId], title: student.studentName }) }); setConversations([...conversations, conversation]); setSelected(conversation); } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر إنشاء المحادثة"); } };
  const send = async (event: FormEvent) => { event.preventDefault(); if (!selected || !body.trim()) return; try { const message = await api<Message>(`/conversations/${selected.id}/messages`, { method: "POST", body: JSON.stringify({ body: body.trim() }) }); setMessages([...messages, message]); setBody(""); } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر إرسال الرسالة"); } };
  return <section><Heading eyebrow="MESSAGES" title="رسائل الطلاب" text="تواصل مع طلابك من مساحة واحدة." /><div className="grid min-h-[420px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[280px_1fr]"><div className="border-l border-slate-100 p-4"><div className="flex items-center justify-between"><h3 className="font-bold">المحادثات</h3><button className="rounded-lg p-2 text-blue-600 hover:bg-blue-50" onClick={() => void startConversation()}><Plus size={16} /></button></div>{conversations.map((conversation) => <button key={conversation.id} className={`mt-3 w-full rounded-2xl p-3 text-right text-sm font-bold ${selected?.id === conversation.id ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50"}`} onClick={() => setSelected(conversation)}>{conversation.title}</button>)}{conversations.length === 0 && <p className="mt-4 text-xs text-slate-400">لا توجد محادثات بعد. ابدأ محادثة مع طالب من زر +.</p>}</div><div className="flex flex-col"><div className="border-b border-slate-100 p-4 font-bold">صندوق المدرس · {user.name}</div><div className="flex-1 space-y-3 bg-slate-50 p-5 text-sm">{selected ? messages.map((message) => <div className={`max-w-md rounded-2xl p-3 ${message.senderId === user.id ? "mr-auto rounded-tl-sm bg-[#1a72d5] text-white" : "rounded-tr-sm bg-white text-slate-600"}`} key={message.id}>{message.body}</div>) : <p className="text-slate-400">اختر محادثة لعرض الرسائل.</p>}</div><form className="flex gap-2 border-t border-slate-100 p-3" onSubmit={send}><input className="flex-1 rounded-xl border border-slate-200 px-3 py-2" placeholder="اكتب رسالة..." value={body} onChange={(event) => setBody(event.target.value)} /><button className="rounded-xl bg-[#1a72d5] p-3 text-white"><Send size={16} /></button></form></div></div></section>;
}
function ProfilePage({ user, onSaved }: { user: ApiUser; onSaved: () => Promise<void> }) {
  const [profile, setProfile] = useState(user);
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || "");
  const [subject, setSubject] = useState(user.subject || "");
  const [avatar, setAvatar] = useState(user.avatar || "");
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setProfile(user);
    setName(user.name);
    setPhone(user.phone || "");
    setSubject(user.subject || "");
    setAvatar(user.avatar || "");
  }, [user]);

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCropFile(file);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await api<ApiUser>("/profile", {
        method: "PATCH",
        body: JSON.stringify({ name, phone, subject, avatar: avatar || undefined }),
      });
      const nextProfile = { ...profile, ...updated, name: updated.name || name, phone: updated.phone || phone, subject: updated.subject || subject, avatar: updated.avatar || avatar || profile.avatar };
      setProfile(nextProfile);
      setName(nextProfile.name);
      setPhone(nextProfile.phone || "");
      setSubject(nextProfile.subject || "");
      setAvatar(nextProfile.avatar || "");
      await onSaved();
      toast.success("تم حفظ الملف الشخصي");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ الملف");
    } finally {
      setSaving(false);
    }
  };

  return <><section><Heading eyebrow="ACCOUNT" title="ملفي الشخصي" text="حدّث بيانات التواصل الخاصة بك." /><form className="max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" onSubmit={save}><div className="mb-6 flex items-center gap-4"><span className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-blue-100 text-2xl font-extrabold text-blue-700">{avatar ? <img src={avatar} alt={name} className="h-full w-full object-cover" /> : (name[0] || "؟")}</span><div><h3 className="font-bold">{name}</h3><p className="text-sm text-slate-500">{subject || "مدرس"}</p></div></div><div className="mb-4 flex items-center gap-3"><label className="cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700"><input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />تغيير الصورة</label>{avatar && <span className="text-xs text-slate-500">تم اختيار صورة جديدة</span>}</div><Field label="الاسم"><input required value={name} onChange={(event) => setName(event.target.value)} /></Field><Field label="البريد الإلكتروني"><input readOnly value={profile.email} /></Field><Field label="المادة"><input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="مثل: الرياضيات" /></Field><Field label="رقم الهاتف"><input value={phone} onChange={(event) => setPhone(event.target.value)} /></Field><button className="rounded-xl bg-[#1a72d5] px-5 py-3 font-bold text-white" type="submit" disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ التغييرات"}</button></form></section>{cropFile && <ImageCropDialog file={cropFile} onCancel={() => setCropFile(null)} onComplete={value => { setAvatar(value); setCropFile(null); }} />}</>;
}

function Heading({ eyebrow, title, text, action }: { eyebrow: string; title: string; text: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold tracking-[.18em] text-[#1a72d5]">{eyebrow}</p><h2 className="mt-2 text-3xl font-extrabold">{title}</h2><p className="mt-2 text-sm text-slate-500">{text}</p></div>{action}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="mb-3 block text-sm font-semibold text-slate-600"><span className="mb-1 block">{label}</span>{children}</label>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">{text}</div>; }
