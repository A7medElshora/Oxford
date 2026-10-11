import { useEffect, useRef, useState } from "react";
import { ArrowLeft, BookOpen, CalendarClock, FileText, GraduationCap, Lock, Play, Users } from "lucide-react";
import { toast } from "sonner";
import { api, type ApiUser } from "@/lib/api";
import { readGovernance, writeGovernance } from "@/lib/learningGovernance";
import { CourseEnrollmentForm } from "@/pages/VisitorHome";
import { CardSkeleton } from "@/components/ui/skeleton";

type Lesson = {
  id: string;
  courseId: string;
  title: string;
  description: string;
  lectureUrl: string;
  resourceUrl?: string;
  unit?: string;
  published: boolean;
};

type Course = {
  id: string;
  title: string;
  description: string;
  level: string;
  duration: string;
  image: string;
  teacherIds: string[];
  lessonCount: number;
  published: boolean;
  targetGrades: string[];
  teacherPlans?: Array<{
    teacherId: string;
    monthlyPrice: number;
    lessonPrice: number;
    chapterPrice: number;
    discountEnabled: boolean;
    discountKind?: "percent" | "amount";
    discountValue?: number;
  }>;
};

type Teacher = {
  id: string;
  name: string;
  subject: string;
  bio: string;
  image: string;
  courseIds: string[];
  trustLabel: string;
  courses: number;
  students: string;
  plans: { label: string; price: number }[];
  discount?: string;
  discountKind?: "percent" | "amount";
};

type Props = {
  courseId: string;
  user: ApiUser;
  onNavigate: (page: string) => void;
};

function getLessonWatchKey(studentId: string, lessonId: string) {
  return `oxford-per-lesson-watch:${studentId}:${lessonId}`;
}

function hasLessonBeenWatched(studentId: string, lessonId: string) {
  if (!studentId || !lessonId) return false;
  try {
    return localStorage.getItem(getLessonWatchKey(studentId, lessonId)) === "1";
  } catch {
    return false;
  }
}

function markLessonWatched(studentId: string, lessonId: string, lessonTitle?: string) {
  if (!studentId) return;
  try {
    if (lessonId) localStorage.setItem(getLessonWatchKey(studentId, lessonId), "1");
    if (lessonTitle) localStorage.setItem(getLessonWatchKey(studentId, lessonTitle), "1");
  } catch {
    // ignore localStorage access errors
  }
}

/* ─── helpers ─────────────────────────────────────────────────────────── */
function normalizeUnitName(unit?: string): string {
  if (!unit) return "";
  return unit
    .trim()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .toLowerCase();
}

function isLessonInUnit(lesson: Lesson, enrolledUnit: string | null | undefined): boolean {
  if (!enrolledUnit || !enrolledUnit.trim()) return false;
  if (!lesson.unit || !lesson.unit.trim()) return false;

  const normEnrolled = normalizeUnitName(enrolledUnit);
  const normLessonUnit = normalizeUnitName(lesson.unit);

  return (
    normLessonUnit === normEnrolled ||
    normLessonUnit.includes(normEnrolled) ||
    normEnrolled.includes(normLessonUnit)
  );
}

