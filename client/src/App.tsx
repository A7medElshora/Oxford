/* Oxford Learning Platform: RTL paper-card education UI, Oxford Orange and Ink Black, restrained motion. */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useEffect, useMemo, useState } from "react";
import { Route, Switch, useLocation } from "wouter";
import Home from "./pages/Home";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import VisitorHome from "./pages/VisitorHome";

function AppRouter() {
  const [location, setLocation] = useLocation();
  const [role, setRole] = useState<string | null>(() => localStorage.getItem("tafra-role"));
  const [activePage, setActivePage] = useState(() => localStorage.getItem("tafra-page") || "overview");

  useEffect(() => {
    const sync = () => setRole(localStorage.getItem("tafra-role"));
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const login = (nextRole: string) => {
    localStorage.setItem("tafra-role", nextRole);
    setRole(nextRole);
    setActivePage(localStorage.getItem("oxford-return-page") || "overview");
    localStorage.removeItem("oxford-return-page");
  };
  const logout = () => {
    localStorage.removeItem("tafra-role");
    localStorage.removeItem("tafra-page");
    setRole(null);
  };
  const navigate = (page: string) => {
    localStorage.setItem("tafra-page", page);
    setActivePage(page);
  };

  if (location === "/login" && !role) return <Login onLogin={login} />;
  if (!role) return <VisitorHome onLogin={() => setLocation("/login")} />;
  if (location === "/404") return <NotFound />;
  return <Home role={role as "student" | "admin" | "teacher"} activePage={activePage} onNavigate={navigate} onLogout={logout} />;
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="light">
      <TooltipProvider>
        <Toaster position="bottom-left" />
        <Switch><Route path="*"><AppRouter /></Route></Switch>
      </TooltipProvider>
    </ThemeProvider>
  );
}
