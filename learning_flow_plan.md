# Teacher-to-student learning flow

## Goal
Create a shared local content experience that behaves like a real product before a backend exists.

## Data model
Use one `tafra-learning-content` LocalStorage document containing published lessons, exams, submissions, and grades. Lessons carry a course, title, description, lecture URL, resource URL, teacher, publication state, and timestamp. Exams carry a course, title, description, duration, questions, publication state, teacher, and timestamp. Submissions connect a student to an exam, retain selected answers, and store a nullable score plus review state.

## Teacher flow
1. Open the lessons workspace.
2. Create a lesson with title, course, description, lecture link, and optional materials link.
3. Publish it locally and show it in the teacher library with working external links.
4. Open the exams workspace.
5. Create an exam with title, course, duration, description, and at least one question with choices and a correct answer.
6. Publish it locally and expose a review action.
7. Open grades, review student submissions, enter or update a score, and mark the submission reviewed.

## Student flow
1. Open a course detail view and see teacher-published lessons for that course.
2. Open lecture links and material links from the lesson list.
3. Open exams to see teacher-published exams.
4. Start an exam, select answers, submit, and persist the calculated result locally.
5. Return to exams and see the score/status for the submitted exam.
6. After the teacher updates a grade, re-enter the student workspace and see the updated result.

## Constraints
No backend, authentication service, file upload, or payment provider is introduced in this pass. The interface must clearly label local/demo behavior, preserve the existing RTL Editorial Learning Atelier style, and keep all existing role navigation working.
