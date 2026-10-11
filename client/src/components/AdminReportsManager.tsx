import { useEffect, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Download, TrendingUp, Users, BookOpen, CircleDollarSign } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import ExcelJS from "exceljs";
import { MetricsSkeleton, TableSkeleton } from "@/components/ui/skeleton";

type Enrollment = {
  id: string;
  studentName: string;
  courseId: string;
  courseTitle?: string;
  bookingType: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  transferImage?: string;
  transferImageUrl?: string;
};
type Course = {
  id: string;
  title: string;
  teacherIds: string[];
  lessonCount: number;
  price: number;
  level: string;
};
type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  grade?: string;
  phone?: string;
  parentPhone?: string;
};

// Build month-by-month revenue from enrollments
function buildMonthlyRevenue(enrollments: Enrollment[]) {
  const months: Record<string, number> = {};
  enrollments
    .filter(e => e.status === "approved")
    .forEach(e => {
      const d = new Date(e.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months[key] = (months[key] || 0) + e.amount;
    });
  return Object.keys(months).sort().slice(-12).map(key => ({
    name: new Intl.DateTimeFormat("ar-EG", { month: "short", year: "2-digit" }).format(new Date(`${key}-01T00:00:00`)),
    value: months[key],
  }));
}

// Build per-course enrollment count
function buildCourseEnrollments(enrollments: Enrollment[]) {
  const counts: Record<string, { name: string; value: number }> = {};
  enrollments.filter(e => e.status === "approved").forEach(e => {
    const title = e.courseTitle || e.courseId;
    const short = title.length > 18 ? title.slice(0, 16) + "…" : title;
    if (!counts[e.courseId]) counts[e.courseId] = { name: short, value: 0 };
    counts[e.courseId].value += 1;
  });
  return Object.values(counts);
}

function toDataImageExtension(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/([a-zA-Z0-9.+-]+));base64,/i);
  return match ? match[2].toLowerCase() : "png";
}

function toDataImageBase64(dataUrl: string) {
  const match = dataUrl.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/i);
  return match ? match[1] : null;
}

function toExcelImageExtension(dataUrl: string): "png" | "jpeg" | "gif" {
  const extension = toDataImageExtension(dataUrl);
  if (extension === "jpg" || extension === "jpeg") return "jpeg";
  if (extension === "gif") return "gif";
  return "png";
}

const REPORT_NAVY = "17324D";
const REPORT_BLUE = "2376B7";
const REPORT_ORANGE = "F47B20";
const REPORT_PALE = "EAF2F8";
const REPORT_GREEN = "2E9B68";
const REPORT_RED = "D95D54";

function styleReportTable(sheet: ExcelJS.Worksheet, headerRow: number, endRow: number) {
  const header = sheet.getRow(headerRow);
  header.height = 30;
  header.eachCell(cell => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: REPORT_NAVY } };
    cell.font = { name: "Aptos", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: REPORT_ORANGE } } };
  });
  for (let rowIndex = headerRow + 1; rowIndex <= endRow; rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    row.height = 24;
    row.eachCell(cell => {
      cell.font = { name: "Aptos", size: 10, color: { argb: REPORT_NAVY } };
      cell.alignment = { vertical: "middle", horizontal: "right", wrapText: true };
      if (rowIndex % 2 === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F3F7FA" } };
      cell.border = { bottom: { style: "hair", color: { argb: "D9E3EC" } } };
    });
  }
  if (endRow >= headerRow) {
    sheet.autoFilter = {
      from: { row: headerRow, column: 1 },
      to: { row: endRow, column: sheet.columnCount },
    };
  }
  sheet.views = [{ rightToLeft: true, state: "frozen", ySplit: headerRow }];
}

