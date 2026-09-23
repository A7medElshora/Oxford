/* Oxford Learning Platform: public visitor experience with orange signals, ink-black authority, warm paper, and RTL-first navigation. */
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowUpLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  FileText,
  GraduationCap,
  LockKeyhole,
  Menu,
  PlayCircle,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api, apiMe, getApiToken, type ApiUser } from "@/lib/api";
import { compressImage } from "@/lib/image";
import ImageCropDialog from "@/components/ImageCropDialog";
import { buildPendingSubscription, currentStudentId, readGovernance, writeGovernance } from "@/lib/learningGovernance";

const heroImg = "/assets/learning.png";
const programmingImg = "/assets/learning.png";
const scienceImg = "/assets/learning.png";

type View =
  | "home"
  | "courses"
  | "course"
  | "teachers"
  | "teacher"
  | "exams"
  | "lessons"
  | "assignments";

type Props = { onLogin: () => void };

type ApiCourse = { id: string; title: string; description: string; level: string; duration: string; image: string; teacherIds: string[]; lessonCount: number; published: boolean; teachers?: ApiTeacher[]; teacherPlans?: ApiTeacherPlan[] };
type ApiTeacherPlan = { teacherId: string; monthlyPrice: number; lessonPrice: number; chapterPrice: number; discountEnabled: boolean; discountKind?: "percent" | "amount"; discountValue?: number };
type ApiTeacher = { id: string; name: string; subject: string; bio: string; image: string; courseIds: string[]; trustLabel: string; plans?: { label: string; price: number }[] };

type Teacher = {
  id: string;
  name: string;
  subject: string;
  bio: string;
  image: string;
  courses: number;
  students: string;
  trustLabel: string;
  discount?: string;
  discountKind?: "percent" | "amount";
  courseIds: string[];
  plans: { label: string; price: number }[];
};

const publicTeachers: Teacher[] = [
  {
    id: "nourhan",
    name: "نورهان عادل",
    subject: "البرمجة وعلوم الحاسب",
    bio: "مدرسة برمجة تساعد الطلاب على بناء أساس عملي هادئ وواضح، من التفكير المنطقي حتى أول مشروع.",
    image: programmingImg,
    courses: 4,
    students: "2.4k",
    trustLabel: "مدرسة موصى بها",
    discount: "15%",
    discountKind: "percent",
    courseIds: ["programming"],
    plans: [
      { label: "شهري", price: 450 },
      { label: "الباب الأول", price: 180 },
      { label: "الباب الثاني", price: 180 },
      { label: "الباب الثالث", price: 180 },
      { label: "الباب الرابع", price: 180 },
      { label: "بالحصة", price: 90 },
    ],
  },
  {
    id: "ahmed",
    name: "أحمد سامح",
    subject: "الفيزياء والعلوم",
    bio: "يحوّل المسائل الصعبة إلى خطوات مرئية وتطبيقات قريبة من الحياة اليومية مع متابعة مستمرة.",
    image: scienceImg,
    courses: 6,
    students: "3.1k",
    trustLabel: "ملف مدرس موثّق",
    discount: "100 جنيه",
    discountKind: "amount",
    courseIds: ["science"],
    plans: [
      { label: "شهري", price: 520 },
      { label: "الباب الأول", price: 220 },
      { label: "الباب الثاني", price: 220 },
      { label: "الباب الثالث", price: 220 },
      { label: "الباب الرابع", price: 220 },
      { label: "بالحصة", price: 110 },
    ],
  },
  {
    id: "mariam",
    name: "مريم حسن",
    subject: "البرمجة وعلوم الحاسب",
    bio: "تشرح أساسيات البرمجة بالمشاريع الصغيرة وتساعد الطالب على تحويل الفكرة إلى تطبيق قابل للتجربة.",
    image: programmingImg,
    courses: 3,
    students: "1.6k",
    trustLabel: "مدرسة متخصصة",
    courseIds: ["programming"],
    plans: [
      { label: "شهري", price: 410 },
      { label: "الباب الأول", price: 165 },
      { label: "الباب الثاني", price: 165 },
      { label: "الباب الثالث", price: 165 },
      { label: "الباب الرابع", price: 165 },
      { label: "بالحصة", price: 85 },
    ],
  },
  {
    id: "sara",
    name: "سارة يونس",
    subject: "مهارات الدراسة واللغة",
    bio: "تساعد الطلاب على تنظيم الوقت وتحويل المذاكرة إلى عادة قابلة للاستمرار بدون ضغط زائد.",
    image: heroImg,
    courses: 3,
    students: "1.8k",
    trustLabel: "خبرة تعليمية",
    courseIds: ["skills"],
    plans: [
      { label: "شهري", price: 380 },
      { label: "الوحدة الأولى", price: 150 },
      { label: "الوحدة الثانية", price: 150 },
      { label: "الوحدة الثالثة", price: 150 },
      { label: "بالحصة", price: 75 },
    ],
  },
];

type Announcement = { id: string; kicker: string; title: string; body: string; cta: string; target: View; mediaType: "none" | "image" | "video"; mediaUrl?: string; published: boolean; sortOrder: number };

const publicCourses = [
  {
    id: "programming",
    title: "أساسيات البرمجة",
    desc: "ابنِ فهمًا عمليًا للتفكير البرمجي من أول خطوة.",
    teacher: "نورهان عادل",
    teacherIds: ["nourhan", "mariam"],
    level: "مبتدئ",
    lessons: 18,
    duration: "6 أسابيع",
    image: programmingImg,
    accent: "orange",
  },
  {
    id: "science",
    title: "قوانين نيوتن والحركة",
    desc: "مراجعة واضحة للمفاهيم الأساسية مع تطبيقات يومية.",
    teacher: "أحمد سامح",
    teacherIds: ["ahmed"],
    level: "متوسط",
    lessons: 14,
    duration: "5 أسابيع",
    image: scienceImg,
    accent: "ink",
  },
  {
    id: "skills",
    title: "مهارات الدراسة الذكية",
    desc: "نظّم وقتك وابنِ عادات تعلم تستمر معك.",
    teacher: "سارة يونس",
    teacherIds: ["sara"],
    level: "كل المستويات",
    lessons: 10,
    duration: "3 أسابيع",
    image: heroImg,
    accent: "orange",
  },
];
type PublicCourse = {
  id: string;
  title: string;
  desc: string;
  teacher: string;
  teacherIds: string[];
  level: string;
  lessons: number;
  duration: string;
  image: string;
  accent: string;
  teachers?: Teacher[];
};

