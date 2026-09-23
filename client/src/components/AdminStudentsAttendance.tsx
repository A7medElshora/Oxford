import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { api, type ApiUser } from "@/lib/api";

type Enrollment = {
  id: string;
  studentId?: string;
  studentName: string;
  courseId: string;
  courseTitle: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

type Attendance = {
  id: string;
  studentId: string;
  studentName?: string;
  courseId: string;
  courseTitle?: string;
  date: string;
  status: "present" | "absent" | "late";
  note?: string;
};

type Props = { page: "students" | "attendance" };

export default function AdminStudentsAttendance({ page }: Props) {
  const [students, setStudents] = useState<ApiUser[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      api<ApiUser[]>("/users?role=student"),
      api<Enrollment[]>("/enrollments"),
      api<Attendance[]>("/attendance"),
    ])
      .then(([nextStudents, nextEnrollments, nextAttendance]) => {
        if (!active) return;
        setStudents(nextStudents);
        setEnrollments(nextEnrollments);
        setAttendance(nextAttendance);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "تعذر تحميل بيانات الطلاب"))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredStudents = useMemo(
    () =>
      students.filter((student) =>
        enrollments.some((enrollment) =>
          enrollment.status === "approved" &&
          (enrollment.studentId === student.id || enrollment.studentName === student.name),
        ) &&
        [student.name, student.email, student.phone, student.grade].some((value) =>
          value?.toLowerCase().includes(query.toLowerCase()),
        ),
      ),
    [enrollments, query, students],
  );
  const filteredAttendance = useMemo(
    () =>
      attendance.filter((record) =>
        [record.studentName, record.courseTitle, record.date, record.status, record.note].some((value) =>
          value?.toLowerCase().includes(query.toLowerCase()),
        ),
      ),
    [attendance, query],
  );

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">ADMIN / {page === "students" ? "STUDENTS" : "ATTENDANCE"}</span>
          <h1>{page === "students" ? "الطلاب المسجلون" : "سجل الحضور الفعلي"}</h1>
          <p>{page === "students" ? "بيانات الطلاب المسجلين من حسابات المستخدمين والاشتراكات." : "السجلات التي تم تسجيلها فعليًا عبر نظام الحضور."}</p>
        </div>
        <div className="stat-chip">
          {page === "students" ? <Users size={16} /> : <CalendarDays size={16} />}
          {page === "students" ? `${students.length} طالب` : `${attendance.length} سجل`}
        </div>
      </div>
      <div className="toolbar">
        <div className="search-box">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بالاسم أو الكورس..." />
        </div>
      </div>
      <div className="table-card full">
        {loading ? (
          <p className="muted table-empty">جارٍ تحميل البيانات...</p>
        ) : page === "students" ? (
          <StudentsTable students={filteredStudents} enrollments={enrollments} attendance={attendance} />
        ) : (
          <AttendanceTable records={filteredAttendance} />
        )}
      </div>
    </>
  );
}

function StudentsTable({ students, enrollments, attendance }: { students: ApiUser[]; enrollments: Enrollment[]; attendance: Attendance[] }) {
  return students.length ? (
    <div className="table-scroll">
      <table>
        <thead><tr><th>الطالب</th><th>الصف</th><th>الكورسات</th><th>الحضور</th><th>التسجيل</th></tr></thead>
        <tbody>
          {students.map((student, index) => {
            const studentEnrollments = enrollments.filter((item) => item.studentId === student.id);
            const records = attendance.filter((item) => item.studentId === student.id);
            const present = records.filter((item) => item.status === "present" || item.status === "late").length;
            const rate = records.length ? `${Math.round((present / records.length) * 100)}%` : "—";
            return (
              <tr key={student.id}>
                <td><div className="person"><span className={`avatar avatar-${index % 4}`}>{student.name.charAt(0)}</span><span><strong>{student.name}</strong><small>{student.email}</small></span></div></td>
                <td>{student.grade || "—"}</td>
                <td>{studentEnrollments.length ? studentEnrollments.map((item) => <span className="tag" key={item.id}>{item.courseTitle}</span>) : "لا توجد اشتراكات"}</td>
                <td className={records.length && present / records.length < 0.7 ? "warning-text" : "success-text"}>{rate}{records.length ? ` (${records.length} سجل)` : ""}</td>
                <td>{studentEnrollments.length ? studentEnrollments.map((item) => <span className={`status ${item.status === "approved" ? "success" : item.status === "pending" ? "warning" : "danger"}`} key={item.id}><i />{item.status === "approved" ? "مقبول" : item.status === "pending" ? "قيد المراجعة" : "مرفوض"}</span>) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  ) : <p className="muted table-empty">لا يوجد طلاب مسجلون.</p>;
}

function AttendanceTable({ records }: { records: Attendance[] }) {
  return records.length ? (
    <div className="table-scroll">
      <table>
        <thead><tr><th>#</th><th>الطالب</th><th>الكورس</th><th>التاريخ</th><th>الحالة</th><th>ملاحظة</th></tr></thead>
        <tbody>
          {records.map((record, index) => (
            <tr key={record.id}>
              <td className="muted">{String(index + 1).padStart(2, "0")}</td>
              <td><strong>{record.studentName || record.studentId}</strong></td>
              <td>{record.courseTitle || record.courseId}</td>
              <td>{new Date(record.date).toLocaleDateString("ar-EG")}</td>
              <td><span className={`status ${record.status === "present" ? "success" : record.status === "late" ? "warning" : "danger"}`}><i />{record.status === "present" ? "حاضر" : record.status === "late" ? "متأخر" : "غائب"}</span></td>
              <td>{record.note || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : <p className="muted table-empty">لا توجد سجلات حضور فعلية حتى الآن.</p>;
}
