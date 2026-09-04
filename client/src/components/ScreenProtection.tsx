import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export default function ScreenProtection() {
  const [away, setAway] = useState(false);

  useEffect(() => {
    const blockMenu = (event: MouseEvent) => event.preventDefault();
    const blockShortcut = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (event.key === "PrintScreen" || (event.ctrlKey && ["p", "s", "u"].includes(key)) || (event.ctrlKey && event.shiftKey && ["i", "j", "c"].includes(key))) {
        event.preventDefault();
        toast.error("المحتوى التعليمي محمي داخل مساحة التعلم.");
      }
    };
    const onVisibility = () => setAway(document.visibilityState === "hidden");
    document.addEventListener("contextmenu", blockMenu);
    window.addEventListener("keydown", blockShortcut);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("contextmenu", blockMenu);
      window.removeEventListener("keydown", blockShortcut);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <>
    <div className="screen-watermark" aria-hidden="true">OXFORD · PRIVATE LEARNING</div>
    {away && <div className="screen-away" role="status"><ShieldAlert size={28} /><strong>المحتوى محمي</strong><span>ارجع إلى نافذة التعلم للمتابعة.</span></div>}
  </>;
}
