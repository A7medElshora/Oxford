/* Oxford Learning Platform: RTL paper-first education workspace with real local teacher-to-student learning flows. */
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { toast } from "sonner";
import ScreenProtection from "@/components/ScreenProtection";
import CourseDetailContent from "@/components/CourseDetailContent";
import TeacherLessonManager from "@/components/TeacherLessonManager";
import AdminGovernance from "@/components/AdminGovernance";
import AdminCatalogManager from "@/components/AdminCatalogManager";
import AdminCourseCreate from "@/components/AdminCourseCreate";
import AdminCourseDetail from "@/components/AdminCourseDetail";
import AdminPaymentsManager from "@/components/AdminPaymentsManager";
import AdminPaymentMethodsManager from "@/components/AdminPaymentMethodsManager";
import AdminReportsManager from "@/components/AdminReportsManager";
import AdminAnnouncementsManager from "@/components/AdminAnnouncementsManager";
import AdminStudentsAttendance from "@/components/AdminStudentsAttendance";
import TeacherWorkspace from "@/components/TeacherWorkspace";
import AdminDashboard from "@/components/AdminDashboard";
import ImageCropDialog from "@/components/ImageCropDialog";
import { api, type ApiUser } from "@/lib/api";
import {
  activeSubscriptions,
  dateInput,
  governanceId,
  isSubscriptionActive,
  readGovernance,
  writeGovernance,
  type GovernanceStore,
  type PlanType,
  type SubscriptionRequest,
} from "@/lib/learningGovernance";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowLeft,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  CircleDollarSign,
  ClipboardCheck,
  ExternalLink,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  UserPlus,
  Users,
  WalletCards,
  X,
} from "lucide-react";

const heroImg = "/assets/learning.png";
const programImg = "/assets/learning.png";
const scienceImg = "/assets/learning.png";

type Role = "student" | "admin" | "teacher";
type AdminPermission = "users" | "courses" | "content" | "reports" | "payments" | "settings";
type Props = {
  user: ApiUser;
  role: Role;
  activePage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  onUserChange: (user: ApiUser) => void;
};
type CourseId = "programming" | "science" | "skills";
type Lesson = {
  id: string;
  courseId: CourseId;
  title: string;
  description: string;
  lectureUrl: string;
  resourceUrl: string;
  teacher: string;
  published: boolean;
  approvalStatus?: "pending" | "approved" | "rejected";
  createdAt: string;
};
type ExamQuestion = {
  id: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
};
type Exam = {
  id: string;
  courseId: CourseId;
  title: string;
  description: string;
  duration: number;
  questions: ExamQuestion[];
  teacher: string;
  published: boolean;
  createdAt: string;
};
type Submission = {
  id: string;
  examId: string;
  studentId: string;
  studentName: string;
  answers: number[];
  score: number | null;
  reviewed: boolean;
  submittedAt: string;
};
type LearningStore = {
  lessons: Lesson[];
  exams: Exam[];
  submissions: Submission[];
};
type UpdateLearning = (
  updater: (previous: LearningStore) => LearningStore
) => void;

type ApiCourse = {
  id: string;
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
};
type ApiEnrollment = { courseId: string; status: "pending" | "approved" | "rejected"; studentId?: string };

const courseCatalog: {
  id: CourseId;
  title: string;
  teacher: string;
  tag: string;
  price: string;
  img: string;
  progress: number;
  lessons: number;
}[] = [
  {
    id: "programming",
    title: "أساسيات البرمجة",
    teacher: "نورهان عادل",
    tag: "الصف الثاني الثانوي",
    price: "450 جنيه",
    img: programImg,
    progress: 72,
    lessons: 24,
  },
  {
    id: "science",
    title: "فيزياء الحركة والطاقة",
    teacher: "عمر فؤاد",
    tag: "الصف الأول الثانوي",
    price: "380 جنيه",
    img: scienceImg,
    progress: 38,
    lessons: 18,
  },
  {
    id: "skills",
    title: "مهارات حل الامتحان",
    teacher: "سلمى حمدي",
    tag: "تطوير المهارات",
    price: "220 جنيه",
    img: programImg,
    progress: 0,
    lessons: 12,
  },
];
const sales = [
  { name: "يناير", value: 19000 },
  { name: "فبراير", value: 26000 },
  { name: "مارس", value: 22000 },
  { name: "أبريل", value: 36000 },
  { name: "مايو", value: 42000 },
  { name: "يونيو", value: 51000 },
];
const attendance = [
  { name: "السبت", value: 78 },
  { name: "الأحد", value: 84 },
  { name: "الإثنين", value: 72 },
  { name: "الثلاثاء", value: 91 },
  { name: "الأربعاء", value: 86 },
  { name: "الخميس", value: 88 },
];
const students = [
  {
    name: "سارة محمود",
    grade: "الثاني الثانوي",
    course: "أساسيات البرمجة",
    attendance: "94%",
    status: "نشط",
  },
  {
    name: "يوسف علي",
    grade: "الأول الثانوي",
    course: "فيزياء الحركة",
    attendance: "81%",
    status: "نشط",
  },
  {
    name: "مريم خالد",
    grade: "الثاني الثانوي",
    course: "أساسيات البرمجة",
    attendance: "68%",
    status: "يحتاج متابعة",
  },
  {
    name: "آدم حسن",
    grade: "الثالث الثانوي",
    course: "مراجعة نهائية",
    attendance: "89%",
    status: "نشط",
  },
];

const initialLearning: LearningStore = {
  lessons: [
    {
      id: "lesson-seed-1",
      courseId: "programming",
      title: "مدخل إلى التفكير البرمجي",
      description: "كيف نقسم أي مشكلة كبيرة إلى خطوات واضحة قابلة للتنفيذ.",
      lectureUrl: "https://meet.google.com/taf-demo-lesson",
      resourceUrl: "https://drive.google.com/oxford-demo-notes",
      teacher: "نورهان عادل",
      published: true,
      createdAt: "2026-06-24",
    },
    {
      id: "lesson-seed-2",
      courseId: "programming",
      title: "المتغيرات والمنطق",
      description: "فهم المتغيرات، المقارنات، وبناء أول خوارزمية.",
      lectureUrl: "https://meet.google.com/taf-demo-variables",
      resourceUrl: "https://drive.google.com/oxford-demo-variables",
      teacher: "نورهان عادل",
      published: true,
      createdAt: "2026-06-23",
    },
  ],
  exams: [
    {
      id: "exam-seed-1",
      courseId: "programming",
      title: "اختبار الوحدة الأولى",
      description: "اختبار قصير يقيس فهم أساسيات التفكير البرمجي.",
      duration: 20,
      teacher: "نورهان عادل",
      published: true,
      createdAt: "2026-06-24",
      questions: [
        {
          id: "question-seed-1",
          prompt: "ما الخطوة الأولى عند مواجهة مشكلة برمجية؟",
          choices: [
            "كتابة الكود مباشرة",
            "تقسيم المشكلة وفهم المطلوب",
            "تغيير لغة البرمجة",
            "حذف المشروع",
          ],
          correctIndex: 1,
        },
        {
          id: "question-seed-2",
          prompt: "ما الذي يصف الخوارزمية بشكل أفضل؟",
          choices: [
            "مجموعة خطوات مرتبة لحل مشكلة",
            "صورة للمشروع",
            "اسم المتغير",
            "نوع جهاز الكمبيوتر",
          ],
          correctIndex: 0,
        },
      ],
    },
  ],
  submissions: [
    {
      id: "submission-seed-1",
      examId: "exam-seed-1",
      studentId: "student-demo",
      studentName: "هايدي محمد ",
      answers: [1, 0],
      score: 85,
      reviewed: true,
      submittedAt: "2026-06-24",
    },
  ],
};

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function readLearning(): LearningStore {
  try {
    const saved = localStorage.getItem("oxford-learning-content");
    return saved ? (JSON.parse(saved) as LearningStore) : initialLearning;
  } catch {
    return initialLearning;
  }
}
function writeLearning(value: LearningStore) {
  localStorage.setItem("oxford-learning-content", JSON.stringify(value));
}
function courseById(id: CourseId) {
  return courseCatalog.find(course => course.id === id) || courseCatalog[0];
}
function formatDate() {
  return new Date().toLocaleDateString("ar-EG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function Stat({
  icon: Icon,
  label,
  value,
  meta,
  accent = "blue",
}: {
  icon: any;
  label: string;
  value: string;
  meta: string;
  accent?: string;
}) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${accent}`}>
        <Icon size={19} />
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{meta}</small>
      </div>
    </div>
  );
}
function Button({
  children,
  secondary = false,
  onClick,
  className = "",
  type = "button",
  disabled = false,
}: {
  children: any;
  secondary?: boolean;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`${secondary ? "secondary-btn" : "primary-btn"} ${className} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
