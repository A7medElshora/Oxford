import { useEffect, useState } from "react";
import { Plus, Trash2, Save, QrCode, Link, Phone, FileText, ToggleLeft, ToggleRight, CreditCard } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import ImageCropDialog from "@/components/ImageCropDialog";
import { CardSkeleton } from "@/components/ui/skeleton";

type PaymentMethod = {
  id: string;
  name: string;
  type: string;
  walletNumber?: string;
  paymentLink?: string;
  qrCodeUrl?: string;
  instructions?: string;
  active: boolean;
  createdAt: string;
};

const PAYMENT_TYPES = [
  { value: "INSTAPAY", label: "انستاباي" },
  { value: "VODAFONE_CASH", label: "فودافون كاش" },
  { value: "ETISALAT_CASH", label: "اتصالات كاش" },
  { value: "ORANGE_CASH", label: "أورنج كاش" },
  { value: "BANK_TRANSFER", label: "تحويل بنكي" },
  { value: "CUSTOM", label: "أخرى" },
];

export const PAYMENT_TYPE_LABEL: Record<string, string> = {
  INSTAPAY: "انستاباي",
  VODAFONE_CASH: "فودافون كاش",
  ETISALAT_CASH: "اتصالات كاش",
  ORANGE_CASH: "أورنج كاش",
  BANK_TRANSFER: "تحويل بنكي",
  CUSTOM: "أخرى",
};

export const PAYMENT_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  INSTAPAY: { bg: "#fff0f6", color: "#d6336c" },
  VODAFONE_CASH: { bg: "#fff5ef", color: "#d63031" },
  ETISALAT_CASH: { bg: "#f0fff4", color: "#00b894" },
  ORANGE_CASH: { bg: "#fff9e6", color: "#e17055" },
  BANK_TRANSFER: { bg: "#eef6ff", color: "#1a72d5" },
  CUSTOM: { bg: "#f5f5f5", color: "#636e72" },
};

type FormState = {
  name: string;
  type: string;
  walletNumber: string;
  paymentLink: string;
  qrCodeUrl: string;
  instructions: string;
  active: boolean;
};

const emptyForm: FormState = {
  name: "",
  type: "VODAFONE_CASH",
  walletNumber: "",
  paymentLink: "",
  qrCodeUrl: "",
  instructions: "",
  active: true,
};