export default function VisitorHome({ onLogin }: Props) {
  const [, setLocation] = useLocation();
  const [view, setView] = useState<View>("home");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<PublicCourse | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [teacherBackView, setTeacherBackView] = useState<View>("teachers");
  const [bannerIndex, setBannerIndex] = useState(0);
  const [courses, setCourses] = useState<PublicCourse[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState(0);
  useEffect(() => {
    void Promise.all([api<ApiCourse[]>("/courses"), api<ApiTeacher[]>("/teachers")]).then(([items, teacherItems]) => {
      const mappedTeachers = teacherItems.map((teacher) => ({ ...teacher, courses: teacher.courseIds.length, students: "", plans: teacher.plans || [] }));
      setTeachers(mappedTeachers);
      if (!items.length) {
        setCourses([]);
        setSelectedCourse(null);
        return;
      }
      const mapped = items.map((item) => {
        const plans = item.teacherPlans || [];
        const teachers = (item.teachers || []).map((teacher) => {
          const plan = plans.find((entry) => entry.teacherId === teacher.id);
          const detailedPlans = plan ? [
            { label: "شهري", price: plan.monthlyPrice },
            { label: "الباب الأول", price: plan.chapterPrice },
            { label: "بالحصة", price: plan.lessonPrice },
          ] : (teacher.plans || []);
          const discount = plan?.discountEnabled && plan.discountValue !== undefined
            ? `${plan.discountValue}${plan.discountKind === "percent" ? "%" : " جنيه"}`
            : undefined;
          return { ...teacher, courses: teacher.courseIds.length, students: "", plans: detailedPlans, discount, discountKind: plan?.discountKind };
        });
        return { id: item.id, title: item.title, desc: item.description, teacher: teachers.map((teacher) => teacher.name).join("، ") || "مدرسو الكورس", teacherIds: item.teacherIds, level: item.level, lessons: item.lessonCount, duration: item.duration, image: item.image || heroImg, accent: "orange", teachers };
      });
      setCourses(mapped);
      setSelectedCourse((current) => (current && mapped.find((item) => item.id === current.id)) || mapped[0]);
      setSelectedTeacher((current) => (current && mappedTeachers.find((item) => item.id === current.id)) || mappedTeachers[0] || null);
    }).catch(() => undefined);
  }, []);
  useEffect(() => {
    void api<Announcement[]>("/announcements").then(items => setAnnouncements(items)).catch(() => undefined);
  }, []);
  useEffect(() => {
    void api<{ enrolledStudents: number }>("/public/stats").then(stats => setEnrolledStudents(stats.enrolledStudents)).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (announcements.length < 2 || announcements[bannerIndex]?.mediaType === "video") return;
    const timer = window.setInterval(
      () => setBannerIndex(index => (index + 1) % announcements.length),
      5200
    );
    return () => window.clearInterval(timer);
  }, [announcements, bannerIndex]);

  const browse = (next: View) => {
    setView(next);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const protectedAction = (page: string) => {
    localStorage.setItem("oxford-return-page", page);
    toast.info("هذه المساحة خاصة بالحسابات المسجلة. سجّل الدخول للمتابعة.");
    setLocation("/login");
  };
  const openCourse = (course: PublicCourse) => {
    setSelectedCourse(course);
    browse("course");
  };
  const openTeacher = (teacher: Teacher, returnView: View = "teachers") => {
    setSelectedTeacher(teacher);
    setTeacherBackView(returnView);
    browse("teacher");
  };

  return (
    <main className="visitor-site" dir="rtl">
      <header className="visitor-header">
        <button className="visitor-brand" onClick={() => browse("home")}>
          <span className="brand-mark">
            <img src="/assets/platform-logo.png" alt="Oxford Learning Platform" />
          </span>
          <span>
            <strong className="festive-wordmark">Oxford</strong>
            <small>learning platform</small>
          </span>
        </button>
        <nav className={`visitor-nav ${mobileOpen ? "open" : ""}`}>
          <button
            className={view === "home" ? "active" : ""}
            onClick={() => browse("home")}
          >
            الرئيسية
          </button>
          <button
            className={view === "courses" || view === "course" ? "active" : ""}
            onClick={() => browse("courses")}
          >
            الكورسات
          </button>
          <button
            className={
              view === "teachers" || view === "teacher" ? "active" : ""
            }
            onClick={() => browse("teachers")}
          >
            المدرسون
          </button>
          <button
            className={view === "lessons" ? "active" : ""}
            onClick={() => browse("lessons")}
          >
            المحاضرات
          </button>
          <button
            className={view === "exams" ? "active" : ""}
            onClick={() => browse("exams")}
          >
            الامتحانات
          </button>
          <button
            className={view === "assignments" ? "active" : ""}
            onClick={() => browse("assignments")}
          >
            الواجبات
          </button>
        </nav>
        <div className="visitor-actions">
          <button className="visitor-search">
            <Search size={17} />
            <span>ابحث عن كورس</span>
          </button>
          <button className="visitor-login" onClick={onLogin}>
            تسجيل الدخول <ArrowLeft size={15} />
          </button>
          <button
            className="visitor-menu"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="القائمة"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {view === "home" && (
        <>
          <section className="visitor-hero">
            <div className="visitor-hero-copy">
              <span className="eyebrow">OXFORD / OPEN LEARNING</span>
              <h1>
                اتصفح طريقك
                <br />
                <em>قبل أن تسجّل.</em>
              </h1>
              <p>
                اكتشف الكورسات، المحاضرات، والموارد التي تساعدك تبدأ بثقة.
                الحساب مطلوب فقط عندما تريد حفظ تقدمك أو أداء امتحان.
              </p>
              <div className="visitor-hero-actions">
                <button
                  className="primary-btn"
                  onClick={() => browse("courses")}
                >
                  استكشف الكورسات <ArrowLeft size={17} />
                </button>
                <button className="visitor-text-link" onClick={onLogin}>
                  لديك حساب؟ سجّل الدخول <ChevronLeft size={16} />
                </button>
              </div>
              <div className="visitor-proof">
                <span>
                  <strong>{courses.length}</strong> كورسات منشورة
                </span>
                <span>
                  <strong>{teachers.length}</strong> مدرس متاح
                </span>
                <span>
                  <strong>{enrolledStudents}</strong> طالب مشترك
                </span>
              </div>
            </div>
            <div className="visitor-hero-art">
              <div className="visitor-orbit orbit-one" />
              <div className="visitor-orbit orbit-two" />
              <div className="visitor-paper">
                <span className="eyebrow">TODAY / PREVIEW</span>
                <img src={heroImg} alt="مساحة تعلم مفتوحة" />
                <div>
                  <strong>ملاحظات اليوم</strong>
                  <span>تصفح الدرس الأول مجانًا</span>
                  <i />
                </div>
              </div>
              <span className="visitor-stamp">
                <Sparkles size={16} /> مفتوح للزوار
              </span>
            </div>
          </section>
          {announcements.length > 0 && <AnnouncementCarousel index={Math.min(bannerIndex, announcements.length - 1)} items={announcements} onChange={setBannerIndex} onNavigate={browse} onVideoEnded={() => setBannerIndex(current => (current + 1) % announcements.length)} />}
          <section className="visitor-section visitor-intro">
            <div>
              <span className="eyebrow">EXPLORE WITHOUT FRICTION</span>
              <h2>
                المعرفة تبدأ
                <br />
                <em>بفضول بسيط.</em>
              </h2>
            </div>
            <p>
              يمكنك مشاهدة محتوى تعريفي عن المواد والمدرسين والامتحانات قبل
              إنشاء حساب. وعندما تجد مسارك، سجّل الدخول لحفظ التقدم والتفاعل مع
              المدرس.
            </p>
            <div className="visitor-feature-list">
              <span>
                <BookOpen size={18} />
                <b>كورسات واضحة</b>
                <small>خطط ودروس يمكن معاينتها</small>
              </span>
              <span>
                <PlayCircle size={18} />
                <b>محاضرات منظمة</b>
                <small>اعرف شكل الدرس قبل البدء</small>
              </span>
              <span>
                <LockKeyhole size={18} />
                <b>تقدمك محفوظ</b>
                <small>يظهر بعد تسجيل الدخول</small>
              </span>
            </div>
          </section>
          <section className="visitor-section">
            <div className="visitor-section-head">
              <div>
                <span className="eyebrow">POPULAR PATHS</span>
                <h2>ابدأ من المسار الأقرب لك</h2>
              </div>
              <button
                className="visitor-text-link"
                onClick={() => browse("courses")}
              >
                عرض كل الكورسات <ChevronLeft size={16} />
              </button>
            </div>
            <div className="visitor-course-grid">
              {courses.map(course => (
                <CoursePreview
                  key={course.id}
                  course={course}
                  onOpen={openCourse}
                />
              ))}
            </div>
          </section>
          <section className="visitor-section">
            <div className="visitor-section-head">
              <div>
                <span className="eyebrow">MEET THE TEACHERS</span>
                <h2>اختر المدرس المناسب لمسارك</h2>
              </div>
              <button
                className="visitor-text-link"
                onClick={() => browse("teachers")}
              >
                كل المدرسين <ChevronLeft size={16} />
              </button>
            </div>
            <div className="teacher-grid">
              {teachers.slice(0, 3).map(teacher => (
                <TeacherCard
                  key={teacher.id}
                  teacher={teacher}
                  onOpen={openTeacher}
                />
              ))}
            </div>
          </section>
          <section className="visitor-section visitor-locked-strip">
            <div className="lock-copy">
              <span className="eyebrow">PRIVATE WORKSPACE</span>
              <h2>وبعد أن تختار مسارك؟</h2>
              <p>
                تسجيل الدخول يفتح لك «امتحاناتي»، «محاضراتي»، «واجباتي»،
                النتائج، الحضور، والشات مع المدرس.
              </p>
            </div>
            <button className="primary-btn" onClick={onLogin}>
              افتح مساحتك <ArrowLeft size={17} />
            </button>
          </section>
        </>
      )}

      {view === "courses" && (
        <PublicListing
          title="استكشف الكورسات"
          eyebrow="PUBLIC COURSE CATALOG"
          description="تصفح خطط التعلم والمدرسين والمستوى قبل تسجيل الدخول."
          action={onLogin}
        >
          {courses.map(course => (
            <CoursePreview
              key={course.id}
              course={course}
              onOpen={openCourse}
            />
          ))}
        </PublicListing>
      )}
      {view === "course" && selectedCourse && (
        <CourseDetailWithTeachers
          course={selectedCourse}
          onBack={() => browse("courses")}
          onProtected={protectedAction}
          onViewTeacher={teacher => openTeacher(teacher, "course")}
        />
      )}
      {view === "teachers" && (
        <PublicTeacherListing
          teachers={teachers}
          onOpen={openTeacher}
          onLogin={onLogin}
        />
      )}
      {view === "teacher" && selectedTeacher && (
        <TeacherDetail
          teacher={selectedTeacher}
          onBack={() => browse(teacherBackView)}
          onLogin={onLogin}
        />
      )}
      {view === "lessons" && (
        <PublicResource
          view="lessons"
          onProtected={protectedAction}
          onBack={() => browse("home")}
        />
      )}
      {view === "exams" && (
        <PublicResource
          view="exams"
          onProtected={protectedAction}
          onBack={() => browse("home")}
        />
      )}
      {view === "assignments" && (
        <PublicResource
          view="assignments"
          onProtected={protectedAction}
          onBack={() => browse("home")}
        />
      )}

      <footer className="visitor-footer">
        <span>© 2026 Oxford Learning Platform</span>
        <span>تعلم مفتوح في البداية، ومساحة شخصية عندما تكون مستعدًا.</span>
        <button onClick={onLogin}>
          تسجيل الدخول <ArrowLeft size={14} />
        </button>
      </footer>
    </main>
  );
}

function CoursePreview({
  course,
  onOpen,
}: {
  course: PublicCourse;
  onOpen: (course: PublicCourse) => void;
}) {
  return (
    <article className="visitor-course-card" onClick={() => onOpen(course)}>
      <div className={`visitor-course-image ${course.accent}`}>
        <img src={course.image} alt="" />
        <span>{course.level}</span>
      </div>
      <div className="visitor-course-body">
        <div className="course-kicker">
          <span>{course.teacher}</span>
          <span>{course.lessons} محاضرة</span>
        </div>
        <h3>{course.title}</h3>
        <p>{course.desc}</p>
        <div className="course-meta">
          <span>
            <Clock3 size={14} /> {course.duration}
          </span>
          <button>
            التفاصيل <ArrowLeft size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}

function PublicListing({
  title,
  eyebrow,
  description,
  action,
  children,
}: {
  title: string;
  eyebrow: string;
  description: string;
  action: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="visitor-section visitor-listing">
      <div className="visitor-section-head">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <button className="primary-btn" onClick={action}>
          سجّل الدخول <ArrowLeft size={16} />
        </button>
      </div>
      <div className="visitor-course-grid">{children}</div>
    </section>
  );
}

function CourseDetail({
  course,
  onBack,
  onProtected,
}: {
  course: PublicCourse;
  onBack: () => void;
  onProtected: (page: string) => void;
}) {
  return (
    <section className="visitor-section visitor-detail">
      <button className="visitor-back" onClick={onBack}>
        <ArrowLeft size={15} /> العودة للكورسات
      </button>
      <div className="detail-hero">
        <div>
          <span className="eyebrow">
            COURSE PREVIEW / {course.level.toUpperCase()}
          </span>
          <h1>{course.title}</h1>
          <p>{course.desc}</p>
          <div className="detail-stats">
            <span>
              <BookOpen size={16} /> {course.lessons} محاضرة
            </span>
            <span>
              <Clock3 size={16} /> {course.duration}
            </span>
            <span>
              <Users size={16} /> مع {course.teacher}
            </span>
          </div>
          <button
            className="primary-btn"
            onClick={() => onProtected("my-courses")}
          >
            ابدأ التعلم <ArrowLeft size={17} />
          </button>
        </div>
        <img src={course.image} alt="" />
      </div>
      <div className="detail-columns">
        <div className="detail-outline">
          <span className="eyebrow">WHAT YOU WILL SEE</span>
          <h2>ماذا ستتعلم؟</h2>
          {[
            "مقدمة مرتبة للمفاهيم الأساسية",
            "تطبيقات قصيرة بعد كل فكرة",
            "مراجعة ومصادر إضافية",
          ].map(item => (
            <div key={item}>
              <CheckCircle2 size={17} />
              <span>{item}</span>
            </div>
          ))}
        </div>
        <div className="detail-login-card">
          <LockKeyhole size={20} />
          <h3>التقدم والنتائج خاصة بحسابك</h3>
          <p>
            يمكنك معاينة الخطة الآن، ويطلب الموقع تسجيل الدخول عند حفظ التقدم أو
            بدء الامتحان.
          </p>
          <button
            className="visitor-text-link"
            onClick={() => onProtected("my-courses")}
          >
            سجّل الدخول للمتابعة <ArrowLeft size={15} />
          </button>
        </div>
      </div>
    </section>
  );
}

function PublicResource({
  view,
  onProtected,
  onBack,
}: {
  view: "lessons" | "exams" | "assignments";
  onProtected: (page: string) => void;
  onBack: () => void;
}) {
  const config = {
    lessons: {
      eyebrow: "PUBLIC LESSON PREVIEW",
      title: "المحاضرات",
      description:
        "شاهد شكل المادة التعليمية والروابط قبل أن تحفظها في مساحتك.",
      icon: PlayCircle,
      action: "my-lessons",
      actionLabel: "افتح محاضراتي",
    },
    exams: {
      eyebrow: "PUBLIC ASSESSMENT PREVIEW",
      title: "الامتحانات",
      description: "اطلع على نماذج الأسئلة والمدة، ويطلب الحل تسجيل الدخول.",
      icon: FileText,
      action: "my-exams",
      actionLabel: "افتح امتحاناتي",
    },
    assignments: {
      eyebrow: "PUBLIC PRACTICE PREVIEW",
      title: "الواجبات",
      description: "تعرّف على نوع المهام المطلوبة قبل متابعة التسليم والتقييم.",
      icon: CheckCircle2,
      action: "my-assignments",
      actionLabel: "افتح واجباتي",
    },
  }[view];
  const Icon = config.icon;
  return (
    <section className="visitor-section visitor-resource">
      <button className="visitor-back" onClick={onBack}>
        <ArrowLeft size={15} /> العودة للرئيسية
      </button>
      <div className="resource-heading">
        <span className="resource-icon">
          <Icon size={28} />
        </span>
        <div>
          <span className="eyebrow">{config.eyebrow}</span>
          <h1>{config.title}</h1>
          <p>{config.description}</p>
        </div>
      </div>
      <div className="resource-preview-grid">
        <article>
          <span className="eyebrow">OPEN PREVIEW</span>
          <h2>محتوى تعريفي للزائر</h2>
          <p>
            هذه الصفحة عامة لتفهم شكل الرحلة التعليمية. المحتوى الشخصي،
            التسليمات، الدرجات، وروابطك المحفوظة تظهر بعد تسجيل الدخول فقط.
          </p>
          <div className="preview-lines">
            <i />
            <i />
            <i />
            <i />
          </div>
        </article>
        <article className="resource-locked">
          <LockKeyhole size={22} />
          <h3>المساحة الخاصة</h3>
          <p>
            للوصول إلى {config.title} الخاصة بك ومتابعة حالتك الحالية، سجّل
            الدخول إلى حسابك.
          </p>
          <button
            className="primary-btn"
            onClick={() => onProtected(config.action)}
          >
            {config.actionLabel} <ArrowLeft size={16} />
          </button>
        </article>
      </div>
    </section>
  );
}

function youtubeEmbedUrl(url: string) {
  const match = url.match(/(?:youtube\.com\/(?:shorts\/|watch\?v=)|youtu\.be\/)([\w-]{11})/);
  if (!match) return null;
  const params = new URLSearchParams({ autoplay: "1", mute: "1", controls: "1", rel: "0", modestbranding: "1", enablejsapi: "1", origin: window.location.origin });
  return `https://www.youtube.com/embed/${match[1]}?${params.toString()}`;
}

function AnnouncementCarousel({
  index,
  items,
  onChange,
  onNavigate,
  onVideoEnded,
}: {
  index: number;
  items: Announcement[];
  onChange: (index: number) => void;
  onNavigate: (view: View) => void;
  onVideoEnded: () => void;
}) {
  const item = items[index];
  const youtubeUrl = item.mediaType === "video" && item.mediaUrl ? youtubeEmbedUrl(item.mediaUrl) : null;
  useEffect(() => {
    if (!youtubeUrl) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== document.querySelector<HTMLIFrameElement>(".announcement-media iframe")?.contentWindow) return;
      try {
        const message = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (message?.event === "onStateChange" && message.info === 0) onVideoEnded();
      } catch {
        // Ignore unrelated iframe messages.
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [youtubeUrl, onVideoEnded]);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const finishDrag = (end: number) => {
    if (dragStart === null) return;
    const distance = end - dragStart;
    if (Math.abs(distance) > 45) {
      onChange((index + (distance > 0 ? -1 : 1) + items.length) % items.length);
    }
    setDragStart(null);
  };
  return (
    <section className="visitor-announcement-wrap">
      <div
        className="visitor-announcement"
        onTouchStart={event => setDragStart(event.touches[0].clientX)}
        onTouchEnd={event => finishDrag(event.changedTouches[0].clientX)}
        onMouseDown={event => setDragStart(event.clientX)}
        onMouseUp={event => finishDrag(event.clientX)}
        onMouseLeave={() => setDragStart(null)}
      >
        <div className="announcement-copy">
          <span className="eyebrow">{item.kicker}</span>
          <h2>{item.title}</h2>
          <p>{item.body}</p>
          <button
            className="visitor-announcement-cta"
            onClick={() => onNavigate(item.target)}
          >
            {item.cta} <ArrowLeft size={15} />
          </button>
        </div>
        <div className="announcement-media">
          {item.mediaType === "image" && item.mediaUrl ? <img src={item.mediaUrl} alt="" draggable={false} /> : youtubeUrl ? <iframe src={youtubeUrl} title={item.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /> : item.mediaType === "video" && item.mediaUrl ? <video src={item.mediaUrl} autoPlay muted playsInline onEnded={onVideoEnded} /> : <img src="/assets/learning.png" alt="" draggable={false} />}
        </div>
        <div className="announcement-side">
          <div className="announcement-dots">
            {items.map((_, dot) => (
              <button
                key={dot}
                className={dot === index ? "active" : ""}
                aria-label={`الإعلان ${dot + 1}`}
                onClick={() => onChange(dot)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function TeacherCard({
  teacher,
  onOpen,
}: {
  teacher: Teacher;
  onOpen: (teacher: Teacher) => void;
}) {
  return (
    <article className="teacher-card" onClick={() => onOpen(teacher)}>
      <div className="teacher-avatar-wrap">
        <img src={teacher.image} alt="" />
        <span className="teacher-trust">{teacher.trustLabel}</span>
        {teacher.discount && (
          <b className="teacher-discount">خصم {teacher.discount}</b>
        )}
      </div>
      <div className="teacher-card-body">
        <span className="eyebrow">{teacher.subject}</span>
        <h3>{teacher.name}</h3>
        <p>{teacher.bio}</p>
        <div className="teacher-card-meta">
          <span>
            <BookOpen size={14} /> {teacher.courses} مواد
          </span>
          <span>
            <Users size={14} /> {teacher.students} طالب
          </span>
        </div>
        <div className="teacher-rating-note">
          ملف تعليمي عام · التقييمات الفعلية تظهر بعد الربط
        </div>
        <button className="teacher-open">
          عرض الملف <ArrowLeft size={14} />
        </button>
      </div>
    </article>
  );
}

function PublicTeacherListing({
  teachers,
  onOpen,
  onLogin,
}: {
  teachers: Teacher[];
  onOpen: (teacher: Teacher) => void;
  onLogin: () => void;
}) {
  return (
    <section className="visitor-section visitor-listing">
      <div className="visitor-section-head">
        <div>
          <span className="eyebrow">TEACHER DIRECTORY</span>
          <h1>مدرسون يصنعون فرقًا</h1>
          <p>تعرّف على المادة، طريقة الشرح، وخيارات الحجز قبل تسجيل بياناتك.</p>
        </div>
        <button className="primary-btn" onClick={onLogin}>
          سجّل الدخول <ArrowLeft size={16} />
        </button>
      </div>
      <div className="teacher-grid">
        {teachers.map(teacher => (
          <TeacherCard key={teacher.id} teacher={teacher} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

function TeacherDetail({
  teacher,
  onBack,
  onLogin,
}: {
  teacher: Teacher;
  onBack: () => void;
  onLogin: () => void;
}) {
  const [grade, setGrade] = useState("الثانوية العامة");
  const [planLabel, setPlanLabel] = useState(teacher.plans[0].label);
  const [unit, setUnit] = useState("الباب الأول");
  const [studentName, setStudentName] = useState("");
  const [studentPhone, setStudentPhone] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const activePlan =
    teacher.plans.find(plan => plan.label === planLabel) || teacher.plans[0];
  const isPerLesson = planLabel === "بالحصة";
  const finalPrice =
    teacher.discountKind === "percent" && teacher.discount
      ? Math.round(
          activePlan.price * (1 - Number.parseInt(teacher.discount) / 100)
        )
      : teacher.discountKind === "amount" && teacher.discount
        ? Math.max(0, activePlan.price - Number.parseInt(teacher.discount))
        : activePlan.price;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !studentName.trim() ||
      studentPhone.length < 8 ||
      parentPhone.length < 8
    ) {
      toast.error("أكمل اسم الطالب ورقم الطالب ورقم ولي الأمر.");
      return;
    }
    const planType: "شهري" | "بالحصة" | "الباب" =
      planLabel === "بالحصة"
        ? "بالحصة"
        : planLabel.startsWith("الباب") || planLabel.includes("الوحدة")
          ? "الباب"
          : "شهري";
    const governance = readGovernance();
    const pending = buildPendingSubscription({
      courseId: teacher.courseIds[0] as "programming" | "science" | "skills",
      teacherId: teacher.id,
      teacherName: teacher.name,
      studentId: currentStudentId(),
      studentName,
      planType,
      selectedUnit: !isPerLesson ? unit : undefined,
    });
    governance.subscriptions.unshift(pending);
    writeGovernance(governance);
    window.dispatchEvent(new Event("storage"));
    setSubmitted(true);
    toast.success("تم إرسال طلب الاشتراك للأدمن؛ سيصبح الكورس متاحًا بعد الموافقة");
  };
  return (
    <section className="visitor-section teacher-detail">
      <button className="visitor-back" onClick={onBack}>
        <ArrowLeft size={15} /> العودة للمدرسين
      </button>
      <div className="teacher-detail-head">
        <div className="teacher-profile-photo">
          <img src={teacher.image} alt="" />
          <span>{teacher.trustLabel}</span>
        </div>
        <div>
          <span className="eyebrow">TEACHER PROFILE / OXFORD</span>
          <h1>{teacher.name}</h1>
          <h3>{teacher.subject}</h3>
          <p>{teacher.bio}</p>
          <div className="teacher-profile-stats">
            <span>
              <BookOpen size={15} /> {teacher.courses} مواد
            </span>
            <span>
              <Users size={15} /> {teacher.students} طالب
            </span>
            <span className="rating-disclaimer">
              بيانات التقييم ستظهر بعد الربط
            </span>
          </div>
          <button className="visitor-login" onClick={onLogin}>
            لديك حساب؟ تسجيل الدخول <ArrowLeft size={15} />
          </button>
        </div>
      </div>
      <div className="teacher-detail-grid">
        <div className="teacher-materials">
          <span className="eyebrow">PUBLIC MATERIALS</span>
          <h2>المواد وخيارات الحجز</h2>
          <p>
            اختر طريقة الحجز لتشاهد السعر المناسب، ثم أرسل بيانات الطالب وولي
            الأمر.
          </p>
          {teacher.plans.map(plan => (
            <div
              className={`material-plan ${plan.label === planLabel ? "selected" : ""}`}
              key={plan.label}
              onClick={() => setPlanLabel(plan.label)}
            >
              <span>
                <b>{plan.label}</b>
                <small>
                  {plan.label === "بالحصة" ? "جلسة فردية" : "خطة متابعة"}
                </small>
              </span>
              <strong>{plan.price} ج.م</strong>
              {teacher.discount && (
                <em>
                  {teacher.discountKind === "percent"
                    ? `بعد الخصم ${Math.round(plan.price * (1 - Number.parseInt(teacher.discount) / 100))}`
                    : `خصم ${teacher.discount}`}
                </em>
              )}
            </div>
          ))}
        </div>
        <form className="booking-form" onSubmit={submit}>
          <div className="form-heading">
            <span className="eyebrow">
              BOOK WITH {teacher.name.toUpperCase()}
            </span>
            <h2>سجّل مع المدرس</h2>
            <p>
              نموذج تجريبي محلي — لا يوجد دفع أو حجز نهائي قبل الربط بالخادم.
            </p>
          </div>
          <label>
            اسم الطالب
            <input
              value={studentName}
              onChange={event => setStudentName(event.target.value)}
              placeholder="اكتب الاسم كاملًا"
              required
            />
          </label>
          <div className="booking-two-col">
            <label>
              رقم الطالب
              <input
                value={studentPhone}
                onChange={event =>
                  setStudentPhone(event.target.value.replace(/\D/g, ""))
                }
                inputMode="tel"
                placeholder="01xxxxxxxxx"
                required
              />
            </label>
            <label>
              رقم ولي الأمر
              <input
                value={parentPhone}
                onChange={event =>
                  setParentPhone(event.target.value.replace(/\D/g, ""))
                }
                inputMode="tel"
                placeholder="01xxxxxxxxx"
                required
              />
            </label>
          </div>
          <div className="booking-two-col">
            <label>
              الصف الدراسي
              <select
                value={grade}
                onChange={event => setGrade(event.target.value)}
              >
                <option>أولى ثانوي</option>
                <option>ثانية ثانوي</option>
                <option>ثالثة ثانوي</option>
                <option>بكالوريا</option>
                <option>الثانوية العامة</option>
              </select>
            </label>
            <label>
              مدة الحجز
              <select
                value={planLabel}
                onChange={event => setPlanLabel(event.target.value)}
              >
                {teacher.plans.map(plan => (
                  <option key={plan.label}>{plan.label}</option>
                ))}
              </select>
            </label>
          </div>
          {!isPerLesson && (
            <label>
              الباب أو الوحدة
              <select
                value={unit}
                onChange={event => setUnit(event.target.value)}
              >
                <option>الباب الأول</option>
                <option>الباب الثاني</option>
                <option>الباب الثالث</option>
                <option>الباب الرابع</option>
                <option>وحدة مراجعة شاملة</option>
              </select>
            </label>
          )}
          <div className="booking-total">
            <span>
              السعر المتوقع{" "}
              <small>
                ({grade} · {planLabel}
                {!isPerLesson ? ` · ${unit}` : ""})
              </small>
            </span>
            <strong>{finalPrice} ج.م</strong>
          </div>
          {submitted ? (
            <div className="booking-success">
              <CheckCircle2 size={20} />
              <div>
                <b>تم استلام طلبك محليًا</b>
                <small>سيتم التواصل معك بعد تفعيل النظام الفعلي.</small>
              </div>
            </div>
          ) : (
            <button className="primary-btn wide" type="submit">
              إرسال طلب التسجيل <ArrowLeft size={16} />
            </button>
          )}
        </form>
      </div>
    </section>
  );
}

function CourseDetailWithTeachers({
  course,
  onBack,
  onProtected,
  onViewTeacher,
}: {
  course: PublicCourse;
  onBack: () => void;
  onProtected: (page: string) => void;
  onViewTeacher: (teacher: Teacher) => void;
}) {
  const courseTeachers = course.teachers?.length
    ? course.teachers
    : [];
  return (
    <section className="visitor-section visitor-detail course-detail-linked">
      <button className="visitor-back" onClick={onBack}>
        <ArrowLeft size={15} /> العودة للكورسات
      </button>
      <div className="detail-hero">
        <div>
          <span className="eyebrow">
            COURSE PREVIEW / {course.level.toUpperCase()}
          </span>
          <h1>{course.title}</h1>
          <p>{course.desc}</p>
          <div className="detail-stats">
            <span>
              <BookOpen size={16} /> {course.lessons} محاضرة
            </span>
            <span>
              <Clock3 size={16} /> {course.duration}
            </span>
            <span>
              <Users size={16} /> {courseTeachers.length} مدرس للمادة
            </span>
          </div>
          <button
            className="primary-btn"
            onClick={() =>
              document
                .getElementById("course-enroll")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          >
            اشترك مع مدرس <ArrowLeft size={17} />
          </button>
        </div>
        <img src={course.image} alt="" />
      </div>
      <section className="course-teachers-section">
        <div className="visitor-section-head">
          <div>
            <span className="eyebrow">
              {course.title.toUpperCase()} / TEACHERS
            </span>
            <h2>مدرسو هذا الكورس</h2>
            <p>
              اختر مدرس المادة المناسب لك، راجع خياراته، ثم أرسل طلب الاشتراك من
              نفس الصفحة.
            </p>
          </div>
          <span className="course-teacher-count">
            {courseTeachers.length} مدرس متاح
          </span>
        </div>
        <div className="course-teachers-grid">
          {courseTeachers.map(teacher => (
            <CourseTeacherCard
              key={teacher.id}
              teacher={teacher}
              onView={() => onViewTeacher(teacher)}
            />
          ))}
        </div>
      </section>
      <CourseEnrollmentForm
        course={course}
        teachers={courseTeachers}
        onProtected={onProtected}
      />
    </section>
  );
}

function CourseTeacherCard({
  teacher,
  onView,
}: {
  teacher: Teacher;
  onView: () => void;
}) {
  const firstChapter = teacher.plans.find(
    plan => plan.label !== "شهري" && plan.label !== "بالحصة"
  );
  const monthly = teacher.plans.find(plan => plan.label === "شهري");
  const discounted =
    teacher.discountKind === "percent" && teacher.discount
      ? Math.round(
          (monthly?.price || 0) * (1 - Number.parseInt(teacher.discount) / 100)
        )
      : teacher.discountKind === "amount" && teacher.discount
        ? Math.max(0, (monthly?.price || 0) - Number.parseInt(teacher.discount))
        : monthly?.price;
  return (
    <article className="course-teacher-card">
      <div className="course-teacher-avatar">
        <img src={teacher.image} alt="" />
        <span className="teacher-trust">{teacher.trustLabel}</span>
        {teacher.discount && (
          <b className="teacher-discount">خصم {teacher.discount}</b>
        )}
      </div>
      <div className="course-teacher-content">
        <span className="eyebrow">{teacher.subject}</span>
        <h3>{teacher.name}</h3>
        <p>{teacher.bio}</p>
        <div className="course-teacher-pricing">
          <span>الحجز الشهري يبدأ من</span>
          <strong>
            {discounted} <small>ج.م</small>
          </strong>
          {teacher.discount && <em>بدلًا من {monthly?.price} ج.م</em>}
        </div>
        <div className="course-teacher-actions">
          <button className="teacher-open" onClick={onView}>
            بيانات المدرس <ArrowLeft size={14} />
          </button>
          <a
            href="#course-enroll"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("oxford-select-course-teacher", {
                  detail: teacher.id,
                })
              );
            }}
          >
            اشترك معه <ArrowLeft size={14} />
          </a>
        </div>
        <small className="course-plan-note">
          {firstChapter ? `${firstChapter.label} متاح` : "خطط مرنة"} · بيانات
          التقييم تظهر بعد الربط
        </small>
      </div>
    </article>
  );
}

export function CourseEnrollmentForm({
  course,
  teachers,
  onProtected,
}: {
  course: PublicCourse;
  teachers: Teacher[];
  onProtected: (page: string) => void;
}) {
  const [teacherId, setTeacherId] = useState(teachers[0]?.id || "");
  const [bookingType, setBookingType] = useState("شهري");
  const [unit, setUnit] = useState("الباب الأول");
  const [grade, setGrade] = useState("الثانوية العامة");
  const [studentName, setStudentName] = useState("");
  const [studentPhone, setStudentPhone] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [transferImage, setTransferImage] = useState("");
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [sent, setSent] = useState(false);
  const [signedInUser, setSignedInUser] = useState<ApiUser | null>(null);
  const [courseLessons, setCourseLessons] = useState<Array<{ id: string; title: string; unit?: string; teacherId?: string }>>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string>("");

  useEffect(() => {
    if (!course?.id) return;
    api<Array<{ id: string; title: string; unit?: string; teacherId?: string }>>(`/lessons?courseId=${course.id}`)
      .then(lessons => {
        setCourseLessons(lessons);
      })
      .catch(() => setCourseLessons([]));
  }, [course?.id]);

  const teacherLessons = useMemo(() => {
    const activeTeacherObj = teachers.find(t => t.id === teacherId) || teachers[0];
    const activeTeacherId = activeTeacherObj?.id;
    const activeUserId = (activeTeacherObj as any)?.userId;

    const matching = courseLessons.filter(l => {
      if (!l.teacherId) return true;
      return (
        (activeTeacherId && l.teacherId === activeTeacherId) ||
        (activeUserId && l.teacherId === activeUserId) ||
        (teacherId && l.teacherId === teacherId)
      );
    });
    return matching;
  }, [courseLessons, teacherId, teachers]);

  const availableUnits = useMemo(() => {
    const unitsFromLessons = Array.from(
      new Set(
        teacherLessons
          .map(l => l.unit)
          .filter((u): u is string => Boolean(u && u.trim()))
      )
    );
    if (unitsFromLessons.length > 0) {
      return unitsFromLessons;
    }
    return ["الباب الأول", "الباب الثاني", "الباب الثالث", "الباب الرابع", "وحدة مراجعة شاملة"];
  }, [teacherLessons]);

  useEffect(() => {
    if (teacherLessons.length > 0) {
      setSelectedLessonId(teacherLessons[0].id);
    } else {
      setSelectedLessonId("");
    }
    if (availableUnits.length > 0) {
      setUnit(availableUnits[0]);
    }
  }, [teacherLessons, availableUnits]);

  useEffect(() => {
    if (!getApiToken()) return;
    void apiMe().then((user) => {
      setSignedInUser(user);
      setStudentName(user.name);
      setStudentPhone(user.phone || "");
      setParentPhone(user.parentPhone || "");
      setGrade(user.grade || grade);
    }).catch(() => setSignedInUser(null));
  }, []);
  useEffect(() => {
    const handler = (event: Event) => {
      const nextTeacherId = (event as CustomEvent<string>).detail;
      if (teachers.some(teacher => teacher.id === nextTeacherId)) {
        setTeacherId(nextTeacherId);
        setSent(false);
      }
    };
    window.addEventListener("oxford-select-course-teacher", handler);
    return () =>
      window.removeEventListener("oxford-select-course-teacher", handler);
  }, [teachers]);
  const activeTeacher =
    teachers.find(teacher => teacher.id === teacherId) || teachers[0];
  const monthly =
    activeTeacher?.plans.find(plan => plan.label === "شهري")?.price || 0;
  const chapterPlan = activeTeacher?.plans.find(
    plan => plan.label !== "شهري" && plan.label !== "بالحصة"
  );
  const lesson =
    activeTeacher?.plans.find(plan => plan.label === "بالحصة")?.price || 0;
  const basePrice =
    bookingType === "شهري"
      ? monthly
      : bookingType === "بالحصة"
        ? lesson
        : chapterPlan?.price || 0;
  const finalPrice =
    activeTeacher?.discountKind === "percent" && activeTeacher.discount
      ? Math.round(
          basePrice * (1 - Number.parseInt(activeTeacher.discount) / 100)
        )
      : activeTeacher?.discountKind === "amount" && activeTeacher.discount
        ? Math.max(0, basePrice - Number.parseInt(activeTeacher.discount))
        : basePrice;
  const discountValue = Math.max(0, basePrice - finalPrice);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!signedInUser || !getApiToken()) {
      localStorage.setItem("oxford-return-page", "browse");
      toast.info("يجب تسجيل الدخول أولًا لإرسال طلب الاشتراك.");
      onProtected("browse");
      return;
    }
    if (
      !studentName.trim() ||
      studentPhone.length < 8 ||
      parentPhone.length < 8
    ) {
      toast.error("أكمل اسم الطالب ورقم الطالب ورقم ولي الأمر.");
      return;
    }
    const governance = readGovernance();
    const planType: "شهري" | "بالحصة" | "الباب" =
      bookingType === "بالحصة"
        ? "بالحصة"
        : bookingType === "بالوحدة / الباب"
          ? "الباب"
          : "شهري";

    const selectedLessonObj = teacherLessons.find(l => l.id === selectedLessonId);
    const unitValue = bookingType === "بالحصة"
      ? (selectedLessonObj ? selectedLessonObj.title : selectedLessonId)
      : bookingType === "بالوحدة / الباب"
        ? unit
        : undefined;

    try {
      await api("/enrollments", {
        method: "POST",
        body: JSON.stringify({ courseId: course.id, teacherId, studentId: signedInUser.id, studentName, studentPhone, parentPhone, grade, bookingType: planType, unit: unitValue, amount: finalPrice, transferImage }),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إرسال طلب الاشتراك");
      return;
    }
    governance.subscriptions.unshift(
      buildPendingSubscription({
        courseId: course.id as "programming" | "science" | "skills",
        teacherId,
        teacherName: activeTeacher?.name ?? "مدرس",
        studentId: signedInUser.id,
        studentName,
        planType,
        selectedUnit: bookingType === "بالوحدة / الباب" ? unit : undefined,
        selectedLesson: bookingType === "بالحصة" ? (selectedLessonObj?.title || selectedLessonId) : undefined,
      })
    );
    writeGovernance(governance);
    localStorage.setItem(
      "oxford-course-registration",
      JSON.stringify({
        courseId: course.id,
        teacherId,
        grade,
        bookingType,
        unit,
        studentName,
        studentPhone,
        parentPhone,
        transferImage,
        finalPrice,
        createdAt: new Date().toISOString(),
      })
    );
    window.dispatchEvent(new Event("storage"));
    setSent(true);
    toast.success("تم إرسال طلب الاشتراك للأدمن؛ لا يظهر الكورس للطالب إلا بعد الموافقة");
  };
  return (
    <div id="course-enroll" className="course-enrollment-wrap">
      <div className="course-enrollment-intro">
        <span className="eyebrow">COURSE ENROLLMENT / OXFORD</span>
        <h2>اشترك في {course.title} مع المدرس المناسب</h2>
        <p>
          الفورم هنا داخل صفحة الكورس مباشرة. اختر المدرس، نوع الحجز، والباب أو
          الوحدة، وسيتم حساب السعر قبل إرسال الطلب.
        </p>
        <div className="enrollment-steps">
          <span>
            <b>01</b> اختر المدرس
          </span>
          <span>
            <b>02</b> حدد الخطة
          </span>
          <span>
            <b>03</b> أرسل بيانات الطالب
          </span>
        </div>
      </div>
      <form className="course-enrollment-form" onSubmit={submit}>
        <label>
          مدرس الكورس
          <select
            id="course-teacher-select"
            value={teacherId}
            onChange={event => {
              setTeacherId(event.target.value);
              setSent(false);
            }}
          >
            {teachers.map(teacher => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
                {teacher.discount ? ` — خصم ${teacher.discount}` : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="booking-two-col">
          <label>
            نوع الحجز
            <select
              value={bookingType}
              onChange={event => {
                setBookingType(event.target.value);
                setSent(false);
              }}
            >
              <option>شهري</option>
              <option>بالوحدة / الباب</option>
              <option>بالحصة</option>
            </select>
          </label>
          <label>
            الصف الدراسي
            <select
              value={grade}
              onChange={event => setGrade(event.target.value)}
            >
              <option>أولى ثانوي</option>
              <option>ثانية ثانوي</option>
              <option>ثالثة ثانوي</option>
              <option>بكالوريا</option>
              <option>الثانوية العامة</option>
            </select>
          </label>
        </div>
        <label className="transfer-upload-field">
          صورة التحويل
          <span className="transfer-upload">
            <input type="file" accept="image/*" required={!transferImage} onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setCropFile(file);
            }} />
            <strong>{transferImage ? "تغيير صورة التحويل" : "اختر صورة إيصال التحويل"}</strong>
            <small>PNG أو JPG — بحد أقصى 500KB</small>
          </span>
          {transferImage && <img className="transfer-preview" src={transferImage} alt="معاينة صورة التحويل" />}
        </label>
        {cropFile && <ImageCropDialog file={cropFile} onCancel={() => setCropFile(null)} onComplete={value => { setTransferImage(value); setCropFile(null); }} />}
        {bookingType === "بالوحدة / الباب" && (
          <label>
            اختر الباب أو الوحدة
            <select
              value={unit}
              onChange={event => setUnit(event.target.value)}
            >
              {availableUnits.map(u => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
        )}
        {bookingType === "بالحصة" && (
          <label>
            اختر الحصة التي ترغب بالاشتراك فيها
            <select
              value={selectedLessonId}
              onChange={event => {
                setSelectedLessonId(event.target.value);
                setSent(false);
              }}
            >
              {teacherLessons.length === 0 ? (
                <option value="">لا توجد حصص متاحة حالياً لهذا المدرس</option>
              ) : (
                teacherLessons.map(lessonItem => (
                  <option key={lessonItem.id} value={lessonItem.id}>
                    {lessonItem.title} {lessonItem.unit ? `(${lessonItem.unit})` : ""}
                  </option>
                ))
              )}
            </select>
          </label>
        )}
        <label>
          اسم الطالب
          <input
            value={studentName}
            onChange={event => setStudentName(event.target.value)}
            placeholder="اكتب الاسم كاملًا"
            required
          />
        </label>
        <div className="booking-two-col">
          <label>
            رقم الطالب
            <input
              value={studentPhone}
              onChange={event =>
                setStudentPhone(event.target.value.replace(/\D/g, ""))
              }
              inputMode="tel"
              placeholder="01xxxxxxxxx"
              required
            />
          </label>
          <label>
            رقم ولي الأمر
            <input
              value={parentPhone}
              onChange={event =>
                setParentPhone(event.target.value.replace(/\D/g, ""))
              }
              inputMode="tel"
              placeholder="01xxxxxxxxx"
              required
            />
          </label>
        </div>
        <div className="course-enrollment-total">
          <div>
            <span>السعر المتوقع</span>
            <small>
              {activeTeacher?.name} · {bookingType}
              {bookingType === "بالوحدة / الباب" ? ` · ${unit}` : ""}
            </small>
          </div>
          <div>
            <strong>{finalPrice} ج.م</strong>
            {discountValue > 0 && <em>وفّرت {discountValue} ج.م</em>}
          </div>
        </div>
        {sent ? (
          <div className="booking-success">
            <CheckCircle2 size={20} />
            <div>
              <b>تم استلام طلب اشتراكك محليًا</b>
              <small>
                هذه معاينة Frontend فقط؛ سيتم التواصل بعد ربط النظام الحقيقي.
              </small>
            </div>
          </div>
        ) : (
          <button type="submit" className="primary-btn wide">
            إرسال طلب الاشتراك <ArrowLeft size={16} />
          </button>
        )}
        <button
          type="button"
          className="enrollment-login-link"
          onClick={() => onProtected("my-courses")}
        >
          لديك حساب؟ سجّل الدخول لحفظ التقدم <ArrowLeft size={14} />
        </button>
      </form>
    </div>
  );
}
