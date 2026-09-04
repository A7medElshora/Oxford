/* Oxford Learning Platform: RTL paper-first education workspace with real local teacher-to-student learning flows. */
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import ScreenProtection from "@/components/ScreenProtection";
import CourseDetailContent from "@/components/CourseDetailContent";
import TeacherLessonManager from "@/components/TeacherLessonManager";
import AdminGovernance from "@/components/AdminGovernance";
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
  Users,
  WalletCards,
  X,
} from "lucide-react";

const heroImg = "/manus-storage/tafra-hero_39e40131.png";
const programImg = "/manus-storage/tafra-course-programming_a75d5b1c.png";
const scienceImg = "/manus-storage/tafra-course-science_d8c92127.png";

type Role = "student" | "admin" | "teacher";
type Props = {
  role: Role;
  activePage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
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
      resourceUrl: "https://drive.google.com/tafra-demo-notes",
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
      resourceUrl: "https://drive.google.com/tafra-demo-variables",
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
      studentName: "سلمى إبراهيم",
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
    const saved = localStorage.getItem("tafra-learning-content");
    return saved ? (JSON.parse(saved) as LearningStore) : initialLearning;
  } catch {
    return initialLearning;
  }
}
function writeLearning(value: LearningStore) {
  localStorage.setItem("tafra-learning-content", JSON.stringify(value));
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
}: {
  children: any;
  secondary?: boolean;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      className={`${secondary ? "secondary-btn" : "primary-btn"} ${className}`}
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
}: {
  role: Role;
  onNavigate: (p: string) => void;
}) {
  const rows = role === "admin" ? students : students.slice(0, 3);
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
            {rows.map((s, i) => (
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
  learning,
}: {
  onNavigate: (p: string) => void;
  learning: LearningStore;
}) {
  const publishedLessons = learning.lessons.filter(lesson => lesson.published);
  return (
    <>
      <section className="hero-card">
        <div className="hero-copy">
          <span className="eyebrow light">YOUR NEXT MILESTONE</span>
          <h2>
            أهلًا يا <em>سلمى</em>،<br />
            جاهزة لخطوتك التالية؟
          </h2>
          <p>لديك درس واحد مستمر وامتحان قادم هذا الأسبوع.</p>
          <Button onClick={() => onNavigate("lesson")}>
            استمر في التعلّم <ArrowLeft size={16} />
          </Button>
        </div>
        <img src={heroImg} alt="student learning" />
      </section>
      <div className="stats-row">
        <Stat
          icon={BookOpen}
          label="الكورسات النشطة"
          value="04"
          meta="+2 هذا الشهر"
        />
        <Stat
          icon={Target}
          label="نسبة التقدم"
          value="68%"
          meta="أفضل من 74% من الطلاب"
          accent="mint"
        />
        <Stat
          icon={ClipboardCheck}
          label="متوسط الاختبارات"
          value="86/100"
          meta="+8 نقاط عن الشهر الماضي"
          accent="amber"
        />
        <Stat
          icon={Activity}
          label="ساعات التعلّم"
          value="24.5"
          meta="هذا الشهر"
          accent="coral"
        />
      </div>
      <div className="section-heading">
        <div>
          <span className="eyebrow">KEEP GOING</span>
          <h2>تابعي من حيث توقفتِ</h2>
        </div>
        <button className="text-button" onClick={() => onNavigate("courses")}>
          كل الكورسات <ArrowLeft size={15} />
        </button>
      </div>
      <div className="course-grid">
        {courseCatalog.slice(0, 2).map(course => (
          <CourseCard
            key={course.id}
            course={course}
            onClick={() => onNavigate("course-detail")}
          />
        ))}
      </div>
      <div className="section-heading lower">
        <div>
          <span className="eyebrow">NEW FROM YOUR TEACHER</span>
          <h2>آخر المواد المضافة</h2>
        </div>
        <button className="text-button" onClick={() => onNavigate("courses")}>
          فتح المسار <ArrowLeft size={15} />
        </button>
      </div>
      <div className="paper-card learning-feed">
        {publishedLessons.slice(0, 3).map(lesson => (
          <div className="learning-feed-row" key={lesson.id}>
            <span className="lesson-num">
              <FileText size={15} />
            </span>
            <div>
              <strong>{lesson.title}</strong>
              <small>
                {courseById(lesson.courseId).title} · {lesson.teacher}
              </small>
            </div>
            <a
              href={lesson.lectureUrl}
              target="_blank"
              rel="noreferrer"
              className="link-action"
            >
              رابط المحاضرة <ExternalLink size={14} />
            </a>
          </div>
        ))}
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
          <div className="schedule-item">
            <b>غدًا</b>
            <span>
              <strong>محاضرة البرمجة</strong>
              <small>10:00 ص · أونلاين</small>
            </span>
            <span className="dot blue-dot" />
          </div>
          <div className="schedule-item">
            <b>الخميس</b>
            <span>
              <strong>امتحان قصير</strong>
              <small>12:30 م · قاعة 204</small>
            </span>
            <span className="dot coral-dot" />
          </div>
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
              <span />
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
  course: (typeof courseCatalog)[number];
  onClick: () => void;
}) {
  return (
    <button className="course-card" onClick={onClick}>
      <div className="course-image">
        <img src={course.img} alt="" />
        <span>{course.tag}</span>
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
}: {
  role: Role;
  onNavigate: (p: string) => void;
  learning: LearningStore;
}) {
  if (role === "student")
    return <StudentHome onNavigate={onNavigate} learning={learning} />;
  const admin = role === "admin";
  return (
    <>
      <div className="stats-row">
        <Stat
          icon={Users}
          label="إجمالي الطلاب"
          value={admin ? "2,486" : "186"}
          meta="+12% هذا الشهر"
        />
        <Stat
          icon={CircleDollarSign}
          label={admin ? "إيرادات الشهر" : "متوسط الدخل"}
          value={admin ? "184k" : "32.4k"}
          meta="جنيه مصري"
          accent="mint"
        />
        <Stat
          icon={BookOpen}
          label="الكورسات النشطة"
          value={admin ? "42" : "08"}
          meta={admin ? "+6 منشورة" : "3 مسارات منشورة"}
          accent="amber"
        />
        <Stat
          icon={ClipboardCheck}
          label="نسبة الحضور"
          value={admin ? "86%" : "91%"}
          meta="آخر 30 يومًا"
          accent="coral"
        />
      </div>
      <Charts role={role} />
      <Table role={role} onNavigate={onNavigate} />
    </>
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
function ProfilePage({ role }: { role: Role }) {
  return (
    <>
      <PageHeader
        eyebrow="ACCOUNT / PROFILE"
        title="ملفي الشخصي"
        description="بياناتك وإنجازاتك في مكان واحد."
        action={
          <Button onClick={() => toast.success("تم حفظ البيانات التجريبية")}>
            حفظ التغييرات
          </Button>
        }
      />
      <div className="profile-grid">
        <div className="profile-card paper-card">
          <div className="profile-cover">
            <span className="avatar avatar-0 big-avatar">
              {role === "admin" ? "م" : role === "teacher" ? "ن" : "س"}
            </span>
          </div>
          <div className="profile-body">
            <h2>
              {role === "admin"
                ? "محمود الشاذلي"
                : role === "teacher"
                  ? "نورهان عادل"
                  : "سلمى إبراهيم"}
            </h2>
            <span className="status success">
              <i />
              الحساب نشط
            </span>
            <div className="profile-fields">
              <Field label="البريد الإلكتروني">
                <input value={`${role}@demo.com`} readOnly />
              </Field>
              <Field label="رقم الهاتف">
                <input value="010 555 2841" readOnly />
              </Field>
              <Field label="الصف / الدور">
                <input
                  value={
                    role === "student"
                      ? "الثاني الثانوي"
                      : role === "admin"
                        ? "مدير السنتر"
                        : "مدرس البرمجة"
                  }
                  readOnly
                />
              </Field>
            </div>
          </div>
        </div>
        <div className="profile-stats">
          <Stat
            icon={Activity}
            label="أيام النشاط"
            value="28"
            meta="هذا الشهر"
          />
          <Stat
            icon={Target}
            label="الإنجاز"
            value="86%"
            meta="+12% عن الشهر السابق"
            accent="mint"
          />
          <Stat
            icon={WalletCards}
            label="الرصيد"
            value="1,240"
            meta="جنيه مصري"
            accent="amber"
          />
        </div>
      </div>
    </>
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
  const exams = learning.exams.filter(exam => exam.published);
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
          const submission = learning.submissions.find(
            item => item.examId === exam.id && item.studentId === "student-demo"
          );
          return (
            <div className="assessment-card paper-card" key={exam.id}>
              <div className="assessment-top">
                <span className="signal-chip">
                  {courseById(exam.courseId).title}
                </span>
                <span
                  className={`status ${submission?.score !== null && submission ? "success" : "warning"}`}
                >
                  <i />
                  {submission ? `${submission.score}/100` : "لم يبدأ"}
                </span>
              </div>
              <h3>{exam.title}</h3>
              <p>{exam.description}</p>
              <div className="assessment-meta">
                <span>
                  <ClipboardCheck size={14} />
                  {exam.questions.length} أسئلة
                </span>
                <span>
                  <Activity size={14} />
                  {exam.duration} دقيقة
                </span>
                <span>
                  <UserRound size={14} />
                  {exam.teacher}
                </span>
              </div>
              <Button onClick={() => onNavigate(`exam-take:${exam.id}`)}>
                {submission ? "مراجعة الإجابة" : "ابدأ الامتحان"}{" "}
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
function StudentResults({ learning }: { learning: LearningStore }) {
  const submissions = learning.submissions.filter(
    submission => submission.studentId === "student-demo"
  );
  return (
    <>
      <PageHeader
        eyebrow="RESULTS / PROGRESS"
        title="نتائج الامتحانات"
        description="نتائجك المحفوظة محليًا وحالة مراجعة المدرس."
      />
      <div className="results-summary">
        <Stat
          icon={ClipboardCheck}
          label="عدد الاختبارات"
          value={String(submissions.length)}
          meta="اختبارات تم تسليمها"
        />
        <Stat
          icon={Target}
          label="متوسط الدرجات"
          value={`${submissions.length ? Math.round(submissions.reduce((sum, item) => sum + (item.score || 0), 0) / submissions.length) : 0}/100`}
          meta="يتحدث بعد كل تسليم"
          accent="mint"
        />
        <Stat
          icon={CheckCircle2}
          label="مراجعة المدرس"
          value={`${submissions.filter(item => item.reviewed).length}/${submissions.length}`}
          meta="نتائج معتمدة"
          accent="amber"
        />
      </div>
      <div className="paper-card results-list">
        {submissions.map(submission => {
          const exam = learning.exams.find(
            item => item.id === submission.examId
          );
          return (
            <div className="result-row" key={submission.id}>
              <span className="lesson-num">
                <ClipboardCheck size={15} />
              </span>
              <div>
                <strong>{exam?.title || "اختبار"}</strong>
                <small>
                  {exam ? courseById(exam.courseId).title : ""} · تم التسليم{" "}
                  {submission.submittedAt}
                </small>
              </div>
              <b
                className={
                  submission.score && submission.score >= 70
                    ? "success-text"
                    : "warning-text"
                }
              >
                {submission.score ?? "قيد المراجعة"}
                {submission.score !== null && "/100"}
              </b>
              <span
                className={`status ${submission.reviewed ? "success" : "warning"}`}
              >
                <i />
                {submission.reviewed ? "تمت المراجعة" : "قيد المراجعة"}
              </span>
            </div>
          );
        })}
        {submissions.length === 0 && (
          <Empty
            icon={TrendingUp}
            title="لم تسلمي أي اختبار بعد"
            text="ابدئي من صفحة الامتحانات وستظهر النتائج هنا."
          />
        )}
      </div>
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
  const exam = learning.exams.find(item => item.id === examId);
  const existing = learning.submissions.find(
    item => item.examId === examId && item.studentId === "student-demo"
  );
  const [answers, setAnswers] = useState<number[]>(existing?.answers || []);
  if (!exam)
    return (
      <Empty
        icon={ClipboardCheck}
        title="الاختبار غير متاح"
        text="قد يكون الاختبار غير منشور أو تم حذفه."
      />
    );
  const submit = () => {
    const score = Math.round(
      (exam.questions.reduce(
        (sum, question, index) =>
          sum + (answers[index] === question.correctIndex ? 1 : 0),
        0
      ) /
        exam.questions.length) *
        100
    );
    updateLearning(previous => ({
      ...previous,
      submissions: [
        ...previous.submissions.filter(
          item => !(item.examId === examId && item.studentId === "student-demo")
        ),
        {
          id: existing?.id || makeId("submission"),
          examId,
          studentId: "student-demo",
          studentName: "سلمى إبراهيم",
          answers,
          score,
          reviewed: false,
          submittedAt: formatDate(),
        },
      ],
    }));
    toast.success(`تم تسليم الاختبار وحساب درجتك: ${score}/100`);
    onNavigate("results");
  };
  return (
    <>
      <PageHeader
        eyebrow="ASSESSMENT / TAKE EXAM"
        title={exam.title}
        description={`${courseById(exam.courseId).title} · ${exam.duration} دقيقة · ${exam.teacher}`}
        action={
          <Button secondary onClick={() => onNavigate("exams")}>
            العودة للامتحانات <ArrowLeft size={16} />
          </Button>
        }
      />
      <div className="exam-layout">
        <div className="paper-card exam-form">
          <div className="exam-intro">
            <span className="signal-chip">{exam.questions.length} أسئلة</span>
            <h2>{exam.description}</h2>
            <p>اختاري إجابة لكل سؤال ثم أرسلي الإجابات لحساب النتيجة محليًا.</p>
          </div>
          {exam.questions.map((question, index) => (
            <fieldset className="question-card" key={question.id}>
              <legend>
                {String(index + 1).padStart(2, "0")} · {question.prompt}
              </legend>
              {question.choices.map((choice, choiceIndex) => (
                <label
                  className={`choice ${answers[index] === choiceIndex ? "selected" : ""}`}
                  key={choice}
                >
                  <input
                    type="radio"
                    name={question.id}
                    checked={answers[index] === choiceIndex}
                    onChange={() =>
                      setAnswers(previous => {
                        const next = [...previous];
                        next[index] = choiceIndex;
                        return next;
                      })
                    }
                  />
                  <span>{choice}</span>
                </label>
              ))}
            </fieldset>
          ))}
          <Button onClick={submit}>
            تسليم الإجابات <CheckCircle2 size={16} />
          </Button>
        </div>
        <aside className="paper-card exam-side">
          <span className="eyebrow">YOUR ATTEMPT</span>
          <strong className="big-number">
            {answers.filter(answer => answer !== undefined).length}/
            {exam.questions.length}
          </strong>
          <p>أسئلة تمت الإجابة عنها</p>
          <div className="progress-track">
            <i
              style={{
                width: `${(answers.filter(answer => answer !== undefined).length / exam.questions.length) * 100}%`,
              }}
            />
          </div>
          <div className="detail-facts">
            <span>
              <Activity size={15} />
              المدة: {exam.duration} دقيقة
            </span>
            <span>
              <UserRound size={15} />
              المدرس: {exam.teacher}
            </span>
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

function DataPage({
  role,
  page,
  onNavigate,
  learning,
  updateLearning,
}: {
  role: Role;
  page: string;
  onNavigate: (p: string) => void;
  learning: LearningStore;
  updateLearning: UpdateLearning;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const titles: Record<string, string> = {
    students: "إدارة الطلاب",
    teachers: "إدارة المدرسين",
    attendance: "سجل الحضور",
    payments: "المدفوعات والاشتراكات",
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
  if (page === "course-detail")
    return <CourseDetailContent onNavigate={onNavigate} learning={learning} />;
  if (page === "lesson")
    return <LessonPage onNavigate={onNavigate} learning={learning} />;
  if (page === "calendar") return <CalendarPage />;
  if (page === "profile") return <ProfilePage role={role} />;
  if (page === "cart") return <CartPage onNavigate={onNavigate} />;
  if (page === "results" && role === "student")
    return <StudentResults learning={learning} />;
  if (page === "exams" && role === "student")
    return <StudentExams learning={learning} onNavigate={onNavigate} />;
  if (page === "lessons" && role === "teacher")
    return (
      <TeacherLessonManager
        learning={learning}
        updateLearning={updateLearning}
      />
    );
  if (page === "payments" && role === "admin")
    return <AdminGovernance learning={learning} updateLearning={updateLearning} />;
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
            <Button onClick={() => setOpen(true)}>
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
          {courseCatalog
            .filter(course => course.title.includes(query) || !query)
            .map(course => (
              <CourseCard
                key={course.id}
                course={course}
                onClick={() => onNavigate("course-detail")}
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
    { label: "المجتمع", icon: MessageCircle, page: "community" },
    { label: "الملف الشخصي", icon: UserRound, page: "profile" },
    { label: "السلة", icon: Package, page: "cart" },
  ],
  admin: [
    { label: "نظرة عامة", icon: LayoutDashboard, page: "overview" },
    { label: "الطلاب", icon: Users, page: "students" },
    { label: "المدرسون", icon: GraduationCap, page: "teachers" },
    { label: "الكورسات", icon: BookOpen, page: "courses" },
    { label: "الحضور", icon: ClipboardCheck, page: "attendance" },
    { label: "المدفوعات", icon: CircleDollarSign, page: "payments" },
    { label: "التقارير", icon: TrendingUp, page: "reports" },
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

export default function Home({
  role,
  activePage,
  onNavigate,
  onLogout,
}: Props) {
  const [mobile, setMobile] = useState(false);
  const [learning, setLearning] = useState<LearningStore>(() => readLearning());
  const nav = navByRole[role];
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
  const updateLearning: UpdateLearning = updater => {
    setLearning(previous => {
      const next = updater(previous);
      writeLearning(next);
      return next;
    });
  };
  const content =
    activePage === "overview" ? (
      <RoleHome role={role} onNavigate={onNavigate} learning={learning} />
    ) : (
      <DataPage
        role={role}
        page={activePage}
        onNavigate={onNavigate}
        learning={learning}
        updateLearning={updateLearning}
      />
    );
  return (
    <div className="app-shell" dir="rtl">
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-mark">
            <span className="oxford-glyph" aria-hidden="true" />
          </div>
          <div>
            <strong>Oxford</strong>
            <small>learning platform</small>
          </div>
        </div>
        <div className="user-mini">
          <span className="avatar avatar-0">
            {role === "admin" ? "م" : role === "teacher" ? "ن" : "س"}
          </span>
          <div>
            <b>
              {role === "admin"
                ? "محمود الشاذلي"
                : role === "teacher"
                  ? "نورهان عادل"
                  : "سلمى إبراهيم"}
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
          <div className="breadcrumbs">
            <span>Oxford</span>
            <ChevronLeft size={14} />
            <b>
              {nav.find(item => item.page === activePage)?.label ||
                (activePage.startsWith("exam-take:")
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
              onClick={() => onNavigate("messages")}
            >
              <Bell size={18} />
              <i />
            </button>
            <button
              className="profile-trigger"
              onClick={() => onNavigate("profile")}
            >
              <span className="avatar avatar-0">
                {role === "admin" ? "م" : role === "teacher" ? "ن" : "س"}
              </span>
              <ChevronLeft size={14} />
            </button>
          </div>
        </header>
        <div className="page-content">
          {activePage === "overview" && (
            <PageHeader
              eyebrow={
                role === "student"
                  ? "STUDENT HOME"
                  : role === "admin"
                    ? "CENTER OPERATIONS"
                    : "TEACHER STUDIO"
              }
              title={
                role === "student"
                  ? "صباح الخير، سلمى"
                  : "أهلًا، " + (role === "admin" ? "محمود" : "نورهان")
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
      <button className="support-fab" onClick={() => onNavigate("messages")}>
        <MessageCircle size={20} />
      </button>
      {role !== "admin" && <ScreenProtection />}
      <div className="toast-hint">
        <Bell size={15} />
        <span>فعّل الإشعارات لمتابعة جديدك</span>
        <button onClick={() => toast.success("تم تفعيل الإشعارات التجريبية")}>
          تفعيل
        </button>
      </div>
    </div>
  );
}
