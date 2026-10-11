import { FormEvent, useEffect, useState, type ChangeEvent } from "react";
import {
  Plus,
  Save,
  UserPlus,
  Search,
  Eye,
  EyeOff,
  BookOpen,
  GraduationCap,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  Filter,
  ArrowLeft,
  ShieldCheck,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import ImageCropDialog from "@/components/ImageCropDialog";
import { CardSkeleton, TableSkeleton } from "@/components/ui/skeleton";

type Course = {
  id: string;
  title: string;
  description: string;
  level: string;
  duration: string;
  price: number;
  published: boolean;
  teacherIds: string[];
  targetGrades?: string[];
  image?: string;
};

type Teacher = {
  id: string;
  name: string;
  subject: string;
  bio: string;
  image?: string;
  courseIds: string[];
  plans: { label: string; price: number }[];
};

type Props = { page: "teachers" | "courses"; onNavigate: (page: string) => void };

export default function AdminCatalogManager({ page, onNavigate }: Props) {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [pendingTeachers, setPendingTeachers] = useState<any[]>([]);
  const [teacher, setTeacher] = useState<{ name: string; subject: string; bio: string }>({ name: "", subject: "", bio: "" });
  const [teacherImage, setTeacherImage] = useState("");
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [savingTeacher, setSavingTeacher] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "published" | "hidden">("all");

  const load = async () => {
    setLoading(true);
    try {
      const [nextCourses, nextTeachers, users] = await Promise.all([
        api<Course[]>("/courses?published=false"),
        api<Teacher[]>("/teachers"),
        api<any[]>("/users?status=pending"),
      ]);
      setCourses(nextCourses);
      setTeachers(nextTeachers);
      setPendingTeachers(users.filter((u) => u.status === "pending" && (u.role === "teacher" || u.role === "admin")));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تحميل الكتالوج");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const reviewUser = async (userId: string, status: "approved" | "rejected") => {
    try {
      await api(`/users/${userId}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      await load();
      toast.success(status === "approved" ? "تم الموافقة وتفعيل الحساب" : "تم رفض الانضمام");
    } catch {
      toast.error("تعذر تحديث حالة المستخدم");
    }
  };

  const chooseTeacherImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) setCropFile(file);
  };

  const addTeacher = async (event: FormEvent) => {
    event.preventDefault();
    setSavingTeacher(true);
    try {
      await api<Teacher>("/teachers", {
        method: "POST",
        body: JSON.stringify({ ...teacher, image: teacherImage, courseIds: [], trustLabel: "مدرس جديد", plans: [] }),
      });
      setTeacher({ name: "", subject: "", bio: "" });
      setTeacherImage("");
      await load();
      toast.success("تمت إضافة المدرس بنجاح");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إضافة المدرس");
    } finally {
      setSavingTeacher(false);
    }
  };

  const toggleCourse = async (item: Course) => {
    try {
      await api<Course>(`/courses/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ published: !item.published }),
      });
      await load();
      toast.success(item.published ? "تم إخفاء الكورس من المتجر" : "تم نشر الكورس للطلاب");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تحديث حالة الكورس");
    }
  };

  // Filter courses based on search & status
  const filteredCourses = courses.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.targetGrades && c.targetGrades.some((g) => g.toLowerCase().includes(searchQuery.toLowerCase())));
    if (filterStatus === "published") return matchesSearch && c.published;
    if (filterStatus === "hidden") return matchesSearch && !c.published;
    return matchesSearch;
  });

  const publishedCount = courses.filter((c) => c.published).length;
  const hiddenCount = courses.filter((c) => !c.published).length;

  if (page === "courses") {
    return (
      <div className="admin-courses-view" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Header & Metrics Bar */}
        <div
          className="paper-card"
          style={{
            padding: "24px 28px",
            borderRadius: "16px",
            background: "linear-gradient(135deg, var(--surface) 0%, rgba(244,123,32,0.03) 100%)",
            border: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="eyebrow" style={{ color: "var(--primary)", fontWeight: 700 }}>ACADEMIC CATALOG</span>
                <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "12px", background: "rgba(244,123,32,0.12)", color: "var(--primary)", fontWeight: 700 }}>
                  {courses.length} كورسات
                </span>
              </div>
              <h1 style={{ fontSize: "26px", margin: "6px 0 4px", fontWeight: 800 }}>الكورسات والبرامج المتاحة</h1>
              <p style={{ color: "var(--ink-muted)", fontSize: "13px", margin: 0 }}>
                إدارة المسارات الأكاديمية والصفوف الدراسية، التحكم في حالة النشر والربط مع المدرسين والخطط.
              </p>
            </div>
            <button
              className="primary-btn"
              type="button"
              onClick={() => onNavigate("course-new")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 22px",
                borderRadius: "12px",
                fontWeight: 700,
                fontSize: "14px",
                boxShadow: "0 4px 14px rgba(244,123,32,0.25)",
              }}
            >
              <Plus size={18} /> إضافة كورس جديد
            </button>
          </div>

          {/* Quick Metrics Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
            <div style={{ padding: "14px 18px", borderRadius: "12px", background: "var(--surface-raised, rgba(255,255,255,0.04))", border: "1px solid var(--border)" }}>
              <span style={{ fontSize: "12px", color: "var(--ink-muted)" }}>إجمالي الكورسات</span>
              <div style={{ fontSize: "22px", fontWeight: 800, marginTop: "4px", color: "var(--ink)" }}>{courses.length}</div>
            </div>
            <div style={{ padding: "14px 18px", borderRadius: "12px", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)" }}>
              <span style={{ fontSize: "12px", color: "#10b981" }}>نشط ومنشور للطلاب</span>
              <div style={{ fontSize: "22px", fontWeight: 800, marginTop: "4px", color: "#10b981" }}>{publishedCount}</div>
            </div>
            <div style={{ padding: "14px 18px", borderRadius: "12px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <span style={{ fontSize: "12px", color: "#f59e0b" }}>مسودة أو مخفي</span>
              <div style={{ fontSize: "22px", fontWeight: 800, marginTop: "4px", color: "#f59e0b" }}>{hiddenCount}</div>
            </div>
            <div style={{ padding: "14px 18px", borderRadius: "12px", background: "var(--surface-raised, rgba(255,255,255,0.04))", border: "1px solid var(--border)" }}>
              <span style={{ fontSize: "12px", color: "var(--ink-muted)" }}>المدرسون المشاركون</span>
              <div style={{ fontSize: "22px", fontWeight: 800, marginTop: "4px", color: "var(--ink)" }}>{teachers.length} مدرس</div>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", paddingTop: "8px", borderTop: "1px dashed var(--border)" }}>
            <div style={{ position: "relative", flex: "1", minWidth: "240px" }}>
              <Search size={16} style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--ink-muted)" }} />
              <input
                type="text"
                placeholder="ابحث باسم الكورس، الكود، أو الصف الدراسي..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 42px 10px 14px",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  color: "var(--ink)",
                  fontSize: "13px",
                  outline: "none",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                onClick={() => setFilterStatus("all")}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: filterStatus === "all" ? "var(--primary)" : "var(--surface)",
                  color: filterStatus === "all" ? "#fff" : "var(--ink)",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                الكل ({courses.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("published")}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: filterStatus === "published" ? "#10b981" : "var(--surface)",
                  color: filterStatus === "published" ? "#fff" : "var(--ink)",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                منشور فقط ({publishedCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("hidden")}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: filterStatus === "hidden" ? "#f59e0b" : "var(--surface)",
                  color: filterStatus === "hidden" ? "#fff" : "var(--ink)",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                مخفي فقط ({hiddenCount})
              </button>
            </div>
          </div>
        </div>

        {/* Courses Cards Grid */}
        {loading ? (
          <CardSkeleton count={6} />
        ) : filteredCourses.length === 0 ? (
          <div className="paper-card" style={{ padding: "60px 20px", textAlign: "center", borderRadius: "16px" }}>
            <BookOpen size={48} style={{ opacity: 0.3, margin: "0 auto 12px" }} />
            <h3 style={{ fontSize: "18px", margin: "0 0 6px" }}>لا توجد كورسات مطابقة</h3>
            <p className="muted" style={{ fontSize: "13px" }}>جرّب تغيير كلمات البحث أو أضف كورسًا جديدًا بدلاً من ذلك.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "20px" }}>
            {filteredCourses.map((item) => {
              const courseTeachers = teachers.filter((t) => item.teacherIds?.includes(t.id));

              return (
                <div
                  key={item.id}
                  className="paper-card"
                  style={{
                    padding: "0",
                    borderRadius: "16px",
                    overflow: "hidden",
                    border: item.published ? "1px solid var(--border)" : "1px dashed rgba(245,158,11,0.4)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    transition: "all 0.22s ease",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
                    background: "var(--surface)",
                  }}
                >
                  {/* Card Banner / Header Image */}
                  <div
                    style={{
                      position: "relative",
                      height: "140px",
                      background: item.image
                        ? `url(${item.image}) center/cover no-repeat`
                        : "linear-gradient(135deg, #2c3e50 0%, #000000 100%)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      padding: "14px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "4px 10px",
                          borderRadius: "20px",
                          background: item.published ? "#10b981" : "#f59e0b",
                          color: "#fff",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                        }}
                      >
                        {item.published ? <CheckCircle2 size={12} /> : <EyeOff size={12} />}
                        {item.published ? "منشور للطلاب" : "مخفي كمسودة"}
                      </span>

                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "4px 10px",
                          borderRadius: "20px",
                          background: "rgba(0,0,0,0.65)",
                          color: "#fff",
                          backdropFilter: "blur(4px)",
                          direction: "ltr",
                        }}
                      >
                        #{item.id}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "11px", background: "rgba(255,255,255,0.9)", color: "#111", padding: "3px 9px", borderRadius: "6px", fontWeight: 700 }}>
                        {item.level || "كل المستويات"}
                      </span>
                      {item.duration && (
                        <span style={{ fontSize: "11px", background: "rgba(0,0,0,0.65)", color: "#fff", padding: "3px 9px", borderRadius: "6px", backdropFilter: "blur(4px)" }}>
                          ⏱️ {item.duration}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Content Body */}
                  <div style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "14px", flex: 1 }}>
                    <div>
                      <h3 style={{ fontSize: "18px", fontWeight: 800, margin: "0 0 6px", color: "var(--ink)", lineHeight: 1.3 }}>
                        {item.title}
                      </h3>
                      {item.description && (
                        <p style={{ fontSize: "12.5px", color: "var(--ink-muted)", margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.5 }}>
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* Target Grades Pills */}
                    {item.targetGrades && item.targetGrades.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                        {item.targetGrades.map((grade) => (
                          <span
                            key={grade}
                            style={{
                              fontSize: "10.5px",
                              padding: "2px 8px",
                              borderRadius: "6px",
                              background: "var(--primary-subtle, rgba(244,123,32,0.08))",
                              color: "var(--primary)",
                              fontWeight: 600,
                            }}
                          >
                            {grade}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Linked Teachers */}
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <GraduationCap size={15} style={{ color: "var(--primary)" }} />
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink)" }}>
                          {courseTeachers.length > 0
                            ? courseTeachers.map((t) => t.name).join("، ")
                            : `${item.teacherIds.length} مدرسين`}
                        </span>
                      </div>

                      <div style={{ fontSize: "15px", fontWeight: 800, color: "var(--primary)" }}>
                        {item.price > 0 ? `${item.price} ج.م` : "مجاني"}
                      </div>
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div
                    style={{
                      padding: "12px 18px",
                      background: "var(--surface-raised, rgba(0,0,0,0.02))",
                      borderTop: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={() => onNavigate(`course-detail:${item.id}`)}
                      style={{
                        flex: 1,
                        fontSize: "12.5px",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                      }}
                    >
                      <BookOpen size={14} /> التفاصيل وإدارة البنود
                    </button>

                    <button
                      type="button"
                      onClick={() => void toggleCourse(item)}
                      style={{
                        padding: "8px 14px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 700,
                        border: `1px solid ${item.published ? "rgba(245,158,11,0.4)" : "rgba(16,185,129,0.4)"}`,
                        background: item.published ? "rgba(245,158,11,0.1)" : "rgba(16,185,129,0.1)",
                        color: item.published ? "#f59e0b" : "#10b981",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                        transition: "all 0.15s",
                      }}
                      title={item.published ? "إخفاء الكورس من قائمة الطلاب" : "نشر الكورس للطلاب"}
                    >
                      {item.published ? <EyeOff size={14} /> : <Eye size={14} />}
                      {item.published ? "إخفاء" : "نشر"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Teachers View
  return (
    <>
      <div className="admin-catalog-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: "25px", gridColumn: "1 / -1" }}>
          {pendingTeachers.length > 0 && (
            <section className="paper-card published-panel" style={{ borderColor: "var(--accent)" }}>
              <div className="card-title">
                <div>
                  <span className="eyebrow" style={{ color: "var(--accent)" }}>NEW REQUESTS</span>
                  <h2 style={{ color: "var(--accent)" }}>طلبات الانضمام وتوثيق الحسابات ({pendingTeachers.length})</h2>
                  <p>قام هؤلاء بإنشاء حسابات وينتظرون موافقة الإدارة (Admins/Teachers)</p>
                </div>
              </div>
              {pendingTeachers.map((item) => (
                <div className="published-row" key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>{item.name}</strong>
                    <small>{item.role === "teacher" ? `مدرس (${item.subject || "غير محدد"})` : "أدمن"} · {item.email}</small>
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button className="primary-btn compact" onClick={() => void reviewUser(item.id, "approved")}>موافقة وتفعيل</button>
                    <button className="secondary-btn compact" onClick={() => void reviewUser(item.id, "rejected")}>رفض الحساب</button>
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>

        <section className="paper-card creator-form">
          <div className="form-heading">
            <span className="eyebrow">ADMIN / TEACHERS</span>
            <h2>إضافة مدرس جديد</h2>
            <p>أدخل بيانات المدرس وتخصصه لإتاحته في قائمة ربط الكورسات والأسعار.</p>
          </div>
          <form onSubmit={addTeacher}>
            <Field label="الاسم"><input required value={teacher.name} onChange={(event) => setTeacher({ ...teacher, name: event.target.value })} /></Field>
            <Field label="التخصص المالي/الأكاديمي"><input required value={teacher.subject} onChange={(event) => setTeacher({ ...teacher, subject: event.target.value })} placeholder="مثال: الرياضيات المتقدمة" /></Field>
            <label className="image-upload">
              <span>صورة المدرس الشخصية</span>
              <input type="file" accept="image/*" onChange={chooseTeacherImage} />
              {teacherImage && <img className="teacher-image-preview" src={teacherImage} alt="معاينة صورة المدرس" />}
            </label>
            <Field label="نبذة تعريفية"><textarea value={teacher.bio} onChange={(event) => setTeacher({ ...teacher, bio: event.target.value })} /></Field>
            <button className="primary-btn" type="submit" disabled={savingTeacher}>
              <UserPlus size={15} /> {savingTeacher ? "جارٍ الإضافة..." : "إضافة المدرس"}
            </button>
          </form>
        </section>

        <section className="paper-card published-panel">
          <div className="card-title">
            <div>
              <span className="eyebrow">TEACHER DIRECTORY</span>
              <h2>المدرسون المعتمدون ({teachers.length})</h2>
            </div>
            <ShieldCheck size={20} style={{ color: "var(--primary)" }} />
          </div>
          {teachers.map((item) => (
            <div className="published-row" key={item.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 0" }}>
              {item.image ? (
                <img className="teacher-image-preview" src={item.image} alt="" style={{ width: "42px", height: "42px", borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "var(--primary-subtle, rgba(244,123,32,0.15))", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>
                  {item.name.slice(0, 2)}
                </div>
              )}
              <div>
                <strong style={{ fontSize: "14px" }}>{item.name}</strong>
                <div style={{ fontSize: "12px", color: "var(--ink-muted)" }}>{item.subject} · مرتبط بـ {item.courseIds.length} كورسات</div>
              </div>
            </div>
          ))}
          {teachers.length === 0 && <p className="muted">لا يوجد مدرسون مضافون حتى الآن.</p>}
        </section>
      </div>

      {cropFile && <ImageCropDialog file={cropFile} onCancel={() => setCropFile(null)} onComplete={(value) => { setTeacherImage(value); setCropFile(null); }} />}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
