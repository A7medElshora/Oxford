import { FormEvent, useState } from "react";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Upload } from "lucide-react";
import { toast } from "sonner";
import { apiLogin, apiRegister, setApiToken, type ApiUser, type Role } from "@/lib/api";

import { motion, AnimatePresence } from "framer-motion";
import { compressImage } from "@/lib/image";
import ImageCropDialog from "@/components/ImageCropDialog";

const roleLabels: Record<Role, string> = { student: "طالب", teacher: "مدرس", admin: "أدمن" };
const grades = ["الأول الإعدادي", "الثاني الإعدادي", "الثالث الإعدادي", "الأول الثانوي", "الثاني الثانوي", "الثالث الثانوي"];

const flipVariants = {
  initial: (isLogin: boolean) => ({
    rotateY: isLogin ? -90 : 90,
    opacity: 0,
    filter: "blur(3px)"
  }),
  animate: {
    rotateY: 0,
    opacity: 1,
    filter: "blur(0px)",
    transition: { type: "spring" as const, stiffness: 75, damping: 14, mass: 0.9 }
  },
  exit: (isLogin: boolean) => ({
    rotateY: isLogin ? 90 : -90,
    opacity: 0,
    filter: "blur(3px)",
    transition: { type: "spring" as const, stiffness: 75, damping: 14, mass: 0.9 }
  })
};