function chartImage(title: string, labels: string[], values: number[], color: string, horizontal = false) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 520;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("تعذر إنشاء مخططات التقرير");

  context.fillStyle = "#FFFFFF";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = `#${REPORT_NAVY}`;
  context.font = "bold 32px Arial";
  context.textAlign = "right";
  context.direction = "rtl";
  context.fillText(title, 1140, 56);

  const maxValue = Math.max(...values, 1);
  context.strokeStyle = "#DCE5ED";
  context.lineWidth = 2;
  context.fillStyle = "#78899A";
  context.font = "20px Arial";
  if (horizontal) {
    const left = 260;
    const top = 110;
    const rowHeight = Math.min(48, 360 / Math.max(labels.length, 1));
    labels.forEach((label, index) => {
      const y = top + index * rowHeight;
      context.textAlign = "right";
      context.fillText(label, left - 16, y + 24);
      context.fillStyle = "#EEF3F7";
      context.fillRect(left, y, 820, 24);
      context.fillStyle = color;
      context.fillRect(left, y, Math.max(4, 820 * values[index] / maxValue), 24);
      context.fillStyle = `#${REPORT_NAVY}`;
      context.textAlign = "left";
      context.fillText(values[index].toLocaleString("ar-EG"), left + 830, y + 22);
      context.fillStyle = "#78899A";
    });
  } else {
    const left = 90;
    const top = 120;
    const chartWidth = 1020;
    const chartHeight = 300;
    [0, 0.25, 0.5, 0.75, 1].forEach(fraction => {
      const y = top + chartHeight * fraction;
      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(left + chartWidth, y);
      context.stroke();
    });
    const step = chartWidth / Math.max(labels.length, 1);
    const points = values.map((value, index) => ({
      x: left + step * (index + 0.5),
      y: top + chartHeight - chartHeight * value / maxValue,
    }));
    context.beginPath();
    points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
    context.strokeStyle = color;
    context.lineWidth = 6;
    context.stroke();
    points.forEach((point, index) => {
      context.beginPath();
      context.arc(point.x, point.y, 8, 0, Math.PI * 2);
      context.fillStyle = color;
      context.fill();
      context.fillStyle = `#${REPORT_NAVY}`;
      context.textAlign = "center";
      context.font = "bold 18px Arial";
      context.fillText(values[index].toLocaleString("ar-EG"), point.x, point.y - 18);
      context.fillStyle = "#78899A";
      context.font = "16px Arial";
      context.fillText(labelSlice(labels[index], 10), point.x, top + chartHeight + 38);
    });
  }

  return canvas.toDataURL("image/png").split(",")[1];
}

