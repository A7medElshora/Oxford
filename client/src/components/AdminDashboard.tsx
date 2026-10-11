/* Oxford Learning Platform: Premium Admin Dashboard with Central Gear Hero & Sidebar-less Navigation */
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { api, type ApiUser } from "@/lib/api";
import { readGovernance, writeGovernance, type GovernanceStore } from "@/lib/learningGovernance";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  Plus,
  Search,
  Sparkles,
  Star,
  Sun,
  TrendingUp,
  UserPlus,
  Users,
  WalletCards,
  XCircle,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { ListSkeleton, MetricsSkeleton } from "@/components/ui/skeleton";

type AdminDashboardProps = {
  user: ApiUser;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  activePage: string;
  children?: React.ReactNode;
};

type EventSettings = { newYear: boolean; ramadan: boolean };

const STAGE_DONUT_DATA = [
  { name: "أولى ثانوي", value: 35, color: "#F47B20" },
  { name: "ثانية ثانوي", value: 25, color: "#5A4033" },
  { name: "ثالثة ثانوي", value: 18, color: "#D99000" },
  { name: "أولى إعدادي", value: 10, color: "#2E9B68" },
  { name: "ثانية إعدادي", value: 7, color: "#3B82F6" },
  { name: "ثالثة إعدادي", value: 5, color: "#8B5CF6" },
];

const DAYS_AR = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

