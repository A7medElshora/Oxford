/* Oxford Learning Platform: RTL paper-card education UI, Oxford Orange and Ink Black, restrained motion. */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useEffect, useState } from "react";
import { Route, Switch, useLocation } from "wouter";
import Home from "./pages/Home";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Setup from "./pages/Setup";
import VisitorHome from "./pages/VisitorHome";

import {
  api,
  apiLogout,
  apiMe,
  clearApiToken,
  getApiToken,
  type ApiUser,
} from "./lib/api";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./contexts/ThemeContext";

function pathToPage(path: string): string {
  if (!path || path === "/" || path === "/dashboard" || path === "/home") return "overview";
  if (path === "/courses") return "courses";
  if (path === "/students") return "students";
  if (path === "/teachers") return "teachers";
  if (path === "/governance" || path === "/requests" || path === "/approvals") return "governance";
  if (path === "/admins") return "admins";
  if (path === "/attendance") return "attendance";
  if (path === "/payments") return "payments";
  if (path === "/payment-methods" || path === "/payment_methods") return "payment-methods";
  if (path === "/reports") return "reports";
  if (path === "/announcements") return "announcements";
  if (path === "/messages") return "messages";
  if (path === "/exams") return "exams";
  if (path === "/results") return "results";
  if (path === "/assignments") return "assignments";
  if (path === "/lessons") return "lessons";
  if (path === "/calendar") return "calendar";
  if (path === "/profile") return "profile";
  if (path === "/cart") return "cart";
  if (path === "/browse") return "browse";
  if (path === "/course/new") return "course-new";
  if (path.startsWith("/course/")) return `course-detail:${path.replace("/course/", "")}`;
  if (path.startsWith("/exam/")) return `exam-take:${path.replace("/exam/", "")}`;
  return "overview";
}

function pageToPath(page: string): string {
  if (page === "overview") return "/dashboard";
  if (page === "courses") return "/courses";
  if (page === "students") return "/students";
  if (page === "teachers") return "/teachers";
  if (page === "governance") return "/requests";
  if (page === "admins") return "/admins";
  if (page === "attendance") return "/attendance";
  if (page === "payments") return "/payments";
  if (page === "payment-methods") return "/payment-methods";
  if (page === "reports") return "/reports";
  if (page === "announcements") return "/announcements";
  if (page === "messages") return "/messages";
  if (page === "exams") return "/exams";
  if (page === "results") return "/results";
  if (page === "assignments") return "/assignments";
  if (page === "lessons") return "/lessons";
  if (page === "calendar") return "/calendar";
  if (page === "profile") return "/profile";
  if (page === "cart") return "/cart";
  if (page === "browse") return "/browse";
  if (page === "course-new") return "/course/new";
  if (page.startsWith("course-detail:")) return `/course/${page.split(":")[1]}`;
  if (page.startsWith("exam-take:")) return `/exam/${page.split(":")[1]}`;
  return "/dashboard";
}

