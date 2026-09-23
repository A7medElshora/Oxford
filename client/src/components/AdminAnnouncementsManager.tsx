import { FormEvent, useEffect, useState, type ChangeEvent } from "react";
import { Image, Plus, Save, Trash2, Video } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { compressImage } from "@/lib/image";
import ImageCropDialog from "@/components/ImageCropDialog";

type Announcement = { id: string; kicker: string; title: string; body: string; cta: string; target: string; mediaType: "none" | "image" | "video"; mediaUrl?: string; published: boolean; sortOrder: number };
type Draft = Omit<Announcement, "id">;
const emptyDraft: Draft = { kicker: "OXFORD / ANNOUNCEMENT", title: "", body: "", cta: "اعرف المزيد", target: "courses", mediaType: "none", mediaUrl: "", published: true, sortOrder: 0 };
const targets = [{ value: "home", label: "الرئيسية" }, { value: "courses", label: "الكورسات" }, { value: "teachers", label: "المدرسون" }, { value: "lessons", label: "المحاضرات" }, { value: "exams", label: "الامتحانات" }, { value: "assignments", label: "الواجبات" }];

export default function AdminAnnouncementsManager() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const load = async () => { try { setItems(await api<Announcement[]>("/admin/announcements")); } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر تحميل الإعلانات"); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const chooseMedia = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const isVideo = file.type.startsWith("video/"); if (isVideo && file.size > 15 * 1024 * 1024) return toast.error("الفيديو يجب ألا يتجاوز 15 ميجابايت"); if (isVideo) { const reader = new FileReader(); reader.onload = () => setDraft(current => ({ ...current, mediaType: "video", mediaUrl: String(reader.result) })); reader.readAsDataURL(file); return; } setCropFile(file); };
  const save = async (event: FormEvent) => { event.preventDefault(); setSaving(true); try { const saved = editingId ? await api<Announcement>(`/admin/announcements/${editingId}`, { method: "PATCH", body: JSON.stringify(draft) }) : await api<Announcement>("/admin/announcements", { method: "POST", body: JSON.stringify(draft) }); setItems(current => editingId ? current.map(item => item.id === editingId ? saved : item) : [...current, saved].sort((a, b) => a.sortOrder - b.sortOrder)); setDraft(emptyDraft); setEditingId(null); toast.success("تم حفظ الإعلان"); } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر حفظ الإعلان"); } finally { setSaving(false); } };
  const remove = async (id: string) => { try { await api(`/admin/announcements/${id}`, { method: "DELETE" }); setItems(current => current.filter(item => item.id !== id)); toast.success("تم حذف الإعلان"); } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر حذف الإعلان"); } };
  const edit = (item: Announcement) => { setEditingId(item.id); setDraft({ kicker: item.kicker, title: item.title, body: item.body, cta: item.cta, target: item.target, mediaType: item.mediaType, mediaUrl: item.mediaUrl || "", published: item.published, sortOrder: item.sortOrder }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const update = (key: keyof Draft, value: string | boolean | number) => setDraft(current => ({ ...current, [key]: value }));
  return <><div className="admin-catalog-grid">
    <section className="paper-card admin-catalog-full">
      <div className="form-heading"><span className="eyebrow">ADMIN / HOMEPAGE SLIDER</span><h1>إعلانات الصفحة الرئيسية</h1><p>أضف نصاً وصورة أو فيديو قصيراً، ثم انشره ليظهر للزوار في الـ slider.</p></div>
      <form onSubmit={save} style={{ display: "grid", gap: "14px", marginTop: "20px" }}>
        <div className="form-three-col"><label className="form-field"><span>الشارة الصغيرة</span><input required value={draft.kicker} onChange={event => update("kicker", event.target.value)} /></label><label className="form-field"><span>زر الإعلان</span><input required value={draft.cta} onChange={event => update("cta", event.target.value)} /></label><label className="form-field"><span>الرابط عند الضغط</span><select value={draft.target} onChange={event => update("target", event.target.value)}>{targets.map(target => <option key={target.value} value={target.value}>{target.label}</option>)}</select></label></div>
        <label className="form-field"><span>عنوان الإعلان</span><input required value={draft.title} onChange={event => update("title", event.target.value)} /></label>
        <label className="form-field"><span>النص</span><textarea required rows={3} value={draft.body} onChange={event => update("body", event.target.value)} /></label>
        <div className="form-three-col"><label className="form-field"><span>نوع الوسائط</span><select value={draft.mediaType} onChange={event => update("mediaType", event.target.value)}><option value="none">بدون وسائط</option><option value="image">صورة</option><option value="video">فيديو قصير</option></select></label><label className="form-field"><span>رابط الوسائط أو ارفع ملفاً</span><input value={draft.mediaUrl} placeholder="https://..." onChange={event => update("mediaUrl", event.target.value)} /></label><label className="image-upload"><span>رفع {draft.mediaType === "video" ? "فيديو" : "صورة"}</span><input type="file" accept={draft.mediaType === "video" ? "video/*" : "image/*"} onChange={chooseMedia} /></label></div>
        <label className="check"><input type="checkbox" checked={draft.published} onChange={event => update("published", event.target.checked)} /> نشر الإعلان للزوار</label>
        <div style={{ display: "flex", gap: "10px" }}><button className="primary-btn" type="submit" disabled={saving}><Save size={15} /> {saving ? "جارٍ الحفظ..." : editingId ? "حفظ التعديل" : "إضافة الإعلان"}</button>{editingId && <button className="secondary-btn" type="button" disabled={saving} onClick={() => { setEditingId(null); setDraft(emptyDraft); }}>إلغاء</button>}</div>
      </form>
    </section>
    <section className="paper-card published-panel admin-catalog-full"><div className="card-title"><div><span className="eyebrow">LIVE SLIDES</span><h2>الإعلانات الحالية</h2></div><Plus size={17} /></div>{loading ? <p className="muted">جاري التحميل...</p> : items.map(item => <div className="published-row" key={item.id}><div style={{ display: "flex", alignItems: "center", gap: "10px" }}>{item.mediaType === "image" ? <Image size={17} /> : item.mediaType === "video" ? <Video size={17} /> : null}<div><strong>{item.title}</strong><small>{item.published ? "منشور للزوار" : "مخفي"} · {targets.find(target => target.value === item.target)?.label}</small></div></div><div style={{ display: "flex", gap: "8px" }}><button className="secondary-btn compact" type="button" onClick={() => edit(item)}>تعديل</button><button className="secondary-btn compact" type="button" onClick={() => void remove(item.id)}><Trash2 size={14} /></button></div></div>)}</section>
  </div>{cropFile && <ImageCropDialog file={cropFile} onCancel={() => setCropFile(null)} onComplete={value => { setDraft(current => ({ ...current, mediaType: "image", mediaUrl: value })); setCropFile(null); }} />}</>;
}
