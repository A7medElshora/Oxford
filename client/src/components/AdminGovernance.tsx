import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, PauseCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { dateInput, isSubscriptionActive, readGovernance, writeGovernance, type GovernanceStore } from "@/lib/learningGovernance";
import { api, apiGenerateAdminInviteCode, type Permission } from "@/lib/api";
import { TableSkeleton } from "@/components/ui/skeleton";

type Lesson = { id: string; approvalStatus?: "pending" | "approved" | "rejected"; published: boolean };
type Learning = { lessons: Lesson[] };
type Props = { learning: any; updateLearning: (updater: (previous: any) => any) => void; canManageTeam: boolean; initialTab?: "subscriptions" | "admins" | "content" };
type Enrollment = { id: string; studentName: string; courseId: string; courseTitle?: string; teacherId: string; bookingType: string; amount: number; status: "pending" | "approved" | "rejected"; transferImage?: string; createdAt: string };
type Notification = { id: string; title: string; message: string; read: boolean; createdAt: string };
type TeamUser = { id: string; name: string; email: string; role: "teacher" | "admin"; status?: string; permissions?: Permission[] };
const permissionLabels: Record<Permission, string> = { users: "المستخدمون", courses: "الكورسات", content: "المحتوى", reports: "التقارير", payments: "المدفوعات", settings: "الإعدادات" };
const allPermissions = Object.keys(permissionLabels) as Permission[];