function AppRouter() {
  const [location, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [activePage, setActivePage] = useState(() => {
    const pageFromUrl = pathToPage(window.location.pathname);
    return pageFromUrl !== "overview" ? pageFromUrl : (localStorage.getItem("tafra-page") || "overview");
  });
  const [newYear, setNewYear] = useState(() => {
    try {
      const saved = localStorage.getItem("oxford-events-settings");
      if (saved) return Boolean(JSON.parse(saved).newYear);
    } catch {}
    return false;
  });
  const [ramadan, setRamadan] = useState(() => {
    try {
      const saved = localStorage.getItem("oxford-events-settings");
      if (saved) return Boolean(JSON.parse(saved).ramadan);
    } catch {}
    return false;
  });

  useEffect(() => {
    const sync = () => {
      if (!getApiToken()) setUser(null);
    };
    window.addEventListener("storage", sync);
    if (getApiToken())
      apiMe()
        .then(setUser)
        .catch(() => {
          clearApiToken();
        })
        .finally(() => setCheckingSession(false));
    else setCheckingSession(false);
    return () => window.removeEventListener("storage", sync);
  }, []);

  useEffect(() => {
    if (user && location !== "/setup" && location !== "/404") {
      if (location === "/login") {
        const targetPath = pageToPath(activePage || "overview");
        if (location !== targetPath) {
          setLocation(targetPath);
        }
      } else {
        const pageFromUrl = pathToPage(location);
        if (pageFromUrl !== activePage) {
          setActivePage(pageFromUrl);
          localStorage.setItem("tafra-page", pageFromUrl);
        }
      }
    }
  }, [location, user, activePage, setLocation]);

  useEffect(() => {
    const loadEvent = (e?: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail) {
        if (typeof detail.newYear === "boolean") setNewYear(detail.newYear);
        if (typeof detail.ramadan === "boolean") setRamadan(detail.ramadan);
        try {
          const current = JSON.parse(localStorage.getItem("oxford-events-settings") || "{}");
          localStorage.setItem(
            "oxford-events-settings",
            JSON.stringify({
              ...current,
              ...(typeof detail.newYear === "boolean" ? { newYear: detail.newYear } : {}),
              ...(typeof detail.ramadan === "boolean" ? { ramadan: detail.ramadan } : {}),
            })
          );
        } catch {}
        return;
      }

      // Check localStorage first
      try {
        const cached = localStorage.getItem("oxford-events-settings");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (typeof parsed.newYear === "boolean") setNewYear(parsed.newYear);
          if (typeof parsed.ramadan === "boolean") setRamadan(parsed.ramadan);
        }
      } catch {}

      void api<{ events?: { newYear?: boolean; ramadan?: boolean } }>("/settings")
        .then(settings => {
          if (settings?.events) {
            const ny = Boolean(settings.events.newYear);
            const ram = Boolean(settings.events.ramadan);
            setNewYear(ny);
            setRamadan(ram);
            localStorage.setItem("oxford-events-settings", JSON.stringify({ newYear: ny, ramadan: ram }));
          }
        })
        .catch(() => undefined);
    };

    loadEvent();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "oxford-settings-changed" || e.key === "oxford-events-settings") {
        try {
          const cached = localStorage.getItem("oxford-events-settings");
          if (cached) {
            const parsed = JSON.parse(cached);
            if (typeof parsed.newYear === "boolean") setNewYear(parsed.newYear);
            if (typeof parsed.ramadan === "boolean") setRamadan(parsed.ramadan);
          }
        } catch {}
        loadEvent();
      }
    };

    window.addEventListener("oxford-settings-changed", loadEvent);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("oxford-settings-changed", loadEvent);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const login = (nextUser: ApiUser) => {
    setUser(nextUser);
    const returnPage = localStorage.getItem("oxford-return-page") || "overview";
    setActivePage(returnPage);
    localStorage.removeItem("oxford-return-page");
    setLocation(pageToPath(returnPage));
  };
  const logout = () => {
    localStorage.removeItem("tafra-page");
    clearApiToken();
    void apiLogout().catch(() => undefined);
    setUser(null);
    setLocation("/login");
  };
  const navigate = (page: string) => {
    localStorage.setItem("tafra-page", page);
    setActivePage(page);
    const targetPath = pageToPath(page);
    if (location !== targetPath) {
      setLocation(targetPath);
    }
  };

  if (checkingSession) return null;
  const content =
    location === "/setup" ? (
      <Setup />
    ) : location === "/login" && !user ? (
      <Login onLogin={login} />
    ) : !user ? (
      <VisitorHome onLogin={() => setLocation("/login")} />
    ) : location === "/404" ? (
      <NotFound />
    ) : (
      <Home
        user={user}
        role={user.role}
        activePage={activePage}
        onNavigate={navigate}
        onLogout={logout}
        onUserChange={setUser}
      />
    );
  return (
    <div className={`${newYear ? "festive-mode" : ""} ${ramadan ? "ramadan-mode" : ""}`}>
      <button
        className="theme-toggle"
        type="button"
        onClick={toggleTheme}
        aria-label={
          theme === "dark" ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"
        }
        title={theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}
      >
        {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
      </button>
      {newYear && <SeasonalEffects />}
      {ramadan && <RamadanEffects />}
      {content}
    </div>
  );
}

