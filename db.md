PHASE 3 — STEP 3
IMPLEMENT PRISMA-BACKED REGISTRATION

The Prisma authentication core is now implemented and verified:

- Prisma User is authoritative for login.
- Prisma Session is authoritative when PRISMA_AUTH_ENABLED=true.
- Login /me/logout are working.
- Frontend bearer-token contract is preserved.
- No frontend/schema/migration/seed changes were made.

Now implement ONLY:

POST /api/auth/register

Do NOT implement:

- password reset
- permissions migration
- protected GET migration
- write-route migration
- X-Demo-Role complete removal
- frontend changes
- migration of store.users
- migration of store.sessions
- Cloud Run changes

==================================================
CRITICAL RULES
==================================================

1. Do not modify:

- prisma/schema.prisma
- prisma/migrations/*
- prisma/seed.ts
- frontend files

2. Do not run destructive database commands.

Never run:

prisma migrate reset
prisma db push --force-reset
DROP DATABASE
DROP SCHEMA

3. When PRISMA_AUTH_ENABLED=true, registration must use Prisma.

4. Do NOT silently fall back to legacy registration if Prisma fails.

5. Do NOT store plaintext passwords.

6. Do NOT trust client-provided permissions.

7. Do not modify unrelated business routes.

8. Preserve the existing API request/response contract.

==================================================
STEP 1 — AUDIT EXISTING REGISTER IMPLEMENTATION
==================================================

Before editing, inspect the exact existing:

POST /api/auth/register

implementation in backend/app.ts.

Identify:

- accepted request fields
- Zod validation
- role handling
- student status
- teacher status
- admin status
- admin invitation code
- teacher profile creation
- session creation
- token response
- pending response
- duplicate email behavior
- existing error messages/status codes

Do not change the contract unless absolutely required.

==================================================
STEP 2 — PRISMA USER CREATION
==================================================

When:

PRISMA_AUTH_ENABLED=true

create users through Prisma.

Use:

User

as the source of truth.

Map the existing lowercase API roles:

student
teacher
admin

to Prisma:

STUDENT
TEACHER
ADMIN

Do not store the lowercase enum values in Prisma.

==================================================
STEP 3 — PASSWORD SECURITY
==================================================

Hash registration passwords using the existing bcryptjs dependency.

The password must never be stored in:

- User
- store.users
- logs
- API responses
- any database field

Store only:

User.passwordHash

Use an appropriate bcrypt cost consistent with the existing authentication implementation.

Do not introduce another password hashing library.

==================================================
STEP 4 — STATUS COMPATIBILITY
==================================================

Preserve the current registration behavior exactly.

Based on the existing implementation:

Student:
- approved immediately
- receives a session/token if the existing behavior does so

Teacher:
- pending approval
- token should remain null if that is the current contract

Admin:
- pending approval
- token should remain null if that is the current contract

Do NOT invent a new approval workflow.

Map existing API status semantics to Prisma enum values.

==================================================
STEP 5 — TEACHER PROFILE
==================================================

If the existing teacher registration creates a teacher record:

create the corresponding Prisma:

TeacherProfile

using the newly created Prisma User UUID.

IMPORTANT:

The Prisma UUID is the internal identity.

Do NOT use:

teacher-demo

or another legacy string ID as a foreign key.

Preserve the existing teacher API behavior where possible.

If TeacherProfile requires fields that the existing registration does not provide, use the existing schema defaults/nullable fields only.

Do not modify the Prisma schema.

==================================================
STEP 6 — ADMIN INVITATION CODE
==================================================

Inspect how the existing admin registration validates:

store.settings.adminInviteCode

The Prisma schema already contains:

adminInviteCodeHash

Use secure hash verification against the stored Prisma setting where appropriate.

DO NOT:

- store the raw invitation code in Prisma
- return the invitation code
- log the invitation code
- introduce plaintext invitation-code persistence

If the seeded Prisma setting is already hashed, verify against it.

If the current Prisma setting is not sufficient to support this safely, STOP and report the exact blocker instead of weakening security.

Do not modify the schema or seed in this step.

==================================================
STEP 7 — DUPLICATE USERS
==================================================

Prisma has uniqueness constraints.

Registration must handle duplicate:

- email
- phone

without exposing raw Prisma/database errors.

Preserve the existing API error shape used by the frontend.

Do not leak database implementation details.

If the legacy route only checked email, still ensure Prisma uniqueness constraints are safely translated into the existing API response.

==================================================
STEP 8 — STUDENT AUTO-SESSION
==================================================

If the current registration behavior automatically logs in an approved student:

create the Prisma Session exactly like the new Prisma login flow.

Requirements:

- cryptographically random raw token
- SHA-256 tokenHash stored in Prisma
- raw token returned only to frontend
- expiresAt populated
- userAgent populated
- ipAddress populated

Do NOT duplicate session-generation logic.

Reuse the authentication helper created in:

backend/lib/auth.ts

==================================================
STEP 9 — TEACHER/ADMIN PENDING RESPONSE
==================================================

For pending teacher/admin registration, preserve the existing response contract.

If the existing response is:

{
  "data": {
    "token": null,
    "user": {...}
  }
}

keep that.

If the existing route returns another exact structure, preserve it.

Do not automatically authenticate pending users.

==================================================
STEP 10 — API USER MAPPING
==================================================

Reuse the centralized Prisma → API user mapper.

Do not create another independent user serialization implementation.

Preserve:

student
teacher
admin

as lowercase API roles.

Preserve legacy API-visible demo IDs only where the existing compatibility layer requires them.

For newly registered users, use the appropriate existing API ID behavior without corrupting Prisma foreign keys.

Remember:

API identity compatibility ≠ database identity.

==================================================
STEP 11 — TRANSACTIONAL TEACHER REGISTRATION
==================================================

Teacher registration creates:

1. User
2. TeacherProfile

These operations should be atomic.

Use a Prisma transaction where appropriate.

If TeacherProfile creation fails:

the newly created User must not remain as a partially created teacher account.

Do NOT use the long-running seed-style transaction pattern that previously caused Neon transaction timeout problems.

Keep the transaction short.

==================================================
STEP 12 — DO NOT CREATE PERMISSIONS YET
==================================================

Do not migrate the entire permission system in this step.

If registration currently assigns permissions through legacy behavior, inspect exactly what it does.

Do not blindly copy arbitrary client permissions into Prisma.

If Prisma UserPermission must be initialized for a newly registered account to preserve current behavior, implement only the minimum safe initialization required and document it.

Do not redesign authorization yet.

==================================================
STEP 13 — FEATURE FLAG BEHAVIOR
==================================================

When:

PRISMA_AUTH_ENABLED=true

POST /auth/register must use Prisma.

If Prisma is unavailable:

return a clear 503/database service error.

DO NOT silently create the account in store.users.

When:

PRISMA_AUTH_ENABLED=false

leave the existing legacy registration implementation unchanged.

This is a temporary rollback path only.

==================================================
STEP 14 — LEGACY STORE
==================================================

When Prisma registration is enabled:

DO NOT write the newly registered user into:

store.users

DO NOT write a Prisma session into:

store.sessions

Prisma must be authoritative for the new registration path.

The old store can remain untouched for legacy mode.

==================================================
STEP 15 — SECURITY
==================================================

Verify all of the following:

- passwordHash is never returned
- plaintext password is never persisted
- client cannot choose arbitrary permissions
- client cannot authenticate a pending user
- admin invitation code is never exposed
- Prisma UUID is used for database relationships
- raw session token is never persisted
- raw token is not logged
- database errors are not returned directly
- duplicate email/phone errors are sanitized

==================================================
STEP 16 — TEST MATRIX
==================================================

After implementation run:

pnpm exec prisma validate

pnpm run backend:check

Then run the backend with:

PRISMA_AUTH_ENABLED=true

Test at minimum:

1. Register student
2. Register teacher
3. Register admin with valid invitation code
4. Register admin with invalid invitation code
5. Duplicate email
6. Duplicate phone if supported by the current request
7. Short/invalid password
8. Verify student receives token if expected
9. Verify pending teacher receives token:null if expected
10. Verify pending admin receives token:null
11. Student token works with /auth/me
12. Pending teacher cannot authenticate through /auth/me
13. Pending admin cannot authenticate through /auth/me
14. Verify teacher profile exists in Prisma
15. Verify passwordHash exists and plaintext password does not
16. Verify newly created users exist in Neon
17. Verify no new users were inserted into legacy store.users in Prisma mode
18. Verify no Prisma session is inserted into legacy store.sessions
19. Verify Prisma failure returns 503 rather than falling back

Do not print:

- passwords
- invitation codes
- raw tokens
- DATABASE_URL

==================================================
STEP 17 — DATABASE VERIFICATION
==================================================

For test users verify:

User:
- UUID exists
- correct role
- correct status
- passwordHash populated
- lastLoginAt only changes after actual login

Teacher:
- TeacherProfile exists
- teacherProfile.userId points to Prisma User UUID

Session:
- exists only for approved/auto-login users
- tokenHash is 64 characters
- expiresAt is populated
- raw token is not stored

==================================================
STEP 18 — FRONTEND COMPATIBILITY
==================================================

Do not modify frontend files.

Verify that the existing frontend registration flow can continue using:

data.token

and:

data.user

and that it can handle:

token: null

for pending users.

Inspect but do not modify:

client/src/lib/api.ts
client/src/App.tsx
client/src/pages/Login.tsx

==================================================
STEP 19 — GIT SAFETY
==================================================

Before editing inspect git status.

At the end report:

- files changed
- files created
- files intentionally untouched
- schema changed? YES/NO
- migration changed? YES/NO
- seed changed? YES/NO
- frontend changed? YES/NO
- tests executed
- test results
- Prisma registration behavior
- teacher profile behavior
- admin invitation behavior
- remaining legacy authentication dependencies

Do NOT commit.

==================================================
SUCCESS CRITERIA
==================================================

[ ] POST /auth/register uses Prisma when PRISMA_AUTH_ENABLED=true
[ ] password is bcrypt-hashed
[ ] plaintext password is never persisted
[ ] Prisma UUID is the internal identity
[ ] student approval behavior preserved
[ ] teacher approval behavior preserved
[ ] admin approval behavior preserved
[ ] teacher profile created correctly
[ ] teacher creation is atomic
[ ] admin invitation code is verified securely
[ ] duplicate email handled safely
[ ] duplicate phone handled safely
[ ] approved student receives Prisma session if required
[ ] pending users do not receive usable sessions
[ ] raw session token is never stored
[ ] frontend contract remains unchanged
[ ] no frontend files changed
[ ] no schema/migration/seed changes
[ ] no legacy store writes when Prisma auth is enabled
[ ] Prisma failure does not silently fall back
[ ] prisma validate passes
[ ] backend:check passes
[ ] runtime registration tests pass

When all criteria pass, STOP.

Do not proceed to password reset or permissions migration automatically.