export default function AdminGovernance({ learning, updateLearning, canManageTeam, initialTab }: Props) {
  const [governance, setGovernance] = useState<GovernanceStore>(() => readGovernance());
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [newYear, setNewYear] = useState(false);
  const [ramadan, setRamadan] = useState(false);
  const [generatedAdminInviteCode, setGeneratedAdminInviteCode] = useState("");
  const [activeTab, setActiveTab] = useState<"subscriptions" | "admins" | "content">(initialTab || "subscriptions");
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const loadRequests = async () => {
    setLoadingData(true);
    try {
      const [nextEnrollments, nextNotifications, users] = await Promise.all([api<Enrollment[]>('/enrollments'), api<Notification[]>('/notifications'), canManageTeam ? api<any[]>('/users') : Promise.resolve([])]);
      setEnrollments(nextEnrollments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setNotifications(nextNotifications);
      setPendingUsers(users.filter((u) => (u.role === 'admin' || u.role === 'teacher') && u.status === 'pending'));
      setTeamUsers(users.filter((u): u is TeamUser => u.role === 'admin'));
    } finally {
      setLoadingData(false);
    }
  };
  useEffect(() => { void loadRequests().catch((error) => toast.error(error instanceof Error ? error.message : "تعذر تحميل الإشعارات وطلبات الاشتراك")); }, []);
  useEffect(() => { 
    void api<{ events?: { newYear?: boolean, ramadan?: boolean }, adminInviteCode?: string }>("/settings")
      .then((settings) => {
        setNewYear(Boolean(settings.events?.newYear));
        setRamadan(Boolean(settings.events?.ramadan));
      }).catch(() => undefined); 
  }, []);

  const toggleEvent = async (eventName: "newYear" | "ramadan", currentState: boolean, setState: (val: boolean) => void) => {
    const next = !currentState;
    try {
      try {
        await api("/settings/events", { method: "PATCH", body: JSON.stringify({ [eventName]: next }) });
      } catch (error) {
        if (!(error instanceof Error) || !error.message.toLowerCase().includes("route not found")) throw error;
        await api("/settings", { method: "PATCH", body: JSON.stringify({ events: { [eventName]: next } }) });
      }
      setState(next);
      window.dispatchEvent(new Event("oxford-settings-changed"));
      toast.success(next ? `تم تفعيل زينة ${eventName} لكل المستخدمين` : `تم إيقاف زينة ${eventName}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تحديث المناسبة");
    }
  };

  const save = (next: GovernanceStore) => { writeGovernance(next); setGovernance(next); window.dispatchEvent(new Event("storage")); };
  const reviewEnrollment = async (id: string, status: "approved" | "rejected") => { 
    try { 
      await api(`/enrollments/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }); 
      await loadRequests(); 
      toast.success(status === "approved" ? "تم تفعيل الاشتراك وإرسال إشعار للطالب" : "تم رفض الطلب وإرسال إشعار للطالب"); 
    } catch (error) { 
      toast.error(error instanceof Error ? error.message : "تعذر تحديث الطلب"); 
    } 
  };
  const reviewLesson = async (contentId: string, status: "approved" | "rejected") => { 
    try { 
      await api(`/lessons/${contentId}`, { method: "PATCH", body: JSON.stringify({ published: status === "approved" }) }); 
      save({ ...governance, contentApprovals: governance.contentApprovals.map((item) => item.contentId === contentId ? { ...item, status } : item) }); 
      updateLearning((previous) => ({ ...previous, lessons: previous.lessons.map((lesson: any) => lesson.id === contentId ? { ...lesson, approvalStatus: status, published: status === "approved" } : lesson) })); 
      toast.success(status === "approved" ? "تم اعتماد المحاضرة ونشرها" : "تم رفض المحاضرة"); 
    } catch (error) { 
      toast.error(error instanceof Error ? error.message : "تعذر تحديث المحاضرة"); 
    } 
  };
  const reviewUser = async (userId: string, status: "approved" | "rejected") => { 
    try { 
      await api(`/users/${userId}/status`, { method: "PATCH", body: JSON.stringify({ status }) }); 
      await loadRequests(); 
      toast.success(status === "approved" ? "تم الموافقة على انضمام المستخدم" : "تم رفض الانضمام"); 
    } catch (error) { 
      toast.error("تعذر تحديث حالة المستخدم"); 
    } 
  };
  const savePermissions = async (userId: string, permissions: Permission[]) => {
    try {
      const updated = await api<TeamUser>(`/users/${userId}/permissions`, { method: "PATCH", body: JSON.stringify({ permissions }) });
      setTeamUsers(current => current.map(user => user.id === userId ? updated : user));
      toast.success("تم حفظ صلاحيات المستخدم");
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر حفظ الصلاحيات"); }
  };
  const generateInviteCode = async () => {
    try {
      const result = await apiGenerateAdminInviteCode();
      setGeneratedAdminInviteCode(result.inviteCode);
      toast.success("تم إنشاء كود دعوة أدمن جديد");
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر تحديث كود الدعوة"); }
  };

  const pendingCount = enrollments.filter(e => e.status === "pending").length;
  const pendingAdminCount = pendingUsers.length;

  return (
    <div className="governance-page" style={{ display: 'grid', gap: '20px' }}>
      <div className="paper-card governance-intro">
        <span className="eyebrow" style={{ color: "var(--primary)" }}>CENTER CONTROL / APPROVALS</span>
        <h1 style={{ marginTop: '8px', fontSize: '28px' }}>طلبات الانضمام والمراجعات</h1>
        <p style={{ color: "var(--ink-muted)", fontSize: '13px' }}>إدارة الحسابات، مراجعة اشتراكات الطلاب وصور التحويل، والتحكم في إعدادات المنصة.</p>
        <div className="detail-tabs" style={{ marginTop: '20px' }}>
          <button
            className={activeTab === "subscriptions" ? "active" : ""}
            onClick={() => setActiveTab("subscriptions")}
          >
            اشتراكات الكورسات {pendingCount > 0 && <span className="nav-count" style={{ display: "inline-block", marginRight: "6px" }}>{pendingCount}</span>}
          </button>
          {canManageTeam && <button
            className={activeTab === "admins" ? "active" : ""}
            onClick={() => setActiveTab("admins")}
          >
            المشرفين {pendingAdminCount > 0 && <span className="nav-count" style={{ display: "inline-block", marginRight: "6px" }}>{pendingAdminCount}</span>}
          </button>}
          <button
            className={activeTab === "content" ? "active" : ""}
            onClick={() => setActiveTab("content")}
          >
            المحتوى والمناسبات
          </button>
        </div>
      </div>

      {activeTab === "subscriptions" && (
        <section className="paper-card">
          <div className="card-title" style={{ marginBottom: "20px" }}>
            <div>
              <span className="eyebrow">STUDENT ENROLLMENTS</span>
              <h2>مراجعة الاشتراكات وصور التحويل</h2>
            </div>
          </div>
          <div className="table-scroll">
            {loadingData ? (
              <TableSkeleton rows={5} cols={7} />
            ) : (
            <table style={{ minWidth: "900px" }}>
              <thead>
                <tr>
                  <th>الطالب</th>
                  <th>الكورس / المدرس</th>
                  <th>خطة الاشتراك</th>
                  <th>المبلغ</th>
                  <th>صورة التحويل</th>
                  <th>الحالة</th>
                  <th>الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map(item => (
                  <tr key={item.id}>
                    <td>
                      <div className="person">
                        <span className="avatar avatar-1">{item.studentName[0]}</span>
                        <span>
                          <strong>{item.studentName}</strong>
                          <small>تاريخ الطلب: {new Date(item.createdAt).toLocaleDateString("ar-EG")}</small>
                        </span>
                      </div>
                    </td>
                    <td><strong>{item.courseTitle || item.courseId}</strong></td>
                    <td><span className="signal-chip">{item.bookingType}</span></td>
                    <td><strong>{item.amount} ج.م</strong></td>
                    <td>
                      {item.transferImage ? (
                        <a href={item.transferImage} target="_blank" rel="noreferrer" className="transfer-review" style={{ background: "#fff5ef", padding: "6px 12px", borderRadius: "8px" }}>
                          <img src={item.transferImage} alt="تحويل" style={{ width: "35px", height: "25px", borderRadius: "4px" }} />
                          عرض الإيصال
                        </a>
                      ) : (
                        <span className="muted">بدون إيصال</span>
                      )}
                    </td>
                    <td>
                       <span className={`status ${item.status === "pending" ? "warning" : item.status === "approved" ? "success" : "danger"}`} style={item.status === "rejected" ? { background: "#ffebe7", color: "#bf5347" } : undefined}>
                          <i style={item.status === "rejected" ? { background: "#e56d62" } : undefined}/> 
                          {item.status === "pending" ? "قيد المراجعة" : item.status === "approved" ? "مفعل" : "مرفوض"}
                       </span>
                    </td>
                    <td>
                      {item.status === "pending" ? (
                        <div style={{ display: "flex", gap: "6px" }}>
                           <button className="primary-btn" style={{ padding: "6px 14px", fontSize: "11px", minHeight: "30px" }} onClick={() => void reviewEnrollment(item.id, "approved")}>موافقة وتفعيل</button>
                           <button className="secondary-btn" style={{ padding: "6px 14px", fontSize: "11px", minHeight: "30px" }} onClick={() => void reviewEnrollment(item.id, "rejected")}>رفض</button>
                        </div>
                      ) : (
                        <span className="muted" style={{ fontSize: "11px" }}>تم اتخاذ إجراء</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
            {!loadingData && enrollments.length === 0 && <div style={{ padding: "30px", textAlign: "center", color: "var(--ink-muted)" }}>لا توجد طلبات اشتراك حالياً.</div>}
          </div>
        </section>
      )}

      {activeTab === "admins" && canManageTeam && (
        <section className="paper-card">
          <div className="card-title" style={{ marginBottom: "20px" }}>
            <div>
              <span className="eyebrow">TEAM JOIN REQUESTS</span>
              <h2>طلبات انضمام المشرفين والمدرسين</h2>
            </div>
          </div>
          <div className="table-scroll">
            {loadingData ? (
              <TableSkeleton rows={4} cols={4} />
            ) : (
            <table style={{ minWidth: "700px" }}>
              <thead>
                <tr>
                  <th>الاسم / الإيميل</th>
                  <th>الدور</th>
                  <th>الحالة</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map(item => (
                  <tr key={item.id}>
                    <td>
                      <div className="person">
                        <span className="avatar avatar-0">{item.name[0]}</span>
                        <span>
                          <strong>{item.name}</strong>
                          <small>{item.email}</small>
                        </span>
                      </div>
                    </td>
                    <td><span className="signal-chip" style={{ background: "#fff0e5", color: "#f36a21" }}>{item.role === "teacher" ? "مدرس" : "مشرف"}</span></td>
                    <td><span className="status warning"><i />بانتظار الموافقة</span></td>
                    <td>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button className="primary-btn" style={{ padding: "6px 14px", fontSize: "11px", minHeight: "30px" }} onClick={() => void reviewUser(item.id, "approved")}>قبول الانضمام</button>
                        <button className="secondary-btn" style={{ padding: "6px 14px", fontSize: "11px", minHeight: "30px" }} onClick={() => void reviewUser(item.id, "rejected")}>رفض</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
            {!loadingData && pendingUsers.length === 0 && <div style={{ padding: "30px", textAlign: "center", color: "var(--ink-muted)" }}>لا توجد طلبات انضمام للمشرفين حاليًا.</div>}
          </div>

          <div style={{ marginTop: "28px", borderTop: "1px solid var(--border)", paddingTop: "20px" }}>
            <div className="card-title" style={{ marginBottom: "14px" }}>
              <div>
                <span className="eyebrow">ADMIN ACCESS</span>
                <h3>كود دعوة المشرفين</h3>
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "end", marginTop: "16px", maxWidth: "560px", flexWrap: "wrap" }}>
              <label className="form-field" style={{ flex: 1, minWidth: "240px" }}>
                <span>الكود الحالي</span>
                <input value={generatedAdminInviteCode} readOnly placeholder="سيظهر هنا بعد إنشاء كود جديد" />
              </label>
              <button className="primary-btn" type="button" onClick={() => void generateInviteCode()}>إنشاء كود</button>
              {generatedAdminInviteCode && (
                <button className="secondary-btn" type="button" onClick={() => void navigator.clipboard.writeText(generatedAdminInviteCode)}>نسخ</button>
              )}
            </div>
          </div>

          <div style={{ marginTop: "28px", borderTop: "1px solid var(--border)", paddingTop: "20px" }}>
            <div className="card-title" style={{ marginBottom: "14px" }}><div><span className="eyebrow">TEAM ACCESS</span><h3>صلاحيات المشرفين المعتمدين</h3></div></div>
            {teamUsers.filter(user => user.status === "approved").map(user => (
              <div key={user.id} style={{ padding: "14px 0", borderTop: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                  <div><strong>{user.name}</strong><small style={{ display: "block", color: "var(--ink-muted)" }}>{user.email} · مشرف</small></div>
                  {user.id === "admin-demo" ? <span className="signal-chip">صلاحيات كاملة</span> : <button className="primary-btn compact" onClick={() => void savePermissions(user.id, user.permissions || [])}>حفظ الصلاحيات</button>}
                </div>
                {user.id !== "admin-demo" && <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "12px" }}>
                  {allPermissions.map(permission => <label key={permission} className="check"><input type="checkbox" checked={user.permissions?.includes(permission) || false} onChange={event => setTeamUsers(current => current.map(item => item.id === user.id ? { ...item, permissions: event.target.checked ? [...(item.permissions || []), permission] : (item.permissions || []).filter(value => value !== permission) } : item))} />{permissionLabels[permission]}</label>)}
                </div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "content" && (
        <>
          <section className="paper-card event-settings" style={{ marginBottom: "20px" }}>
            <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="eyebrow">OCCASIONS</span>
                <h2>تفعيل المناسبات والزينة</h2>
                <small>فعّل التأثيرات الموسمية لكل مستخدمي المنصة فورًا.</small>
              </div>
              <div style={{ display: 'flex', gap: '20px' }}>
                <label className="event-switch">
                  <input type="checkbox" checked={newYear} onChange={() => void toggleEvent("newYear", newYear, setNewYear)} />
                  <span />
                  <b>New Year</b>
                </label>
                <label className="event-switch">
                  <input type="checkbox" checked={ramadan} onChange={() => void toggleEvent("ramadan", ramadan, setRamadan)} />
                  <span />
                  <b>رمضان مبارك</b>
                </label>
              </div>
            </div>
          </section>
          
          <section className="paper-card">
            <div className="card-title" style={{ marginBottom: "20px" }}>
              <div>
                <span className="eyebrow">CONTENT APPROVALS</span>
                <h2>محاضرات المدرسين المقترحة</h2>
              </div>
            </div>
            {governance.contentApprovals.filter(item => item.status === "pending").length > 0 ? (
              governance.contentApprovals.filter(item => item.status === "pending").map((item) => (
                <div className="governance-row" key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 0", borderTop: "1px solid var(--border)" }}>
                  <div>
                    <strong>{item.title}</strong>
                    <small style={{ display: "block", color: "var(--ink-muted)", fontSize: "11px", marginTop: "4px" }}>المدرس: {item.teacher}</small>
                  </div>
                  <div className="governance-actions" style={{ display: "flex", gap: "8px" }}>
                    <button className="primary-btn" style={{ padding: "7px 15px", fontSize: "11px" }} onClick={() => reviewLesson(item.contentId, "approved")}>اعتماد ونشر للطلاب</button>
                    <button className="secondary-btn" style={{ padding: "7px 15px", fontSize: "11px" }} onClick={() => reviewLesson(item.contentId, "rejected")}>رفض</button>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--ink-muted)" }}>جميع المحاضرات معتمدة ومنشورة.</div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