function SeasonalEffects() {
  useEffect(() => {
    const canvas = document.getElementById(
      "festive-snow-canvas"
    ) as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId: number;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    const flakes = Array.from({ length: 90 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: 1.2 + Math.random() * 3.5,
      speed: 0.4 + Math.random() * 1.2,
      drift: (Math.random() - 0.5) * 0.6,
      opacity: 0.18 + Math.random() * 0.55,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.012 + Math.random() * 0.018,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      flakes.forEach(f => {
        f.wobble += f.wobbleSpeed;
        f.x += f.drift + Math.sin(f.wobble) * 0.4;
        f.y += f.speed;
        if (f.y > canvas.height + 10) {
          f.y = -10;
          f.x = Math.random() * canvas.width;
        }
        if (f.x > canvas.width + 10) f.x = -10;
        if (f.x < -10) f.x = canvas.width + 10;
        ctx.save();
        ctx.globalAlpha = f.opacity;
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
        g.addColorStop(0, "#ffffff");
        g.addColorStop(0.5, "#ddeeff");
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const bulbs = Array.from({ length: 25 });
  
  return (
    <div className="seasonal-effects" aria-hidden="true">
      {/* 1. Snow Canvas */}
      <canvas id="festive-snow-canvas" className="festive-snow-canvas" />

      {/* 2. Magical Aurora Sky & Frost 
          Replaces the ugly solid green block with glowing elegant northern lights. */}
      <div className="aurora-sky" />
      <div className="window-frost" />

      {/* 3. Smooth String Lights with Electric Wires (CSS Scallops perfectly aligned) */}
      <div className="elegant-string-lights">
        <div className="wire-scallops" />
        {Array.from({ length: 21 }).map((_, i) => (
          <i
            key={i}
            className={`light-bulb color-${i % 6}`}
            style={{ 
              left: `calc(${(i * 5) + 2.5}% - 4px)`, /* Exactly aligns with 5% background-size loops */
              top: `33px`, /* Exact bottom curve of the scallops */
              animationDelay: `${i * -0.17}s` 
            }}
          />
        ))}
      </div>

      {/* 4. Real 3D Transparent Christmas Trees (Icons8 CDN - Highly Reliable) */}
      <div className="real-tree-left">
        <img 
          src="https://img.icons8.com/3d-fluency/512/christmas-tree.png" 
          alt="Christmas Tree" 
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <div className="tree-glow-aura" />
      </div>
      <div className="real-tree-right">
        <img 
          src="https://img.icons8.com/3d-fluency/512/christmas-tree.png" 
          alt="Christmas Tree" 
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <div className="tree-glow-aura" />
      </div>

      {/* 5. Floating Magic Bokeh Sparkles */}
      <div className="magic-sparkles">
        {Array.from({ length: 20 }, (_, i) => (
          <span
            key={i}
            className={`m-sparkle speed-${i % 3}`}
            style={{
              left: `${(i * 13 + 5) % 95}%`,
              top: `${(i * 29 + 10) % 80}%`,
              animationDelay: `${i * 0.22}s`,
              transform: `scale(${0.5 + (i % 5) * 0.2})`
            }}
          />
        ))}
      </div>

      {/* 6. Flying Santa Sleigh Silhoutte (Professional SVG Vector, positioned right under lights) */}
      <div className="flying-sleigh">
        <div className="sleigh-group">
          <img src="https://api.iconify.design/mdi/deer.svg?color=white" className="deer" alt="" />
          <img src="https://api.iconify.design/mdi/deer.svg?color=white" className="deer" alt="" />
          <img src="https://api.iconify.design/mdi/sleigh.svg?color=white" className="sled" alt="" />
        </div>
      </div>

      {/* 7. Festive Badge - Adjusted for Elegance */}
      <div className="seasonal-badge premium-badge">
        <span className="gold-seal">26</span>
        <div className="badge-text">
          <b>سنة ميلادية سعيدة</b>
          <small>أطيب الأمنيات للعام الجديد</small>
        </div>
      </div>
    </div>
  );
}

function RamadanEffects() {
  const canvasRef = useEffect(() => {
    const canvas = document.getElementById(
      "ramadan-stars-canvas"
    ) as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId: number;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    
    // Create magical dust and twinkling 4-point stars!
    const particles = Array.from({ length: 100 }, (_, i) => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: 1 + Math.random() * 2,
      speed: 0.1 + Math.random() * 0.4,
      opacity: 0.1 + Math.random() * 0.8,
      shineDir: Math.random() > 0.5 ? 1 : -1,
      isStar: i % 5 === 0, // 20% are majestic 4-point stars
      angle: Math.random() * Math.PI
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.y -= p.speed;
        p.opacity += 0.006 * p.shineDir;
        p.angle += 0.005;
        if (p.opacity >= 1) p.shineDir = -1;
        if (p.opacity <= 0.1) p.shineDir = 1;
        if (p.y < -20) { p.y = canvas.height + 20; p.x = Math.random() * canvas.width; }
        
        ctx.shadowBlur = p.isStar ? 15 : 10;
        ctx.shadowColor = "#f5c542";
        ctx.fillStyle = `rgba(245, 197, 66, ${p.opacity})`;

        if (p.isStar) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          ctx.beginPath();
          ctx.moveTo(0, -p.r * 4);
          ctx.quadraticCurveTo(0, 0, p.r * 4, 0);
          ctx.quadraticCurveTo(0, 0, 0, p.r * 4);
          ctx.quadraticCurveTo(0, 0, -p.r * 4, 0);
          ctx.quadraticCurveTo(0, 0, 0, -p.r * 4);
          ctx.fill();
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);
  void canvasRef;

  return (
    <>
      <div className="ramadan-effects" aria-hidden="true">
        <canvas id="ramadan-stars-canvas" className="ramadan-stars-canvas" />

        {/* Majestic Egyptian Crescent & Star */}
        <div className="egyptian-crescent">
          <div className="crescent-shape" />
          <div className="hanging-crescent-star">✦</div>
        </div>

        {/* Hanging Fanoos Lanterns (Authentic Egyptian Shape) */}
        <div className="hanging-lanterns">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className={`lantern-string r-loc-${i}`}>
              <div className="wire-drop" />
              <div className="egyptian-fanoos">
                <svg viewBox="0 0 100 200" width="100%" height="100%" filter="drop-shadow(0 0 20px rgba(245, 197, 66, 0.9))">
                    <circle cx="50" cy="15" r="8" fill="none" stroke="#d4af37" strokeWidth="4" />
                    <polygon points="45,23 55,23 70,55 30,55" fill="#d4af37" />
                    <polygon points="30,55 70,55 85,140 15,140" fill="rgba(245, 197, 66, 0.35)" stroke="#d4af37" strokeLinejoin="round" strokeWidth="5" />
                    <polygon points="15,140 85,140 60,185 40,185" fill="#d4af37" />
                    <polygon points="40,185 60,185 75,200 25,200" fill="#d4af37" />
                    <circle cx="50" cy="98" r="16" fill="#fff" filter="blur(4px)" />
                    <path d="M 30,55 L 15,140 M 70,55 L 85,140" stroke="#b8860b" strokeWidth="2" opacity="0.8"/>
                    <path d="M 50,55 L 50,140" stroke="#d4af37" strokeWidth="3" opacity="0.9"/>
                    <path d="M 30,55 L 50,140 M 70,55 L 50,140" stroke="#b8860b" strokeWidth="1" opacity="0.6"/>
                </svg>
              </div>
            </div>
          ))}
        </div>

        {/* Majestic Cairo Skyline Silhouette */}
        <div className="cairo-skyline">
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className="skyline-mosque">🕌</span>
          ))}
        </div>
      </div>

      {/* Khayamiya Bunting Decoration - Pulled out to stay on TOP of the Header */}
      <div className="khayamiya-bunting" aria-hidden="true">
        {Array.from({ length: 50 }).map((_, i) => (
          <div key={i} className={`k-triangle k-color-${i % 4}`} />
        ))}
      </div>

      {/* Premium Ramadan Badge - Rendered outside effects layer to stay on top */}
      <div className="seasonal-badge premium-badge ramadan-badge">
        <span className="gold-seal">1447</span>
        <div className="badge-text" style={{ display: 'flex', flexDirection: 'column', whiteSpace: 'nowrap' }}>
          <b>رمضان مبارك</b>
          <small>أعاده الله عليكم باليمن والبركات</small>
        </div>
      </div>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="light" switchable>
      <TooltipProvider>
        <Toaster position="bottom-left" />
        <Switch>
          <Route path="*">
            <AppRouter />
          </Route>
        </Switch>
      </TooltipProvider>
    </ThemeProvider>
  );
}