function labelSlice(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

async function exportToExcel(enrollments: Enrollment[], students: User[], teachers: User[], courses: Course[], fromDate?: string, toDate?: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Oxford Learning Platform";
  workbook.subject = "لوحة مؤشرات وتقارير أكسفورد التعليمية";
  workbook.company = "Oxford Learning Platform";
  workbook.created = new Date();
  workbook.modified = new Date();

  const dateRangeStr = fromDate && toDate
    ? `من ${fromDate} إلى ${toDate}`
    : fromDate
    ? `من ${fromDate} وحتى الآن`
    : toDate
    ? `حتى تاريخ ${toDate}`
    : "شامل جميع الفترات الزمنية";

  const approvedEnrollments = enrollments.filter(e => e.status === "approved");
  const pendingEnrollments = enrollments.filter(e => e.status === "pending");
  const rejectedEnrollments = enrollments.filter(e => e.status === "rejected");
  const totalRev = approvedEnrollments.reduce((sum, e) => sum + e.amount, 0);
  const monthlyRevenue = new Map<string, number>();
  enrollments.filter(e => e.status === "approved").forEach(enrollment => {
    const date = new Date(enrollment.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    monthlyRevenue.set(key, (monthlyRevenue.get(key) || 0) + enrollment.amount);
  });
  const monthlyEntries = Array.from(monthlyRevenue.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12);
  const monthlyLabels = monthlyEntries.map(([key]) => new Intl.DateTimeFormat("ar-EG", { month: "short", year: "2-digit" }).format(new Date(`${key}-01T00:00:00`)));
  const monthlyValues = monthlyEntries.map(([, value]) => value);
  const courseMetrics = courses.map(course => ({
    title: course.title,
    count: approvedEnrollments.filter(enrollment => enrollment.courseId === course.id).length,
  })).sort((a, b) => b.count - a.count).slice(0, 8);

  const summarySheet = workbook.addWorksheet("لوحة المؤشرات");
  summarySheet.views = [{ rightToLeft: true, showGridLines: false }];
  summarySheet.columns = Array.from({ length: 12 }, () => ({ width: 15 }));
  summarySheet.mergeCells("A1:L2");
  summarySheet.getCell("A1").value = "OXFORD  |  لوحة ذكاء الأعمال والتحليلات";
  summarySheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: REPORT_NAVY } };
  summarySheet.getCell("A1").font = { name: "Aptos Display", size: 22, bold: true, color: { argb: "FFFFFFFF" } };
  summarySheet.getCell("A1").alignment = { vertical: "middle", horizontal: "right" };
  summarySheet.getRow(1).height = 28;
  summarySheet.getRow(2).height = 22;
  summarySheet.mergeCells("A3:L3");
  summarySheet.getCell("A3").value = `الفترة: ${dateRangeStr}     |     تاريخ إعداد التقرير: ${new Date().toLocaleDateString("ar-EG")}`;
  summarySheet.getCell("A3").font = { name: "Aptos", size: 11, color: { argb: REPORT_NAVY }, italic: true };
  summarySheet.getCell("A3").fill = { type: "pattern", pattern: "solid", fgColor: { argb: REPORT_PALE } };
  summarySheet.getCell("A3").alignment = { vertical: "middle", horizontal: "right" };
  summarySheet.getRow(3).height = 26;

  const kpis = [
    { range: "A5:C5", valueRange: "A6:C7", label: "إجمالي الإيرادات المعتمدة", value: totalRev, color: REPORT_BLUE, format: '#,##0.00 "ج.م"' },
    { range: "D5:F5", valueRange: "D6:F7", label: "الاشتراكات المفعّلة", value: approvedEnrollments.length, color: REPORT_GREEN },
    { range: "G5:I5", valueRange: "G6:I7", label: "طلبات قيد المراجعة", value: pendingEnrollments.length, color: REPORT_ORANGE },
    { range: "J5:L5", valueRange: "J6:L7", label: "الطلاب المسجلون", value: students.length, color: "7554A3" },
  ];
  kpis.forEach(kpi => {
    summarySheet.mergeCells(kpi.range);
    summarySheet.mergeCells(kpi.valueRange);
    const labelCell = summarySheet.getCell(kpi.range.slice(0, kpi.range.indexOf(":")));
    const valueCell = summarySheet.getCell(kpi.valueRange.slice(0, kpi.valueRange.indexOf(":")));
    labelCell.value = kpi.label;
    labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: kpi.color } };
    labelCell.font = { name: "Aptos", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    labelCell.alignment = { horizontal: "center", vertical: "middle" };
    valueCell.value = kpi.value;
    valueCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F4F7FA" } };
    valueCell.font = { name: "Aptos Display", size: 23, bold: true, color: { argb: kpi.color } };
    valueCell.alignment = { horizontal: "center", vertical: "middle" };
    if ("format" in kpi && kpi.format) valueCell.numFmt = kpi.format;
  });
  summarySheet.getRow(5).height = 28;
  summarySheet.getRow(6).height = 27;
  summarySheet.getRow(7).height = 27;
  summarySheet.mergeCells("A9:F9");
  summarySheet.mergeCells("G9:L9");
  summarySheet.getCell("A9").value = "اتجاه الإيرادات الشهرية";
  summarySheet.getCell("G9").value = "أعلى الكورسات اشتراكًا";
  ["A9", "G9"].forEach(address => {
    const cell = summarySheet.getCell(address);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: REPORT_NAVY } };
    cell.font = { name: "Aptos", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  summarySheet.getRow(9).height = 28;
  const revenueChartId = workbook.addImage({ base64: chartImage("الإيرادات المعتمدة حسب الشهر (ج.م)", monthlyLabels, monthlyValues, `#${REPORT_BLUE}`), extension: "png" });
  summarySheet.addImage(revenueChartId, "A10:F24");
  const coursesChartId = workbook.addImage({ base64: chartImage("الطلاب المشتركون حسب الكورس", courseMetrics.map(course => course.title), courseMetrics.map(course => course.count), `#${REPORT_ORANGE}`, true), extension: "png" });
  summarySheet.addImage(coursesChartId, "G10:L24");
  summarySheet.mergeCells("A25:L25");
  summarySheet.getCell("A25").value = `ملخص الحالة: ${approvedEnrollments.length} مفعّل  |  ${pendingEnrollments.length} قيد المراجعة  |  ${rejectedEnrollments.length} مرفوض  |  ${teachers.length} مدرس  |  ${courses.length} كورس`;
  summarySheet.getCell("A25").fill = { type: "pattern", pattern: "solid", fgColor: { argb: REPORT_PALE } };
  summarySheet.getCell("A25").font = { name: "Aptos", size: 11, bold: true, color: { argb: REPORT_NAVY } };
  summarySheet.getCell("A25").alignment = { horizontal: "center", vertical: "middle" };
  summarySheet.getRow(25).height = 30;

  const summaryDetailSheet = workbook.addWorksheet("ملخص الفترة");
  summaryDetailSheet.views = [{ rightToLeft: true, showGridLines: false }];
  summaryDetailSheet.columns = [{ width: 42 }, { width: 28 }];
  summaryDetailSheet.mergeCells("A1:B2");
  summaryDetailSheet.getCell("A1").value = "ملخص تنفيذي للفترة";
  summaryDetailSheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: REPORT_NAVY } };
  summaryDetailSheet.getCell("A1").font = { name: "Aptos Display", size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  summaryDetailSheet.getCell("A1").alignment = { horizontal: "right", vertical: "middle" };
  summaryDetailSheet.addRows([
    [],
    ["المؤشر", "القيمة"],
    ["الفترة", dateRangeStr],
    ["تاريخ البداية", fromDate || "غير محدد"],
    ["تاريخ النهاية", toDate || "غير محدد"],
    ["إجمالي الطلاب", students.length],
    ["إجمالي المدرسين", teachers.length],
    ["إجمالي الكورسات", courses.length],
    ["إجمالي طلبات الاشتراك", enrollments.length],
    ["اشتراكات مفعّلة", approvedEnrollments.length],
    ["طلبات قيد المراجعة", pendingEnrollments.length],
    ["طلبات مرفوضة", rejectedEnrollments.length],
    ["إجمالي الإيرادات المعتمدة", totalRev],
  ]);
  summaryDetailSheet.getColumn(2).numFmt = '#,##0.00 "ج.م"';
  summaryDetailSheet.getCell("B4").numFmt = "@";
  summaryDetailSheet.getCell("B5").numFmt = "@";
  styleReportTable(summaryDetailSheet, 4, 16);

  const paymentsSheet = workbook.addWorksheet("سجل الاشتراكات المالي");
  paymentsSheet.views = [{ rightToLeft: true, showGridLines: false }];
  paymentsSheet.columns = [{ width: 16 }, { width: 25 }, { width: 32 }, { width: 17 }, { width: 18 }, { width: 22 }, { width: 20 }, { width: 20 }, { width: 60 }];
  paymentsSheet.mergeCells("A1:I2");
  paymentsSheet.getCell("A1").value = "سجل الاشتراكات والتحصيلات المالية";
  paymentsSheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: REPORT_NAVY } };
  paymentsSheet.getCell("A1").font = { name: "Aptos Display", size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  paymentsSheet.getCell("A1").alignment = { horizontal: "right", vertical: "middle" };
  paymentsSheet.addRow([]);
  paymentsSheet.addRow(["التاريخ", "اسم الطالب", "الكورس المختار", "نوع الخطة", "المبلغ (ج.م)", "وسيلة الدفع", "رقم المحفظة المرسل منها", "حالة الدفع", "صورة / رابط إيصال تحويل الطالب"]);
  enrollments.forEach((e) => {
    const status = e.status === "approved" ? "مفعل" : e.status === "pending" ? "قيد المراجعة" : "مرفوض";
    paymentsSheet.addRow([
      new Date(e.createdAt),
      e.studentName,
      e.courseTitle || e.courseId,
      e.bookingType,
      e.amount,
      (e as any).paymentMethodName || "غير محدد",
      (e as any).senderNumber || "-",
      status,
      e.transferImage || (e as any).transferImageUrl || "غير مرفق",
    ]);
  });
  styleReportTable(paymentsSheet, 4, paymentsSheet.rowCount);
  paymentsSheet.getColumn(1).numFmt = "dd/mm/yyyy";
  paymentsSheet.getColumn(5).numFmt = '#,##0.00 "ج.م"';
  for (let row = 5; row <= paymentsSheet.rowCount; row += 1) {
    const cell = paymentsSheet.getCell(row, 8);
    const statusColor = cell.value === "مفعل" ? REPORT_GREEN : cell.value === "مرفوض" ? REPORT_RED : REPORT_ORANGE;
    cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: statusColor } };
  }

  const transferSheet = workbook.addWorksheet("صور تحويلات المشتركين");
  transferSheet.views = [{ rightToLeft: true, showGridLines: false }];
  transferSheet.columns = [{ width: 8 }, { width: 28 }, { width: 32 }, { width: 17 }, { width: 18 }, { width: 22 }, { width: 20 }, { width: 17 }, { width: 24 }, { width: 75 }];
  transferSheet.mergeCells("A1:J2");
  transferSheet.getCell("A1").value = "مرفقات إثبات التحويلات البنكية";
  transferSheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: REPORT_NAVY } };
  transferSheet.getCell("A1").font = { name: "Aptos Display", size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  transferSheet.getCell("A1").alignment = { horizontal: "right", vertical: "middle" };
  transferSheet.addRow([]);
  transferSheet.addRow(["#", "اسم الطالب المشترك", "الكورس", "نوع الخطة", "المبلغ (ج.م)", "وسيلة الدفع", "رقم المحفظة المرسل منها", "تاريخ الطلب", "حالة الاشتراك", "صورة إيصال التحويل"]);
  enrollments.forEach((e, index) => {
    const rowIndex = transferSheet.addRow([
      index + 1,
      e.studentName,
      e.courseTitle || e.courseId,
      e.bookingType,
      e.amount,
      (e as any).paymentMethodName || "غير محدد",
      (e as any).senderNumber || "-",
      new Date(e.createdAt),
      e.status === "approved" ? "مكتمل ومفعل" : e.status === "pending" ? "قيد المراجعة والتحقق" : "مرفوض",
      e.transferImage || (e as any).transferImageUrl || "غير مرفق",
    ]).number;

    const source = e.transferImage || e.transferImageUrl;
    if (!source || !source.startsWith("data:image/")) return;
    const base64 = toDataImageBase64(source);
    const extension = toDataImageExtension(source);
    if (!base64) return;

    const imageId = workbook.addImage({ base64, extension: toExcelImageExtension(source) });
    transferSheet.addImage(imageId, {
      tl: { col: 9, row: rowIndex - 1 },
      ext: { width: 120, height: 70 },
    });
    transferSheet.getRow(rowIndex).height = 70;
  });
  styleReportTable(transferSheet, 4, transferSheet.rowCount);
  transferSheet.getColumn(5).numFmt = '#,##0.00 "ج.م"';
  transferSheet.getColumn(8).numFmt = "dd/mm/yyyy";

  const studentsSheet = workbook.addWorksheet("بيانات الطلاب");
  studentsSheet.views = [{ rightToLeft: true, showGridLines: false }];
  studentsSheet.columns = [{ width: 30 }, { width: 35 }, { width: 20 }, { width: 20 }, { width: 20 }];
  studentsSheet.mergeCells("A1:E2");
  studentsSheet.getCell("A1").value = "سجل الطلاب وبيانات التواصل";
  studentsSheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: REPORT_NAVY } };
  studentsSheet.getCell("A1").font = { name: "Aptos Display", size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  studentsSheet.getCell("A1").alignment = { horizontal: "right", vertical: "middle" };
  studentsSheet.addRow([]);
  studentsSheet.addRow(["اسم الطالب", "البريد الإلكتروني", "الصف الدراسي", "رقم هاتف الطالب", "رقم هاتف ولي الأمر"]);
  students.forEach((s) => studentsSheet.addRow([s.name, s.email, s.grade || "غير محدد", s.phone || "-", s.parentPhone || "-"]));
  styleReportTable(studentsSheet, 4, studentsSheet.rowCount);

  const teachersSheet = workbook.addWorksheet("أداء المدرسين");
  teachersSheet.views = [{ rightToLeft: true, showGridLines: false }];
  teachersSheet.columns = [{ width: 30 }, { width: 35 }, { width: 15 }, { width: 20 }, { width: 30 }];
  teachersSheet.mergeCells("A1:E2");
  teachersSheet.getCell("A1").value = "مؤشرات أداء المدرسين";
  teachersSheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: REPORT_NAVY } };
  teachersSheet.getCell("A1").font = { name: "Aptos Display", size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  teachersSheet.getCell("A1").alignment = { horizontal: "right", vertical: "middle" };
  teachersSheet.addRow([]);
  teachersSheet.addRow(["الاسم", "البريد الإلكتروني", "عدد الكورسات", "إجمالي المشتركين", "مجموع إيرادات المدرس (ج.م)"]);
  teachers.forEach((t) => {
    const tc = courses.filter(c => c.teacherIds.includes(t.id));
    const te = enrollments.filter(e => tc.some(c => c.id === e.courseId) && e.status === "approved");
    const rev = te.reduce((sum, e) => sum + e.amount, 0);
    teachersSheet.addRow([t.name, t.email, tc.length, te.length, rev]);
  });
  styleReportTable(teachersSheet, 4, teachersSheet.rowCount);
  teachersSheet.getColumn(5).numFmt = '#,##0.00 "ج.م"';

  const coursesSheet = workbook.addWorksheet("الكورسات والمبيعات");
  coursesSheet.views = [{ rightToLeft: true, showGridLines: false }];
  coursesSheet.columns = [{ width: 40 }, { width: 20 }, { width: 15 }, { width: 15 }, { width: 30 }];
  coursesSheet.mergeCells("A1:E2");
  coursesSheet.getCell("A1").value = "تحليل الكورسات والمبيعات";
  coursesSheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: REPORT_NAVY } };
  coursesSheet.getCell("A1").font = { name: "Aptos Display", size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  coursesSheet.getCell("A1").alignment = { horizontal: "right", vertical: "middle" };
  coursesSheet.addRow([]);
  coursesSheet.addRow(["اسم الكورس", "المستهدف", "عدد المحاضرات", "السعر الأساسي", "إجمالي المبيعات (عدد الطلاب)"]);
  courses.forEach((c) => {
    const enrolled = enrollments.filter(e => e.courseId === c.id && e.status === "approved").length;
    coursesSheet.addRow([c.title, c.level, c.lessonCount, c.price, enrolled]);
  });
  styleReportTable(coursesSheet, 4, coursesSheet.rowCount);
  coursesSheet.getColumn(4).numFmt = '#,##0.00 "ج.م"';

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Oxford_Analytics_${new Date().toLocaleDateString("en-GB").replace(/\//g, "-")}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);

  toast.success("تم تصدير تقرير Excel الشامل متضمناً الفترات الزمنية وصور التحويلات الحقيقية بنجاح ✓");
}

export default function AdminReportsManager() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportToExcel(filteredEnrollments, students, teachers, courses, fromDate, toDate);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إنشاء ملف التقرير");
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    void Promise.all([
      api<Enrollment[]>("/enrollments"),
      api<Course[]>("/courses"),
      api<User[]>("/users"),
    ]).then(([e, c, u]) => {
      setEnrollments(e);
      setCourses(c);
      setUsers(u);
    }).catch(() => toast.error("تعذر تحميل البيانات"))
      .finally(() => setLoading(false));
  }, []);

  const students = users.filter(u => u.role === "student");
  const teachers = users.filter(u => u.role === "teacher");

  const filteredEnrollments = enrollments.filter(e => {
    const d = new Date(e.createdAt);
    if (fromDate && d < new Date(fromDate)) return false;
    if (toDate && d > new Date(toDate + "T23:59:59.999Z")) return false;
    return true;
  });

  const totalRevenue = filteredEnrollments.filter(e => e.status === "approved").reduce((s, e) => s + e.amount, 0);
  const totalApproved = filteredEnrollments.filter(e => e.status === "approved").length;
  const totalPending = filteredEnrollments.filter(e => e.status === "pending").length;

  const revenueData = buildMonthlyRevenue(filteredEnrollments);
  const courseData = buildCourseEnrollments(filteredEnrollments);

  if (loading) {
    return (
      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
        <MetricsSkeleton count={4} />
        <TableSkeleton rows={6} cols={5} />
      </div>
    );
  }

  return (
    <>
      <div className="page-header flex-wrap gap-4">
        <div>
          <span className="eyebrow" style={{ color: "var(--primary)" }}>ADMIN / ANALYTICS</span>
          <h1>التقارير والتحليلات الشاملة</h1>
          <p style={{ color: "var(--ink-muted)", fontSize: "13px" }}>اختر الفترة الزمنية واضغط تصدير للحصول على ملف Excel متضمناً صور تحويلات الطلاب.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 text-xs font-bold text-slate-700">
            <span>من:</span>
            <input
              type="date"
              className="rounded-lg border border-slate-200 p-1 text-xs outline-none"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
            />
            <span>إلى:</span>
            <input
              type="date"
              className="rounded-lg border border-slate-200 p-1 text-xs outline-none"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
            />
            {(fromDate || toDate) && (
              <button
                className="text-red-500 hover:underline px-1"
                onClick={() => { setFromDate(""); setToDate(""); }}
              >
                مسح
              </button>
            )}
          </div>

          <button
            className="primary-btn"
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
            onClick={() => void handleExport()}
            disabled={exporting}
          >
            {exporting ? <span className="animate-spin">◌</span> : <Download size={16} />}
            {exporting ? "جارٍ تجهيز التقرير..." : "تصدير تقرير Excel الشامل (مع الصور)"}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        {[
          { icon: CircleDollarSign, label: "إجمالي الإيرادات", value: `${totalRevenue.toLocaleString()} ج.م`, bg: "#eef6ff", color: "#1a72d5" },
          { icon: Users, label: "الطلاب المسجلون", value: `${students.length} طالب`, bg: "#f0faf6", color: "#1a9970" },
          { icon: TrendingUp, label: "اشتراكات مفعّلة", value: `${totalApproved} اشتراك`, bg: "#fff5ef", color: "#f36a21" },
          { icon: BookOpen, label: "اشتراكات قيد المراجعة", value: `${totalPending} طلب`, bg: "#fffbea", color: "#c59a00" },
          { icon: BookOpen, label: "عدد الكورسات", value: `${courses.length} كورس`, bg: "#f5f0ff", color: "#7c4dff" },
          { icon: Users, label: "المدرسون", value: `${teachers.length} مدرس`, bg: "#fff0f5", color: "#e0306a" },
        ].map((kpi, i) => (
          <div className="paper-card" key={i} style={{ padding: "18px" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <div style={{ background: kpi.bg, color: kpi.color, padding: "10px", borderRadius: "12px", flexShrink: 0 }}>
                <kpi.icon size={20} />
              </div>
              <div>
                <span className="eyebrow" style={{ fontSize: "9px" }}>{kpi.label}</span>
                <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--ink)" }}>{kpi.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="chart-grid">
        <div className="chart-card">
          <div className="card-title">
            <div>
              <span className="eyebrow">MONTHLY REVENUE</span>
              <h3>الإيرادات الشهرية (ج.م)</h3>
            </div>
            <span className="chart-value">{totalRevenue.toLocaleString()} ج.م</span>
          </div>
          {revenueData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1A72D5" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#1A72D5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#edf1f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#8994a6" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#8994a6" }} />
                <Tooltip formatter={(v: number) => [`${v.toLocaleString()} ج.م`, "الإيراد"]} />
                <Area type="monotone" dataKey="value" stroke="#1A72D5" strokeWidth={3} fill="url(#revFill)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-muted)" }}>
              لا توجد إيرادات مسجلة بعد
            </div>
          )}
        </div>

        <div className="chart-card">
          <div className="card-title">
            <div>
              <span className="eyebrow">COURSE POPULARITY</span>
              <h3>الاشتراكات لكل كورس</h3>
            </div>
            <span className="chart-value mint">{totalApproved} مشترك</span>
          </div>
          {courseData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={courseData}>
                <CartesianGrid vertical={false} stroke="#edf1f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#8994a6" }} />
                <YAxis hide />
                <Tooltip formatter={(v: number) => [v, "مشترك"]} />
                <Bar dataKey="value" fill="#83cbb7" radius={[6, 6, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-muted)" }}>
              لا توجد اشتراكات مفعّلة بعد
            </div>
          )}
        </div>
      </div>

      {/* Teachers Table */}
      <div className="paper-card" style={{ marginTop: "24px" }}>
        <div className="card-title" style={{ marginBottom: "16px" }}>
          <div>
            <span className="eyebrow">TEACHER PERFORMANCE</span>
            <h3>أداء المدرسين</h3>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>المدرس</th>
                <th>عدد الكورسات</th>
                <th>الطلاب المشتركين</th>
                <th>إجمالي الإيراد</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t, i) => {
                const tc = courses.filter(c => c.teacherIds.includes(t.id));
                const te = enrollments.filter(e => tc.some(c => c.id === e.courseId) && e.status === "approved");
                const revenue = te.reduce((s, e) => s + e.amount, 0);
                return (
                  <tr key={t.id}>
                    <td>
                      <div className="person">
                        <span className={`avatar avatar-${i % 4}`}>{t.name[0]}</span>
                        <span>
                          <strong>{t.name}</strong>
                          <small>{t.email}</small>
                        </span>
                      </div>
                    </td>
                    <td><span className="signal-chip">{tc.length} كورس</span></td>
                    <td><strong>{te.length}</strong></td>
                    <td><strong style={{ color: "var(--primary)" }}>{revenue.toLocaleString()} ج.م</strong></td>
                  </tr>
                );
              })}
              {teachers.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--ink-muted)", padding: "20px" }}>لا يوجد مدرسون مسجلون.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
