import { useEffect, useState } from "react";
import { Search, Download, CircleDollarSign } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { MetricsSkeleton, TableSkeleton } from "@/components/ui/skeleton";

type Enrollment = {
  id: string;
  studentName: string;
  courseId: string;
  courseTitle?: string;
  teacherId: string;
  bookingType: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  transferImage?: string;
  createdAt: string;
};

export default function AdminPaymentsManager() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setLoading(true);
    void api<Enrollment[]>("/enrollments")
      .then(data => {
        setEnrollments(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      })
      .catch(() => toast.error("تعذر تحميل المدفوعات"))
      .finally(() => setLoading(false));
  }, []);

  const totalRevenue = enrollments
    .filter(e => e.status === "approved")
    .reduce((sum, current) => sum + current.amount, 0);

  const filtered = enrollments.filter(e => 
    e.studentName.includes(query) || (e.courseTitle || "").includes(query)
  );

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow" style={{ color: "var(--primary)" }}>FINANCE & PAYMENTS</span>
          <h1>المدفوعات والاشتراكات</h1>
          <p>سجل بجميع الاشتراكات والتحويلات المالية التي تمت على المنصة مسبقاً والجديدة.</p>
        </div>
      </div>

      {loading ? (
        <MetricsSkeleton count={2} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", marginBottom: "20px" }}>
          <div className="paper-card" style={{ padding: "20px" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "10px" }}>
              <div style={{ background: "#eef6ff", color: "#1a72d5", padding: "10px", borderRadius: "12px" }}>
                <CircleDollarSign size={24} />
              </div>
              <div>
                <span className="eyebrow">TOTAL REVENUE</span>
                <h3 style={{ fontSize: "20px", margin: 0 }}>{totalRevenue} ج.م</h3>
              </div>
            </div>
            <p className="muted" style={{ fontSize: "12px", margin: 0 }}>إجمالي الإيرادات الفعلية (الطلبات المقبولة فقط)</p>
          </div>

          <div className="paper-card" style={{ padding: "20px" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "10px" }}>
              <div style={{ background: "#fff5ef", color: "#f36a21", padding: "10px", borderRadius: "12px" }}>
                <CircleDollarSign size={24} />
              </div>
              <div>
                <span className="eyebrow">TOTAL ENROLLMENTS</span>
                <h3 style={{ fontSize: "20px", margin: 0 }}>{enrollments.length} اشتراك</h3>
              </div>
            </div>
            <p className="muted" style={{ fontSize: "12px", margin: 0 }}>إجمالي الطلبات (بمختلف الحالات)</p>
          </div>
        </div>
      )}

      <div className="toolbar" style={{ marginTop: 0 }}>
        <div className="search-box">
          <Search size={17} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="ابحث باسم الطالب أو الكورس..."
          />
        </div>
        <div className="toolbar-actions">
          <button className="secondary-btn" onClick={() => toast.success("جاري تصدير الملف كـ CSV...")}>
            <Download size={16} /> تصدير السجل
          </button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : (
      <div className="table-card full">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>الطالب</th>
                <th>الكورس / المسار</th>
                <th>نوع الاشتراك</th>
                <th>وسيلة الدفع</th>
                <th>رقم المحفظة المرسل</th>
                <th>قيمة الاشتراك</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => (
                <tr key={item.id || i}>
                  <td className="muted" style={{ fontSize: "12px" }}>
                    {new Date(item.createdAt).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" })}
                  </td>
                  <td>
                    <div className="person">
                      <span className={`avatar avatar-${i % 4}`}>{item.studentName[0]}</span>
                      <span>
                        <strong>{item.studentName}</strong>
                      </span>
                    </div>
                  </td>
                  <td>
                    <strong>{item.courseTitle || item.courseId}</strong>
                  </td>
                  <td>
                    <span className="signal-chip">{item.bookingType}</span>
                  </td>
                  <td>
                    {(item as any).paymentMethodName ? (
                      <span style={{ fontSize: "12px", fontWeight: 600, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "2px 8px" }}>
                        {(item as any).paymentMethodName}
                      </span>
                    ) : <span className="muted" style={{ fontSize: "12px" }}>—</span>}
                  </td>
                  <td>
                    {(item as any).senderNumber ? (
                      <span dir="ltr" style={{ fontFamily: "monospace", fontSize: "12px", fontWeight: 700 }}>{(item as any).senderNumber}</span>
                    ) : <span className="muted" style={{ fontSize: "12px" }}>—</span>}
                  </td>
                  <td>
                    <strong style={{ color: "var(--primary)" }}>{item.amount} ج.م</strong>
                  </td>
                  <td>
                    <span className={`status ${item.status === "pending" ? "warning" : item.status === "approved" ? "success" : "danger"}`} style={item.status === "rejected" ? { background: "#ffebe7", color: "#bf5347" } : undefined}>
                       <i style={item.status === "rejected" ? { background: "#e56d62" } : undefined}/> 
                       {item.status === "pending" ? "قيد المراجعة" : item.status === "approved" ? "مفعل (تم الدفع)" : "مرفوض"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--ink-muted)" }}>
              لا توجد مدفوعات حالياً مطابقة لبحثك.
            </div>
          )}
        </div>
      </div>
      )}
    </>
  );
}