export default function Login({ onLogin }: { onLogin: (user: ApiUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [role, setRole] = useState<Role>("student");
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [grade, setGrade] = useState(grades[0]);
  const [subject, setSubject] = useState("");
  const [teacherGrades, setTeacherGrades] = useState<string[]>([]);
  const [avatar, setAvatar] = useState("");
  const [adminInviteCode, setAdminInviteCode] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);

  const resetRegistration = (nextRole: Role) => { setRole(nextRole); setTeacherGrades([]); setAvatar(""); };
  const readAvatar = async (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الصورة كبير جداً، يرجى اختيار صورة أصغر (الحد الأقصى 5 ميجابايت)");
      return;
    }
    setCropFile(file);
  };
  const toggleTeacherGrade = (item: string) => setTeacherGrades(current => current.includes(item) ? current.filter(value => value !== item) : [...current, item]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const result = await apiLogin(identifier, password);
        setApiToken(result.token);
        onLogin(result.user);
        toast.success("تم تسجيل الدخول بنجاح");
      } else {
        if (avatar.length > 700_000) {
          throw new Error("حجم الصورة كبير جداً، يرجى اختيار صورة أصغر");
        }
        const payload = { name, email: identifier, password, role, phone: role === "student" ? phone : undefined, parentPhone: role === "student" ? parentPhone : undefined, grade: role === "student" ? grade : undefined, subject: role === "teacher" ? subject : undefined, grades: role === "teacher" ? teacherGrades : undefined, avatar: avatar || undefined, adminInviteCode: role === "admin" ? adminInviteCode : undefined };
        const result = await apiRegister(payload);
        if (result.token) {
          setApiToken(result.token);
          onLogin(result.user);
          toast.success("تم إنشاء الحساب بنجاح");
        } else {
          toast.success(result.message || "حسابك قيد المراجعة", { duration: 5000 });
          setMode("login");
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إتمام العملية");
    } finally { setLoading(false); }
  };
  
  const isLogin = mode === "login";

  return <><main className="login-page">
    <section className="login-art"><div className="art-paper"><span className="eyebrow">OXFORD / LEARNING PLATFORM</span><img className="login-hero-image" src="/assets/learning.png" alt="طالبة تذاكر في مساحة تعليمية" /><div className="art-caption"><b>ملاحظات اليوم</b><span>درس واحد · 24 دقيقة</span><i /></div></div><div className="art-copy"><div className="brand-mark large"><img src="/assets/platform-logo.png" alt="Oxford Learning Platform" /></div><p className="eyebrow">A QUIETER WAY TO LEARN</p><h1>مساحة أهدأ<br /><em>للتعلّم والتقدّم.</em></h1><p>رتّب يومك، تابع حضورك، وارجع إلى الدرس التالي بثقة.</p><div className="art-stats"><span><strong>24k+</strong> طالب</span><span><strong>320</strong> مدرس</span></div></div></section>
    <section className="login-panel"><div className="login-panel-inner"><div className="brand-lockup"><div className="brand-mark"><img src="/assets/platform-logo.png" alt="Oxford Learning Platform" /></div><div><strong className="festive-wordmark">Oxford</strong><small>تعليم يتحرّك معك</small></div></div><div className="auth-mode"><button type="button" className={isLogin ? "active" : ""} onClick={() => setMode("login")}>تسجيل الدخول</button><button type="button" className={!isLogin ? "active" : ""} onClick={() => setMode("register")}>إنشاء حساب</button></div>
      <div style={{ perspective: "1800px", width: "100%", position: "relative" }}>
        <AnimatePresence mode="wait" custom={isLogin}>
          <motion.div
            key={mode}
            custom={isLogin}
            variants={flipVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ transformOrigin: "right center", backfaceVisibility: "hidden", width: "100%" }}
          >
            <div className="form-heading"><span className="eyebrow">{isLogin ? "مرحبًا بعودتك" : "حساب جديد"}</span><h2>{isLogin ? "سجّل الدخول إلى مساحتك" : "أنشئ حسابك التعليمي"}</h2><p>{isLogin ? "أدخل بريدك أو رقم هاتفك للمتابعة." : "اختر دورك، ثم أكمل البيانات الخاصة به."}</p></div>
            <form onSubmit={submit} noValidate>
              {!isLogin && <><label>الاسم بالكامل<input value={name} onChange={e => setName(e.target.value)} required /></label><div className="role-picker" aria-label="اختيار الدور">{(Object.keys(roleLabels) as Role[]).map(item => <button type="button" key={item} className={role === item ? "active" : ""} onClick={() => resetRegistration(item)}><span className={`role-dot ${item}`} />{roleLabels[item]}</button>)}</div></>}
              {!isLogin && role === "student" && <div className="register-fields"><label>رقم الهاتف<input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required /></label><label>رقم ولي الأمر<input type="tel" value={parentPhone} onChange={e => setParentPhone(e.target.value)} required /></label><label>الصف الدراسي<select value={grade} onChange={e => setGrade(e.target.value)}>{grades.map(item => <option key={item}>{item}</option>)}</select></label></div>}
              {!isLogin && role === "teacher" && <div className="register-fields"><label>المادة التي تدرسها<input value={subject} onChange={e => setSubject(e.target.value)} required placeholder="مثل: الرياضيات" /></label><fieldset><legend>الصفوف الدراسية</legend><div className="grade-checks">{grades.map(item => <label key={item}><input type="checkbox" checked={teacherGrades.includes(item)} onChange={() => toggleTeacherGrade(item)} />{item}</label>)}</div></fieldset></div>}
              {!isLogin && role === "admin" && <label>كود دعوة الأدمن<input value={adminInviteCode} onChange={e => setAdminInviteCode(e.target.value)} required placeholder="يقدمه الأدمن الرئيسي" /></label>}
              {!isLogin && <label className="avatar-upload"><span>صورة شخصية <small>(اختياري - الحد الأقصى 5 ميجابايت)</small></span><input type="file" accept="image/*" onChange={e => { void readAvatar(e.target.files?.[0]); }} /><span className="upload-hint"><Upload size={15} /> {avatar ? "تم اختيار الصورة" : "اختر صورة"}</span></label>}
              <label>{isLogin ? "البريد الإلكتروني أو رقم الهاتف" : "البريد الإلكتروني"}<input type={isLogin ? "text" : "email"} value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder={isLogin ? "student@demo.com أو 01012345678" : "name@example.com"} required /></label>
              <label>كلمة المرور<div className="password-field"><input type={show ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} minLength={!isLogin ? 6 : undefined} required /><button type="button" onClick={() => setShow(!show)} aria-label="إظهار كلمة المرور">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
              {isLogin && <div className="form-row"><label className="check"><input type="checkbox" defaultChecked /> تذكرني</label><button type="button" className="text-button" onClick={() => toast.info("سيتم تفعيل استعادة كلمة المرور مع الـBackend")}>نسيت كلمة المرور؟</button></div>}
              <button className="primary-btn wide" disabled={loading}>{loading ? "جارٍ التنفيذ..." : isLogin ? "تسجيل الدخول" : "إنشاء الحساب"}<ArrowLeft size={17} /></button>
            </form>
            <p className="login-note"><LockKeyhole size={14} /> بياناتك محمية ولا يتم عرض كلمة المرور.</p>
          </motion.div>
        </AnimatePresence>
      </div></div></section>
  </main>{cropFile && <ImageCropDialog file={cropFile} onCancel={() => setCropFile(null)} onComplete={async value => { setCropFile(null); try { const response = await fetch(value); const cropped = new File([await response.blob()], cropFile.name, { type: "image/jpeg" }); setAvatar(await compressImage(cropped, { maxBytes: 110_000, maxDimension: 512 })); } catch (error) { toast.error("حجم الصورة كبير جداً، يرجى اختيار صورة أصغر"); } }} />}</>;
}