export default function AdminDashboard({
  user,
  onNavigate,
  onLogout,
  activePage,
  children,
}: AdminDashboardProps) {
  const { theme, toggleTheme } = useTheme();
  const [governance, setGovernance] = useState<GovernanceStore>(() => readGovernance());
  const [dashboardData, setDashboardData] = useState<{
    stats: {
      students: number;
      courses: number;
      lessons: number;
      exams: number;
      attendanceRate?: number;
    };
    recentStudents: Array<{
      name: string;
      grade: string;
      course: string;
      attendance: string;
      status: string;
    }>;
    stageDistribution?: Array<{
      name: string;
      value: number;
      count?: number;
      color: string;
    }>;
  } | null>(null);

  // Real data from other APIs
  const [teachersCount, setTeachersCount] = useState<number | null>(null);
  const [todaySessions, setTodaySessions] = useState<number | null>(null);
  const [totalRevenue, setTotalRevenue] = useState<number | null>(null);
  const [revenueChart, setRevenueChart] = useState<{ day: string; value: number }[]>([]);
  const [eventSettings, setEventSettings] = useState<EventSettings | null>(null);
  const [eventsLoading, setEventsLoading] = useState(false);

  const [notifications, setNotifications] = useState<
    Array<{ id: string; title: string; message: string; read: boolean; type?: string }>
  >([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sync state from backend API & local stores
  useEffect(() => {
    // Main dashboard stats (students, courses, lessons, exams, recentStudents)
    void api<typeof dashboardData>("/dashboard")
      .then(setDashboardData)
      .catch(() => undefined);

    // Teachers list → count
    void api<Array<{ id: string }>>("/teachers")
      .then(list => setTeachersCount(list.length))
      .catch(() => undefined);

    // Calendar events → count today's sessions
    void api<Array<{ id: string; date: string; title: string }>>("/calendar")
      .then(events => {
        const today = new Date().toISOString().slice(0, 10);
        setTodaySessions(events.filter(e => e.date?.startsWith(today)).length);
      })
      .catch(() => undefined);

    // Reports overview → monthly revenue data
    void api<{ totalRevenue?: number; monthlyRevenue: number[]; attendanceRate: number; activeStudents: number; pendingEnrollments: number }>("/reports/overview")
      .then(data => {
        const total = data.totalRevenue ?? data.monthlyRevenue.reduce((a, b) => a + b, 0);
        setTotalRevenue(total);
        // Map daily/monthly values to last 7 days chart shape using day labels
        const chartData = DAYS_AR.map((day, i) => ({
          day,
          value: data.monthlyRevenue[i] ?? 0,
        }));
        setRevenueChart(chartData);
      })
      .catch(() => undefined);

    // Platform settings → event toggles
    void api<{ events: EventSettings } | undefined>("/settings")
      .then(data => {
        if (data?.events) setEventSettings(data.events);
      })
      .catch(() => undefined);

    const refreshNotifications = () => {
      void api<Array<{ id: string; title: string; message: string; read: boolean; type?: string }>>("/notifications")
        .then(setNotifications)
        .catch(() => undefined);
    };
    refreshNotifications();
    const notificationTimer = window.setInterval(refreshNotifications, 15_000);
    window.addEventListener("focus", refreshNotifications);

    const syncGov = () => setGovernance(readGovernance());
    window.addEventListener("storage", syncGov);
    return () => {
      window.clearInterval(notificationTimer);
      window.removeEventListener("focus", refreshNotifications);
      window.removeEventListener("storage", syncGov);
    };
  }, []);

  const stats = dashboardData?.stats;
  const recentStudents = dashboardData?.recentStudents || [];

  // Toggle event (Ramadan / New Year) via PATCH /settings/events
  const handleToggleEvent = async (key: keyof EventSettings) => {
    if (!eventSettings) return;
    const next = { ...eventSettings, [key]: !eventSettings[key] };
    setEventsLoading(true);
    setEventSettings(next);
    localStorage.setItem("oxford-events-settings", JSON.stringify(next));
    localStorage.setItem("oxford-settings-changed", String(Date.now()));
    window.dispatchEvent(new CustomEvent("oxford-settings-changed", { detail: next }));
    try {
      const updated = await api<EventSettings>("/settings/events", {
        method: "PATCH",
        body: JSON.stringify({ [key]: next[key] }),
      });
      if (updated) {
        setEventSettings(updated);
        localStorage.setItem("oxford-events-settings", JSON.stringify(updated));
      }
      toast.success(next[key] ? `تم تفعيل ${key === "ramadan" ? "وضع رمضان المبارك 🌙" : "احتفالية رأس السنة 🎉"}` : `تم إيقاف ${key === "ramadan" ? "وضع رمضان المبارك" : "احتفالية رأس السنة"}`);
    } catch {
      toast.error("تعذّر تحديث الإعداد — تأكد من صلاحيات الأدمن");
      setEventSettings(eventSettings);
      localStorage.setItem("oxford-events-settings", JSON.stringify(eventSettings));
      localStorage.setItem("oxford-settings-changed", String(Date.now()));
      window.dispatchEvent(new CustomEvent("oxford-settings-changed", { detail: eventSettings }));
    } finally {
      setEventsLoading(false);
    }
  };

  // Filter pending subscription requests from governance store
  const pendingRequests = useMemo(() => {
    return governance.subscriptions.filter(s => s.status === "pending");
  }, [governance.subscriptions]);

  const handleApproveRequest = (requestId: string) => {
    const updated = {
      ...governance,
      subscriptions: governance.subscriptions.map(s =>
        s.id === requestId ? { ...s, status: "approved" as const } : s
      ),
    };
    writeGovernance(updated);
    setGovernance(updated);
    toast.success("تم قبول الطلب بنجاح وتفعيل الاشتراك للطالب");
  };

  const handleRejectRequest = (requestId: string) => {
    const updated = {
      ...governance,
      subscriptions: governance.subscriptions.map(s =>
        s.id === requestId ? { ...s, status: "rejected" as const } : s
      ),
    };
    writeGovernance(updated);
    setGovernance(updated);
    toast.info("تم رفض الطلب");
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const navItems = [
    { label: "نظرة عامة", page: "overview", icon: LayoutDashboard },
    { label: "الطلبات والمراجعة", page: "admins", icon: LockKeyhole },
    { label: "الطلاب", page: "students", icon: Users },
    { label: "المدرسون", page: "teachers", icon: GraduationCap },
    { label: "الكورسات", page: "courses", icon: BookOpen },
    { label: "الحضور", page: "attendance", icon: ClipboardCheck },
    { label: "المدفوعات", page: "payments", icon: CircleDollarSign },
    { label: "طرق الدفع", page: "payment-methods", icon: WalletCards },
    { label: "التقارير", page: "reports", icon: TrendingUp },
    { label: "إعلانات الصفحة الرئيسية", page: "announcements", icon: Sparkles },
    { label: "الرسائل", page: "messages", icon: MessageCircle, badge: 3 },
  ];
  const visibleNavItems = navItems.filter(item =>
    user.id === "admin-demo" ||
    (item.page !== "payments" && item.page !== "payment-methods" && item.page !== "reports" && item.page !== "announcements") ||
    (item.page === "payments" && user.permissions?.includes("payments")) ||
    (item.page === "payment-methods" && user.permissions?.includes("payments")) ||
    (item.page === "reports" && user.permissions?.includes("reports")) ||
    (item.page === "announcements" && user.permissions?.includes("content"))
  );

  return (
    <div className="admin-redesign-root" dir="rtl">
      {/* Background Academic & Geometric Watermarks */}
      <div className="admin-bg-patterns" aria-hidden="true">
        <div className="bg-glow-orb orb-1" />
        <div className="bg-glow-orb orb-2" />
        <svg className="bg-academic-watermark" viewBox="0 0 1000 600" fill="none" opacity="0.04">
          <path d="M150 120 L250 80 L350 120 L250 160 Z" stroke="#5A4033" strokeWidth="3" />
          <path d="M250 160 V220" stroke="#5A4033" strokeWidth="3" />
          <circle cx="800" cy="180" r="90" stroke="#F47B20" strokeWidth="2" strokeDasharray="6 6" />
          <path d="M740 450 L840 400 L940 450 L840 500 Z" stroke="#F47B20" strokeWidth="3" />
        </svg>
      </div>

      {/* Floating Header */}
      <header className="admin-floating-header">
        <div className="admin-header-right">
          <div className="admin-brand-logo">
            <div className="brand-icon-box">
              <img src="/assets/platform-logo.png" alt="Oxford Logo" />
            </div>
            <div className="brand-text-box">
              <strong className="brand-name">Oxford</strong>
              <small className="brand-sub">Learning Platform</small>
            </div>
          </div>

          <button
            className="admin-mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="القائمة"
          >
            <Menu size={20} />
          </button>
        </div>

        <div className="admin-header-center">
          <div className="admin-search-bar">
            <Search size={17} className="search-icon" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ابحث عن طالب، معلم، كورس أو أي شيء..."
            />
          </div>
        </div>

        <div className="admin-header-left">
          {/* Notifications button */}
          <div className="admin-popover-wrapper">
            <button
              className="admin-icon-btn notification-btn"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              aria-label="الإشعارات"
            >
              <Bell size={18} />
              {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
            </button>

            {notificationsOpen && (
              <div className="admin-notifications-popover">
                <div className="popover-head">
                  <strong>الإشعارات</strong>
                  <span>{unreadCount} جديدة</span>
                </div>
                <div className="popover-body">
                  {notifications.length === 0 ? (
                    <p className="empty-notif">لا توجد إشعارات حالياً.</p>
                  ) : (
                    notifications.slice(0, 5).map(item => (
                      <div
                        key={item.id}
                        className={`notif-row ${item.read ? "read" : "unread"}`}
                        onClick={() => {
                          if (!item.read) {
                            void api(`/notifications/${item.id}/read`, { method: "PATCH" }).catch(() => undefined);
                            setNotifications(prev =>
                              prev.map(n => (n.id === item.id ? { ...n, read: true } : n))
                            );
                          }
                          setNotificationsOpen(false);
                          onNavigate(item.title === "طلب انضمام مدرس جديد" ? "admins" : "governance");
                        }}
                      >
                        <b>{item.title}</b>
                        <small>{item.message}</small>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile */}
          <div className="admin-profile-pill" onClick={() => onNavigate("profile")}>
            <div className="admin-avatar-circle">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} />
              ) : (
                <span>{user.name?.charAt(0) || "أ"}</span>
              )}
            </div>
            <div className="admin-profile-text">
              <b className="admin-user-name">{user.name}</b>
              <small className="admin-user-role">مدير النظام</small>
            </div>
          </div>

          {/* Theme toggle */}
          <button
            className="admin-icon-btn theme-btn"
            onClick={toggleTheme}
            title={theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {/* Settings / Logout shortcut */}
          <button
            className="admin-icon-btn logout-btn"
            onClick={onLogout}
            title="تسجيل الخروج"
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>

      {/* Floating Top Navigation Bar (Replacing Sidebar) */}
      <nav className={`admin-top-navbar ${mobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="nav-container">
          {visibleNavItems.map(item => {
            const Icon = item.icon;
            const isActive = activePage === item.page;
            return (
              <button
                key={item.page}
                className={`nav-tab-btn ${isActive ? "active" : ""}`}
                onClick={() => {
                  onNavigate(item.page);
                  setMobileMenuOpen(false);
                }}
              >
                <Icon size={16} />
                <span>{item.label}</span>
                {item.badge !== undefined && <span className="tab-badge">{item.badge}</span>}
              </button>
            );
          })}
        </div>
      </nav>

      {/* SUBPAGE CONTENT OR HERO GEAR DASHBOARD */}
      {children ? (
        <div className="admin-subpage-content">{children}</div>
      ) : (
        <>
          {/* MAIN DASHBOARD HERO SECTION: Central Gear Concept */}
          <section className="admin-hero-gear-section">
        {/* Welcome Banner Copy (Left Side) */}
        <div className="hero-welcome-box">
          <div className="academic-badge-tag">
            <Sparkles size={14} />
            <span>منصة أكسفورد التعليمية</span>
          </div>
          <h1>
            مرحباً بك في <br />
            <span className="gradient-text">منصة أكسفورد التعليمية</span>
          </h1>
          <p className="hero-subtext">
            معاً نصنع مستقبلاً أفضل لطلابنا
          </p>
          
          <div className="hero-welcome-signature">
            <span className="signature-avatar">👋</span>
            <div>
              <strong>أهلاً بك، {user.name.split(" ")[0]}</strong>
              <small>نتمنى لك يوماً موفقاً في إدارة المركز</small>
            </div>
          </div>
        </div>

        {/* Central Gear & Surrounding Cards Container */}
        <div className="central-gear-hero-layout">
          {/* SVG Connecting Lines between Central Gear and Cards */}
          <svg className="gear-connectors-svg" viewBox="0 0 900 520" fill="none">
            {/* Top Left Card Connector */}
            <path d="M 270 120 Q 380 160 450 220" stroke="#F47B20" strokeWidth="2" strokeDasharray="4 4" opacity="0.4" />
            {/* Top Right Card Connector */}
            <path d="M 630 120 Q 520 160 450 220" stroke="#5A4033" strokeWidth="2" strokeDasharray="4 4" opacity="0.4" />
            {/* Middle Left Connector */}
            <path d="M 230 260 H 400" stroke="#F47B20" strokeWidth="2" strokeDasharray="4 4" opacity="0.4" />
            {/* Middle Right Connector */}
            <path d="M 670 260 H 500" stroke="#5A4033" strokeWidth="2" strokeDasharray="4 4" opacity="0.4" />
            {/* Bottom Left Connector */}
            <path d="M 270 400 Q 380 360 450 300" stroke="#F47B20" strokeWidth="2" strokeDasharray="4 4" opacity="0.4" />
            {/* Bottom Right Connector */}
            <path d="M 630 400 Q 520 360 450 300" stroke="#5A4033" strokeWidth="2" strokeDasharray="4 4" opacity="0.4" />
          </svg>

          {/* 1. TOP LEFT CARD: الطلاب المسجلين */}
          <div className="gear-card node-top-left" onClick={() => onNavigate("students")}>
            <div className="card-icon-wrapper orange-glow">
              <Users size={20} />
            </div>
            <div className="card-info">
              <span className="card-title-text">الطلاب المسجلين</span>
              <strong className="card-main-stat">
                {stats ? stats.students.toLocaleString("ar-EG") : "1,245"}
              </strong>
              <div className="card-meta positive">
                <span className="trend-arrow">↑ 12%</span>
                <span className="meta-label">مقارنة بالشهر الماضي</span>
              </div>
            </div>
          </div>

          {/* 2. TOP RIGHT CARD: المعلمين النشطين */}
          <div className="gear-card node-top-right" onClick={() => onNavigate("teachers")}>
            <div className="card-icon-wrapper brown-glow">
              <GraduationCap size={20} />
            </div>
            <div className="card-info">
              <span className="card-title-text">المعلمين النشطين</span>
              <strong className="card-main-stat">
                {teachersCount !== null ? teachersCount.toLocaleString("ar-EG") : "—"}
              </strong>
              <div className="card-meta positive">
                <span className="trend-arrow">↑ 8%</span>
                <span className="meta-label">مقارنة بالشهر الماضي</span>
              </div>
            </div>
          </div>

          {/* 3. MIDDLE LEFT CARD: الدورات التدريبية */}
          <div className="gear-card node-mid-left" onClick={() => onNavigate("courses")}>
            <div className="card-icon-wrapper orange-glow">
              <BookOpen size={20} />
            </div>
            <div className="card-info">
              <span className="card-title-text">الدورات التدريبية</span>
              <strong className="card-main-stat">
                {stats ? stats.courses.toLocaleString("ar-EG") : "48"}
              </strong>
              <div className="card-meta positive">
                <span className="trend-arrow">↑ 6%</span>
                <span className="meta-label">مقارنة بالشهر الماضي</span>
              </div>
            </div>
          </div>

          {/* THE CENTRAL GEAR HUB */}
          <div className="central-gear-hub">
            {/* Rotating Outer Ring (CSS Animated Rotation: 25s per turn) */}
            <div className="rotating-outer-gear">
              <svg viewBox="0 0 320 320" className="gear-svg-teeth">
                <circle cx="160" cy="160" r="142" fill="none" stroke="#F47B20" strokeWidth="6" opacity="0.25" />
                <circle cx="160" cy="160" r="150" fill="none" stroke="#5A4033" strokeWidth="2" strokeDasharray="12 18" />
                {/* 12 Outer Gear Teeth */}
                {Array.from({ length: 12 }).map((_, i) => {
                  const angle = i * 30;
                  return (
                    <g key={i} transform={`rotate(${angle} 160 160)`}>
                      <rect x="152" y="4" width="16" height="22" rx="4" fill="url(#gearGradient)" />
                      <circle cx="160" cy="30" r="3" fill="#FAF8F5" />
                    </g>
                  );
                })}
                <defs>
                  <linearGradient id="gearGradient" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#F47B20" />
                    <stop offset="100%" stopColor="#5A4033" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* Subtle Counter-rotating Inner Decorative Ring */}
            <div className="counter-rotating-ring">
              <div className="dot-decor d-1" />
              <div className="dot-decor d-2" />
              <div className="dot-decor d-3" />
            </div>

            {/* STABLE INNER CORE (Does NOT Rotate!) */}
            <div className="gear-inner-core">
              <div className="core-brand-icon">
                <img src="/assets/platform-logo.png" alt="Oxford" />
              </div>
              <strong className="core-brand-title">Oxford</strong>
              <span className="core-brand-sub">Learning Platform</span>

              <div className="core-welcome-msg">
                <small className="greeting">أهلاً وسهلاً 👋</small>
                <b className="admin-name">{user.name}</b>
                <span className="role-tag">مدير النظام</span>
              </div>
            </div>
          </div>

          {/* 4. MIDDLE RIGHT CARD: الجدول الأسبوعي */}
          <div className="gear-card node-mid-right" onClick={() => onNavigate("attendance")}>
            <div className="card-icon-wrapper brown-glow">
              <CalendarDays size={20} />
            </div>
            <div className="card-info">
              <span className="card-title-text">الجدول الأسبوعي</span>
              <strong className="card-main-stat">
                {todaySessions !== null ? todaySessions.toLocaleString("ar-EG") : "—"}
              </strong>
              <div className="card-meta link-arrow">
                <span>جلسات اليوم</span>
                <ChevronLeft size={14} />
              </div>
            </div>
          </div>

          {/* 5. BOTTOM LEFT CARD: الطلبات قيد المراجعة */}
          <div className="gear-card node-bottom-left" onClick={() => onNavigate("governance")}>
            <div className="card-icon-wrapper orange-glow">
              <LockKeyhole size={20} />
            </div>
            <div className="card-info">
              <span className="card-title-text">الطلبات قيد المراجعة</span>
              <strong className="card-main-stat">
                {pendingRequests.length}
              </strong>
              <div className="card-meta link-arrow">
                <span>طلبات جديدة</span>
                <ChevronLeft size={14} />
              </div>
            </div>
          </div>

          {/* 6. BOTTOM RIGHT CARD: إجمالي الإيرادات */}
          <div className="gear-card node-bottom-right" onClick={() => onNavigate("payments")}>
            <div className="card-icon-wrapper brown-glow">
              <TrendingUp size={20} />
            </div>
            <div className="card-info">
              <span className="card-title-text">إجمالي الإيرادات</span>
              <strong className="card-main-stat">
                {totalRevenue !== null
                  ? `${totalRevenue.toLocaleString("ar-EG")} `
                  : "—"}
                {totalRevenue !== null && <small className="currency">ج.م</small>}
              </strong>
              <div className="card-meta positive">
                <span className="trend-arrow">↑ 14%</span>
                <span className="meta-label">مقارنة بالشهر الماضي</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side Activity Panel */}
        <aside className="hero-activity-sidebar">
          <div className="activity-panel-header">
            <h3>أحدث الأنشطة</h3>
            <Activity size={17} className="text-orange" />
          </div>

          <div className="activity-feed-list">
            {!dashboardData ? (
              <ListSkeleton rows={5} />
            ) : recentStudents.length > 0 ? (
              recentStudents.slice(0, 5).map((s, idx) => (
                <div className="activity-item-card" key={idx}>
                  <div className="activity-icon-badge orange">
                    {idx % 2 === 0 ? <UserPlus size={15} /> : <FileText size={15} />}
                  </div>
                  <div className="activity-body">
                    <strong>تم تسجيل الطالب: {s.name}</strong>
                    <small>{s.course || s.grade || "طالب جديد بالمنصة"}</small>
                  </div>
                  <span className="activity-time">طالب مسجل</span>
                </div>
              ))
            ) : (
              <div className="activity-empty-state" style={{ padding: "20px", textAlign: "center", color: "var(--ink-muted)" }}>
                لا توجد أنشطة طلابية جديدة حالياً
              </div>
            )}
          </div>
        </aside>
      </section>

      {/* PENDING REQUESTS SECTION */}
      {pendingRequests.length > 0 && (
        <section className="admin-pending-requests-section">
          <div className="section-head-bar">
            <div>
              <h2>طلبات تحتاج إلى مراجعة</h2>
              <p>طلبات انضمام وااشتراك جديدة في الكورسات تتطلب موافقة الأدمن</p>
            </div>
            <span className="pending-badge-count">{pendingRequests.length} طلبات جديدة</span>
          </div>

          <div className="pending-requests-grid">
            {pendingRequests.map(req => {
              const courseTitle = req.courseId === "programming" ? "أساسيات البرمجة" : req.courseId === "science" ? "فيزياء الحركة والطاقة" : "مهارات حل الامتحان";
              return (
                <div className="pending-card" key={req.id}>
                  <div className="req-user-info">
                    <span className="req-avatar">{req.studentName?.charAt(0) || "ط"}</span>
                    <div>
                      <strong>{req.studentName}</strong>
                      <small>الكورس: {courseTitle}</small>
                    </div>
                  </div>
                  <div className="req-meta">
                    <span>المدرس: {req.teacherName}</span>
                    <span>الخطة: {req.planType}</span>
                    <small>التاريخ: {new Date(req.createdAt).toLocaleDateString("ar-EG")}</small>
                  </div>
                  <div className="req-actions">
                    <button className="btn-approve" onClick={() => handleApproveRequest(req.id)}>
                      <CheckCircle2 size={15} /> قبول
                    </button>
                    <button className="btn-reject" onClick={() => handleRejectRequest(req.id)}>
                      <XCircle size={15} /> رفض
                    </button>
                    <button className="btn-details" onClick={() => onNavigate("governance")}>
                      التفاصيل
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ANALYTICS SECTION: Charts & Tables Grid */}
      <section className="admin-analytics-section">
        {/* 1. Platform Performance Chart */}
        <div className="analytics-card chart-large-card">
          <div className="card-head-title">
            <div>
              <h3>إيرادات المنصة</h3>
              <small>الإيرادات الشهرية موزعة على الأسبوع</small>
            </div>
            <div className="chart-filter-chip">آخر 7 أيام</div>
          </div>

          <div className="recharts-wrapper">
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={revenueChart.length > 0 ? revenueChart : DAYS_AR.map(day => ({ day, value: 0 }))}>
                <defs>
                  <linearGradient id="orangeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F47B20" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#F47B20" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#E8DED5" strokeDasharray="3 3" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#7A706A" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#7A706A" }} />
                <Tooltip
                  formatter={(v: number) => [`${v.toLocaleString("ar-EG")} ج.م`, "الإيرادات"]}
                  contentStyle={{ backgroundColor: "#FFFFFF", borderRadius: "12px", borderColor: "#E8DED5", boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}
                />
                <Area type="monotone" dataKey="value" stroke="#F47B20" strokeWidth={3} fill="url(#orangeGrad)" dot={{ r: 4, fill: "#F47B20" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Donut Chart: Student Stage Distribution */}
        <div className="analytics-card chart-donut-card">
          <div className="card-head-title">
            <h3>توزيع الطلاب حسب المرحلة</h3>
            <button className="text-link-btn" onClick={() => onNavigate("students")}>عرض الكل</button>
          </div>

          {(() => {
            const currentStageData = dashboardData?.stageDistribution || STAGE_DONUT_DATA;
            return (
              <div className="donut-content-layout">
                <div className="donut-chart-container">
                  <ResponsiveContainer width={170} height={170}>
                    <PieChart>
                      <Pie
                        data={currentStageData}
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {currentStageData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="donut-center-label">
                    <strong>{stats ? stats.students : 0}</strong>
                    <small>طالب</small>
                  </div>
                </div>

                <div className="donut-legend-list">
                  {currentStageData.map((item, idx) => (
                    <div className="legend-row" key={idx}>
                      <span className="legend-dot" style={{ backgroundColor: item.color }} />
                      <span className="legend-name">{item.name}</span>
                      <b className="legend-val">{item.value}%</b>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* 3. Recent Students Roster Table */}
        <div className="analytics-card table-roster-card">
          <div className="card-head-title">
            <h3>أحدث الطلاب المسجلين</h3>
            <button className="text-link-btn" onClick={() => onNavigate("students")}>
              عرض القائمة كاملة <ChevronLeft size={14} />
            </button>
          </div>

          <div className="roster-list-body">
            {!dashboardData ? (
              <ListSkeleton rows={4} />
            ) : recentStudents.length > 0 ? (
              recentStudents.slice(0, 4).map((s, idx) => (
                <div className="roster-item-row" key={idx}>
                  <div className="roster-user">
                    <span className={`avatar-initials color-${idx % 4}`}>{s.name.charAt(0)}</span>
                    <div>
                      <strong>{s.name}</strong>
                      <small>{s.grade || "الصف الأول الثانوي"}</small>
                    </div>
                  </div>
                  <span className="roster-status-badge">{s.status || "نشط"}</span>
                </div>
              ))
            ) : (
              <div className="roster-empty-state" style={{ padding: "20px", textAlign: "center", color: "var(--ink-muted)" }}>
                لا يوجد طلاب مسجلين حالياً
              </div>
            )}
          </div>
        </div>
      </section>

      {/* OCCASIONS / EVENTS TOGGLE SECTION */}
      <section className="admin-events-section">
        <div className="events-section-header">
          <Star size={16} className="events-icon" />
          <h3>المناسبات والأوضاع الخاصة</h3>
          <span className="events-beta-tag">تأثيرات بصرية</span>
        </div>
        <div className="events-toggles-grid">
          {/* Ramadan Mode */}
          <div className={`event-toggle-card ${eventSettings?.ramadan ? "event-active" : ""}`}>
            <div className="event-toggle-info">
              <span className="event-emoji">🌙</span>
              <div>
                <strong>وضع رمضان المبارك</strong>
                <small>يُضيف زخارف وأجواء رمضانية على المنصة</small>
              </div>
            </div>
            <button
              className={`toggle-switch ${eventSettings?.ramadan ? "on" : "off"}`}
              onClick={() => handleToggleEvent("ramadan")}
              disabled={eventsLoading || !eventSettings}
              aria-label="تفعيل وضع رمضان"
            >
              <span className="toggle-knob" />
            </button>
          </div>

          {/* New Year Mode */}
          <div className={`event-toggle-card ${eventSettings?.newYear ? "event-active" : ""}`}>
            <div className="event-toggle-info">
              <span className="event-emoji">🎉</span>
              <div>
                <strong>احتفالية رأس السنة</strong>
                <small>يُضيف تأثيرات احتفالية ورسائل ترحيبية خاصة</small>
              </div>
            </div>
            <button
              className={`toggle-switch ${eventSettings?.newYear ? "on" : "off"}`}
              onClick={() => handleToggleEvent("newYear")}
              disabled={eventsLoading || !eventSettings}
              aria-label="تفعيل احتفالية رأس السنة"
            >
              <span className="toggle-knob" />
            </button>
          </div>
        </div>
        {!eventSettings && (
          <p className="events-no-permission">⚠️ تحتاج صلاحية "الإعدادات" لتعديل المناسبات</p>
        )}
      </section>
        </>
      )}
    </div>
  );
}
