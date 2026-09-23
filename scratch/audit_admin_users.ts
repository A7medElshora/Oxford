import { prisma } from "../backend/lib/prisma.ts";

const TARGET_IDS = [
  "00000000-0000-0000-0000-000000000012", // admin@demo.com
  "04d0cb72-087b-4496-9aa6-bee799aaf3f4", // e2e-admin
];

async function audit() {
  console.log("=== AUDIT: Checking related data for target users ===\n");

  // 1. Confirm users exist
  const users = await prisma.user.findMany({
    where: { id: { in: TARGET_IDS } },
    select: { id: true, email: true, role: true, status: true, createdAt: true },
  });
  console.log("Target users found:", users.length);
  users.forEach(u => console.log(`  - ${u.id} | ${u.email} | ${u.role} | ${u.status}`));
  console.log();

  for (const userId of TARGET_IDS) {
    const user = users.find(u => u.id === userId);
    console.log(`\n--- Checking user: ${user?.email || userId} ---`);

    // RESTRICT relations (these will BLOCK deletion):
    const [
      courseTeacher,
      courseTeacherPlan,
      lessons,
      exams,
      examSubmissionsAsStudent,
      enrollmentsAsStudent,
      enrollmentsAsTeacher,
      attendanceAsStudent,
      assignments,
      assignmentSubmissionsAsStudent,
      messages,
    ] = await Promise.all([
      prisma.courseTeacher.count({ where: { teacherId: userId } }),
      prisma.courseTeacherPlan.count({ where: { teacherId: userId } }),
      prisma.lesson.count({ where: { teacherId: userId } }),
      prisma.exam.count({ where: { teacherId: userId } }),
      prisma.examSubmission.count({ where: { studentId: userId } }),
      prisma.enrollment.count({ where: { studentId: userId } }),
      prisma.enrollment.count({ where: { teacherId: userId } }),
      prisma.attendanceRecord.count({ where: { studentId: userId } }),
      prisma.assignment.count({ where: { teacherId: userId } }),
      prisma.assignmentSubmission.count({ where: { studentId: userId } }),
      prisma.message.count({ where: { senderId: userId } }),
    ]);

    // Cascade/SetNull relations (safe):
    const [
      permissions,
      sessions,
      passwordResets,
      notifications,
      conversationParticipants,
      carts,
      mediaFiles,
      calendarEvents,
      announcements,
      reviewedSubmissions,
      recordedAttendance,
      reviewedAssignments,
    ] = await Promise.all([
      prisma.userPermission.count({ where: { userId } }),
      prisma.session.count({ where: { userId } }),
      prisma.passwordResetToken.count({ where: { userId } }),
      prisma.notification.count({ where: { userId } }),
      prisma.conversationParticipant.count({ where: { userId } }),
      prisma.cart.count({ where: { studentId: userId } }),
      prisma.mediaFile.count({ where: { uploadedBy: userId } }),
      prisma.calendarEvent.count({ where: { createdBy: userId } }),
      prisma.announcement.count({ where: { createdBy: userId } }),
      prisma.examSubmission.count({ where: { reviewedBy: userId } }),
      prisma.attendanceRecord.count({ where: { recordedBy: userId } }),
      prisma.assignmentSubmission.count({ where: { reviewedBy: userId } }),
    ]);

    console.log("\n  [RESTRICT - will BLOCK deletion if > 0]:");
    console.log(`    CourseTeacher (as teacher):         ${courseTeacher}`);
    console.log(`    CourseTeacherPlan (as teacher):     ${courseTeacherPlan}`);
    console.log(`    Lessons (as teacher):               ${lessons}`);
    console.log(`    Exams (as teacher):                 ${exams}`);
    console.log(`    ExamSubmissions (as student):       ${examSubmissionsAsStudent}`);
    console.log(`    Enrollments (as student):           ${enrollmentsAsStudent}`);
    console.log(`    Enrollments (as teacher):           ${enrollmentsAsTeacher}`);
    console.log(`    AttendanceRecords (as student):     ${attendanceAsStudent}`);
    console.log(`    Assignments (as teacher):           ${assignments}`);
    console.log(`    AssignmentSubmissions (as student): ${assignmentSubmissionsAsStudent}`);
    console.log(`    Messages (as sender):               ${messages}`);

    const hasRestrict = [courseTeacher, courseTeacherPlan, lessons, exams,
      examSubmissionsAsStudent, enrollmentsAsStudent, enrollmentsAsTeacher,
      attendanceAsStudent, assignments, assignmentSubmissionsAsStudent, messages]
      .some(count => count > 0);

    console.log(`\n  [CASCADE/SetNull - auto-handled on delete]:`);
    console.log(`    UserPermissions:           ${permissions}`);
    console.log(`    Sessions:                  ${sessions}`);
    console.log(`    PasswordResetTokens:       ${passwordResets}`);
    console.log(`    Notifications:             ${notifications}`);
    console.log(`    ConversationParticipants:  ${conversationParticipants}`);
    console.log(`    Carts:                     ${carts}`);
    console.log(`    MediaFiles (uploader):     ${mediaFiles}`);
    console.log(`    CalendarEvents (creator):  ${calendarEvents}`);
    console.log(`    Announcements (creator):   ${announcements}`);
    console.log(`    ReviewedSubmissions:       ${reviewedSubmissions}`);
    console.log(`    RecordedAttendance:        ${recordedAttendance}`);
    console.log(`    ReviewedAssignments:       ${reviewedAssignments}`);

    console.log(`\n  => SAFE TO DELETE: ${!hasRestrict ? "YES ✅" : "NO ❌ - RESTRICT relations found!"}`);
  }
}

audit()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