function Empty({
  icon: Icon = Package,
  title = "لا توجد بيانات بعد",
  text = "ستظهر التفاصيل هنا عند توفرها.",
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={25} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: any;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
function Field({ label, children }: { label: string; children: any }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Table({
  role,
  onNavigate,
  rows,
}: {
  role: Role;
  onNavigate: (p: string) => void;
  rows: Array<{ name: string; grade: string; course: string; attendance: string; status: string }>;
}) {
  const visibleRows = role === "admin" ? rows : rows.slice(0, 3);
  return (
    <div className="table-card">
      <div className="table-head">
        <div>
          <span className="eyebrow">LIVE ROSTER</span>
          <h3>{role === "admin" ? "آخر الطلاب المسجلين" : "تقدم طلابي"}</h3>
        </div>
        <button className="icon-btn">
          <MoreHorizontal size={18} />
        </button>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>الطالب</th>
              <th>{role === "admin" ? "الكورس" : "التقدم"}</th>
              <th>الحضور</th>
              <th>الحالة</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((s, i) => (
              <tr key={s.name}>
                <td>
                  <div className="person">
                    <span className={`avatar avatar-${i}`}>{s.name[0]}</span>
                    <span>
                      <strong>{s.name}</strong>
                      <small>{s.grade}</small>
                    </span>
                  </div>
                </td>
                <td>
                  {role === "admin" ? (
                    <span>{s.course}</span>
                  ) : (
                    <div className="mini-progress">
                      <span style={{ width: `${35 + i * 18}%` }} />
                    </div>
                  )}
                </td>
                <td>
                  <b
                    className={
                      s.attendance.startsWith("6")
                        ? "warning-text"
                        : "success-text"
                    }
                  >
                    {s.attendance}
                  </b>
                </td>
                <td>
                  <span
                    className={`status ${s.status.includes("متابعة") ? "warning" : "success"}`}
                  >
                    <i /> {s.status}
                  </span>
                </td>
                <td>
                  <button
                    className="row-action"
                    onClick={() => onNavigate("students")}
                  >
                    فتح <ChevronLeft size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {visibleRows.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", padding: "28px", color: "var(--ink-muted)" }}>لا توجد سجلات طلاب فعلية حتى الآن.</td></tr>}
          </tbody>
        </table>
      </div>
      <button
        className="table-link"
        onClick={() => onNavigate(role === "teacher" ? "students" : "students")}
      >
        عرض القائمة كاملة <ArrowLeft size={15} />
      </button>
    </div>
  );
}
function Charts({ role }: { role: Role }) {
  return (
    <div className="chart-grid">
      <div className="chart-card">
        <div className="card-title">
          <div>
            <span className="eyebrow">PERFORMANCE / 2026</span>
            <h3>{role === "admin" ? "الإيرادات الشهرية" : "ساعات التعلّم"}</h3>
          </div>
          <span className="chart-value">+18.4%</span>
        </div>
        <ResponsiveContainer width="100%" height={215}>
          <AreaChart data={sales}>
            <defs>
              <linearGradient id="blueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1A72D5" stopOpacity={0.24} />
                <stop offset="100%" stopColor="#1A72D5" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#edf1f6" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#8994a6" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#8994a6" }}
            />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#1A72D5"
              strokeWidth={3}
              fill="url(#blueFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-card">
        <div className="card-title">
          <div>
            <span className="eyebrow">WEEKLY PULSE</span>
            <h3>نسبة الحضور</h3>
          </div>
          <span className="chart-value mint">86%</span>
        </div>
        <ResponsiveContainer width="100%" height={215}>
          <BarChart data={attendance}>
            <CartesianGrid vertical={false} stroke="#edf1f6" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#8994a6" }}
            />
            <YAxis hide />
            <Tooltip />
            <Bar
              dataKey="value"
              fill="#83cbb7"
              radius={[5, 5, 0, 0]}
              barSize={22}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function SubscriptionGate({
  courseId,
  governance,
  onNavigate,
}: {
  courseId: CourseId;
  governance: GovernanceStore;
  onNavigate: (page: string) => void;
}) {
  const request = governance.subscriptions.find(
    item =>
      item.courseId === courseId &&
      item.studentId === "student-demo" &&
      item.status !== "ended"
  );
  const active = request && isSubscriptionActive(request);
  return (
    <div className="access-gate paper-card">
      <div className="access-gate-icon">
        <LockKeyhole size={25} />
      </div>
      <span className="eyebrow">PRIVATE COURSE ACCESS</span>
      <h2>
        {active
          ? "الاشتراك فعال"
          : request?.status === "pending"
            ? "طلبك قيد مراجعة الأدمن"
            : "هذا الكورس غير متاح لحسابك بعد"}
      </h2>
      <p>
        {active
          ? `دخولك مسموح حتى ${new Date(request.endsAt).toLocaleDateString("ar-EG")}.`
          : "يجب اختيار مدرس وخطة اشتراك، ثم انتظار موافقة الأدمن قبل فتح المحاضرات والامتحانات."}
      </p>
      {request && (
        <div className="access-gate-meta">
          <span>
            الحالة:{" "}
            {request.status === "pending"
              ? "قيد المراجعة"
              : request.status === "rejected"
                ? "مرفوض"
                : "منتهي"}
          </span>
          <span>
            {request.teacherName} · {request.planType}
          </span>
        </div>
      )}
      <Button secondary onClick={() => onNavigate("browse")}>
        {active ? "العودة للكورسات" : "اختيار مدرس واشتراك"}{" "}
        <ArrowLeft size={15} />
      </Button>
    </div>
  );
}

function StudentHome({
  onNavigate,
  userName,
}: {
  onNavigate: (p: string) => void;
  learning: LearningStore;
  userName: string;
}) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      api<any[]>("/courses").catch(() => []),
      api<any>("/dashboard").catch(() => null),
      api<any[]>("/submissions").catch(() => []),
      api<any[]>("/calendar").catch(() => []),
      api<any[]>("/enrollments").catch(() => [])
    ]).then(([courses, dashboard, submissions, calendar, enrollments]) => {
      if (!isMounted) return;
      const activeCourses = Array.isArray(courses) ? courses : [];
      const subList = Array.isArray(submissions) ? submissions : [];
      const calList = Array.isArray(calendar) ? calendar : [];
      const enrollmentList = Array.isArray(enrollments) ? enrollments : [];
      const scores = subList.filter(s => s && typeof s.score === "number").map(s => s.score);
      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      const stats = dashboard?.stats || { courses: activeCourses.length, lessons: 0, submissions: subList.length };
      const approvedSpend = enrollmentList
        .filter(item => item?.status === "approved")
        .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

      setData({
        courses: activeCourses,
        stats,
        recentLessons: dashboard?.recentLessons || [],
        avgScore,
        approvedSpend,
        upcomingEvents: calList.filter(c => c?.startsAt && new Date(c.startsAt).getTime() > Date.now()).slice(0, 2)
      });
    }).catch((err) => {
      console.error("Student overview load error:", err);
      if (isMounted) {
        setData({
          courses: [],
          stats: { courses: 0, lessons: 0, submissions: 0 },
          recentLessons: [],
          avgScore: 0,
          approvedSpend: 0,
          upcomingEvents: []
        });
      }
    });
    return () => { isMounted = false; };
  }, []);

  if (!data) return <div className="paper-card loading-card">جاري تحميل نظرة عامة...</div>;

  return (
    <>
      <section className="hero-card">
        <div className="hero-copy">
          <span className="eyebrow light">YOUR NEXT MILESTONE</span>
          <h2>
            أهلًا يا <em>{userName.split(" ")[0]}</em>،<br />
            جاهز لخطوتك التالية؟
          </h2>
          <p>
            {data.recentLessons.length > 0 
              ? `لديك درس جديد متاح: ${data.recentLessons[0].title}`
              : 'جاهز لاستكشاف المزيد من الدروس والكورسات.'}
          </p>
          <Button onClick={() => onNavigate("courses")}>
            استمر في التعلّم <ArrowLeft size={16} />
          </Button>
        </div>
        <img src={heroImg} alt="student learning" />
      </section>
      <div className="stats-row">
        <Stat
          icon={BookOpen}
          label="الكورسات النشطة"
          value={data.stats.courses > 0 ? String(data.stats.courses) : "0"}
          meta="إجمالي الكورسات المفتوحة"
        />
        <Stat
          icon={Target}
          label="المحاضرات"
          value={data.stats.lessons > 0 ? String(data.stats.lessons) : "0"}
          meta="إجمالي المحاضرات"
          accent="mint"
        />
        <Stat
          icon={ClipboardCheck}
          label="متوسط الاختبارات"
          value={`${data.avgScore}/100`}
          meta={`${data.stats.submissions} اختبار تم حله`}
          accent="amber"
        />
        <Stat
          icon={Activity}
          label="ساعات التعلّم"
          value={data.stats.lessons > 0 ? String(Math.round(data.stats.lessons * 1.5)) : "0"}
          meta="ساعات تقديرية"
          accent="coral"
        />
      </div>
      <div className="section-heading">
        <div>
          <span className="eyebrow">KEEP GOING</span>
          <h2>أحدث الكورسات لديك</h2>
        </div>
        <button className="text-button" onClick={() => onNavigate("courses")}>
          كل الكورسات <ArrowLeft size={15} />
        </button>
      </div>
      <div className="course-grid">
        {data.courses.slice(0, 2).map((course: any) => {
          const normalized = {
            ...course,
            img: course.image || course.imageUrl || course.cover || heroImg,
            tag: course.level || "عام",
            lessons: Number(course.lessonCount ?? course.lessons ?? 0),
            progress: Number(course.progress ?? 0),
            teacher: course.teachers?.map((t: any) => t.name || t.teacher?.name || "مدرس").join(", ") || course.teacher || "كورس عام",
            price: (() => {
              if (typeof course.price === "number") return `${course.price} جنيه`;
              if (typeof course.price === "string" && course.price.trim()) return `${course.price} جنيه`;
              return "مجاني";
            })(),
          };

          return (
            <CourseCard
              key={course.id}
              course={normalized as any}
              onClick={() => onNavigate(`course-detail:${course.id}`)}
            />
          );
        })}
        {data.courses.length === 0 && (
          <p className="muted">لم يتم إضافة كورسات بعد.</p>
        )}
      </div>
      <div className="section-heading lower">
        <div>
          <span className="eyebrow">NEW FROM YOUR TEACHER</span>
          <h2>أحدث المحاضرات</h2>
        </div>
        <button className="text-button" onClick={() => onNavigate("courses")}>
          فتح المسار <ArrowLeft size={15} />
        </button>
      </div>
      <div className="paper-card learning-feed">
        {data.recentLessons.slice(0, 3).map((lesson: any) => (
          <div className="learning-feed-row" key={lesson.id}>
            <span className="lesson-num">
              <FileText size={15} />
            </span>
            <div>
              <strong>{lesson.title}</strong>
              <small>
                 المدرس: {lesson.teacher || "مدرس الكورس"}
              </small>
            </div>
            <button
              onClick={() => onNavigate("courses")}
              className="link-action"
            >
              الذهاب للكورسات <ArrowLeft size={14} />
            </button>
          </div>
        ))}
        {data.recentLessons.length === 0 && (
          <p className="muted">لا توجد محاضرات منشورة حاليًا.</p>
        )}
      </div>
      <div className="section-heading lower">
        <div>
          <span className="eyebrow">THIS WEEK</span>
          <h2>نظرة سريعة</h2>
        </div>
      </div>
      <div className="quick-grid-cards">
        <div className="paper-card schedule-card">
          <div className="card-title">
            <h3>المواعيد القادمة</h3>
            <CalendarDays size={19} />
          </div>
          {data.upcomingEvents.length > 0 ? data.upcomingEvents.map((evt: any, i: number) => (
            <div className="schedule-item" key={evt.id}>
              <b>{new Date(evt.startsAt).toLocaleDateString('ar-EG', { weekday: 'short' })}</b>
              <span>
                <strong>{evt.title}</strong>
                <small>{new Date(evt.startsAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</small>
              </span>
              <span className={`dot ${i === 0 ? "blue-dot" : "coral-dot"}`} />
            </div>
          )) : (
            <p className="muted" style={{ padding: "10px 0" }}>لا يوجد مواعيد قادمة.</p>
          )}
          <button className="table-link" onClick={() => onNavigate("calendar")}>
            عرض التقويم <ArrowLeft size={14} />
          </button>
        </div>
        <div className="paper-card badge-card">
          <div className="badge-ring">
            <Sparkles size={26} />
          </div>
          <div>
            <span className="eyebrow">CURRENT BADGE</span>
            <h3>المستكشف</h3>
            <p>
              بقيت 120 نقطة للوصول إلى <b>صانع الأثر</b>
            </p>
            <div className="badge-progress">
              <span style={{ width: "65%" }} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
function CourseCard({
  course,
  onClick,
}: {
  course: (typeof courseCatalog)[number] & { enrolled?: boolean };
  onClick: () => void;
}) {
  return (
    <button className="course-card" onClick={onClick}>
      <div className="course-image">
        <img
          src={course.img}
          alt={course.title}
          onError={event => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = programImg;
          }}
        />
        <span>{course.tag}</span>
        {course.enrolled && <b className="enrolled-course-badge">مشترك بها</b>}
      </div>
      <div className="course-content">
        <div className="course-top">
          <small>{course.teacher}</small>
          <span>{course.price}</span>
        </div>
        <h3>{course.title}</h3>
        <p>{course.lessons} درس · مسار تعليمي متدرج</p>
        <div className="course-progress">
          <div>
            <span>التقدم</span>
            <b>{course.progress}%</b>
          </div>
          <div className="progress-track">
            <i style={{ width: `${course.progress}%` }} />
          </div>
        </div>
      </div>
    </button>
  );
}
function RoleHome({
  role,
  onNavigate,
  learning,
  userName,
}: {
  role: Role;
  onNavigate: (p: string) => void;
  learning: LearningStore;
  userName: string;
}) {
  const [dashboard, setDashboard] = useState<{ stats: { students: number; courses: number; lessons: number; exams: number; attendanceRate?: number }; recentStudents: Array<{ name: string; grade: string; course: string; attendance: string; status: string }> } | null>(null);
  useEffect(() => {
    void api<typeof dashboard>("/dashboard").then(setDashboard).catch(() => undefined);
  }, []);
  if (role === "student")
    return <StudentHome onNavigate={onNavigate} learning={learning} userName={userName} />;
  const admin = role === "admin";
  const stats = dashboard?.stats;
  if (admin) {
    return (
      <AdminOverview
        dashboard={dashboard}
        onNavigate={onNavigate}
        userName={userName}
      />
    );
  }
  return (
    <>
      <div className="stats-row">
        <Stat
          icon={Users}
          label="إجمالي الطلاب"
          value={String(stats?.students ?? 0)}
          meta="حسابات الطلاب الفعلية"
        />
        <Stat
          icon={CircleDollarSign}
          label={admin ? "إيرادات الشهر" : "متوسط الدخل"}
          value={admin ? "—" : "—"}
          meta="تُحسب من الاشتراكات المؤكدة"
          accent="mint"
        />
        <Stat
          icon={BookOpen}
          label="الكورسات النشطة"
          value={String(stats?.courses ?? 0)}
          meta={`${stats?.lessons ?? 0} محاضرة منشورة`}
          accent="amber"
        />
        <Stat
          icon={ClipboardCheck}
          label="نسبة الحضور"
          value={stats?.attendanceRate === undefined ? "—" : `${stats.attendanceRate}%`}
          meta="من سجلات الحضور الفعلية"
          accent="coral"
        />
      </div>
      <Charts role={role} />
      <Table role={role} onNavigate={onNavigate} rows={dashboard?.recentStudents || []} />
    </>
  );
}

function AdminOverview({
  dashboard,
  onNavigate,
  userName,
}: {
  dashboard: {
    stats: { students: number; courses: number; lessons: number; exams: number; attendanceRate?: number };
    recentStudents: Array<{ name: string; grade: string; course: string; attendance: string; status: string }>;
  } | null;
  onNavigate: (page: string) => void;
  userName: string;
}) {
  const stats = dashboard?.stats;
  const recentStudents = dashboard?.recentStudents || [];
  const firstName = userName.split(" ")[0];
  const cards = [
    { cls: "orbit-students", icon: Users, title: "الطلاب المسجلين", value: stats ? String(stats.students) : "—", hint: "حسابات حقيقية", page: "students" },
    { cls: "orbit-teachers", icon: GraduationCap, title: "المعلمون النشطون", value: "—", hint: "من بيانات المنصة", page: "teachers" },
    { cls: "orbit-courses", icon: BookOpen, title: "الدورات التدريبية", value: stats ? String(stats.courses) : "—", hint: "كورس نشط", page: "courses" },
    { cls: "orbit-attendance", icon: CalendarDays, title: "الجدول الأسبوعي", value: stats?.attendanceRate === undefined ? "—" : `${stats.attendanceRate}%`, hint: "نسبة الحضور", page: "attendance" },
    { cls: "orbit-reports", icon: TrendingUp, title: "التقارير", value: stats ? String(stats.exams) : "—", hint: "امتحان مسجل", page: "reports" },
  ];
  return (
    <div className="admin-reference-dashboard">
      <section className="admin-reference-hero">
        <div className="admin-reference-welcome">
          <span>مرحباً بك في</span>
          <strong>منصة أكسفورد التعليمية</strong>
          <p>معاً نصنع مستقبلاً أفضل لطلابنا</p>
          <i />
        </div>
        <div className="admin-reference-orbits">
          {cards.map(card => {
            const Icon = card.icon;
            return (
              <button key={card.cls} className={`admin-reference-card ${card.cls}`} onClick={() => onNavigate(card.page)}>
                <span className="reference-card-icon"><Icon size={19} /></span>
                <span><b>{card.title}</b><strong>{card.value}</strong><small>{card.hint}</small></span>
              </button>
            );
          })}
          <div className="admin-reference-gear">
            <div className="reference-gear-decor" />
            <div className="reference-gear-core">
              <div className="reference-logo"><img src="/assets/platform-logo.png" alt="Oxford" /></div>
              <strong>Oxford</strong>
              <small>Learning Platform</small>
              <em>أهلاً وسهلاً</em>
              <b>{userName}</b>
              <span>مدير النظام</span>
            </div>
          </div>
        </div>
        <div className="admin-reference-activity">
          <div className="reference-panel-title"><h3>أحدث الأنشطة</h3><Activity size={16} /></div>
          {recentStudents.length === 0 ? <p>لا توجد أنشطة حقيقية بعد</p> : recentStudents.slice(0, 5).map((student, index) => (
            <button key={`${student.name}-${index}`} onClick={() => onNavigate("students")}>
              <span className="reference-activity-icon">{index % 2 ? <ClipboardCheck size={14} /> : <UserPlus size={14} />}</span>
              <span><b>{student.name}</b><small>{student.course || "تسجيل جديد"}</small></span>
              <em>حديثاً</em>
            </button>
          ))}
        </div>
      </section>
      <section className="admin-reference-analytics">
        <div className="reference-analytics-card">
          <div className="reference-panel-title"><h3>أحدث الطلاب المسجلين</h3><button onClick={() => onNavigate("students")}>عرض الكل</button></div>
          {recentStudents.length === 0 ? <div className="reference-empty">لا توجد سجلات طلاب فعلية حتى الآن.</div> : recentStudents.slice(0, 4).map(student => <div className="reference-student-row" key={student.name}><span className="avatar">{student.name.charAt(0)}</span><b>{student.name}</b><small>{student.grade || "—"}</small><em>جديد</em></div>)}
        </div>
        <div className="reference-analytics-card reference-chart-card">
          <div className="reference-panel-title"><h3>توزيع الطلاب حسب المرحلة</h3><span>{stats ? stats.students : "—"} طالب</span></div>
          <div className="reference-donut"><span>{stats ? stats.students : "—"}<small>طالب</small></span></div>
          <div className="reference-legend"><span><i /> بيانات الطلاب الفعلية</span><span><i /> تتحدث تلقائياً</span></div>
        </div>
        <div className="reference-analytics-card reference-line-card">
          <div className="reference-panel-title"><h3>الأداء العام للمنصة</h3><span>الآن</span></div>
          <div className="reference-line"><i /><i /><i /><i /><i /><i /><i /></div>
          <div className="reference-week"><span>السبت</span><span>الأحد</span><span>الإثنين</span><span>الثلاثاء</span><span>الأربعاء</span><span>الخميس</span><span>الجمعة</span></div>
        </div>
      </section>
    </div>
  );
}

function CourseDetailLegacy({
  onNavigate,
  learning,
}: {
  onNavigate: (p: string) => void;
  learning: LearningStore;
}) {
  const [joined, setJoined] = useState(false);
  const lessons = learning.lessons.filter(
    lesson => lesson.courseId === "programming" && lesson.published
  );
  const exams = learning.exams.filter(
    exam => exam.courseId === "programming" && exam.published
  );
  return (
    <>
      <PageHeader
        eyebrow="COURSE / DETAIL"
        title="أساسيات البرمجة"
        description="مسار عملي لبناء أساس قوي في التفكير البرمجي."
        action={
          <Button
            onClick={() => {
              setJoined(true);
              toast.success("تم التسجيل في الكورس محليًا");
            }}
          >
            {joined ? "تم التسجيل" : "سجّل في الكورس"} <ArrowLeft size={16} />
          </Button>
        }
      />
      <div className="detail-grid">
        <div className="detail-main">
          <div className="detail-cover">
            <img src={programImg} alt="" />
            <div>
              <span className="eyebrow light">FOUNDATION TRACK</span>
              <h2>من أول سطر كود إلى أول مشروع</h2>
              <p>24 درسًا، اختبارات قصيرة، ومهام تطبيقية.</p>
            </div>
          </div>
          <div className="paper-card syllabus">
            <div className="card-title">
              <div>
                <span className="eyebrow">TEACHER CONTENT</span>
                <h3>المحاضرات والمواد المضافة</h3>
              </div>
              <span className="signal-chip">{lessons.length} محاضرات</span>
            </div>
            {lessons.map((lesson, index) => (
              <div className="lesson-row" key={lesson.id}>
                <span className="lesson-num">0{index + 1}</span>
                <span>
                  <strong>{lesson.title}</strong>
                  <small>{lesson.description}</small>
                </span>
                <a
                  className="row-action"
                  href={lesson.lectureUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  المحاضرة <ExternalLink size={14} />
                </a>
              </div>
            ))}
            {lessons.length === 0 && (
              <Empty
                icon={FileText}
                title="لم يضف المدرس مواد بعد"
                text="ستظهر المواد هنا عند نشرها."
              />
            )}
          </div>
          <div className="paper-card syllabus">
            <div className="card-title">
              <div>
                <span className="eyebrow">ASSESSMENTS</span>
                <h3>اختبارات هذا المسار</h3>
              </div>
              <button
                className="text-button"
                onClick={() => onNavigate("exams")}
              >
                كل الاختبارات <ArrowLeft size={14} />
              </button>
            </div>
            {exams.map(exam => (
              <div className="lesson-row" key={exam.id}>
                <span className="lesson-num">
                  <ClipboardCheck size={15} />
                </span>
                <span>
                  <strong>{exam.title}</strong>
                  <small>
                    {exam.description} · {exam.duration} دقيقة
                  </small>
                </span>
                <button
                  className="row-action"
                  onClick={() => onNavigate(`exam-take:${exam.id}`)}
                >
                  ابدأ <ChevronLeft size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
        <aside className="detail-side">
          <div className="paper-card detail-card">
            <span className="eyebrow">COURSE NOTE</span>
            <h3>إيقاع تعلّم متوازن</h3>
            <p>ابدئي بدرس واحد اليوم، واتركي للمراجعة مساحة غدًا.</p>
            <div className="detail-facts">
              <span>
                <BookOpen size={16} />
                24 درس
              </span>
              <span>
                <Activity size={16} />8 ساعات
              </span>
              <span>
                <UserRound size={16} />
                نورهان عادل
              </span>
            </div>
          </div>
          <div className="paper-card detail-card">
            <span className="eyebrow">YOUR PROGRESS</span>
            <strong className="big-number">72%</strong>
            <div className="progress-track">
              <i style={{ width: "72%" }} />
            </div>
            <button className="table-link" onClick={() => onNavigate("lesson")}>
              تابعي الدرس التالي <ArrowLeft size={14} />
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}
function LessonPage({
  onNavigate,
  learning,
}: {
  onNavigate: (p: string) => void;
  learning: LearningStore;
}) {
  const lesson = learning.lessons[0];
  return (
    <>
      <PageHeader
        eyebrow="LEARNING / LESSON 01"
        title={lesson?.title || "مدخل إلى التفكير البرمجي"}
        description="الوحدة الأولى · أساسيات البرمجة"
        action={
          <Button
            onClick={() => {
              toast.success("تم حفظ التقدم");
              onNavigate("courses");
            }}
          >
            حفظ والعودة <ArrowLeft size={16} />
          </Button>
        }
      />
      <div className="lesson-layout">
        <div className="video-card">
          <div className="video-placeholder">
            <a
              className="play-button"
              href={lesson?.lectureUrl}
              target="_blank"
              rel="noreferrer"
            >
              ▶
            </a>
            <span>VIDEO LINK · 18:42</span>
          </div>
          <div className="video-meta">
            <div>
              <span className="eyebrow">LESSON 01 / 06</span>
              <h2>كيف نبدأ بتقسيم المشكلة؟</h2>
            </div>
            <span className="status success">
              <i />
              قيد التعلّم
            </span>
          </div>
          <div className="lesson-actions">
            <button onClick={() => toast.success("تم وضع علامة مكتمل")}>
              ✓ وضع علامة مكتمل
            </button>
            {lesson?.resourceUrl && (
              <a href={lesson.resourceUrl} target="_blank" rel="noreferrer">
                تحميل المصادر <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>
        <aside className="paper-card lesson-list">
          <div className="card-title">
            <h3>محتوى الوحدة</h3>
            <span>6 دروس</span>
          </div>
          {[
            "مدخل إلى التفكير البرمجي",
            "المتغيرات والمنطق",
            "التكرار والدوال",
            "مشروع تطبيقي",
          ].map((n, i) => (
            <button
              key={n}
              className={`lesson-row compact ${i === 0 ? "selected" : ""}`}
              onClick={() =>
                i === 0
                  ? undefined
                  : toast.info("هذه الوحدة ستفتح عند نشر محتواها")
              }
            >
              <span className="lesson-num">0{i + 1}</span>
              <span>
                <strong>{n}</strong>
                <small>24:10</small>
              </span>
              <CheckCircle2 size={16} />
            </button>
          ))}
        </aside>
      </div>
    </>
  );
}

function CalendarPage() {
  return (
    <>
      <PageHeader
        eyebrow="PLAN / WEEKLY VIEW"
        title="مواعيدك"
        description="رتّبي محاضراتك وامتحاناتك في أسبوع واحد."
        action={
          <div className="view-toggle">
            <button className="active">أسبوعي</button>
            <button>شهري</button>
          </div>
        }
      />
      <div className="calendar-card">
        <div className="calendar-head">
          <button className="icon-btn">
            <ChevronLeft size={17} />
          </button>
          <h3>23 — 29 يونيو 2026</h3>
          <button className="secondary-btn">اليوم</button>
        </div>
        <div className="week-grid">
          {[
            "السبت",
            "الأحد",
            "الإثنين",
            "الثلاثاء",
            "الأربعاء",
            "الخميس",
            "الجمعة",
          ].map((d, i) => (
            <div className={`day-column ${i === 3 ? "today" : ""}`} key={d}>
              <b>{d}</b>
              <strong>{23 + i}</strong>
              {i === 3 && (
                <div className="day-event blue-event">
                  <span>10:00</span>
                  <strong>محاضرة البرمجة</strong>
                  <small>أونلاين</small>
                </div>
              )}
              {i === 4 && (
                <div className="day-event coral-event">
                  <span>12:30</span>
                  <strong>اختبار قصير</strong>
                  <small>قاعة 204</small>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
function ProfilePage({ role, user, onUserChange }: { role: Role; user: ApiUser; onUserChange: (user: ApiUser) => void }) {
  const [form, setForm] = useState({
    name: user.name,
    phone: user.phone || "",
    grade: user.grade || "",
    subject: user.subject || "",
    avatar: user.avatar || "",
  });
  const [saving, setSaving] = useState(false);
  const [profileStats, setProfileStats] = useState({ activityDays: 0, achievement: 0, balance: 0 });

  useEffect(() => {
    setForm({
      name: user.name,
      phone: user.phone || "",
      grade: user.grade || "",
      subject: user.subject || "",
      avatar: user.avatar || "",
    });
  }, [user]);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      api<any[]>("/submissions").catch(() => []),
      api<any[]>("/enrollments").catch(() => [])
    ]).then(([submissions, enrollments]) => {
      if (!isMounted) return;
      const scores = (Array.isArray(submissions) ? submissions : [])
        .map(item => Number(item?.score))
        .filter(score => Number.isFinite(score) && score >= 0);
      const averageScore = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
      const approvedSpend = (Array.isArray(enrollments) ? enrollments : [])
        .filter(item => item?.status === "approved")
        .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const activityDays = Math.max(7, Math.min(90, 5 + scores.length + Math.round(approvedSpend / 250)));
      setProfileStats({ activityDays, achievement: averageScore, balance: approvedSpend });
    }).catch(() => {
      if (isMounted) setProfileStats({ activityDays: 7, achievement: 0, balance: 0 });
    });

    return () => { isMounted = false; };
  }, [user.id]);

  const initial = (form.name || user.name).trim().charAt(0) || "؟";
  const [cropFile, setCropFile] = useState<File | null>(null);
  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCropFile(file);
  };
  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        phone: form.phone,
        grade: role === "student" ? form.grade : undefined,
        subject: role === "teacher" ? form.subject : undefined,
        avatar: form.avatar || undefined,
      };
      const updated = await api<ApiUser>("/profile", { method: "PATCH", body: JSON.stringify(payload) });
      onUserChange({
        ...user,
        ...updated,
        name: updated.name || form.name || user.name,
        phone: updated.phone || form.phone || user.phone,
        grade: updated.grade || form.grade || user.grade,
        subject: updated.subject || form.subject || user.subject,
        avatar: updated.avatar || form.avatar || user.avatar,
      });
      toast.success("تم حفظ الملف الشخصي");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ الملف الشخصي");
    } finally {
      setSaving(false);
    }
  };

  return (
    <><>
      <PageHeader
        eyebrow="ACCOUNT / PROFILE"
        title="ملفي الشخصي"
        description="بياناتك وإنجازاتك في مكان واحد."
        action={
          <Button onClick={() => { void handleSave(); }} disabled={saving}>
            {saving ? "جارٍ الحفظ..." : "حفظ التغييرات"}
          </Button>
        }
      />
      <div className="profile-grid">
        <div className="profile-card paper-card">
          <div className="profile-cover">
            <span className="avatar avatar-0 big-avatar">
              {form.avatar ? <img src={form.avatar} alt={form.name || user.name} /> : initial}
            </span>
          </div>
          <div className="profile-body">
            <div className="profile-image-upload" style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "15px" }}>
              <label className="secondary-btn compact" style={{ cursor: "pointer" }}>
                تغيير الصورة
                <input type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: "none" }} />
              </label>
              {form.avatar && <span className="muted">تم اختيار صورة جديدة</span>}
            </div>
            <h2>{form.name || user.name}</h2>
            <span className="status success">
              <i />
              الحساب نشط
            </span>
            <div className="profile-fields">
              <Field label="الاسم الكامل">
                <input value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} />
              </Field>
              <Field label="البريد الإلكتروني">
                <input value={user.email} readOnly />
              </Field>
              <Field label="رقم الهاتف">
                <input value={form.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value }))} placeholder="أدخل رقم الهاتف" />
              </Field>
              <Field label={role === "student" ? "الصف الدراسي" : role === "teacher" ? "المادة" : "الدور"}>
                {role === "student" ? (
                  <input value={form.grade} onChange={event => setForm(current => ({ ...current, grade: event.target.value }))} placeholder="مثل: الثاني الثانوي" />
                ) : role === "teacher" ? (
                  <input value={form.subject} onChange={event => setForm(current => ({ ...current, subject: event.target.value }))} placeholder="مثل: الرياضيات" />
                ) : (
                  <input value="مدير السنتر" readOnly />
                )}
              </Field>
            </div>
          </div>
        </div>
        <div className="profile-stats">
          <Stat
            icon={Activity}
            label="أيام النشاط"
            value={String(profileStats.activityDays)}
            meta="هذا الشهر"
          />
          <Stat
            icon={Target}
            label="الإنجاز"
            value={`${profileStats.achievement}%`}
            meta="متوسط النتائج"
            accent="mint"
          />
          <Stat
            icon={WalletCards}
            label="الرصيد"
            value={`${profileStats.balance.toLocaleString("ar-EG")} جنيه`}
            meta="جنيه مصري"
            accent="amber"
          />
        </div>
      </div>
    </>{cropFile && <ImageCropDialog file={cropFile} onCancel={() => setCropFile(null)} onComplete={value => { setForm(current => ({ ...current, avatar: value })); setCropFile(null); }} />}</>
  );
}
function CartPage({ onNavigate }: { onNavigate: (p: string) => void }) {
  const [empty, setEmpty] = useState(false);
  return (
    <>
      <PageHeader
        eyebrow="STORE / CART"
        title="سلة المشتريات"
        description="راجعي اختياراتك قبل إتمام الطلب."
        action={
          <button
            className="secondary-btn"
            onClick={() => onNavigate("browse")}
          >
            متابعة التصفح <ArrowLeft size={16} />
          </button>
        }
      />
      {empty ? (
        <Empty
          icon={Package}
          title="السلة فارغة"
          text="أضيفي كورسًا من صفحة التصفح وسيظهر هنا."
        />
      ) : (
        <div className="cart-layout">
          <div className="cart-items">
            <div className="cart-item">
              <img src={programImg} alt="" />
              <div>
                <span className="eyebrow">COURSE</span>
                <h3>أساسيات البرمجة</h3>
                <p>24 درس · نورهان عادل</p>
              </div>
              <strong>450 جنيه</strong>
              <button
                className="icon-btn"
                onClick={() => {
                  setEmpty(true);
                  toast.success("تم حذف العنصر");
                }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="cart-item">
              <img src={scienceImg} alt="" />
              <div>
                <span className="eyebrow">COURSE</span>
                <h3>فيزياء الحركة والطاقة</h3>
                <p>18 درس · عمر فؤاد</p>
              </div>
              <strong>380 جنيه</strong>
              <button
                className="icon-btn"
                onClick={() => toast.success("تم حذف العنصر")}
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <aside className="paper-card order-summary">
            <span className="eyebrow">ORDER SUMMARY</span>
            <h3>ملخص الطلب</h3>
            <div>
              <span>المجموع الفرعي</span>
              <b>830 جنيه</b>
            </div>
            <div>
              <span>الخصم</span>
              <b className="success-text">-80 جنيه</b>
            </div>
            <hr />
            <div className="total">
              <span>الإجمالي</span>
              <b>750 جنيه</b>
            </div>
            <Button
              onClick={() => {
                toast.success("تم إنشاء الطلب التجريبي");
                onNavigate("overview");
              }}
            >
              إتمام الطلب <ArrowLeft size={16} />
            </Button>
          </aside>
        </div>
      )}
    </>
  );
}
function RecordDetail({
  page,
  onNavigate,
}: {
  page: string;
  onNavigate: (p: string) => void;
}) {
  const base = page.replace(/-detail$/, "");
  const names: Record<string, string> = {
    students: "سارة محمود",
    teachers: "نورهان عادل",
    attendance: "سارة محمود",
    payments: "سارة محمود",
    lessons: "مدخل إلى التفكير البرمجي",
    exams: "اختبار الوحدة الأولى",
    assignments: "واجب المراجعة",
  };
  return (
    <>
      <PageHeader
        eyebrow={`${base.toUpperCase()} / DETAIL`}
        title={
          base === "students"
            ? "ملف الطالب"
            : base === "teachers"
              ? "ملف المدرس"
              : `تفاصيل ${names[base] || "السجل"}`
        }
        description="واجهة تفاصيل فعلية ببيانات تجريبية محلية."
        action={
          <Button onClick={() => onNavigate(base)}>
            <ArrowLeft size={16} />
            العودة للقائمة
          </Button>
        }
      />
      <div className="record-detail-grid">
        <div className="record-main paper-card">
          <div className="record-heading">
            <span className="avatar avatar-0 big-avatar-inline">
              {(names[base] || "س")[0]}
            </span>
            <div>
              <span className="eyebrow">RECORD ID · TF-0248</span>
              <h2>{names[base] || "سجل المنصة"}</h2>
              <p>آخر تحديث اليوم · البيانات المحلية التجريبية</p>
            </div>
            <span className="status success">
              <i />
              نشط
            </span>
          </div>
          <div className="detail-tabs">
            <button className="active">نظرة عامة</button>
            <button onClick={() => toast.info("تم فتح تبويب النشاط")}>
              النشاط
            </button>
            <button onClick={() => toast.info("تم فتح تبويب الملاحظات")}>
              الملاحظات
            </button>
          </div>
          <div className="record-sections">
            <div>
              <span className="eyebrow">SUMMARY</span>
              <h3>ملخص الأداء</h3>
              <p>
                قراءة مركزة للحالة الحالية، آخر التحديثات، والعناصر التي تحتاج
                إلى متابعة.
              </p>
            </div>
            <div className="record-metrics">
              <div>
                <b>
                  {base === "payments"
                    ? "750"
                    : base === "attendance"
                      ? "94%"
                      : "86%"}
                </b>
                <small>المؤشر الحالي</small>
              </div>
              <div>
                <b>12</b>
                <small>نشاط هذا الشهر</small>
              </div>
              <div>
                <b>+18%</b>
                <small>مقارنة بالفترة السابقة</small>
              </div>
            </div>
          </div>
          <div className="activity-line">
            <span className="activity-dot" />
            <div>
              <strong>تم تحديث البيانات</strong>
              <small>الثلاثاء، 24 يونيو · 10:44 ص</small>
            </div>
          </div>
          <div className="activity-line">
            <span className="activity-dot mint-dot" />
            <div>
              <strong>تم تسجيل إجراء جديد</strong>
              <small>الإثنين، 23 يونيو · 02:10 م</small>
            </div>
          </div>
        </div>
        <aside className="record-side">
          <div className="paper-card action-stack">
            <span className="eyebrow">QUICK ACTIONS</span>
            <h3>إجراءات سريعة</h3>
            <button onClick={() => toast.success("تم تحديث الحالة محليًا")}>
              تحديث الحالة <CheckCircle2 size={16} />
            </button>
            <button onClick={() => onNavigate("messages")}>
              إرسال رسالة <MessageCircle size={16} />
            </button>
            <button onClick={() => toast.success("تم تجهيز التقرير التجريبي")}>
              تحميل التقرير <ArrowLeft size={16} />
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}

function StudentExams({
  learning,
  onNavigate,
}: {
  learning: LearningStore;
  onNavigate: (p: string) => void;
}) {
  const [apiExams, setApiExams] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);

  useEffect(() => {
    void Promise.all([
      api<any[]>("/exams").catch(() => []),
      api<any[]>("/submissions").catch(() => []),
    ]).then(([fetchedExams, fetchedSubmissions]) => {
      setApiExams(fetchedExams || []);
      setSubmissions(fetchedSubmissions || []);
    });
  }, []);

  const allExamsMap = new Map<string, any>();
  learning.exams.filter(exam => exam.published).forEach(e => allExamsMap.set(e.id, e));
  apiExams.filter(exam => exam.published !== false).forEach(e => allExamsMap.set(e.id, e));
  const exams = Array.from(allExamsMap.values());

  return (
    <>
      <PageHeader
        eyebrow="ASSESSMENTS / STUDENT"
        title="امتحاناتي"
        description="اختبارات نشرها المدرسون، مع نتائجك وحالة المراجعة."
        action={
          <Button secondary onClick={() => onNavigate("results")}>
            عرض كل النتائج <TrendingUp size={16} />
          </Button>
        }
      />
      <div className="assessment-grid">
        {exams.map(exam => {
          const submission = submissions.find(s => s.examId === exam.id) || learning.submissions.find(
            item => item.examId === exam.id
          );
          const isAfterReview = exam.resultVisibility === "after_review";
          const isPendingReview = isAfterReview && submission && (submission.score === null || !submission.reviewed);

          return (
            <div className="assessment-card paper-card" key={exam.id}>
              <div className="assessment-top">
                <span className="signal-chip">
                  {exam.courseTitle || courseById(exam.courseId).title}
                </span>
                <span
                  className={`status ${submission && (submission.score !== null && !isPendingReview) ? "success" : "warning"}`}
                >
                  <i />
                  {isPendingReview
                    ? "قيد المراجعة من المدرس"
                    : submission && submission.score !== null
                    ? `${submission.score}/100`
                    : "لم يبدأ"}
                </span>
              </div>
              <h3>{exam.title}</h3>
              <p>{exam.description}</p>
              {isAfterReview && (
                <small style={{ color: "#d97706", display: "block", marginTop: "4px", fontSize: "11px" }}>
                  ℹ️ تنبيه: النتيجة والدرجة تظهر بعد مراجعة المدرس لجميع التسليمات.
                </small>
              )}
              <div className="assessment-meta" style={{ marginTop: "12px" }}>
                <span>
                  <ClipboardCheck size={14} />
                  {exam.questionCount || exam.questions?.length || 0} أسئلة
                </span>
                <span>
                  <Activity size={14} />
                  {exam.duration} دقيقة
                </span>
                <span>
                  <UserRound size={14} />
                  {exam.teacher || "المدرس"}
                </span>
              </div>
              <Button onClick={() => onNavigate(`exam-take:${exam.id}`)}>
                {submission ? (isPendingReview ? "تم التسليم (في انتظار المراجعة)" : "مراجعة الإجابة") : "ابدأ الامتحان"}{" "}
                <ArrowLeft size={15} />
              </Button>
            </div>
          );
        })}
      </div>
      {exams.length === 0 && (
        <Empty
          icon={ClipboardCheck}
          title="لا توجد امتحانات منشورة"
          text="سيظهر أي اختبار ينشره المدرس هنا تلقائيًا."
        />
      )}
    </>
  );
}

function ExamTakePage({
  examId,
  learning,
  updateLearning,
  onNavigate,
}: {
  examId: string;
  learning: LearningStore;
  updateLearning: UpdateLearning;
  onNavigate: (p: string) => void;
}) {
  const [exam, setExam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<number[]>([]);
  const [started, setStarted] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [userSubmission, setUserSubmission] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api<any>(`/exams/${examId}`).catch(() => null),
      api<any[]>("/submissions").catch(() => []),
    ])
      .then(([res, submissions]) => {
        const foundSub = submissions.find(s => s.examId === examId);
        if (foundSub) {
          setAlreadySubmitted(true);
          setUserSubmission(foundSub);
        }
        if (res) {
          setExam(res);
          if (foundSub && foundSub.answers) {
            setAnswers(foundSub.answers.map((a: any) => a.selectedIndex ?? a));
          } else {
            setAnswers(new Array(res.questions?.length || 0).fill(-1));
          }
          setTimeLeft((res.duration || 30) * 60);
        } else {
          const local = learning.exams.find(item => item.id === examId);
          if (local) {
            setExam(local);
            setAnswers(new Array(local.questions?.length || 0).fill(-1));
            setTimeLeft((local.duration || 30) * 60);
          }
        }
      })
      .finally(() => setLoading(false));
  }, [examId]);

  // Count down timer
  useEffect(() => {
    if (!started || alreadySubmitted || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          toast.error("انتهى وقت الامتحان! جاري تسليم إجاباتك تلقائياً...");
          void submitAuto();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [started, alreadySubmitted, timeLeft]);

  const submitAuto = async () => {
    setSubmitting(true);
    try {
      await api<any>(`/exams/${examId}/submissions`, {
        method: "POST",
        body: JSON.stringify({ answers }),
      });
      toast.success("تم تسليم الامتحان تلقائياً بنجاح");
      onNavigate("results");
    } catch {
      onNavigate("results");
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async () => {
    if (alreadySubmitted) {
      toast.error("لقد قمت بتسليم هذا الامتحان بالفعل ولا يمكن تعديل الإجابات مرة أخرى");
      return;
    }
    if (answers.some(a => a === -1 || a === undefined)) {
      toast.warning("يرجى اختيار إجابة لجميع الأسئلة قبل التسليم");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api<any>(`/exams/${examId}/submissions`, {
        method: "POST",
        body: JSON.stringify({ answers }),
      });
      if (exam.resultVisibility === "after_review") {
        toast.info("تم تسليم الإجابات بنجاح. تظهر الدرجة والنتيجة بعد مراجعة المدرس.");
      } else {
        toast.success(`تم تسليم الاختبار وحساب درجتك: ${res.score ?? 0}/100`);
      }
      onNavigate("results");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تسليم الاختبار");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500 font-bold">
        جاري تحميل بيانات الامتحان...
      </div>
    );
  }

  if (!exam)
    return (
      <Empty
        icon={ClipboardCheck}
        title="الاختبار غير متاح"
        text="قد يكون الاختبار غير منشور أو تم حذفه أو لم يتم تفعيل اشتراكك في الكورس بعد."
      />
    );

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Screen 1: Exam Intro & Start Button
  if (!started && !alreadySubmitted) {
    return (
      <>
        <PageHeader
          eyebrow="ASSESSMENT / START EXAM"
          title={exam.title}
          description={`${exam.courseTitle || courseById(exam.courseId).title} · ${exam.duration} دقيقة`}
          action={
            <Button secondary onClick={() => onNavigate("exams")}>
              العودة للامتحانات <ArrowLeft size={16} />
            </Button>
          }
        />
        <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-blue-50 text-blue-600">
            <ClipboardCheck size={32} />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900">{exam.title}</h2>
          <p className="mt-2 text-slate-600">{exam.description || "اختبار تقييمي لمادة الكورس."}</p>
          <div className="my-6 grid grid-cols-3 gap-4 rounded-2xl bg-slate-50 p-4 text-center text-sm font-bold text-slate-700">
            <div>
              <span className="block text-xs font-normal text-slate-400">المدة الزمنية</span>
              {exam.duration} دقيقة
            </div>
            <div>
              <span className="block text-xs font-normal text-slate-400">عدد الأسئلة</span>
              {exam.questions?.length || 0} أسئلة
            </div>
            <div>
              <span className="block text-xs font-normal text-slate-400">ظهور النتيجة</span>
              {exam.resultVisibility === "after_review" ? "بعد المراجعة" : "فوري"}
            </div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-right text-xs text-amber-800">
            ⚠️ <b>تنبيه مهم:</b> عند التقرير على "بدء الامتحان الآن"، سيبدأ العداد التنازلي للوقت ولن يمكنك إيقافه. يرجى التأكد من جاهزيتك قبل البدء.
          </div>
          <div className="mt-6 flex justify-center">
            <Button className="w-full py-4 text-lg" onClick={() => setStarted(true)}>
              بدء الامتحان الآن 🚀
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="ASSESSMENT / TAKE EXAM"
        title={exam.title}
        description={`${exam.courseTitle || courseById(exam.courseId).title} · ${exam.duration} دقيقة`}
        action={
          <Button secondary onClick={() => onNavigate("exams")}>
            العودة للامتحانات <ArrowLeft size={16} />
          </Button>
        }
      />

      {alreadySubmitted && (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="flex items-center gap-1.5 font-bold text-base text-emerald-800">
                ✅ تم تسليم هذا الامتحان بنجاح ولا يمكن تعديل الإجابات.
              </span>
              <p className="mt-1 text-xs text-emerald-700">
                {userSubmission?.reviewed
                  ? "تم اعتماد النتيجة والمراجعة بواسطة المدرس ✓"
                  : exam.resultVisibility === "after_review"
                  ? "في انتظار مراجعة واعتماد الدرجة النهائية من قبل مدرس المادة."
                  : "تم رصد الدرجة الفورية تلقائياً."}
              </p>
            </div>
            {userSubmission?.score !== null && userSubmission?.score !== undefined && (
              <div className="rounded-2xl bg-emerald-600 px-4 py-2 text-white font-extrabold text-lg text-center shadow-sm">
                الدرجة: {userSubmission.score} / {exam.questions?.reduce((sum: number, q: any) => sum + Number(q.marks || 1), 0) || 100}
              </div>
            )}
          </div>
        </div>
      )}

      {!alreadySubmitted && (
        <div className="sticky top-4 z-20 mb-6 flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-600 p-4 text-white shadow-md">
          <div className="flex items-center gap-2 font-bold">
            <Activity className="animate-pulse" size={20} />
            <span>العداد التنازلي للامتحان:</span>
          </div>
          <div className={`rounded-xl px-4 py-1 text-xl font-black font-mono tracking-wider ${timeLeft < 300 ? "bg-red-500 animate-bounce" : "bg-blue-800"}`}>
            ⏰ {formatTime(timeLeft)}
          </div>
        </div>
      )}

      <div className="exam-layout">
        <div className="paper-card exam-form">
          <div className="exam-intro">
            <span className="signal-chip">{exam.questions?.length || 0} أسئلة</span>
            <h2>{exam.description}</h2>
            <p>{alreadySubmitted ? "سرد الدرجات واستعراض الإجابات:" : "اختر إجابة لكل سؤال ثم انقر على تسليم الإجابات."}</p>
          </div>
          {exam.questions?.map((question: any, index: number) => {
            const studentAns = answers[index];
            const isCorrect = studentAns === question.correctIndex;
            const qMarks = Number(question.marks || 1);
            return (
              <fieldset
                className={`question-card ${alreadySubmitted ? (isCorrect ? "border-emerald-300 bg-emerald-50/30" : "border-red-300 bg-red-50/20") : ""}`}
                key={question.id || index}
                style={alreadySubmitted ? { borderWidth: "2px" } : {}}
              >
                <legend className="flex items-center justify-between w-full gap-2">
                  <span>{String(index + 1).padStart(2, "0")} · {question.prompt}</span>
                  {alreadySubmitted && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isCorrect ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                      {isCorrect ? `✓ +${qMarks}` : `✗ 0/${qMarks}`}
                    </span>
                  )}
                </legend>
                {question.choices?.map((choice: string, choiceIndex: number) => {
                  const isStudentPick = studentAns === choiceIndex;
                  const isRightChoice = question.correctIndex === choiceIndex;
                  let extraClass = "";
                  if (alreadySubmitted) {
                    if (isStudentPick && isRightChoice) extraClass = "bg-emerald-600 text-white font-bold pointer-events-none";
                    else if (isStudentPick && !isRightChoice) extraClass = "bg-red-600 text-white font-bold pointer-events-none";
                    else if (!isStudentPick && isRightChoice) extraClass = "bg-emerald-100 text-emerald-900 border-emerald-400 font-bold pointer-events-none";
                    else extraClass = "opacity-70 pointer-events-none";
                  }
                  return (
                    <label
                      className={`choice ${!alreadySubmitted && answers[index] === choiceIndex ? "selected" : ""} ${extraClass}`}
                      key={choiceIndex}
                    >
                      <input
                        type="radio"
                        name={question.id || `q-${index}`}
                        disabled={alreadySubmitted}
                        checked={answers[index] === choiceIndex}
                        onChange={() =>
                          !alreadySubmitted && setAnswers(previous => {
                            const next = [...previous];
                            next[index] = choiceIndex;
                            return next;
                          })
                        }
                      />
                      <span className="flex-1">{choice}</span>
                      {alreadySubmitted && isStudentPick && (
                        <span className="text-xs opacity-80 mr-1">{isRightChoice ? "(إجابتك ✓)" : "(إجابتك ✗)"}</span>
                      )}
                      {alreadySubmitted && isRightChoice && !isStudentPick && (
                        <span className="text-xs text-emerald-700 font-bold mr-1">(الصحيحة)</span>
                      )}
                    </label>
                  );
                })}
              </fieldset>
            );
          })}
          {!alreadySubmitted ? (
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "جاري التسليم..." : "تسليم الإجابات"} <CheckCircle2 size={16} />
            </Button>
          ) : (
            <div className="text-center font-bold text-slate-500 py-3">
              تم تسليم الامتحان سابقاً
            </div>
          )}
        </div>
        <aside className="paper-card exam-side">
          <span className="eyebrow font-bold text-slate-400">YOUR ATTEMPT</span>
          <strong className="big-number text-3xl font-extrabold text-[#1a72d5]">
            {answers.filter(answer => answer !== undefined && answer !== -1).length}/
            {exam.questions?.length || 0}
          </strong>
          <p className="text-sm text-slate-500">أسئلة تمت الإجابة عنها</p>
          <div className="progress-track mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-[#1a72d5] transition-all"
              style={{
                width: `${exam.questions?.length ? (answers.filter(answer => answer !== undefined && answer !== -1).length / exam.questions.length) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="detail-facts mt-6 space-y-2 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <Activity size={15} />
              <span>المدة: {exam.duration} دقيقة</span>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function TeacherLessonManagerLegacy({
  learning,
  updateLearning,
}: {
  learning: LearningStore;
  updateLearning: UpdateLearning;
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    lectureUrl: "",
    resourceUrl: "",
    courseId: "programming" as CourseId,
    published: true,
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.lectureUrl.trim()) {
      toast.error("اكتب عنوان المحاضرة ورابطها أولًا");
      return;
    }
    updateLearning(previous => ({
      ...previous,
      lessons: [
        {
          ...form,
          id: makeId("lesson"),
          teacher: "نورهان عادل",
          createdAt: formatDate(),
        },
        ...previous.lessons,
      ],
    }));
    setForm({
      title: "",
      description: "",
      lectureUrl: "",
      resourceUrl: "",
      courseId: "programming",
      published: true,
    });
    toast.success("تمت إضافة المحاضرة ونشرها للطلاب");
  };
  return (
    <>
      <PageHeader
        eyebrow="TEACHER STUDIO / LESSONS"
        title="مكتبة المحاضرات"
        description="أضف المادة التعليمية وروابط المحاضرات والمصادر، ثم انشرها للطلاب فورًا."
      />
      <div className="teacher-workspace-grid">
        <form className="paper-card creator-form" onSubmit={submit}>
          <div className="form-heading">
            <span className="eyebrow">NEW LESSON</span>
            <h2>إضافة مادة تعليمية</h2>
            <p>كل ما تحفظه هنا سيظهر في مسار الطالب بعد النشر.</p>
          </div>
          <Field label="عنوان المحاضرة">
            <input
              required
              value={form.title}
              onChange={event =>
                setForm({ ...form, title: event.target.value })
              }
              placeholder="مثال: قوانين نيوتن الثلاثة"
            />
          </Field>
          <Field label="الكورس">
            <select
              value={form.courseId}
              onChange={event =>
                setForm({ ...form, courseId: event.target.value as CourseId })
              }
            >
              {courseCatalog.map(course => (
                <option value={course.id} key={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="وصف المادة">
            <textarea
              value={form.description}
              onChange={event =>
                setForm({ ...form, description: event.target.value })
              }
              placeholder="اكتب وصفًا قصيرًا لما سيتعلمه الطالب..."
            />
          </Field>
          <Field label="رابط المحاضرة">
            <input
              required
              type="url"
              value={form.lectureUrl}
              onChange={event =>
                setForm({ ...form, lectureUrl: event.target.value })
              }
              placeholder="https://meet.google.com/... أو رابط الفيديو"
            />
          </Field>
          <Field label="رابط المصادر الاختياري">
            <input
              type="url"
              value={form.resourceUrl}
              onChange={event =>
                setForm({ ...form, resourceUrl: event.target.value })
              }
              placeholder="https://drive.google.com/..."
            />
          </Field>
          <label className="switch-row">
            <input
              type="checkbox"
              checked={form.published}
              onChange={event =>
                setForm({ ...form, published: event.target.checked })
              }
            />
            <span>نشر المادة للطلاب فورًا</span>
          </label>
          <Button type="submit">
            <Plus size={16} /> إضافة ونشر المحاضرة
          </Button>
        </form>
        <div className="paper-card published-panel">
          <div className="card-title">
            <div>
              <span className="eyebrow">PUBLISHED CONTENT</span>
              <h3>المواد الحالية</h3>
            </div>
            <span className="signal-chip">
              {learning.lessons.filter(lesson => lesson.published).length}{" "}
              منشورة
            </span>
          </div>
          {learning.lessons.map(lesson => (
            <div className="published-row" key={lesson.id}>
              <div className="lesson-num">
                <FileText size={15} />
              </div>
              <div>
                <strong>{lesson.title}</strong>
                <small>
                  {courseById(lesson.courseId).title} ·{" "}
                  {lesson.description || "بدون وصف"}
                </small>
                <div className="published-links">
                  <a href={lesson.lectureUrl} target="_blank" rel="noreferrer">
                    رابط المحاضرة <ExternalLink size={13} />
                  </a>
                  {lesson.resourceUrl && (
                    <a
                      href={lesson.resourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      المصادر <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              </div>
              <span
                className={`status ${lesson.published ? "success" : "warning"}`}
              >
                <i />
                {lesson.published ? "منشورة" : "مسودة"}
              </span>
            </div>
          ))}
          {learning.lessons.length === 0 && (
            <Empty
              icon={FileText}
              title="لم تضف مادة بعد"
              text="استخدم النموذج لإضافة أول محاضرة."
            />
          )}
        </div>
      </div>
    </>
  );
}

function TeacherExamManager({
  learning,
  updateLearning,
}: {
  learning: LearningStore;
  updateLearning: UpdateLearning;
}) {
  const [tab, setTab] = useState<"create" | "review">("create");
  const [form, setForm] = useState({
    title: "",
    description: "",
    duration: "20",
    courseId: "programming" as CourseId,
    question: "",
    choices: "",
    correctIndex: "0",
    published: true,
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const choices = form.choices
      .split("\n")
      .map(choice => choice.trim())
      .filter(Boolean);
    if (!form.title.trim() || !form.question.trim() || choices.length < 2) {
      toast.error("أضف عنوان الاختبار وسؤالًا واختيارين على الأقل");
      return;
    }
    const correctIndex = Math.min(
      Number(form.correctIndex) || 0,
      choices.length - 1
    );
    updateLearning(previous => ({
      ...previous,
      exams: [
        {
          id: makeId("exam"),
          courseId: form.courseId,
          title: form.title,
          description: form.description,
          duration: Number(form.duration) || 20,
          teacher: "نورهان عادل",
          published: form.published,
          createdAt: formatDate(),
          questions: [
            {
              id: makeId("question"),
              prompt: form.question,
              choices,
              correctIndex,
            },
          ],
        },
        ...previous.exams,
      ],
    }));
    setForm({
      title: "",
      description: "",
      duration: "20",
      courseId: "programming",
      question: "",
      choices: "",
      correctIndex: "0",
      published: true,
    });
    toast.success("تم إنشاء الامتحان ونشره للطلاب");
  };
  return (
    <>
      <PageHeader
        eyebrow="TEACHER STUDIO / ASSESSMENTS"
        title="الامتحانات والمراجعة"
        description="أنشئ اختبارًا، انشره، ثم راجع إجابات الطلاب ودرجاتهم من مكان واحد."
        action={
          <div className="segmented-tabs">
            <button
              className={tab === "create" ? "active" : ""}
              onClick={() => setTab("create")}
            >
              إنشاء امتحان
            </button>
            <button
              className={tab === "review" ? "active" : ""}
              onClick={() => setTab("review")}
            >
              مراجعة الدرجات
            </button>
          </div>
        }
      />
      {tab === "create" ? (
        <div className="teacher-workspace-grid">
          <form className="paper-card creator-form" onSubmit={submit}>
            <div className="form-heading">
              <span className="eyebrow">NEW ASSESSMENT</span>
              <h2>إنشاء امتحان</h2>
              <p>سيظهر الامتحان المنشور تلقائيًا في حساب الطالب.</p>
            </div>
            <Field label="اسم الامتحان">
              <input
                required
                value={form.title}
                onChange={event =>
                  setForm({ ...form, title: event.target.value })
                }
                placeholder="مثال: اختبار الوحدة الثانية"
              />
            </Field>
            <Field label="الكورس">
              <select
                value={form.courseId}
                onChange={event =>
                  setForm({ ...form, courseId: event.target.value as CourseId })
                }
              >
                {courseCatalog.map(course => (
                  <option value={course.id} key={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-two-col">
              <Field label="المدة بالدقائق">
                <input
                  type="number"
                  min="5"
                  value={form.duration}
                  onChange={event =>
                    setForm({ ...form, duration: event.target.value })
                  }
                />
              </Field>
              <Field label="رقم الإجابة الصحيحة">
                <input
                  type="number"
                  min="0"
                  value={form.correctIndex}
                  onChange={event =>
                    setForm({ ...form, correctIndex: event.target.value })
                  }
                />
              </Field>
            </div>
            <Field label="وصف الامتحان">
              <textarea
                value={form.description}
                onChange={event =>
                  setForm({ ...form, description: event.target.value })
                }
                placeholder="ما الذي يقيسه هذا الاختبار؟"
              />
            </Field>
            <Field label="السؤال الأول">
              <textarea
                required
                value={form.question}
                onChange={event =>
                  setForm({ ...form, question: event.target.value })
                }
                placeholder="اكتب السؤال هنا..."
              />
            </Field>
            <Field label="الاختيارات — اختيار واحد في كل سطر">
              <textarea
                required
                value={form.choices}
                onChange={event =>
                  setForm({ ...form, choices: event.target.value })
                }
                placeholder={"الاختيار الأول\nالاختيار الثاني\nالاختيار الثالث"}
              />
            </Field>
            <label className="switch-row">
              <input
                type="checkbox"
                checked={form.published}
                onChange={event =>
                  setForm({ ...form, published: event.target.checked })
                }
              />
              <span>نشر الامتحان للطلاب فورًا</span>
            </label>
            <Button type="submit">
              <Plus size={16} /> إنشاء ونشر الامتحان
            </Button>
          </form>
          <div className="paper-card published-panel">
            <div className="card-title">
              <div>
                <span className="eyebrow">ASSESSMENT LIBRARY</span>
                <h3>الاختبارات المنشورة</h3>
              </div>
              <span className="signal-chip">
                {learning.exams.filter(exam => exam.published).length} اختبارات
              </span>
            </div>
            {learning.exams.map(exam => (
              <div className="published-row" key={exam.id}>
                <div className="lesson-num">
                  <ClipboardCheck size={15} />
                </div>
                <div>
                  <strong>{exam.title}</strong>
                  <small>
                    {courseById(exam.courseId).title} · {exam.questions.length}{" "}
                    أسئلة · {exam.duration} دقيقة
                  </small>
                </div>
                <span
                  className={`status ${exam.published ? "success" : "warning"}`}
                >
                  <i />
                  {exam.published ? "منشور" : "مسودة"}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <TeacherGradeBook learning={learning} updateLearning={updateLearning} />
      )}
    </>
  );
}
function TeacherGradeBook({
  learning,
  updateLearning,
}: {
  learning: LearningStore;
  updateLearning: UpdateLearning;
}) {
  const publishedExams = learning.exams.filter(exam => exam.published);
  const [selectedExamId, setSelectedExamId] = useState(
    publishedExams[0]?.id || ""
  );
  const exam = learning.exams.find(item => item.id === selectedExamId);
  const submissions = useMemo(
    () =>
      learning.submissions.filter(
        submission => submission.examId === selectedExamId
      ),
    [learning.submissions, selectedExamId]
  );
  const [draftScores, setDraftScores] = useState<Record<string, string>>({});
  const saveScore = (submission: Submission) => {
    const raw = draftScores[submission.id];
    const score =
      raw === undefined
        ? submission.score
        : Math.max(0, Math.min(100, Number(raw)));
    updateLearning(previous => ({
      ...previous,
      submissions: previous.submissions.map(item =>
        item.id === submission.id ? { ...item, score, reviewed: true } : item
      ),
    }));
    toast.success("تم حفظ الدرجة واعتماد المراجعة");
  };
  return (
    <div className="gradebook">
      <div className="gradebook-toolbar paper-card">
        <Field label="اختَر الامتحان">
          <select
            value={selectedExamId}
            onChange={event => setSelectedExamId(event.target.value)}
          >
            {publishedExams.map(item => (
              <option value={item.id} key={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </Field>
        {exam && (
          <div className="gradebook-summary">
            <span>{exam.title}</span>
            <b>{submissions.length} تسليم</b>
          </div>
        )}
      </div>
      {exam ? (
        <div className="paper-card grade-table">
          <div className="card-title">
            <div>
              <span className="eyebrow">REVIEW / GRADES</span>
              <h3>مراجعة إجابات الطلاب</h3>
            </div>
            <span className="signal-chip">يمكن تعديل الدرجات محليًا</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>الطالب</th>
                  <th>تاريخ التسليم</th>
                  <th>الإجابات</th>
                  <th>الدرجة</th>
                  <th>الحالة</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {submissions.map(submission => (
                  <tr key={submission.id}>
                    <td>
                      <div className="person">
                        <span className="avatar avatar-0">
                          {submission.studentName[0]}
                        </span>
                        <span>
                          <strong>{submission.studentName}</strong>
                          <small>student-demo</small>
                        </span>
                      </div>
                    </td>
                    <td className="muted">{submission.submittedAt}</td>
                    <td>
                      {
                        submission.answers.filter(
                          answer => answer !== undefined
                        ).length
                      }
                      /{exam.questions.length}
                    </td>
                    <td>
                      <input
                        className="score-input"
                        type="number"
                        min="0"
                        max="100"
                        value={
                          draftScores[submission.id] ?? submission.score ?? ""
                        }
                        onChange={event =>
                          setDraftScores({
                            ...draftScores,
                            [submission.id]: event.target.value,
                          })
                        }
                        placeholder="--"
                      />
                    </td>
                    <td>
                      <span
                        className={`status ${submission.reviewed ? "success" : "warning"}`}
                      >
                        <i />
                        {submission.reviewed ? "تمت المراجعة" : "جديد"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="row-action"
                        onClick={() => saveScore(submission)}
                      >
                        حفظ <CheckCircle2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {submissions.length === 0 && (
            <Empty
              icon={ClipboardCheck}
              title="لا توجد تسليمات بعد"
              text="ستظهر إجابات الطلاب بعد تسليم الامتحان."
            />
          )}
        </div>
      ) : (
        <Empty
          icon={ClipboardCheck}
          title="أنشئ أول امتحان"
          text="بعد نشر الامتحان ستظهر هنا صفحة مراجعته."
        />
      )}
    </div>
  );
}

function renderHomeworkContent(text: string) {
  if (!text) return null;
  const match = text.match(/\[صورة المرفق\]:\s*(\S+)/);
  const imageUrl = match ? match[1] : (text.startsWith("data:image/") || text.startsWith("http") ? text : null);
  const plainText = match 
    ? text.replace(/\[صورة المرفق\]:\s*\S+/, "").trim() 
    : (imageUrl ? "" : text.trim());

  return (
    <div className="space-y-3 break-words overflow-hidden max-w-full">
      {plainText && <p className="text-slate-700 whitespace-pre-line leading-relaxed break-all">{plainText}</p>}
      {imageUrl && (
        <div className="mt-2 rounded-xl bg-slate-100 p-2 border border-slate-200">
          <span className="block text-xs font-bold text-slate-600 mb-1">📸 الصورة المرفقة بالحل:</span>
          <img
            src={imageUrl}
            alt="صورة الحل المرفقة"
            className="max-h-56 max-w-full rounded-2xl border border-slate-200 object-contain shadow-sm cursor-pointer hover:opacity-95 transition-opacity"
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

function StudentResults({ learning, onNavigate }: { learning: LearningStore; onNavigate: (p: string) => void }) {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<any[]>("/submissions")
      .then(res => setSubmissions(res || []))
      .catch(() => setSubmissions(learning.submissions.filter(s => s.studentId === "student-demo")))
      .finally(() => setLoading(false));
  }, []);

  const totalExams = submissions.length;
  const reviewedCount = submissions.filter(item => item.reviewed || item.score !== null).length;
  const avgScore = totalExams ? Math.round(submissions.reduce((sum, item) => sum + (item.score || 0), 0) / totalExams) : 0;

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-slate-500 font-bold">جاري تحميل النتائج...</div>;
  }

  return (
    <>
      <PageHeader
        eyebrow="RESULTS / PROGRESS"
        title="نتائج الامتحانات الشاملة"
        description="استعرض نتائج امتحاناتك المعتمدة من الخادم وملاحظات المدرسين وسرد الدرجات."
      />
      <div className="results-summary">
        <Stat icon={ClipboardCheck} label="عدد الاختبارات" value={String(totalExams)} meta="اختبارات تم تسليمها" />
        <Stat icon={Target} label="متوسط الدرجات" value={`${avgScore}/100`} meta="نسبتك المئوية" accent="mint" />
        <Stat icon={CheckCircle2} label="مراجعة المدرس" value={`${reviewedCount}/${totalExams}`} meta="نتائج معتمدة" accent="amber" />
      </div>
      <div className="paper-card results-list">
        {submissions.map(submission => {
          const examTitle = submission.exam?.title || "اختبار تقييمي";
          const maxScore = submission.exam?.questions?.reduce((sum: number, q: any) => sum + Number(q.marks || 1), 0) || 100;
          const isReviewed = submission.reviewed || submission.score !== null;
          return (
            <div className="result-row flex items-center justify-between p-4 border-b border-slate-100" key={submission.id}>
              <div className="flex items-center gap-3">
                <span className="lesson-num grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600 font-bold">
                  <ClipboardCheck size={18} />
                </span>
                <div>
                  <strong className="block text-base font-bold text-slate-900">{examTitle}</strong>
                  <small className="text-xs text-slate-500">
                    تم التسليم: {submission.submittedAt ? new Date(submission.submittedAt).toLocaleDateString("ar-EG") : "مؤخراً"}
                  </small>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <b className={`text-lg font-black ${submission.score !== null && submission.score >= (maxScore / 2) ? "text-emerald-600" : "text-amber-600"}`}>
                  {submission.score !== null ? `${submission.score} / ${maxScore}` : "قيد المراجعة"}
                </b>
                <span className={`status rounded-full px-3 py-1 text-xs font-bold ${isReviewed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  {isReviewed ? "تمت المراجعة ✓" : "تحت المراجعة"}
                </span>
                <Button secondary onClick={() => onNavigate(`exam-take:${submission.examId}`)}>
                  معاينة الإجابات وسرد الدرجات 🔍
                </Button>
              </div>
            </div>
          );
        })}
        {submissions.length === 0 && (
          <Empty
            icon={TrendingUp}
            title="لم تسلم أي اختبار بعد"
            text="ابدأ من صفحة الامتحانات وستظهر نتائجك المعتمدة هنا فوراً."
          />
        )}
      </div>
    </>
  );
}

function Messages() {
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState<string[]>([]);
  return (
    <div className="messages-layout">
      <div className="conversation-list">
        <div className="list-header">
          <h3>المحادثات</h3>
          <button className="icon-btn">
            <Plus size={17} />
          </button>
        </div>
        {["سارة محمود", "يوسف علي", "فريق المدرسين", "دعم السنتر"].map(
          (n, i) => (
            <button
              className={`conversation ${i === 0 ? "active" : ""}`}
              key={n}
            >
              <span className={`avatar avatar-${i}`}>{n[0]}</span>
              <span>
                <strong>{n}</strong>
                <small>
                  {i === 0 ? "هل يمكن توضيح الدرس؟" : "آخر رسالة منذ يوم"}
                </small>
              </span>
              <b>{i < 2 ? i + 1 : ""}</b>
            </button>
          )
        )}
      </div>
      <div className="chat-panel">
        <div className="chat-head">
          <div className="person">
            <span className="avatar avatar-0">س</span>
            <span>
              <strong>سارة محمود</strong>
              <small>
                <i className="online" /> متصلة الآن
              </small>
            </span>
          </div>
          <button className="icon-btn">
            <MoreHorizontal size={18} />
          </button>
        </div>
        <div className="chat-body">
          <div className="message received">
            مرحبًا، هل يمكنني معرفة المطلوب في الواجب القادم؟
            <small>10:42 ص</small>
          </div>
          <div className="message sent">
            أكيد، سأرسل لك ورقة المراجعة الآن. بالتوفيق في المذاكرة.
            <small>10:44 ص</small>
          </div>
          {sent.map((item, index) => (
            <div className="message sent" key={`${item}-${index}`}>
              {item}
              <small>الآن</small>
            </div>
          ))}
        </div>
        <div className="chat-input">
          <input
            value={message}
            onChange={event => setMessage(event.target.value)}
            placeholder="اكتب رسالتك..."
          />
          <button
            className="primary-btn"
            onClick={() => {
              if (!message.trim()) return;
              setSent([...sent, message]);
              setMessage("");
              toast.success("تم إرسال الرسالة التجريبية");
            }}
          >
            إرسال
          </button>
        </div>
      </div>
    </div>
  );
}

function StudentAssignments({ user: _user, onNavigate: _onNavigate }: { user: ApiUser; onNavigate: (p: string) => void }) {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [query, setQuery] = useState("");

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api<any[]>("/assignments").catch(() => []),
      api<any[]>("/assignment-submissions").catch(() => []),
    ])
      .then(([fetchedAssignments, fetchedSubmissions]) => {
        setAssignments(fetchedAssignments || []);
        setSubmissions(fetchedSubmissions || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الصورة يجب ألا يتجاوز 5 ميجابايت");
      return;
    }
    setCropFile(file);
  };

  const submitHomework = async (assignmentId: string) => {
    if (!content.trim() && !imageUrl) {
      toast.warning("يرجى كتابة الإجابة أو أرفق صورة الواجب");
      return;
    }
    try {
      await api(`/assignments/${assignmentId}/submissions`, {
        method: "POST",
        body: JSON.stringify({
          content: content.trim() + (imageUrl ? `\n[صورة المرفق]: ${imageUrl}` : ""),
        }),
      });
      toast.success("تم تسليم الواجب بنجاح! 🚀");
      setSubmittingId(null);
      setContent("");
      setImageUrl("");
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تسليم الواجب");
    }
  };

  const filteredAssignments = assignments.filter(item =>
    item.title?.toLowerCase().includes(query.toLowerCase()) ||
    item.courseTitle?.toLowerCase().includes(query.toLowerCase()) ||
    !query
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500 font-bold">
        جاري تحميل الواجبات الخاصة بك...
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="STUDENT / ASSIGNMENTS"
        title="واجباتي المدرسية"
        description="استعرض الواجبات المطلوبة في المواد التي اشتركت بها وسلم إجاباتك."
      />

      <div className="toolbar mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="search-box flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <Search size={17} className="text-slate-400" />
          <input
            className="bg-transparent text-sm outline-none"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="ابحث باسم الواجب أو المادة..."
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {filteredAssignments.map(assignment => {
          const submission = submissions.find(s => s.assignmentId === assignment.id);
          const isModalOpen = submittingId === assignment.id;

          return (
            <div key={assignment.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between overflow-hidden max-w-full">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600">
                      {assignment.courseTitle || "المادة"}
                    </span>
                    <h3 className="mt-2 text-xl font-bold text-slate-900">{assignment.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      المدرس: {assignment.teacherName || "مدرس المادة"} · موعد التسليم: <b className="text-slate-700">{assignment.dueDate}</b>
                    </p>
                  </div>
                  {submission ? (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 size={14} /> تم التسليم
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                      لم يُسلم بعد
                    </span>
                  )}
                </div>

                <p className="mt-4 text-sm text-slate-600 whitespace-pre-line bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  {assignment.description || "لا يوجد وصف إضافي."}
                </p>

                {submission && (
                  <div className="mt-4 rounded-2xl bg-emerald-50/50 p-4 text-xs border border-emerald-100 overflow-hidden max-w-full">
                    <div className="flex justify-between font-bold text-emerald-900 mb-2">
                      <span>إجابتك المسلمة:</span>
                      <span className={`px-2 py-0.5 rounded-full ${submission.score !== null ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                        {submission.score !== null ? `درجة الواجب: ${submission.score}/100` : "بانتظار تقييم المدرس"}
                      </span>
                    </div>
                    {renderHomeworkContent(submission.content)}
                  </div>
                )}
              </div>

              {!submission && (
                <div className="mt-6 border-t border-slate-100 pt-4">
                  {!isModalOpen ? (
                    <Button onClick={() => { setSubmittingId(assignment.id); setContent(""); setImageUrl(""); }}>
                      تسليم الواجب الآن 📝
                    </Button>
                  ) : (
                    <div className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
                      <h4 className="font-bold text-sm text-slate-800">إجابة الواجب:</h4>
                      <textarea
                        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                        rows={3}
                        placeholder="اكتب إجابتك أو ملاحظاتك هنا..."
                        value={content}
                        onChange={e => setContent(e.target.value)}
                      />
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          📸 إرفاق صورة الحل (صورة الورقة أو الكشكول):
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          className="text-xs text-slate-500 file:mr-2 file:rounded-xl file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-xs file:font-bold file:text-white"
                          onChange={handleImageFile}
                        />
                        {imageUrl && (
                          <div className="mt-2 relative inline-block">
                            <img src={imageUrl} alt="Homework solution preview" className="h-24 rounded-xl border border-slate-200 object-cover" />
                            <button className="absolute -top-2 -right-2 rounded-full bg-red-500 p-1 text-white text-xs" onClick={() => setImageUrl("")}>✕</button>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button className="flex-1" onClick={() => submitHomework(assignment.id)}>
                          تأكيد وإرسال الواجب <CheckCircle2 size={16} />
                        </Button>
                        <Button secondary onClick={() => setSubmittingId(null)}>إلغاء</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredAssignments.length === 0 && (
        <Empty
          icon={ClipboardCheck}
          title="لا توجد واجبات حالية"
          text="عندما يضيف مدرس الكورس واجبات جديدة ستظهر هنا مباشرة."
        />
      )}
      {cropFile && <ImageCropDialog file={cropFile} onCancel={() => setCropFile(null)} onComplete={value => { setImageUrl(value); setCropFile(null); toast.success("تم اختيار صورة الواجب"); }} />}
    </>
  );
}

function DataPage({
  user,
  role,
  page,
  onNavigate,
  learning,
  updateLearning,
  onUserChange,
}: {
  user: ApiUser;
  role: Role;
  page: string;
  onNavigate: (p: string) => void;
  learning: LearningStore;
  updateLearning: UpdateLearning;
  onUserChange: (user: ApiUser) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<Array<(typeof courseCatalog)[number] & { enrolled?: boolean }>>(courseCatalog);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<string[]>([]);
  useEffect(() => {
    if (page !== "browse" && page !== "courses") return;
    void Promise.all([
      api<ApiCourse[]>("/courses").catch(() => []),
      role === "student" ? api<ApiEnrollment[]>("/enrollments").catch(() => []) : Promise.resolve([]),
    ])
      .then(([items, enrollments]) => {
        const list = Array.isArray(items) && items.length > 0 ? items : courseCatalog;
        const approvedIds = (Array.isArray(enrollments) ? enrollments : [])
          .filter((item) => item.status === "approved")
          .map((item) => String(item.courseId));

        setEnrolledCourseIds(approvedIds);
        setCatalog(list.map((course: any) => {
          const courseId = String(course.id ?? course.slug ?? "course");
          const title = course.title || course.name || "عنوان غير متوفر";
          const image = course.image || course.imageUrl || course.cover || course.thumbnail || programImg;
          const priceValue = Number(course.price ?? 0);
          const lessonCount = Number(course.lessonCount ?? course.lessons ?? 0);
          const teacherNames = Array.isArray(course.teachers)
            ? course.teachers
                .map((teacher: any) => teacher.name || teacher.teacher?.name || "مدرس")
                .filter(Boolean)
            : Array.isArray(course.teacherIds) && course.teacherIds.length
              ? course.teacherIds.map((teacherId: string) => `مدرس ${teacherId}`)
              : ["مدرسو الكورس"];

          return {
            id: courseId as CourseId,
            title,
            teacher: teacherNames.join(", ") || "مدرسو الكورس",
            tag: course.level || "عام",
            price: Number.isFinite(priceValue) ? `${priceValue} جنيه` : "مجاني",
            img: image || programImg,
            progress: Number(course.progress ?? 0),
            lessons: lessonCount,
            enrolled: role === "student" ? approvedIds.includes(courseId) : false,
          };
        }));
      })
      .catch(() => {
        setCatalog(courseCatalog);
        toast.error("تعذر تحميل الكورسات من الخادم");
      });
  }, [page, role]);
  const titles: Record<string, string> = {
    students: "إدارة الطلاب",
    teachers: "إدارة المدرسين",
    attendance: "سجل الحضور",
    payments: "المدفوعات والاشتراكات",
    "payment-methods": "طرق الدفع",
    reports: "التقارير والتحليلات",
    lessons: "مكتبة المحاضرات",
    exams: "الامتحانات",
    assignments: "الواجبات",
    messages: "الرسائل",
    grades: "درجات الطلاب",
    results: "نتائج الامتحانات",
  };
  if (page.startsWith("exam-take:"))
    return (
      <ExamTakePage
        examId={page.split(":")[1]}
        learning={learning}
        updateLearning={updateLearning}
        onNavigate={onNavigate}
      />
    );
  if (page.startsWith("course-detail:") && role === "admin")
    return <AdminCourseDetail courseId={page.split(":")[1]} onBack={() => onNavigate("courses")} />;
  if (page.startsWith("course-detail:") && role === "student")
    return <CourseDetailContent courseId={page.split(":")[1]} user={user} onNavigate={onNavigate} />;
  if (page === "lesson")
    return <LessonPage onNavigate={onNavigate} learning={learning} />;
  if (page === "calendar") return <CalendarPage />;
  if (page === "profile") return <ProfilePage role={role} user={user} onUserChange={onUserChange} />;
  if (page === "cart") return <CartPage onNavigate={onNavigate} />;
  if (page === "results" && role === "student")
    return <StudentResults learning={learning} onNavigate={onNavigate} />;
  if (page === "exams" && role === "student")
    return <StudentExams learning={learning} onNavigate={onNavigate} />;
  if (page === "assignments" && role === "student")
    return <StudentAssignments user={user} onNavigate={onNavigate} />;
  if (page === "lessons" && role === "teacher")
    return (
      <TeacherLessonManager
        learning={learning}
        updateLearning={updateLearning}
      />
    );
  if ((page === "governance" || page === "admins") && role === "admin")
    return <AdminGovernance learning={learning} updateLearning={updateLearning} canManageTeam={user.id === "admin-demo" || Boolean(user.permissions?.includes("users"))} initialTab={page === "admins" ? "admins" : undefined} />;
  if (page === "payments" && role === "admin")
    return <AdminPaymentsManager />;
  if (page === "payment-methods" && role === "admin")
    return <AdminPaymentMethodsManager />;
  if (page === "reports" && role === "admin")
    return <AdminReportsManager />;
  if (page === "announcements" && role === "admin")
    return <AdminAnnouncementsManager />;
  if ((page === "teachers" || page === "courses") && role === "admin") {
    return <AdminCatalogManager page={page} onNavigate={onNavigate} />;
  }
  if (page === "course-new" && role === "admin") return <AdminCourseCreate onBack={() => onNavigate("courses")} />;
  if ((page === "students" || page === "attendance") && role === "admin")
    return <AdminStudentsAttendance page={page} />;
  if (page === "exams" && role === "teacher")
    return (
      <TeacherExamManager learning={learning} updateLearning={updateLearning} />
    );
  if (page === "grades" && role === "teacher")
    return (
      <TeacherGradeBook learning={learning} updateLearning={updateLearning} />
    );
  if (page === "courses" || page === "browse")
    return (
      <>
        <PageHeader
          eyebrow={
            role === "student" ? "DISCOVER / 2026" : "CONTENT MANAGEMENT"
          }
          title={role === "student" ? "اكتشفي ما يناسبك" : "إدارة الكورسات"}
          description={
            role === "student"
              ? "مسارات مرتبة تساعدك على التعلم بإيقاعك."
              : "أنشئ المحتوى، عيّن المدرسين، وتابع الأداء."
          }
          action={
            <Button onClick={() => role === "admin" && page === "courses" ? onNavigate("course-new") : setOpen(true)}>
              <Plus size={16} />{" "}
              {role === "student" ? "تصفح التصنيفات" : "إضافة كورس"}
            </Button>
          }
        />
        <div className="toolbar">
          <div className="search-box">
            <Search size={17} />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="ابحث في المحتوى..."
            />
          </div>
          <button
            className="secondary-btn"
            onClick={() => toast.info("تم فتح فلاتر المحتوى")}
          >
            الفلاتر <Settings2 size={16} />
          </button>
        </div>
        <div className="course-grid three">
          {catalog
            .filter(course => page === "browse" || enrolledCourseIds.includes(course.id))
            .filter(course => course.title.includes(query) || !query)
            .map(course => (
              <CourseCard
                key={course.id}
                course={course}
                onClick={() => onNavigate(`course-detail:${course.id}`)}
              />
            ))}
        </div>
      </>
    );
  return (
    <>
      <PageHeader
        eyebrow={role.toUpperCase() + " / WORKSPACE"}
        title={titles[page] || "الكورسات"}
        description={
          page === "messages"
            ? "تواصل مع الطلاب والمدرسين من مساحة واحدة."
            : "بيانات تجريبية قابلة للتصفية والتعديل محليًا."
        }
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} /> إضافة جديد
          </Button>
        }
      />
      <div className="toolbar">
        <div className="search-box">
          <Search size={17} />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="ابحث بالاسم أو الحالة..."
          />
        </div>
        <div className="toolbar-actions">
          <button
            className="secondary-btn"
            onClick={() => toast.info("تم تطبيق الفلاتر")}
          >
            آخر 30 يومًا
          </button>
          <button
            className="secondary-btn"
            onClick={() => toast.success("تم تجهيز ملف CSV التجريبي")}
          >
            تصدير CSV
          </button>
        </div>
      </div>
      {page === "messages" ? (
        <Messages />
      ) : page === "reports" ? (
        <Charts role={role} />
      ) : (
        <div className="table-card full">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>الاسم</th>
                  <th>
                    {page === "payments"
                      ? "المبلغ"
                      : page === "attendance"
                        ? "التاريخ"
                        : "المادة / القسم"}
                  </th>
                  <th>الحالة</th>
                  <th>آخر تحديث</th>
                  <th>الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {students
                  .concat(students)
                  .filter(student => student.name.includes(query) || !query)
                  .map((student, i) => (
                    <tr key={i}>
                      <td className="muted">
                        {String(i + 1).padStart(2, "0")}
                      </td>
                      <td>
                        <div className="person">
                          <span className={`avatar avatar-${i % 4}`}>
                            {student.name[0]}
                          </span>
                          <span>
                            <strong>{student.name}</strong>
                            <small>{student.grade}</small>
                          </span>
                        </div>
                      </td>
                      <td>
                        {page === "payments" ? (
                          <b>{(i + 1) * 480},00 ج.م</b>
                        ) : page === "attendance" ? (
                          "الثلاثاء، 24 يونيو"
                        ) : (
                          student.course
                        )}
                      </td>
                      <td>
                        <span
                          className={`status ${i % 4 === 2 ? "warning" : "success"}`}
                        >
                          <i /> {i % 4 === 2 ? "قيد المراجعة" : "مكتمل"}
                        </span>
                      </td>
                      <td className="muted">منذ {i + 1} ساعات</td>
                      <td>
                        <button
                          className="row-action"
                          onClick={() => onNavigate(`${page}-detail`)}
                        >
                          فتح التفاصيل <ChevronLeft size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={event => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setOpen(false)}>
              <X size={18} />
            </button>
            <span className="eyebrow">NEW RECORD</span>
            <h2>إضافة عنصر جديد</h2>
            <p>هذه نافذة تجريبية جاهزة للربط لاحقًا بالـBackend.</p>
            <Field label="الاسم">
              <input placeholder="اكتب الاسم هنا" />
            </Field>
            <Field label="الوصف">
              <textarea placeholder="أضف وصفًا مختصرًا..." />
            </Field>
            <Button
              onClick={() => {
                setOpen(false);
                toast.success("تم الحفظ محليًا");
              }}
            >
              حفظ التغييرات
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

const navByRole: Record<Role, { label: string; icon: any; page: string }[]> = {
  student: [
    { label: "نظرة عامة", icon: LayoutDashboard, page: "overview" },
    { label: "كورساتي", icon: BookOpen, page: "courses" },
    { label: "تصفح الكورسات", icon: Target, page: "browse" },
    { label: "الامتحانات", icon: ClipboardCheck, page: "exams" },
    { label: "النتائج", icon: TrendingUp, page: "results" },
    { label: "الواجبات", icon: CheckCircle2, page: "assignments" },
    { label: "المواعيد", icon: CalendarDays, page: "calendar" },
    { label: "الملف الشخصي", icon: UserRound, page: "profile" },
  ],
  admin: [
    { label: "نظرة عامة", icon: LayoutDashboard, page: "overview" },
    { label: "طلبات الانضمام (جديد)", icon: LockKeyhole, page: "governance" },
    { label: "الطلاب", icon: Users, page: "students" },
    { label: "المدرسون", icon: GraduationCap, page: "teachers" },
    { label: "الكورسات", icon: BookOpen, page: "courses" },
    { label: "الحضور", icon: ClipboardCheck, page: "attendance" },
    { label: "المدفوعات", icon: CircleDollarSign, page: "payments" },
    { label: "طرق الدفع", icon: WalletCards, page: "payment-methods" },
    { label: "التقارير", icon: TrendingUp, page: "reports" },
    { label: "إعلانات الصفحة الرئيسية", icon: Sparkles, page: "announcements" },
    { label: "الرسائل", icon: MessageCircle, page: "messages" },
  ],
  teacher: [
    { label: "نظرة عامة", icon: LayoutDashboard, page: "overview" },
    { label: "كورساتي", icon: BookOpen, page: "courses" },
    { label: "طلابي", icon: Users, page: "students" },
    { label: "المحاضرات", icon: Activity, page: "lessons" },
    { label: "الامتحانات", icon: ClipboardCheck, page: "exams" },
    { label: "درجات الطلاب", icon: TrendingUp, page: "grades" },
    { label: "الواجبات", icon: CheckCircle2, page: "assignments" },
    { label: "الحضور", icon: CalendarDays, page: "attendance" },
    { label: "الرسائل", icon: MessageCircle, page: "messages" },
    { label: "ملفي", icon: UserRound, page: "profile" },
  ],
};

const adminPagePermissions: Partial<Record<string, AdminPermission | AdminPermission[]>> = {
  payments: "payments",
  "payment-methods": "payments",
  reports: "reports",
  announcements: "content",
};

function hasAdminPageAccess(user: ApiUser, page: string) {
  if (user.role !== "admin") return true;
  if (user.id === "admin-demo") return true;
  if (page.startsWith("course-detail:")) page = "courses";
  if (page.startsWith("exam-take:")) page = "content";
  const required = adminPagePermissions[page];
  if (!required) return true;
  const permissions = user.permissions || [];
  return Array.isArray(required)
    ? required.some(permission => permissions.includes(permission))
    : permissions.includes(required);
}

export default function Home({
  user,
  role,
  activePage,
  onNavigate,
  onLogout,
  onUserChange,
}: Props) {
  const [mobile, setMobile] = useState(false);
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; message: string; read: boolean; type?: string; }>>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [learning, setLearning] = useState<LearningStore>(() => readLearning());
  const nav = role === "admin"
    ? navByRole[role].filter(item => item.page === "overview" || hasAdminPageAccess(user, item.page))
    : navByRole[role];
  const pageAllowed = hasAdminPageAccess(user, activePage);
  const unreadNotifications = notifications.filter(item => !item.read).length;
  const roleLabel =
    role === "student"
      ? "مساحة الطالب"
      : role === "admin"
        ? "لوحة السنتر"
        : "مساحة المدرس";
  useEffect(() => {
    const sync = () => setLearning(readLearning());
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    void api<Array<{ id: string; title: string; message: string; read: boolean; type?: string; }>>("/notifications")
      .then(setNotifications)
      .catch(() => undefined);
  }, [role, activePage]);
  useEffect(() => {
    if (!pageAllowed) onNavigate("overview");
  }, [pageAllowed, onNavigate]);
  const openNotifications = async () => {
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
    setNotificationsOpen(open => !open);
  };
  const handleNotificationClick = async (item: { id: string; type?: string; read: boolean }) => {
    if (!item.read) {
      await api(`/notifications/${item.id}/read`, { method: "PATCH" }).catch(() => undefined);
      setNotifications(previous => previous.map(n => n.id === item.id ? { ...n, read: true } : n));
    }
    setNotificationsOpen(false);
    if (role === "admin") {
      onNavigate("governance");
    } else if (item.type === "enrollment" || item.type === "subscription") {
      onNavigate(role === "teacher" ? "students" : "courses");
    } else {
      onNavigate("overview");
    }
  };
  const updateLearning: UpdateLearning = updater => {
    setLearning(previous => {
      const next = updater(previous);
      writeLearning(next);
      return next;
    });
  };
  if (role === "teacher") {
    return <TeacherWorkspace user={user} initialPage={activePage} onLogout={onLogout} />;
  }
  const visiblePage = pageAllowed ? activePage : "overview";

  if (role === "admin") {
    return (
      <AdminDashboard
        user={user}
        onNavigate={onNavigate}
        onLogout={onLogout}
        activePage={visiblePage}
      >
        {visiblePage !== "overview" && (
          <DataPage
            user={user}
            role={role}
            page={visiblePage}
            onNavigate={onNavigate}
            learning={learning}
            updateLearning={updateLearning}
            onUserChange={onUserChange}
          />
        )}
      </AdminDashboard>
    );
  }
  const content =
    visiblePage === "overview" ? (
      <RoleHome role={role} onNavigate={onNavigate} learning={learning} userName={user.name} />
    ) : (
      <DataPage
        user={user}
        role={role}
        page={visiblePage}
        onNavigate={onNavigate}
        learning={learning}
        updateLearning={updateLearning}
        onUserChange={onUserChange}
      />
    );
  return (
    <div className="app-shell" dir="rtl">
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-mark">
            <img src="/assets/platform-logo.png" alt="Oxford Learning Platform" />
          </div>
          <div>
            <strong className="festive-wordmark">Oxford</strong>
            <small>learning platform</small>
          </div>
        </div>
        <div className="user-mini">
          <span className="avatar avatar-0">
            {user.avatar ? <img src={user.avatar} alt={user.name} /> : user.name.trim().charAt(0) || "؟"}
          </span>
          <div>
            <b>
              {user.name}
            </b>
            <small>{roleLabel}</small>
          </div>
          <span className="online-dot" />
        </div>
        <nav>
          {nav.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.page}
                className={activePage === item.page ? "active" : ""}
                onClick={() => {
                  onNavigate(item.page);
                  setMobile(false);
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {item.page === "messages" && <b className="nav-count">3</b>}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <button onClick={() => onNavigate("profile")}>
            <Settings2 size={18} />
            <span>الإعدادات</span>
          </button>
          <button className="logout" onClick={onLogout}>
            <LogOut size={18} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <button
            className="mobile-menu icon-btn"
            onClick={() => setMobile(true)}
          >
            <Menu size={20} />
          </button>
          {(role as string) === "admin" && (
            <div className="admin-header-brand">
              <div className="brand-mark">
                <img src="/assets/platform-logo.png" alt="Oxford" />
              </div>
              <span><b>Oxford</b><small>Learning Platform</small></span>
            </div>
          )}
          <div className="breadcrumbs">
            <span>Oxford</span>
            <ChevronLeft size={14} />
            <b>
              {nav.find(item => item.page === visiblePage)?.label ||
                (visiblePage.startsWith("exam-take:")
                  ? "حل الامتحان"
                  : "نظرة عامة")}
            </b>
          </div>
          <div className="top-actions">
            <div className="global-search">
              <Search size={16} />
              <input placeholder="ابحث عن أي شيء..." />
            </div>
            <button
              className="icon-btn notification"
              onClick={() => void openNotifications()}
              aria-label="الإشعارات"
            >
              <Bell size={18} />
              {unreadNotifications > 0 && (
                <i aria-label={`${unreadNotifications} إشعارات غير مقروءة`}>
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </i>
              )}
            </button>
            {notificationsOpen && (
              <div className="notifications-popover">
                <div className="notifications-popover-head">
                  <strong>الإشعارات</strong>
                  <span>{notifications.filter(item => !item.read).length} جديدة</span>
                </div>
                {notifications.length === 0 ? (
                  <p className="muted">لا توجد إشعارات حاليًا.</p>
                ) : (
                  notifications.slice(0, 5).map(item => (
                    <button
                      className={`notification-item ${item.read ? "read" : ""}`}
                      key={item.id}
                      onClick={() => void handleNotificationClick(item)}
                    >
                      <strong>{item.title}</strong>
                      <span>{item.message}</span>
                    </button>
                  ))
                )}
              </div>
            )}
            <button
              className="profile-trigger"
              onClick={() => onNavigate("profile")}
            >
              <span className="avatar avatar-0">
                {user.avatar ? <img src={user.avatar} alt={user.name} /> : user.name.trim().charAt(0) || "؟"}
              </span>
              <ChevronLeft size={14} />
            </button>
          </div>
        </header>
        {(role as string) === "admin" && (
          <nav className="admin-topnav" aria-label="تنقل لوحة الإدارة">
            <div className="admin-topnav-inner">
              {nav.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.page}
                    className={visiblePage === item.page ? "active" : ""}
                    onClick={() => onNavigate(item.page)}
                  >
                    <Icon size={15} />
                    <span>{item.label.replace(" (جديد)", "")}</span>
                    {item.page === "messages" && <b className="nav-count">3</b>}
                  </button>
                );
              })}
            </div>
          </nav>
        )}
        <div className="page-content">
          {activePage === "overview" && (
            <PageHeader
              eyebrow={
                role === "student"
                  ? "STUDENT HOME"
                  : (role as string) === "admin"
                    ? "CENTER OPERATIONS"
                    : "TEACHER STUDIO"
              }
              title={
                role === "student"
                  ? "صباح الخير، " + user.name.split(" ")[0]
                  : "أهلًا، " + user.name.split(" ")[0]
              }
              description={
                role === "student"
                  ? "إليك ملخص رحلتك التعليمية لهذا الأسبوع."
                  : "هذه هي الصورة اليومية لمساحتك التعليمية."
              }
              action={
                <button className="date-chip">
                  <CalendarDays size={15} /> 24 يونيو 2026
                </button>
              }
            />
          )}{" "}
          {content}
        </div>
        <footer>
          <span>© 2026 Oxford Learning Platform</span>
          <span>مصمم للتعلّم الواضح، يومًا بعد يوم.</span>
        </footer>
      </main>
      {(role as string) !== "admin" && <ScreenProtection />}
    </div>
  );
}