export default function AdminPaymentMethodsManager() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api<PaymentMethod[]>("/payment-methods");
      setMethods(data);
    } catch {
      toast.error("تعذر تحميل طرق الدفع");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const startEdit = (method: PaymentMethod) => {
    setEditingId(method.id);
    setForm({
      name: method.name,
      type: method.type,
      walletNumber: method.walletNumber || "",
      paymentLink: method.paymentLink || "",
      qrCodeUrl: method.qrCodeUrl || "",
      instructions: method.instructions || "",
      active: method.active,
    });
    setShowForm(true);
  };

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("اسم طريقة الدفع مطلوب"); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        walletNumber: form.walletNumber.trim() || undefined,
        paymentLink: form.paymentLink.trim() || undefined,
        qrCodeUrl: form.qrCodeUrl || undefined,
        instructions: form.instructions.trim() || undefined,
        active: form.active,
      };
      if (editingId) {
        const updated = await api<PaymentMethod>(`/payment-methods/${editingId}`, { method: "PATCH", body: JSON.stringify(payload) });
        setMethods(prev => prev.map(m => m.id === editingId ? updated : m));
        toast.success("تم تحديث طريقة الدفع");
      } else {
        const created = await api<PaymentMethod>("/payment-methods", { method: "POST", body: JSON.stringify(payload) });
        setMethods(prev => [...prev, created]);
        toast.success("تمت إضافة طريقة الدفع");
      }
      cancelEdit();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ طريقة الدفع");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف "${name}"؟`)) return;
    try {
      await api(`/payment-methods/${id}`, { method: "DELETE" });
      setMethods(prev => prev.filter(m => m.id !== id));
      toast.success("تم حذف طريقة الدفع");
    } catch {
      toast.error("تعذر حذف طريقة الدفع");
    }
  };

  const handleToggleActive = async (method: PaymentMethod) => {
    try {
      const updated = await api<PaymentMethod>(`/payment-methods/${method.id}`, { method: "PATCH", body: JSON.stringify({ active: !method.active }) });
      setMethods(prev => prev.map(m => m.id === method.id ? updated : m));
    } catch {
      toast.error("تعذر تحديث الحالة");
    }
  };

  if (loading) {
    return <div style={{ padding: "60px", textAlign: "center", color: "var(--ink-muted)" }}>جاري تحميل طرق الدفع…</div>;
  }

  const typeColors = PAYMENT_TYPE_COLORS[form.type] || PAYMENT_TYPE_COLORS.CUSTOM;

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow" style={{ color: "var(--primary)" }}>ADMIN / PAYMENT METHODS</span>
          <h1>طرق الدفع</h1>
          <p>أضف وسائل الدفع التي سيراها الطلاب في فورم الاشتراك (انستاباي، فودافون كاش، تحويل بنكي…)، وحدد البيانات لكل وسيلة.</p>
        </div>
        <button className="primary-btn" onClick={startCreate}>
          <Plus size={16} /> إضافة طريقة دفع
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="paper-card" style={{ marginBottom: "24px", borderTop: `3px solid ${typeColors.color}` }}>
          <div style={{ marginBottom: "18px" }}>
            <span className="eyebrow">{editingId ? "تعديل" : "إضافة"} طريقة دفع</span>
            <h2 style={{ margin: 0, fontSize: "17px" }}>{editingId ? "تعديل بيانات طريقة الدفع" : "طريقة دفع جديدة"}</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <label className="form-field">
              <span>اسم طريقة الدفع</span>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="مثال: فودافون كاش – المدرس أحمد"
              />
            </label>
            <label className="form-field">
              <span>نوع وسيلة الدفع</span>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {PAYMENT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>رقم المحفظة / الحساب</span>
              <input
                value={form.walletNumber}
                onChange={e => setForm(f => ({ ...f, walletNumber: e.target.value }))}
                placeholder="01xxxxxxxxx أو رقم الحساب"
                dir="ltr"
              />
            </label>
            <label className="form-field">
              <span>رابط الدفع (اختياري)</span>
              <input
                value={form.paymentLink}
                onChange={e => setForm(f => ({ ...f, paymentLink: e.target.value }))}
                placeholder="https://..."
                dir="ltr"
              />
            </label>
          </div>

          <label className="form-field" style={{ marginTop: "12px" }}>
            <span>تعليمات / ملاحظات (اختياري)</span>
            <textarea
              value={form.instructions}
              onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
              placeholder="اكتب أي تعليمات إضافية للطالب عند اختيار هذه الطريقة..."
              rows={2}
              style={{ resize: "vertical" }}
            />
          </label>

          <label className="form-field" style={{ marginTop: "12px" }}>
            <span>باركود الدفع (اختياري)</span>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer", background: "var(--surface)", border: "1.5px dashed var(--border)", borderRadius: "10px", padding: "8px 16px", fontSize: "13px", fontWeight: 600 }}>
                <QrCode size={16} />
                {form.qrCodeUrl ? "تغيير الباركود" : "رفع صورة الباركود"}
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) setCropFile(file);
                }} />
              </label>
              {form.qrCodeUrl && (
                <div style={{ position: "relative" }}>
                  <img src={form.qrCodeUrl} alt="QR Code" style={{ width: 80, height: 80, objectFit: "contain", borderRadius: "8px", border: "1px solid var(--border)" }} />
                  <button type="button" onClick={() => setForm(f => ({ ...f, qrCodeUrl: "" }))} style={{ position: "absolute", top: -6, right: -6, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                </div>
              )}
            </div>
          </label>

          <label className="switch-row" style={{ marginTop: "12px" }}>
            <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
            <span>طريقة الدفع مفعّلة وظاهرة للطلاب</span>
          </label>

          <div style={{ display: "flex", gap: "12px", marginTop: "18px" }}>
            <button className="primary-btn" onClick={() => void handleSave()} disabled={saving}>
              <Save size={15} />{saving ? "جارٍ الحفظ..." : editingId ? "حفظ التعديلات" : "إضافة طريقة الدفع"}
            </button>
            <button className="secondary-btn" onClick={cancelEdit} disabled={saving}>إلغاء</button>
          </div>
        </div>
      )}

      {/* Methods List */}
      {loading ? (
        <CardSkeleton count={4} />
      ) : methods.length === 0 && !showForm ? (
        <div className="paper-card" style={{ padding: "60px", textAlign: "center", color: "var(--ink-muted)" }}>
          <CreditCard size={40} style={{ opacity: 0.3, marginBottom: "12px" }} />
          <p>لم تُضف أي طريقة دفع حتى الآن.</p>
          <button className="primary-btn" style={{ marginTop: "12px" }} onClick={startCreate}>
            <Plus size={15} /> إضافة أول طريقة دفع
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
          {methods.map(method => {
            const colors = PAYMENT_TYPE_COLORS[method.type] || PAYMENT_TYPE_COLORS.CUSTOM;
            return (
              <div key={method.id} className="paper-card" style={{ padding: "18px", borderTop: `3px solid ${colors.color}`, opacity: method.active ? 1 : 0.6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                  <div>
                    <span style={{ display: "inline-block", background: colors.bg, color: colors.color, padding: "2px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, marginBottom: "4px" }}>
                      {PAYMENT_TYPE_LABEL[method.type] || method.type}
                    </span>
                    <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700 }}>{method.name}</h3>
                  </div>
                  <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                    <button title={method.active ? "إيقاف" : "تفعيل"} style={{ background: "none", border: "none", cursor: "pointer", color: method.active ? "#10b981" : "#94a3b8", padding: "2px" }} onClick={() => void handleToggleActive(method)}>
                      {method.active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                    </button>
                    <button className="secondary-btn" style={{ padding: "3px 8px", fontSize: "12px" }} onClick={() => startEdit(method)}>تعديل</button>
                    <button className="icon-btn" title="حذف" onClick={() => void handleDelete(method.id, method.name)} style={{ color: "#ef4444" }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "12px" }}>
                  {method.walletNumber && (
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <Phone size={12} style={{ color: colors.color, flexShrink: 0 }} />
                      <span dir="ltr" style={{ fontFamily: "monospace", fontWeight: 700 }}>{method.walletNumber}</span>
                    </div>
                  )}
                  {method.paymentLink && (
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <Link size={12} style={{ color: colors.color, flexShrink: 0 }} />
                      <a href={method.paymentLink} target="_blank" rel="noreferrer" style={{ color: colors.color, textDecoration: "underline", wordBreak: "break-all" }}>
                        {method.paymentLink.length > 35 ? method.paymentLink.slice(0, 35) + "…" : method.paymentLink}
                      </a>
                    </div>
                  )}
                  {method.qrCodeUrl && (
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <QrCode size={12} style={{ color: colors.color, flexShrink: 0 }} />
                      <img src={method.qrCodeUrl} alt="QR" style={{ width: 48, height: 48, objectFit: "contain", borderRadius: "6px", border: "1px solid var(--border)" }} />
                    </div>
                  )}
                  {method.instructions && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "5px", color: "var(--ink-muted)" }}>
                      <FileText size={12} style={{ color: colors.color, flexShrink: 0, marginTop: "2px" }} />
                      <span>{method.instructions}</span>
                    </div>
                  )}
                </div>

                {!method.active && (
                  <div style={{ marginTop: "8px", background: "#f8fafc", color: "#94a3b8", borderRadius: "6px", padding: "3px 10px", fontSize: "11px", textAlign: "center" }}>
                    موقوفة — لا تظهر للطلاب
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {cropFile && (
        <ImageCropDialog
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onComplete={value => { setForm(f => ({ ...f, qrCodeUrl: value })); setCropFile(null); }}
        />
      )}
    </>
  );
}
