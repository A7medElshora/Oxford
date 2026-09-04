# Oxford Learning Platform API

Backend preparation for the learning platform. This service is intentionally independent from the client and does not connect to a database, authentication provider, storage service, payment provider, or email service.

## Run

From the repository root:

```bash
npm run backend:dev
```

The API listens on `http://127.0.0.1:4000` by default. Set `BACKEND_PORT` to change the port.

## Demo authentication

The API accepts the three demo accounts already used by the client:

- `student@demo.com`
- `teacher@demo.com`
- `admin@demo.com`

The demo password is `123456`. `POST /api/auth/login` returns an in-memory bearer token. For quick manual calls, `X-Demo-Role: student|teacher|admin` can be used instead. Neither mechanism is production authentication.

## API groups

All paths below are prefixed with `/api`:

- `GET /health`, `GET /meta`
- `/auth`: login, logout, current user, password-reset placeholder
- `/courses`, `/teachers`: public catalog and protected management
- `/lessons`, `/exams`: teacher authoring and student consumption
- `/exams/:examId/submissions`, `/submissions`: submissions and grading
- `/enrollments`: public booking requests and admin status changes
- `/cart`: student cart preparation
- `/attendance`: attendance records
- `/assignments`, `/assignment-submissions`: assignments and delivery
- `/conversations`, `/conversations/:id/messages`: messaging
- `/calendar`: learning events
- `/dashboard`, `/reports/overview`: role-aware dashboard data
- `/profile`, `/notifications`, `/settings`: account shell endpoints

## Current boundaries

- Data resets whenever the process restarts.
- No frontend route or localStorage flow has been changed.
- File upload, payments, email, OAuth, database persistence, and production session security are deliberately left as integration points.
- `backend/app.ts` exports the Express app so a database or test harness can be introduced later without changing the route contract.
