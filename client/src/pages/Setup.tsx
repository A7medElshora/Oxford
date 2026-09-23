import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, LockKeyhole, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { apiSetupPrimaryAdmin, apiSetupStatus } from "@/lib/api";
import { motion } from "framer-motion";

export default function Setup() {
  const [, setLocation] = useLocation();
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [bootstrapSecret, setBootstrapSecret] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiSetupStatus()
      .then((res) => setSetupRequired(res.setupRequired))
      .catch(() => setSetupRequired(false))
      .finally(() => setLoadingStatus(false));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }
    if (!bootstrapSecret.trim()) {
      toast.error("يرجى إدخال رمز حماية الإعداد (Bootstrap Secret)");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiSetupPrimaryAdmin({
        name,
        email,
        phone: phone || undefined,
        password,
        bootstrapSecret: bootstrapSecret.trim(),
      });
      toast.success(res.message || "تم إنشاء الأدمن الرئيسي بنجاح! يمكنك الآن تسجيل الدخول.");
      setSetupRequired(false);
      setTimeout(() => setLocation("/login"), 1500);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إكمال عملية الإعداد الأولية");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingStatus) {
    return (
      <main className="login-page">
        <div className="login-panel-inner" style={{ margin: "auto", textAlign: "center" }}>
          <p className="eyebrow">OXFORD INITIAL SETUP</p>
          <h2>جارٍ التحقق من حالة النظام...</h2>
        </div>
      </main>
    );
  }

  return (
    <main className="login-page">
      <section className="login-art">
        <div className="art-paper">
          <span className="eyebrow">OXFORD / SYSTEM BOOTSTRAP</span>
          <img className="login-hero-image" src="/assets/learning.png" alt="إعداد النظام الأول" />
        </div>
        <div className="art-copy">
          <div className="brand-mark large">
            <img src="/assets/platform-logo.png" alt="Oxford Learning Platform" />
          </div>
          <p className="eyebrow">ADMINISTRATOR BOOTSTRAP</p>
          <h1>تهيئة النظام<br /><em>وإنشاء الأدمن الرئيسي الأول.</em></h1>
          <p>تُنفَّذ هذه الخطوة مرة واحدة فقط عند إعداد منصة Oxford التعليمية للمرة الأولى.</p>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-panel-inner">
          <div className="brand-lockup">
            <div className="brand-mark">
              <img src="/assets/platform-logo.png" alt="Oxford Learning Platform" />
            </div>
            <div>
              <strong className="festive-wordmark">Oxford</strong>
              <small>إعداد حساب الأدمن الرئيسي</small>
            </div>
          </div>

          {!setupRequired ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ textAlign: "center", padding: "2rem 0" }}
            >
              <div style={{ display: "inline-flex", padding: "1rem", borderRadius: "50%", background: "rgba(16, 185, 129, 0.1)", color: "#10b981", marginBottom: "1rem" }}>
                <ShieldCheck size={48} />
              </div>
              <h2>النظام مهيأ بالفعل</h2>
              <p style={{ marginTop: "0.5rem", color: "var(--muted, #666)" }}>
                تم تعيين الأدمن الرئيسي الأول سابقًا. تم إغلاق صفحة الإعداد تلقائيًا لحماية الأمان.
              </p>
              <button
                type="button"
                className="primary-btn wide"
                style={{ marginTop: "2rem" }}
                onClick={() => setLocation("/login")}
              >
                الذهاب لصفحة تسجيل الدخول
                <ArrowLeft size={17} />
              </button>
            </motion.div>
          ) : (
            <div>
              <div className="form-heading">
                <span className="eyebrow">OXFORD INITIAL SETUP</span>
                <h2>إنشاء أول Primary Admin</h2>
                <p>أدخل بيانات الحساب ورمز حماية الإعداد (PRIMARY_ADMIN_BOOTSTRAP_SECRET).</p>
              </div>

              <form onSubmit={handleSubmit} noValidate>
                <label>
                  الاسم بالكامل
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: د. أحمد المحمود"
                    required
                  />
                </label>

                <label>
                  البريد الإلكتروني للأدمن
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                    required
                  />
                </label>

                <label>
                  رقم الهاتف <small>(اختياري)</small>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01012345678"
                  />
                </label>

                <label>
                  كلمة المرور
                  <div className="password-field">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label="إظهار كلمة المرور"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>

                <label>
                  تأكيد كلمة المرور
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </label>

                <label>
                  رمز حماية الإعداد (Bootstrap Secret)
                  <input
                    type="password"
                    value={bootstrapSecret}
                    onChange={(e) => setBootstrapSecret(e.target.value)}
                    placeholder="أدخل قيمة PRIMARY_ADMIN_BOOTSTRAP_SECRET"
                    required
                  />
                </label>

                <button className="primary-btn wide" disabled={submitting}>
                  {submitting ? "جارٍ إنشاء الحساب..." : "إنشاء Primary Admin"}
                  <ArrowLeft size={17} />
                </button>
              </form>

              <p className="login-note" style={{ marginTop: "1rem" }}>
                <LockKeyhole size={14} /> يتم تعطيل هذا الرابط فور إنشاء الأدمن الأول.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
