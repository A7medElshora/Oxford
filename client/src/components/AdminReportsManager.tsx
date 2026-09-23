import { useEffect, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Download, TrendingUp, Users, BookOpen, CircleDollarSign } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import ExcelJS from "exceljs";

type Enrollment = {
  id: string;
  studentName: string;
  courseId: string;
  courseTitle?: string;
  bookingType: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  transferImage?: string;
  transferImageUrl?: string;
};
type Course = {
  id: string;
  title: string;
  teacherIds: string[];
  lessonCount: number;
  price: number;
  level: string;
};
type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  grade?: string;
  phone?: string;
  parentPhone?: string;
};

// Build month-by-month revenue from enrollments
function buildMonthlyRevenue(enrollments: Enrollment[]) {
  const months: Record<string, number> = {};
  const monthNames = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  enrollments
    .filter(e => e.status === "approved")
    .forEach(e => {
      const d = new Date(e.createdAt);
      const key = monthNames[d.getMonth()];
      months[key] = (months[key] || 0) + e.amount;
    });
  return monthNames
    .filter(m => months[m] !== undefined)
    .map(m => ({ name: m, value: months[m] }));
}

// Build per-course enrollment count
function buildCourseEnrollments(enrollments: Enrollment[]) {
  const counts: Record<string, { name: string; value: number }> = {};
  enrollments.filter(e => e.status === "approved").forEach(e => {
    const title = e.courseTitle || e.courseId;
    const short = title.length > 18 ? title.slice(0, 16) + "…" : title;
    if (!counts[e.courseId]) counts[e.courseId] = { name: short, value: 0 };
    counts[e.courseId].value += 1;
  });
  return Object.values(counts);
}

function toDataImageExtension(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/([a-zA-Z0-9.+-]+));base64,/i);
  return match ? match[2].toLowerCase() : "png";
}

function toDataImageBase64(dataUrl: string) {
  const match = dataUrl.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/i);
  return match ? match[1] : null;
}

function toExcelImageExtension(dataUrl: string): "png" | "jpeg" | "gif" {
  const extension = toDataImageExtension(dataUrl);
  if (extension === "jpg" || extension === "jpeg") return "jpeg";
  if (extension === "gif") return "gif";
  return "png";
}