function toEmbedUrl(url: string): string | null {
  if (!url) return null;
  // YouTube
  const ytMatch =
    url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/) ||
    url.match(/youtube\.com\/embed\/([\w-]{11})/);
  if (ytMatch) {
    return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=0&controls=0&disablekb=1&modestbranding=1&rel=0&fs=0`;
  }
  // Google Drive
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (driveMatch) {
    return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  }
  // Google Meet / other — try to embed directly
  return url;
}

function toPdfEmbedUrl(url: string): string | null {
  if (!url) return null;
  if (url.startsWith("data:application/pdf")) return url;
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (driveMatch) return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  if (url.endsWith(".pdf") || url.includes("application/pdf")) return url;
  return null;
}

/* ─── Protected Video Player ───────────────────────────────────────────── */
function ProtectedPlayer({ lesson, userName }: { lesson: Lesson; userName: string }) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const embedUrl = toEmbedUrl(lesson.lectureUrl);
  const pdfUrl   = lesson.resourceUrl ? toPdfEmbedUrl(lesson.resourceUrl) : null;

  // Block right-click and keyboard shortcuts on the container
  const blockEvent = (e: React.MouseEvent | React.KeyboardEvent) => e.preventDefault();

  return (
    <div className="lesson-player-page" dir="rtl">
      {/* Header */}
      <header className="lesson-player-header">
        <div>
          <span className="eyebrow">LESSON PLAYER</span>
          <h2>{lesson.title}</h2>
          {lesson.description && <p>{lesson.description}</p>}
        </div>
      </header>

      {/* Video block */}
      {embedUrl ? (
        <div
          className="lesson-video-wrapper"
          onContextMenu={blockEvent}
          onKeyDown={blockEvent}
        >
          {/* Transparent overlays to block interaction with video controls but leave center open */}
          <div
            ref={overlayRef}
            className="lesson-video-shield"
            onContextMenu={blockEvent}
          >
            <div onContextMenu={blockEvent} />
            <div onContextMenu={blockEvent} />
            <div onContextMenu={blockEvent} />
            <div onContextMenu={blockEvent} />
          </div>
          <iframe
            src={embedUrl}
            className="lesson-iframe"
            allow="autoplay; encrypted-media"
            allowFullScreen={false}
            title={lesson.title}
            sandbox="allow-scripts allow-same-origin allow-presentation"
          />
          {/* Watermark */}
          <div className="lesson-watermark">
            {userName} · محتوى محمي
          </div>
        </div>
      ) : (
        <div className="lesson-no-video">
          <Play size={32} />
          <p>رابط الفيديو غير مدعوم للعرض المدمج.</p>
        </div>
      )}

      {/* PDF */}
      {pdfUrl && (
        <section className="lesson-pdf-section" onContextMenu={blockEvent}>
          <div className="lesson-pdf-header">
            <FileText size={18} /> ملف المحاضرة (PDF)
          </div>
          <div className="lesson-pdf-wrapper">
            <div className="lesson-pdf-shield" onContextMenu={blockEvent} />
            <iframe
              src={pdfUrl}
              className="lesson-pdf-iframe"
              title="ملف المحاضرة"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </section>
      )}
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────────────────────── */
export default function CourseDetailContent({ courseId, user, onNavigate }: Props) {
  const [course, setCourse]       = useState<Course | null>(null);
  const [teachers, setTeachers]   = useState<Teacher[]>([]);
  const [enrolled, setEnrolled]   = useState(false);
  const [enrolledTeacherName, setEnrolledTeacherName] = useState<string | null>(null);
  const [enrolledTeacherId, setEnrolledTeacherId]     = useState<string | null>(null);
  const [enrolledPlanType, setEnrolledPlanType]       = useState<"شهري" | "بالحصة" | "الباب" | null>(null);
  const [enrolledUnit, setEnrolledUnit]               = useState<string | null>(null);
  const [enrolledEnrollmentId, setEnrolledEnrollmentId] = useState<string | null>(null);
  const [lessons, setLessons]     = useState<Lesson[]>([]);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [watchedLessons, setWatchedLessons] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const cancelExpiredPerLessonEnrollment = (enrollmentId: string | null) => {
    if (enrollmentId) {
      api(`/enrollments/${enrollmentId}`, { method: "DELETE" }).catch(() => {});
    }
    try {
      const gov = readGovernance();
      gov.subscriptions = gov.subscriptions.map(s => {
        if (s.courseId === courseId && s.studentId === user.id && s.status === "approved") {
          return { ...s, status: "ended" };
        }
        return s;
      });
      writeGovernance(gov);
    } catch {
      // ignore local storage errors
    }
    setEnrolled(false);
    setEnrolledPlanType(null);
    setEnrolledUnit(null);
    setEnrolledTeacherName(null);
    setEnrolledTeacherId(null);
    setEnrolledEnrollmentId(null);
  };

  useEffect(() => {
    setLoading(true);
    void Promise.all([
      api<Course>(`/courses/${courseId}`),
      api<Array<Teacher & { plans?: { label: string; price: number }[] }>>("/teachers"),
      api<Array<{ id: string; courseId: string; teacherId?: string; studentId?: string; status: string; bookingType?: "شهري" | "بالحصة" | "الباب"; unit?: string }>>("/enrollments"),
      api<Lesson[]>(`/lessons?courseId=${courseId}`).catch(() => [] as Lesson[]),
    ]).then(([nextCourse, allTeachers, enrollments, nextLessons]) => {
      setCourse(nextCourse);
      const plans = nextCourse.teacherPlans || [];
      const mappedTeachers = allTeachers
        .filter(t => nextCourse.teacherIds.includes(t.id) || (Boolean((t as any).userId) && nextCourse.teacherIds.includes((t as any).userId)))
        .map(t => {
          const plan = plans.find(p => p.teacherId === t.id || p.teacherId === (t as any).userId);
          return {
            ...t,
            courses: t.courseIds?.length || 0,
            students: "",
            plans: plan
              ? [
                  { label: "شهري",      price: plan.monthlyPrice },
                  { label: "الباب الأول", price: plan.chapterPrice },
                  { label: "بالحصة",    price: plan.lessonPrice },
                ]
              : t.plans || [],
            discount:
              plan?.discountEnabled && plan.discountValue !== undefined
                ? `${plan.discountValue}${plan.discountKind === "percent" ? "%" : " جنيه"}`
                : undefined,
            discountKind: plan?.discountKind,
          };
        });
      setTeachers(mappedTeachers);

      const allCourseLessons = ((nextCourse as any).lessons as Lesson[]) || nextLessons.filter(l => l.published);

      const gov = readGovernance();
      const localGovSub = gov.subscriptions.find(
        s => s.courseId === courseId && s.studentId === user.id && s.status === "approved"
      );

      const approvedEnrollment = enrollments.find(
        e => e.courseId === courseId && e.status === "approved"
      ) || (localGovSub ? {
        id: localGovSub.id,
        courseId: localGovSub.courseId,
        teacherId: localGovSub.teacherId,
        studentId: localGovSub.studentId,
        status: localGovSub.status,
        bookingType: localGovSub.planType,
        unit: localGovSub.selectedUnit || localGovSub.selectedLesson,
      } : null);

      // ── DEBUG: أطبع القيم الفعلية لتشخيص المشكلة ──
      console.log("[CourseDetail] approvedEnrollment:", JSON.stringify(approvedEnrollment));
      console.log("[CourseDetail] allCourseLessons units:", allCourseLessons.map(l => ({ id: l.id, title: l.title, unit: l.unit })));
      console.log("[CourseDetail] enrollments from API:", JSON.stringify(enrollments));
      // ── END DEBUG ──

      const isPerLesson = approvedEnrollment?.bookingType === "بالحصة";
      const targetUnitOrId = approvedEnrollment?.unit || null;
      
      const isAlreadyWatched = isPerLesson && (
        (targetUnitOrId && hasLessonBeenWatched(user.id, targetUnitOrId)) ||
        allCourseLessons.some(l =>
          hasLessonBeenWatched(user.id, l.id) || (l.title && hasLessonBeenWatched(user.id, l.title))
        )
      );

      if (approvedEnrollment && isPerLesson && isAlreadyWatched) {
        cancelExpiredPerLessonEnrollment(approvedEnrollment.id);
        toast.info("لقد استنفذت اشتراكك بالحصة سابقاً، وتم إلغاء الاشتراك القديم تلقائياً. يمكنك طلب اشتراك جديد.");
      } else {
        setEnrolled(Boolean(approvedEnrollment));
        setEnrolledEnrollmentId(approvedEnrollment?.id || null);
        setEnrolledPlanType(approvedEnrollment?.bookingType === "بالحصة" || approvedEnrollment?.bookingType === "شهري" || approvedEnrollment?.bookingType === "الباب" ? approvedEnrollment.bookingType : null);
        setEnrolledUnit(targetUnitOrId);

        if (approvedEnrollment && approvedEnrollment.teacherId) {
          setEnrolledTeacherId(approvedEnrollment.teacherId);
          const foundTeacher = allTeachers.find(
            t => t.id === approvedEnrollment.teacherId || (t as any).userId === approvedEnrollment.teacherId
          );
          if (foundTeacher) {
            setEnrolledTeacherName(foundTeacher.name);
          } else {
            setEnrolledTeacherName(approvedEnrollment.teacherId);
          }
        } else {
          setEnrolledTeacherName(null);
          setEnrolledTeacherId(null);
        }
      }

      const nextWatched: Record<string, boolean> = {};
      for (const lesson of allCourseLessons) {
        nextWatched[lesson.id] = hasLessonBeenWatched(user.id, lesson.id) || Boolean(lesson.title && hasLessonBeenWatched(user.id, lesson.title));
      }
      setWatchedLessons(nextWatched);
      setLessons(allCourseLessons);
    }).catch(() => toast.error("تعذر تحميل بيانات الكورس"))
      .finally(() => setLoading(false));
  }, [courseId, user.id]);

  /* ── show lesson player ── */
  if (activeLesson) {
    return (
      <div>
        <button
          className="visitor-back"
          style={{ marginBottom: 16 }}
          onClick={() => {
            if (enrolledPlanType === "بالحصة" && enrolledEnrollmentId) {
              cancelExpiredPerLessonEnrollment(enrolledEnrollmentId);
              toast.success("تم استنفاذ اشتراكك بالحصة وتم إلغاء الاشتراك القديم تلقائياً.");
            }
            setActiveLesson(null);
          }}
        >
          <ArrowLeft size={16} /> العودة للكورس
        </button>
        <ProtectedPlayer lesson={activeLesson} userName={user.name} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="student-course-detail" style={{ padding: "24px" }}>
        <CardSkeleton count={1} />
        <div style={{ marginTop: 24 }}>
          <CardSkeleton count={3} />
        </div>
      </div>
    );
  }

  if (!course) return <div className="paper-card loading-card">تعذر تحميل بيانات الكورس.</div>;

  const publicCourse = {
    id: course.id as "programming" | "science" | "skills",
    title: course.title,
    desc: course.description,
    teacher: teachers.map(t => t.name).join("، ") || "مدرسو الكورس",
    teacherIds: course.teacherIds,
    level: course.level,
    lessons: course.lessonCount,
    duration: course.duration,
    image: course.image || "/assets/learning.png",
    accent: "orange",
    teachers,
  };

  return (
    <div className="student-course-detail">
      <button className="visitor-back" onClick={() => onNavigate("browse")}>
        <ArrowLeft size={16} /> العودة للكورسات
      </button>

      <section className="detail-hero">
        <div>
          <span className="eyebrow light">COURSE / {course.level}</span>
          <h1>{course.title}</h1>
          <p>{course.description}</p>
          <div className="detail-stats">
            <span><BookOpen size={15} /> {course.lessonCount} محاضرة</span>
            <span><CalendarClock size={15} /> {course.duration}</span>
            <span><Users size={15} /> {teachers.length} مدرسين</span>
          </div>
          {enrolledTeacherName && (
            <div className="enrolled-teacher-badge" style={{ marginTop: "14px", display: "inline-flex", alignItems: "center", gap: "7px", background: "rgba(255, 255, 255, 0.18)", color: "#ffffff", padding: "6px 14px", borderRadius: "10px", fontWeight: "700", fontSize: "13px", backdropFilter: "blur(6px)", border: "1px solid rgba(255, 255, 255, 0.25)" }}>
              <GraduationCap size={16} /> المدرس المشترك معه: {enrolledTeacherName}
            </div>
          )}
        </div>
        <img src={course.image || publicCourse.image} alt={course.title} />
      </section>

      <div className="student-course-info-grid">
        {/* Teachers */}
        <section className="paper-card">
          <span className="eyebrow">COURSE TEACHERS</span>
          <h2>مدرسو الكورس والأسعار</h2>
          <div className="course-teacher-list">
            {teachers.map(teacher => {
              const isMyTeacher = (enrolledTeacherId && teacher.id === enrolledTeacherId) || (enrolledTeacherName && teacher.name === enrolledTeacherName);
              const basePrice = teacher.plans[0]?.price || 0;
              const discountVal = teacher.discount ? Number.parseInt(teacher.discount) : 0;
              const finalPrice = teacher.discountKind === "percent" && discountVal
                ? Math.round(basePrice * (1 - discountVal / 100))
                : teacher.discountKind === "amount" && discountVal
                  ? Math.max(0, basePrice - discountVal)
                  : basePrice;

              return (
                <article key={teacher.id} className={`teacher-compact-card ${isMyTeacher ? "subscribed-teacher" : ""}`} style={isMyTeacher ? { border: "1.5px solid #10b981", background: "rgba(16, 185, 129, 0.05)" } : undefined}>
                  <img
                    src={teacher.image}
                    alt={teacher.name}
                    className="teacher-avatar-sm"
                  />
                  <div>
                    <strong>
                      {teacher.name}
                      {isMyTeacher && (
                        <span style={{ background: "#10b981", color: "#ffffff", padding: "2px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: "bold", marginRight: "8px", display: "inline-block" }}>
                          مدرسك المشترك معه
                        </span>
                      )}
                      {teacher.discount && (
                        <span style={{ background: "#ef4444", color: "#ffffff", padding: "2px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: "bold", marginRight: "8px", display: "inline-block" }}>
                          خصم {teacher.discount}
                        </span>
                      )}
                    </strong>
                    <small>{teacher.subject} · {teacher.trustLabel}</small>
                  </div>
                  <div style={{ textAlign: "left", whiteSpace: "nowrap" }}>
                    {teacher.discount ? (
                      <>
                        <s style={{ color: "#94a3b8", fontSize: "11px", marginLeft: "6px", display: "inline-block" }}>{basePrice} ج.م</s>
                        <b style={{ color: "#ef4444", fontSize: "13px" }}>{finalPrice} جنيه / شهر</b>
                      </>
                    ) : (
                      <b>{basePrice} جنيه / شهر</b>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Lessons */}
        <section className="paper-card">
          <span className="eyebrow">COURSE CONTENT</span>
          <h2>محتوى الكورس</h2>
          {(() => {
            const displayedLessons = (() => {
              if (!enrolled) return lessons;

              if (enrolledPlanType === "بالحصة" && enrolledUnit) {
                const matched = lessons.filter(
                  l => l.id === enrolledUnit || l.title === enrolledUnit || isLessonInUnit(l, enrolledUnit)
                );
                return matched.length > 0 ? matched : lessons;
              }

              if (enrolledPlanType === "الباب" && enrolledUnit) {
                const matched = lessons.filter(
                  l => isLessonInUnit(l, enrolledUnit)
                );
                return matched.length > 0 ? matched : lessons;
              }

              return lessons;
            })();

            if (displayedLessons.length === 0) {
              return (
                <p className="muted">
                  {enrolled
                    ? "لم يُضف المدرس محاضرات هذا الباب بعد، تابع الكورس لاحقاً."
                    : "سيظهر المحتوى بعد الاشتراك في الكورس."}
                </p>
              );
            }

            return displayedLessons.map((lesson, index) => {
              // DEBUG
              if (enrolledPlanType === "الباب") {
                console.log(`[Lesson ${index}] lesson.unit='${lesson.unit}' enrolledUnit='${enrolledUnit}' match=${isLessonInUnit(lesson, enrolledUnit)}`);
              }
              const isSameUnit = Boolean(
                enrolledUnit && isLessonInUnit(lesson, enrolledUnit)
              );
              const isUnitLocked = enrolledPlanType === "الباب" && !isSameUnit;
              const watchLocked = enrolled && enrolledPlanType === "بالحصة" && watchedLessons[lesson.id];
              const canOpenLesson = enrolled && (
                enrolledPlanType === "شهري" ||
                (enrolledPlanType === "الباب" && isSameUnit) ||
                (enrolledPlanType === "بالحصة" && !watchLocked)
              );

              return (
                <div className="lesson-row" key={lesson.id}>
                  <span className="lesson-num">{String(index + 1).padStart(2, "0")}</span>
                  <span>
                    <strong>{lesson.title}</strong>
                    <small>{lesson.unit ? `باب / وحدة: ${lesson.unit}` : lesson.description}</small>
                  </span>
                  {enrolled ? (
                    isUnitLocked ? (
                      <span className="row-action muted"><Lock size={13} /> هذا الباب مغلق في اشتراكك الحالي</span>
                    ) : watchLocked ? (
                      <span className="row-action muted"><Lock size={13} /> تم استخدام هذه الحصة سابقًا</span>
                    ) : canOpenLesson ? (
                      <button
                        className="row-action"
                        onClick={() => {
                          if (enrolledPlanType === "بالحصة") {
                            toast.info("دي المرة الوحيدة اللي هتدخل فيها للحصة وفق اشتراكك الحالي.");
                            markLessonWatched(user.id, lesson.id);
                            setWatchedLessons((current) => ({ ...current, [lesson.id]: true }));
                          }
                          setActiveLesson(lesson);
                          if (lesson.id) {
                            api(`/lessons/${lesson.id}/attend`, { method: "POST" }).catch(() => {});
                          }
                        }}
                      >
                        <Play size={14} /> مشاهدة
                      </button>
                    ) : (
                      <span className="row-action muted"><Lock size={13} /> غير متاح في اشتراكك</span>
                    )
                  ) : (
                    <span className="row-action muted"><Lock size={13} /> مقفل</span>
                  )}
                </div>
              );
            });
          })()}
        </section>
      </div>

      {!enrolled && teachers.length > 0 && (
        <CourseEnrollmentForm
          course={publicCourse}
          teachers={teachers}
          onProtected={() => undefined}
        />
      )}

      {enrolled && (
        <div className="private-access-note">
          <BookOpen size={17} /> أنت مشترك في هذا الكورس {enrolledTeacherName ? `مع المدرس (${enrolledTeacherName})` : ""} — اضغط على أي محاضرة لمشاهدتها.
        </div>
      )}
    </div>
  );
}