async function exportToExcel(enrollments: Enrollment[], students: User[], teachers: User[], courses: Course[], fromDate?: string, toDate?: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Oxford Learning Platform";
  workbook.created = new Date();

  const dateRangeStr = fromDate && toDate
    ? `من ${fromDate} إلى ${toDate}`
    : fromDate
    ? `من ${fromDate} وحتى الآن`
    : toDate
    ? `حتى تاريخ ${toDate}`
    : "شامل جميع الفترات الزمنية";

  const summarySheet = workbook.addWorksheet("نظرة عامة والمدة");
  summarySheet.views = [{ rightToLeft: true }];
  summarySheet.columns = [{ width: 35 }, { width: 45 }];
  const totalRev = enrollments.filter(e => e.status === "approved").reduce((sum, e) => sum + e.amount, 0);
  summarySheet.addRows([
    ["مؤشرات المنصة الشاملة", "القيمة / البيان"],
    ["فترة التقرير المحددة (من - إلى)", dateRangeStr],
    ["تاريخ البداية (من)", fromDate || "غير محدد (شامل جميع البيانات)"],
    ["تاريخ النهاية (إلى)", toDate || "غير محدد (شامل جميع البيانات)"],
    ["إجمالي عدد الطلاب المسجلين", students.length],
    ["إجمالي عدد المدرسين", teachers.length],
    ["إجمالي طلبات الاشتراكات بالفترة", enrollments.length],
    ["إجمالي الاشتراكات المفعّلة", enrollments.filter(e => e.status === "approved").length],
    ["إجمالي الإيرادات المعتمدة", `${totalRev.toLocaleString()} ج.م`],
  ]);

  const paymentsSheet = workbook.addWorksheet("سجل الاشتراكات المالي");
  paymentsSheet.views = [{ rightToLeft: true }];
  paymentsSheet.columns = [{ width: 15 }, { width: 25 }, { width: 30 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 60 }];
  paymentsSheet.addRow(["التاريخ", "اسم الطالب", "الكورس المختار", "نوع الخطة", "المبلغ (ج.م)", "حالة الدفع", "صورة / رابط إيصال تحويل الطالب"]);
  enrollments.forEach((e) => {
    const status = e.status === "approved" ? "مفعل" : e.status === "pending" ? "قيد المراجعة" : "مرفوض";
    paymentsSheet.addRow([
      new Date(e.createdAt).toLocaleDateString("ar-EG"),
      e.studentName,
      e.courseTitle || e.courseId,
      e.bookingType,
      String(e.amount),
      status,
      e.transferImage || e.transferImageUrl || "غير مرفق",
    ]);
  });

  const transferSheet = workbook.addWorksheet("صور تحويلات المشتركين");
  transferSheet.views = [{ rightToLeft: true }];
  transferSheet.columns = [{ width: 6 }, { width: 28 }, { width: 32 }, { width: 15 }, { width: 15 }, { width: 16 }, { width: 22 }, { width: 75 }];
  transferSheet.addRow(["#", "اسم الطالب المشترك", "الكورس", "نوع الخطة", "المبلغ (ج.م)", "تاريخ الطلب", "حالة الاشتراك", "صورة إيصال التحويل"]);
  enrollments.forEach((e, index) => {
    const rowIndex = transferSheet.addRow([
      String(index + 1),
      e.studentName,
      e.courseTitle || e.courseId,
      e.bookingType,
      `${e.amount} ج.م`,
      new Date(e.createdAt).toLocaleDateString("ar-EG"),
      e.status === "approved" ? "مكتمل ومفعل" : e.status === "pending" ? "قيد المراجعة والتحقق" : "مرفوض",
      e.transferImage || e.transferImageUrl || "غير مرفق",
    ]).number;

    const source = e.transferImage || e.transferImageUrl;
    if (!source || !source.startsWith("data:image/")) return;
    const base64 = toDataImageBase64(source);
    const extension = toDataImageExtension(source);
    if (!base64) return;

    const imageId = workbook.addImage({ base64, extension: toExcelImageExtension(source) });
    transferSheet.addImage(imageId, {
      tl: { col: 7, row: rowIndex - 1 },
      ext: { width: 120, height: 70 },
    });
    transferSheet.getRow(rowIndex).height = 70;
  });

  const studentsSheet = workbook.addWorksheet("بيانات الطلاب");
  studentsSheet.views = [{ rightToLeft: true }];
  studentsSheet.columns = [{ width: 30 }, { width: 35 }, { width: 20 }, { width: 20 }, { width: 20 }];
  studentsSheet.addRow(["اسم الطالب", "البريد الإلكتروني", "الصف الدراسي", "رقم هاتف الطالب", "رقم هاتف ولي الأمر"]);
  students.forEach((s) => studentsSheet.addRow([s.name, s.email, s.grade || "غير محدد", s.phone || "-", s.parentPhone || "-"]));

  const teachersSheet = workbook.addWorksheet("أداء المدرسين");
  teachersSheet.views = [{ rightToLeft: true }];
  teachersSheet.columns = [{ width: 30 }, { width: 35 }, { width: 15 }, { width: 20 }, { width: 30 }];
  teachersSheet.addRow(["الاسم", "البريد الإلكتروني", "عدد الكورسات", "إجمالي المشتركين", "مجموع إيرادات المدرس (ج.م)"]);
  teachers.forEach((t) => {
    const tc = courses.filter(c => c.teacherIds.includes(t.id));
    const te = enrollments.filter(e => tc.some(c => c.id === e.courseId) && e.status === "approved");
    const rev = te.reduce((sum, e) => sum + e.amount, 0);
    teachersSheet.addRow([t.name, t.email, String(tc.length), String(te.length), String(rev)]);
  });

  const coursesSheet = workbook.addWorksheet("الكورسات والمبيعات");
  coursesSheet.views = [{ rightToLeft: true }];
  coursesSheet.columns = [{ width: 40 }, { width: 20 }, { width: 15 }, { width: 15 }, { width: 30 }];
  coursesSheet.addRow(["اسم الكورس", "المستهدف", "عدد المحاضرات", "السعر الأساسي", "إجمالي المبيعات (عدد الطلاب)"]);
  courses.forEach((c) => {
    const enrolled = enrollments.filter(e => e.courseId === c.id && e.status === "approved").length;
    coursesSheet.addRow([c.title, c.level, String(c.lessonCount), `${c.price} ج.م`, String(enrolled)]);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Oxford_Analytics_${new Date().toLocaleDateString("en-GB").replace(/\//g, "-")}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);

  toast.success("تم تصدير تقرير Excel الشامل متضمناً الفترات الزمنية وصور التحويلات الحقيقية بنجاح ✓");
}

export default function AdminReportsManager() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  useEffect(() => {
    void Promise.all([
      api<Enrollment[]>("/enrollments"),
      api<Course[]>("/courses"),
      api<User[]>("/users"),
    ]).then(([e, c, u]) => {
      setEnrollments(e);
      setCourses(c);
      setUsers(u);
    }).catch(() => toast.error("تعذر تحميل البيانات"))
      .finally(() => setLoading(false));
  }, []);

  const students = users.filter(u => u.role === "student");
  const teachers = users.filter(u => u.role === "teacher");

  const filteredEnrollments = enrollments.filter(e => {
    const d = new Date(e.createdAt);
    if (fromDate && d < new Date(fromDate)) return false;
    if (toDate && d > new Date(toDate + "T23:59:59.999Z")) return false;
    return true;
  });

  const totalRevenue = filteredEnrollments.filter(e => e.status === "approved").reduce((s, e) => s + e.amount, 0);
  const totalApproved = filteredEnrollments.filter(e => e.status === "approved").length;
  const totalPending = filteredEnrollments.filter(e => e.status === "pending").length;

  const revenueData = buildMonthlyRevenue(filteredEnrollments);
  const courseData = buildCourseEnrollments(filteredEnrollments);

  if (loading) {
    return <div style={{ padding: "60px", textAlign: "center", color: "var(--ink-muted)" }}>جاري تحميل البيانات…</div>;
  }

  return (
    <>
      <div className="page-header flex-wrap gap-4">
        <div>
          <span className="eyebrow" style={{ color: "var(--primary)" }}>ADMIN / ANALYTICS</span>
          <h1>التقارير والتحليلات الشاملة</h1>
          <p style={{ color: "var(--ink-muted)", fontSize: "13px" }}>اختر الفترة الزمنية واضغط تصدير للحصول على ملف Excel متضمناً صور تحويلات الطلاب.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 text-xs font-bold text-slate-700">
            <span>من:</span>
            <input
              type="date"
              className="rounded-lg border border-slate-200 p-1 text-xs outline-none"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
            />
            <span>إلى:</span>
            <input
              type="date"
              className="rounded-lg border border-slate-200 p-1 text-xs outline-none"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
            />
            {(fromDate || toDate) && (
              <button
                className="text-red-500 hover:underline px-1"
                onClick={() => { setFromDate(""); setToDate(""); }}
              >
                مسح
              </button>
            )}
          </div>

          <button
            className="primary-btn"
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
            onClick={() => exportToExcel(filteredEnrollments, students, teachers, courses, fromDate, toDate)}
          >
            <Download size={16} />
            تصدير تقرير Excel الشامل (مع الصور)
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        {[
          { icon: CircleDollarSign, label: "إجمالي الإيرادات", value: `${totalRevenue.toLocaleString()} ج.م`, bg: "#eef6ff", color: "#1a72d5" },
          { icon: Users, label: "الطلاب المسجلون", value: `${students.length} طالب`, bg: "#f0faf6", color: "#1a9970" },
          { icon: TrendingUp, label: "اشتراكات مفعّلة", value: `${totalApproved} اشتراك`, bg: "#fff5ef", color: "#f36a21" },
          { icon: BookOpen, label: "اشتراكات قيد المراجعة", value: `${totalPending} طلب`, bg: "#fffbea", color: "#c59a00" },
          { icon: BookOpen, label: "عدد الكورسات", value: `${courses.length} كورس`, bg: "#f5f0ff", color: "#7c4dff" },
          { icon: Users, label: "المدرسون", value: `${teachers.length} مدرس`, bg: "#fff0f5", color: "#e0306a" },
        ].map((kpi, i) => (
          <div className="paper-card" key={i} style={{ padding: "18px" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <div style={{ background: kpi.bg, color: kpi.color, padding: "10px", borderRadius: "12px", flexShrink: 0 }}>
                <kpi.icon size={20} />
              </div>
              <div>
                <span className="eyebrow" style={{ fontSize: "9px" }}>{kpi.label}</span>
                <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--ink)" }}>{kpi.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="chart-grid">
        <div className="chart-card">
          <div className="card-title">
            <div>
              <span className="eyebrow">MONTHLY REVENUE</span>
              <h3>الإيرادات الشهرية (ج.م)</h3>
            </div>
            <span className="chart-value">{totalRevenue.toLocaleString()} ج.م</span>
          </div>
          {revenueData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1A72D5" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#1A72D5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#edf1f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#8994a6" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#8994a6" }} />
                <Tooltip formatter={(v: number) => [`${v.toLocaleString()} ج.م`, "الإيراد"]} />
                <Area type="monotone" dataKey="value" stroke="#1A72D5" strokeWidth={3} fill="url(#revFill)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-muted)" }}>
              لا توجد إيرادات مسجلة بعد
            </div>
          )}
        </div>

        <div className="chart-card">
          <div className="card-title">
            <div>
              <span className="eyebrow">COURSE POPULARITY</span>
              <h3>الاشتراكات لكل كورس</h3>
            </div>
            <span className="chart-value mint">{totalApproved} مشترك</span>
          </div>
          {courseData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={courseData}>
                <CartesianGrid vertical={false} stroke="#edf1f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#8994a6" }} />
                <YAxis hide />
                <Tooltip formatter={(v: number) => [v, "مشترك"]} />
                <Bar dataKey="value" fill="#83cbb7" radius={[6, 6, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-muted)" }}>
              لا توجد اشتراكات مفعّلة بعد
            </div>
          )}
        </div>
      </div>

      {/* Teachers Table */}
      <div className="paper-card" style={{ marginTop: "24px" }}>
        <div className="card-title" style={{ marginBottom: "16px" }}>
          <div>
            <span className="eyebrow">TEACHER PERFORMANCE</span>
            <h3>أداء المدرسين</h3>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>المدرس</th>
                <th>عدد الكورسات</th>
                <th>الطلاب المشتركين</th>
                <th>إجمالي الإيراد</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t, i) => {
                const tc = courses.filter(c => c.teacherIds.includes(t.id));
                const te = enrollments.filter(e => tc.some(c => c.id === e.courseId) && e.status === "approved");
                const revenue = te.reduce((s, e) => s + e.amount, 0);
                return (
                  <tr key={t.id}>
                    <td>
                      <div className="person">
                        <span className={`avatar avatar-${i % 4}`}>{t.name[0]}</span>
                        <span>
                          <strong>{t.name}</strong>
                          <small>{t.email}</small>
                        </span>
                      </div>
                    </td>
                    <td><span className="signal-chip">{tc.length} كورس</span></td>
                    <td><strong>{te.length}</strong></td>
                    <td><strong style={{ color: "var(--primary)" }}>{revenue.toLocaleString()} ج.م</strong></td>
                  </tr>
                );
              })}
              {teachers.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--ink-muted)", padding: "20px" }}>لا يوجد مدرسون مسجلون.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
