# AI Usage

## Tools and Prompts

### AI tools used

-   **ChatGPT** --- Used as a senior-development review and planning
    assistant for:
    -   backend architecture decisions
    -   appointment and therapist/patient booking flows
    -   recurring appointment design
    -   slot availability and concurrency handling
    -   authentication and authorization security reviews
    -   JWT and refresh-token architecture
    -   cookie-based authentication
    -   CORS/CSRF considerations
    -   code-structure and dead-code cleanup planning
    -   writing implementation prompts for the coding agent
    -   challenging and reviewing implementation results rather than
        blindly accepting them
-   **Antigravity** --- Used as the coding/implementation agent to
    inspect the repository, implement approved changes, run
    tests/type-checks, and report implementation results. Its output was
    reviewed and challenged before moving to the next phase.

### How AI was used

The workflow was intentionally iterative:

1.  Ask AI to analyze the current implementation or design problem.
2.  Challenge the proposed architecture and ask why a particular
    approach was necessary.
3.  Convert the agreed approach into a focused implementation prompt.
4.  Ask Antigravity to implement one security/architecture change at a
    time.
5.  Review the implementation report and test results.
6.  Identify gaps or incorrect assumptions.
7.  Run another targeted audit instead of assuming the implementation
    was correct.
8.  Only then move to the next phase.

The goal was to use AI for reasoning, review, and implementation
assistance while keeping the final technical decisions and verification
under developer review.

------------------------------------------------------------------------

## Exact Prompts

The following prompts are copied from the AI conversation exactly as
used during the development process. They are intentionally preserved
rather than rewritten.

### Prompt 1 --- Recurring appointment series authorization

``` text
SECURITY PHASE 1 — FIX SEC-002 RECURRING APPOINTMENT SERIES IDOR

We are now fixing the CRITICAL recurring appointment series authorization
vulnerability identified in the security audit as SEC-002.

IMPORTANT:
This is an implementation task.

Do NOT modify unrelated security areas.

Do NOT modify:
- Login
- Registration
- JWT storage
- JWT generation/validation
- CORS
- Rate limiting
- Slot concurrency/advisory locks
- Payment verification

Only fix recurring appointment series authorization and related tests.

==================================================
1. SECURITY VULNERABILITY
==================================================

The audit identified that recurring appointment series operations can use
seriesId without properly verifying that the authenticated user owns or is
authorized to modify that series.

This creates an IDOR/BOLA vulnerability.

Example:

Patient A
    |
    | authenticated as A
    |
    | seriesId = Patient B's series
    ↓
Cancel recurring series
    ↓
Patient B's appointments are modified

This MUST NOT be possible.

==================================================
2. REQUIRED SECURITY INVARIANT
==================================================

Before ANY recurring-series operation:

Authenticated user
        ↓
Identify requested series
        ↓
Verify ownership/authorization
        ↓
Only then modify/read the series

Never:

Authenticated user
        ↓
seriesId
        ↓
UPDATE by seriesId alone

==================================================
3. PATIENT OWNERSHIP
==================================================

For a PATIENT:

A patient may access or modify ONLY recurring appointment series belonging
to that authenticated patient.

The authenticated patient identity MUST come from:

req.user.id

NOT from:

- req.body.patientId
- req.query.patientId
- URL patientId
- any client-supplied owner ID

Example:

Patient A:
req.user.id = A

Series:
seriesId = SERIES_B
patientId = B

Request:

POST /appointments/series/SERIES_B/cancel

Expected:

403 or 404 according to existing API conventions.

NO records belonging to Patient B may be modified.

==================================================
4. THERAPIST OWNERSHIP
==================================================

Inspect the existing business rules for therapist recurring-series
operations.

If therapists are allowed to modify/cancel series assigned to them:

Therapist A
    ↓
may only modify series where
    ↓
therapistId = Therapist A

Therapist A MUST NOT modify Therapist B's series.

Do not invent new therapist functionality.

Preserve the existing business rules.

==================================================
5. ADMIN
==================================================

The current project reportedly references ADMIN in some authorization logic,
but ADMIN is not present in the Prisma Role enum.

Do NOT add ADMIN.

Do NOT redesign the role system.

If the current role model has no real ADMIN role, preserve that behavior and
document it.

Do not create a fake admin authorization path.

==================================================
6. INSPECT ALL SERIES OPERATIONS
==================================================

Do NOT fix only the cancellation endpoint.

Search the entire backend for:

seriesId

and recurring-series operations.

Inspect:

- appointment routes
- appointment controllers
- appointment services
- appointment repositories
- recurring appointment services
- Prisma models
- recurring appointment creation
- recurring appointment cancellation
- recurring appointment updates
- recurring appointment retrieval
- recurring appointment rescheduling
- series status changes

Identify every endpoint that accepts or uses seriesId.

For each endpoint determine:

Authentication
Role authorization
Ownership authorization
Database authorization

==================================================
7. DATABASE QUERY SECURITY
==================================================

The final database operation must not rely on seriesId alone where ownership
is required.

BAD:

where: {
    seriesId
}

BETTER:

where: {
    seriesId,
    patientId: authenticatedUserId
}

or, for therapist operations where appropriate:

where: {
    seriesId,
    therapistId: authenticatedUserId
}

Use the actual Prisma schema and relationships.

Do NOT blindly copy these examples if the schema differs.

==================================================
8. TRANSACTION SAFETY
==================================================

If cancelling or modifying a recurring series affects multiple appointments,
preserve the existing transaction.

For example:

SERIES_123
    ↓
Appointment 1
Appointment 2
Appointment 3
Appointment 4
    ↓
transaction
    ↓
authorization verified
    ↓
all appropriate appointments modified atomically

Authorization MUST happen before the destructive update.

Do not partially modify a series because authorization failed halfway through.

==================================================
9. DO NOT LEAK RESOURCE EXISTENCE
==================================================

When a patient requests another patient's series:

Do not return:

"This series exists but belongs to another patient."

Use the project's existing secure convention:

403 Forbidden

or

404 Not Found

Choose consistently with the current API behavior.

The goal is to avoid unnecessary resource enumeration.

==================================================
10. PATIENT ATTACK SCENARIOS
==================================================

The following MUST fail:

Scenario 1:

Patient A
seriesId = Patient B's series

→ Cancel

Expected:
403/404

No records modified.

Scenario 2:

Patient A
seriesId = Patient B's series
patientId = Patient B supplied in body

Expected:
403/404

The backend must still use req.user.id.

Scenario 3:

Patient A
seriesId = random valid UUID

Expected:
403/404/appropriate not-found response.

Scenario 4:

Patient A
seriesId = own series

Expected:
SUCCESS.

==================================================
11. THERAPIST ATTACK SCENARIOS
==================================================

Scenario 5:

Therapist A
series belongs to Therapist A

Expected:
SUCCESS if allowed by existing business rules.

Scenario 6:

Therapist A
series belongs to Therapist B

Expected:
403/404.

Scenario 7:

Patient attempts therapist-only recurring-series operation.

Expected:
403.

==================================================
12. TEST DATABASE STATE
==================================================

Tests must create at least:

Patient A
Patient B

Therapist A
Therapist B where applicable

Series A
Series B

Series A belongs to Patient A.

Series B belongs to Patient B.

Then verify cross-user access is rejected.

==================================================
13. AUTOMATED SECURITY TESTS
==================================================

Add/update tests for:

TEST 1:
Patient A cancels own recurring series.

Expected:
SUCCESS.

TEST 2:
Patient A attempts to cancel Patient B's series.

Expected:
403/404.

TEST 3:
Patient A sends Patient B's patientId in request body.

Expected:
Still rejected.

TEST 4:
Patient A attempts to access Patient B's series.

Expected:
403/404.

TEST 5:
Patient A attempts to update Patient B's series if update functionality
exists.

Expected:
403/404.

TEST 6:
Therapist A accesses/modifies own authorized series.

Expected:
SUCCESS if supported.

TEST 7:
Therapist A accesses/modifies Therapist B's series.

Expected:
403/404.

TEST 8:
Unauthenticated request.

Expected:
401.

TEST 9:
Invalid/non-existent seriesId.

Expected:
appropriate not-found response.

==================================================
14. REGRESSION TESTS
==================================================

Verify that this change does NOT break:

- One-time appointment booking
- Recurring appointment creation
- Recurring conflict detection
- Appointment HOLD
- HOLD expiration
- Payment flow
- Appointment cancellation
- Existing slot concurrency
- PostgreSQL advisory locking
- Existing patient appointment access

Do not modify the existing slot-lock implementation.

==================================================
15. IDEMPOTENCY
==================================================

Preserve the existing idempotency behavior.

Do not accidentally make authorization dependent on an idempotency key.

The operation must remain safe if the same authorized cancellation request is
repeated.

Unauthorized users must not gain access by reusing an idempotency key.

==================================================
16. IMPORTANT SECURITY RULE
==================================================

Do NOT solve this by:

- Hiding seriesId from frontend
- Changing UUID format
- Adding frontend route guards
- Checking only that the user is authenticated
- Checking only that the user has PATIENT role
- Checking only that the user has THERAPIST role

Authentication answers:

"Who are you?"

Authorization must answer:

"Are you allowed to modify THIS series?"

==================================================
17. IMPLEMENTATION QUALITY
==================================================

Follow the project's existing architecture.

Preserve:

Controller
    ↓
Service
    ↓
Repository

Do not duplicate complex authorization logic across many controllers if the
existing architecture has a suitable service/repository boundary.

However, do not move authorization into a layer where the authenticated
identity becomes unavailable or can be bypassed.

==================================================
18. AFTER IMPLEMENTATION
==================================================

Run:

- Recurring appointment tests
- Appointment authorization tests
- New IDOR tests
- Existing regression tests

Then report:

1. Files changed
2. Endpoints audited
3. Ownership rule implemented
4. Database query changes
5. Tests added
6. Test results
7. Any remaining recurring-series authorization risks

==================================================
19. FINAL ACCEPTANCE CRITERIA
==================================================

SEC-002 can only be considered FIXED when:

[ ] Patient A cannot modify Patient B's series
[ ] Patient A cannot cancel Patient B's series
[ ] Patient A cannot view Patient B's series
[ ] patientId from request body cannot bypass ownership
[ ] Therapist A cannot modify Therapist B's series
[ ] Unauthenticated users are rejected
[ ] Authorization occurs before destructive database updates
[ ] Relevant database queries enforce ownership appropriately
[ ] Existing transaction behavior is preserved
[ ] Existing idempotency behavior is preserved
[ ] Existing booking/hold concurrency is unchanged
[ ] Automated cross-user IDOR tests pass

After implementation, do NOT make changes to other security findings.
```

### Prompt 2 --- JWT validation and secret hardening

``` text
SECURITY PHASE — JWT VALIDATION AND SECRET HARDENING

The JWT audit is complete.

Implement ONLY the JWT validation and secret-configuration hardening identified
by the audit.

DO NOT migrate JWTs to cookies yet.

DO NOT modify localStorage yet.

DO NOT modify CORS.

DO NOT implement CSRF.

DO NOT redesign the refresh-token architecture yet.

DO NOT modify appointment, booking, payment, or authorization business logic.

==================================================
1. EXPLICIT JWT ALGORITHM
==================================================

The current implementation uses:

jwt.sign(...)
jwt.verify(token, secret)

without explicitly specifying the algorithm.

Change the implementation to explicitly use the intended algorithm.

The current effective algorithm is HS256.

Use:

HS256

explicitly during:

- Access-token signing
- Access-token verification
- Refresh-token signing
- Refresh-token verification

Do not allow the verifier to accept arbitrary algorithms.

The verify configuration must explicitly restrict accepted algorithms.

==================================================
2. JWT ISSUER
==================================================

Introduce an explicit JWT issuer configuration.

Example:

JWT_ISSUER

Do NOT hardcode the production issuer if the project already uses environment
configuration.

Access tokens must include:

iss

Refresh tokens must also have an explicit issuer appropriate to the
application.

Use the existing configuration architecture.

==================================================
3. JWT AUDIENCE
==================================================

Introduce explicit audience configuration.

Example:

JWT_AUDIENCE

Access tokens should contain:

aud

Backend verification must explicitly validate the expected audience.

Do not accept tokens intended for another service.

==================================================
4. ACCESS TOKEN CLAIMS
==================================================

Preserve the existing required claims:

sub
email
role

Continue using:

iat
exp

Add:

iss
aud

Do not put passwords, secrets, refresh tokens, or unnecessary sensitive
information into JWT claims.

==================================================
5. REFRESH TOKEN CLAIMS
==================================================

Preserve the current refresh-token purpose.

Current refresh token contains:

sub

Add appropriate:

iss
aud

If the application already distinguishes token types, preserve that behavior.

If adding a token-type claim is straightforward and consistent with the
existing architecture, use something explicit such as:

tokenType: "refresh"

IMPORTANT:

Do not implement refresh-token rotation or persistence in this task.

That will be handled separately.

==================================================
6. ACCESS TOKEN VERIFICATION
==================================================

Update backend access-token verification so it explicitly validates:

- Signature
- Algorithm = HS256
- exp
- iss
- aud

Continue rejecting:

- Missing token
- Invalid token
- Expired token
- Invalid signature
- Wrong algorithm
- Wrong issuer
- Wrong audience

Do not weaken current authentication behavior.

==================================================
7. REFRESH TOKEN VERIFICATION
==================================================

Update refresh-token verification to explicitly validate:

- Signature
- Algorithm = HS256
- exp
- iss
- aud

If token type is implemented, ensure a refresh token cannot be accepted as an
access token.

==================================================
8. SEPARATE ACCESS AND REFRESH SECRETS
==================================================

Preserve separate secrets:

JWT_SECRET

JWT_REFRESH_SECRET

Never use the access-token secret to verify refresh tokens.

Never use the refresh-token secret to verify access tokens.

==================================================
9. REMOVE INSECURE FALLBACK SECRETS
==================================================

The current configuration reportedly contains:

process.env.JWT_SECRET || 'changeme'

and:

process.env.JWT_REFRESH_SECRET || 'changeme-refresh'

This MUST NOT remain in production-capable configuration.

Do not silently replace these with another hardcoded secret.

Instead:

- Require JWT_SECRET
- Require JWT_REFRESH_SECRET
- Fail application startup if required secrets are missing in production

Use the existing environment/configuration architecture.

==================================================
10. SECRET STRENGTH
==================================================

Do not hardcode a replacement secret.

Add configuration validation that rejects obviously weak secrets.

Do not expose the secret in:

- logs
- API responses
- errors
- frontend configuration

Do not put JWT secrets in VITE_* variables or any frontend environment
variable.

==================================================
11. DEVELOPMENT / TEST ENVIRONMENT
==================================================

Do not unnecessarily break tests.

Inspect the project's existing test configuration.

If tests require JWT secrets:

Provide them through the existing test environment/configuration mechanism.

Do NOT add:

JWT_SECRET="changeme"

to production configuration.

Keep development/test configuration clearly separated from production.

==================================================
12. CONFIGURATION VALIDATION
==================================================

Inspect:

Backend/src/config/index.ts

and the existing startup/bootstrap architecture.

Implement configuration validation consistent with the project.

If required production variables are missing:

Application startup should fail clearly.

Example concept:

Missing JWT_SECRET
→ startup configuration error

Do not allow the application to silently run using a known default secret.

==================================================
13. ERROR HANDLING
==================================================

Do not expose:

- JWT secret
- decoded token contents unnecessarily
- cryptographic details

to API clients.

Continue returning the application's existing generic authentication error.

Detailed errors may be logged server-side only if they do not contain secrets
or tokens.

==================================================
14. TESTS
==================================================

Add/update automated tests.

TEST 1:

Valid access token.

Expected:
Accepted.

TEST 2:

Expired access token.

Expected:
401.

TEST 3:

Wrong signature.

Expected:
401.

TEST 4:

Wrong algorithm.

Expected:
401.

TEST 5:

Wrong issuer.

Expected:
401.

TEST 6:

Wrong audience.

Expected:
401.

TEST 7:

Valid refresh token.

Expected:
Accepted by refresh endpoint.

TEST 8:

Access token supplied to refresh endpoint.

Expected:
Rejected if token type is enforced.

TEST 9:

Refresh token signed using access-token secret.

Expected:
Rejected.

TEST 10:

Access token signed using refresh-token secret.

Expected:
Rejected.

TEST 11:

Production configuration without JWT_SECRET.

Expected:
Application refuses to start.

TEST 12:

Production configuration without JWT_REFRESH_SECRET.

Expected:
Application refuses to start.

==================================================
15. REGRESSION TESTS
==================================================

Verify:

- Login still works
- Registration still works
- Access token authentication works
- Refresh endpoint still works
- Protected routes still work
- Logout still works according to CURRENT behavior

Do not change logout semantics in this task.

Do not change localStorage behavior in this task.

Do not change CORS.

==================================================
16. IMPORTANT SCOPE BOUNDARY
==================================================

The audit identified these separate findings:

JWT-001:
Refresh token in localStorage + no server-side revocation

JWT-002:
Access token in localStorage

JWT-003:
JWT validation lacks explicit algorithm/issuer/audience constraints

JWT-004:
Insecure fallback JWT secrets

For THIS task:

FIX:
JWT-003
JWT-004

DO NOT FIX YET:
JWT-001
JWT-002

Those require a separate token-storage/refresh-session migration.

==================================================
17. FINAL VERIFICATION
==================================================

After implementation provide:

1. Files changed
2. JWT signing changes
3. JWT verification changes
4. Algorithm restriction
5. Issuer configuration
6. Audience configuration
7. Secret configuration changes
8. Startup validation
9. Tests added
10. Test results
11. Confirmation that localStorage was NOT changed
12. Confirmation that CORS was NOT changed
13. Confirmation that refresh-token rotation/revocation was NOT changed

Do not modify unrelated security findings.
```

### Prompt 3 --- Cookie-based authentication migration

``` text
SECURITY PHASE — MIGRATE AUTHENTICATION TO HTTPONLY COOKIE-BASED REFRESH

The server-side RefreshSession architecture has already been implemented.

Now migrate the browser authentication flow to secure cookie-based refresh
tokens.

IMPORTANT:

The target architecture is:

ACCESS TOKEN:
- Short-lived JWT
- Returned to frontend
- Stored ONLY in frontend memory
- Sent using Authorization: Bearer <accessToken>

REFRESH TOKEN:
- Opaque random token
- Stored ONLY in an HttpOnly cookie
- Secure in production
- Appropriate SameSite policy
- Validated against the server-side RefreshSession database
- NEVER exposed to JavaScript
- NEVER stored in localStorage/sessionStorage
- NEVER returned in JSON

DO NOT use the refresh token as a JWT.

==================================================
1. REMOVE REFRESH TOKEN FROM JSON
==================================================

Login must no longer return:

{
    accessToken,
    refreshToken
}

Instead:

{
    accessToken,
    user
}

The refresh token must be delivered ONLY through:

Set-Cookie

The raw refresh token must never be present in the JSON response.

Apply the same rule to:

- Login
- Register
- Refresh

where applicable.

==================================================
2. REFRESH TOKEN COOKIE
==================================================

Set the refresh token using a secure cookie.

Required production properties:

HttpOnly: true
Secure: true

Use an appropriate:

SameSite

value based on the actual frontend/backend deployment.

Do NOT blindly use:

SameSite=None

unless cross-site cookie behavior is actually required.

Use the smallest appropriate:

Path

Prefer limiting the cookie to the refresh endpoint if compatible with the
application, for example:

Path=/api/v1/auth/refresh

Use an appropriate Max-Age/Expires matching the server-side refresh-session
lifetime.

Do not expose the cookie value to frontend JavaScript.

==================================================
3. COOKIE NAME
==================================================

Use a clear server-side configuration value such as:

REFRESH_TOKEN_COOKIE_NAME

Do not hardcode the production cookie name throughout the application.

The cookie name should not contain the actual token.

==================================================
4. COOKIE SECRET / SIGNING
==================================================

IMPORTANT:

The refresh token is an opaque random token backed by RefreshSession.

Do NOT add another JWT layer to the cookie.

The cookie contains the opaque refresh token.

Server flow:

Cookie
 ↓
raw refresh token
 ↓
hash
 ↓
RefreshSession.tokenHash
 ↓
validate session
```

================================================== 5. LOGIN FLOW
==================================================

Change login to:

User credentials ↓ Authenticate user ↓ Generate access JWT ↓ Generate
opaque refresh token ↓ Hash refresh token ↓ Create RefreshSession ↓ Set
HttpOnly refresh cookie ↓ Return accessToken + user

The frontend must never receive the raw refresh token in JSON.

================================================== 6. REGISTER FLOW
==================================================

If registration currently creates an authenticated session:

Use the same flow:

Registration ↓ Create user ↓ Create access token ↓ Create refresh
session ↓ Set HttpOnly refresh cookie ↓ Return access token + user

Do not return refreshToken in JSON.

================================================== 7. REFRESH ENDPOINT
==================================================

Change:

POST /auth/refresh

so that it reads the refresh token from the HttpOnly cookie.

Do NOT accept refreshToken from:

-   request body
-   query parameter
-   Authorization header
-   localStorage
-   frontend JavaScript

Flow:

POST /auth/refresh ↓ Read cookie ↓ Hash opaque token ↓ Find
RefreshSession ↓ Validate: session exists not revoked not expired ↓
Rotate session ↓ Revoke old session ↓ Create new refresh token ↓ Set new
HttpOnly cookie ↓ Return new access token

Response should NOT contain refreshToken.

================================================== 8. REFRESH TOKEN
ROTATION ==================================================

Preserve the existing server-side rotation behavior.

Old token:

Token A

Refresh:

Token A ↓ revoked ↓ Token B ↓ new cookie

The browser receives the new cookie through:

Set-Cookie

The frontend does not need to know Token B.

================================================== 9. CONCURRENT REFRESH
==================================================

Preserve the existing concurrency-safe refresh-session rotation.

If:

Request A → Cookie Token A Request B → Cookie Token A

Only one should successfully consume Token A.

Do NOT weaken the existing database transaction/atomic behavior.

If the current implementation is not race-safe, report it instead of
silently removing the protection.

================================================== 10. FRONTEND STORAGE
==================================================

Remove all frontend refresh-token storage.

Search the ENTIRE frontend for:

refreshToken refresh_token localStorage sessionStorage

Specifically remove authentication-related code such as:

localStorage.setItem("refresh_token", ...)
localStorage.getItem("refresh_token")
localStorage.removeItem("refresh_token")

The refresh token must not be readable by JavaScript.

================================================== 11. ACCESS TOKEN
STORAGE ==================================================

Remove access-token persistence from:

localStorage sessionStorage

The access token must be stored ONLY in application memory.

For example:

Auth service Auth context Auth store

Use the project's existing state-management architecture.

Do not introduce another state-management library.

================================================== 12. PAGE RELOAD
==================================================

Because the access token is memory-only:

Browser ↓ Page reload ↓ Access token gone ↓ Frontend initializes ↓ POST
/auth/refresh ↓ Browser automatically sends HttpOnly cookie ↓ Backend
validates RefreshSession ↓ New access token returned ↓ Frontend stores
access token in memory ↓ User remains authenticated

Implement this without redirect loops.

================================================== 13. FRONTEND HTTP
CLIENT ==================================================

Update the frontend API client/interceptor.

Authenticated requests:

Authorization: Bearer `<in-memory-access-token>`{=html}

Refresh request:

POST /auth/refresh

must send cookies.

If using fetch:

credentials: "include"

If using Axios:

withCredentials: true

Use the project's existing HTTP client.

Do not add a second HTTP client.

================================================== 14. 401 HANDLING
==================================================

Implement safe refresh behavior.

Example:

API request ↓ 401 ↓ attempt refresh ↓ new access token ↓ retry original
request ONCE

If refresh fails:

-   Clear in-memory access token
-   Clear authenticated user state
-   Redirect/logout according to existing application behavior

Prevent infinite loops.

Do NOT attempt to refresh the refresh endpoint itself.

================================================== 15. CONCURRENT 401
REQUESTS ==================================================

Handle:

Request A → 401 Request B → 401 Request C → 401

Do NOT unnecessarily send:

3 refresh requests

Implement a single-flight refresh mechanism:

First request: starts refresh

Other requests: wait for same refresh operation

After success: retry using new access token

If refresh fails: all waiting requests fail cleanly and user is logged
out.

================================================== 16. LOGOUT
==================================================

Logout must now work using the cookie.

Frontend must NOT send:

{ refreshToken: "..." }

because JavaScript cannot access the HttpOnly cookie.

Instead:

POST /auth/logout

with credentials enabled.

Backend:

Read refresh token from cookie ↓ Hash token ↓ Find RefreshSession ↓
Revoke session ↓ Clear cookie

Use:

res.clearCookie(...)

with the SAME:

-   cookie name
-   path
-   domain
-   sameSite
-   secure

configuration required for the original cookie.

After logout:

Cookie removed + RefreshSession revoked + Access token removed from
memory

================================================== 17. CORS
==================================================

Now configure CORS correctly for cookie-based authentication.

DO NOT use:

Access-Control-Allow-Origin: \*

when credentials are required.

Use an explicit allowlist.

Configure the existing backend CORS middleware to allow only trusted
frontend origins.

Use environment configuration, for example:

CORS_ALLOWED_ORIGINS

Do not hardcode production frontend URLs.

================================================== 18. CREDENTIALS
==================================================

Because the refresh cookie must be sent cross-origin when applicable:

Backend:

Access-Control-Allow-Credentials: true

Frontend refresh requests:

credentials: "include"

or:

withCredentials: true

Do not enable credentials globally unless required.

Prefer enabling it for the authentication API client/configuration where
appropriate.

================================================== 19. CORS ORIGIN
VALIDATION ==================================================

Allowed:

https://trusted-frontend.example.com

Rejected:

https://evil.example.com

Do NOT accept:

-   

Do NOT reflect arbitrary:

Origin

headers.

The allowed origin must come from trusted configuration.

================================================== 20. SAME-SITE
DEPLOYMENT ==================================================

Before choosing SameSite, inspect the actual deployment.

Determine whether frontend and backend are:

-   Same-origin
-   Same-site but different origins
-   Truly cross-site

Then choose the least permissive cookie configuration that works.

Do not automatically use:

SameSite=None

if:

SameSite=Lax

or another stricter option works.

If SameSite=None is genuinely required:

Secure MUST also be enabled.

================================================== 21. CSRF PROTECTION
==================================================

IMPORTANT:

HttpOnly protects the cookie from JavaScript access.

HttpOnly does NOT by itself prevent CSRF.

Because the refresh endpoint uses a cookie, evaluate CSRF risk.

Determine whether the chosen:

SameSite

configuration sufficiently constrains the refresh endpoint for the
actual deployment.

If cross-site cookies require:

SameSite=None

implement an appropriate CSRF defense for state-changing
cookie-authenticated requests.

Do NOT invent a custom weak CSRF mechanism.

If the project can use a robust existing CSRF approach, use it.

At minimum document:

-   CSRF threat model
-   SameSite behavior
-   Why the selected configuration is safe

================================================== 22. IMPORTANT CSRF
SCOPE ==================================================

Do NOT blindly add CSRF tokens to every Bearer-token API request.

The access token is sent explicitly in:

Authorization: Bearer

The cookie is primarily used for refresh/session operations.

Apply CSRF protection where cookie authentication actually creates the
risk.

================================================== 23. COOKIE SECURITY
==================================================

Verify:

\[ \] HttpOnly \[ \] Secure in production \[ \] Appropriate SameSite \[
\] Appropriate Path \[ \] Appropriate expiration \[ \] No Domain unless
required \[ \] No JavaScript access \[ \] No token in JSON \[ \] No
token in localStorage \[ \] No token in sessionStorage

================================================== 24. COOKIE PREFIX
==================================================

If compatible with the deployment, consider using a secure cookie prefix
such as:

\_\_Host-

Only use it if the cookie requirements support the prefix rules.

Do not introduce it if the application requires a Domain attribute.

================================================== 25. AUTH RESPONSE
SECURITY ==================================================

Inspect login and refresh responses.

Ensure they do NOT expose:

-   refreshToken
-   tokenHash
-   RefreshSession
-   cookie value

Access token may be returned because it is intentionally used by the
frontend.

================================================== 26. TOKEN LOGGING
==================================================

Search entire backend/frontend for:

console.log(refreshToken) logger.\*(refreshToken)
console.log(req.cookies) Authorization header logging Set-Cookie logging

Do not log:

-   Raw refresh token
-   Cookie header
-   Authorization header
-   JWT secrets

================================================== 27. FRONTEND SEARCH
==================================================

Search entire frontend for:

localStorage sessionStorage refreshToken refresh_token accessToken
auth_token

Classify every occurrence:

Authentication-related OR Unrelated application state

Remove ONLY authentication token persistence.

Do not delete unrelated localStorage usage.

================================================== 28. BACKEND COOKIE
PARSING ==================================================

Verify the backend already has appropriate cookie parsing support.

If required, add the minimal appropriate middleware.

Do not add duplicate cookie-parser configuration.

================================================== 29. SECURITY TESTS
==================================================

Add/update tests.

TEST 1:

Login.

Expected:

Set-Cookie contains refresh token.

Cookie contains:

HttpOnly Secure in production appropriate SameSite appropriate Path

Response JSON contains:

accessToken

Response JSON does NOT contain:

refreshToken

TEST 2:

Frontend/browser JavaScript cannot access refresh cookie.

Expected:

document.cookie does not contain refresh token.

TEST 3:

Refresh without request body refreshToken.

Expected:

Success when valid cookie exists.

TEST 4:

Refresh without cookie.

Expected:

401. 

TEST 5:

Expired refresh session.

Expected:

401. 

TEST 6:

Revoked refresh session.

Expected:

401. 

TEST 7:

Old rotated cookie/token.

Expected:

401. 

TEST 8:

Logout.

Expected:

RefreshSession revoked.

Expected:

Cookie cleared.

TEST 9:

Refresh after logout.

Expected:

401. 

TEST 10:

Page reload.

Expected:

Refresh cookie restores authentication and a new access token is
obtained.

TEST 11:

Two simultaneous refresh requests using same refresh session.

Expected:

Only one succeeds.

TEST 12:

Allowed frontend origin.

Expected:

CORS accepted.

TEST 13:

Unauthorized origin.

Expected:

CORS rejected.

TEST 14:

Credentials are allowed only for configured origins.

TEST 15:

Wildcard origin is NOT used with credentials.

================================================== 30. REGRESSION TESTS
==================================================

Verify:

-   Login
-   Register
-   Refresh
-   Logout
-   Protected API requests
-   Route guards
-   User session restoration
-   Existing JWT validation
-   Therapist authorization
-   Patient authorization
-   Appointment booking
-   Slot HOLD
-   Payment
-   Recurring appointments

Do not modify business logic.

================================================== 31. PRODUCTION
CONFIGURATION ==================================================

Add/configure environment variables as needed.

For example:

REFRESH_TOKEN_COOKIE_NAME CORS_ALLOWED_ORIGINS

Do not expose backend secrets to frontend environment variables.

Do not put JWT secrets in VITE\_\* variables.

================================================== 32. DEVELOPMENT
CONFIGURATION ==================================================

Support local development securely.

Inspect the actual frontend/backend development origins.

Example only if actually applicable:

http://localhost:3000 http://localhost:5173

Do not automatically add arbitrary localhost origins without checking
the project.

================================================== 33. FINAL ACCEPTANCE
CRITERIA ==================================================

\[ \] Refresh token is HttpOnly cookie \[ \] Refresh token is not
accessible to JavaScript \[ \] Refresh token is not in localStorage \[
\] Refresh token is not in sessionStorage \[ \] Access token is not
persisted in localStorage \[ \] Access token is stored in memory \[ \]
Access token uses Authorization Bearer \[ \] Refresh endpoint reads
cookie \[ \] Refresh rotation remains server-side \[ \] Logout revokes
session \[ \] Logout clears cookie \[ \] Page reload restores session \[
\] Concurrent refresh remains safe \[ \] Login does not return refresh
token \[ \] Refresh does not return refresh token \[ \] CORS uses
explicit allowlist \[ \] CORS credentials are configured correctly \[ \]
Wildcard CORS is not used with credentials \[ \] SameSite is appropriate
\[ \] Secure is enabled in production \[ \] CSRF implications are
addressed \[ \] No authentication token is logged \[ \] Existing
authentication tests pass \[ \] Existing application tests pass

================================================== 34. FINAL REPORT
==================================================

After implementation provide:

1.  Files changed
2.  Cookie architecture
3.  Cookie attributes
4.  Refresh flow
5.  Access-token storage
6.  Logout flow
7.  Refresh-session integration
8.  CORS configuration
9.  Allowed origins
10. Credentials configuration
11. SameSite decision
12. CSRF approach
13. Frontend localStorage changes
14. Tests added
15. Test results
16. Any remaining security concerns

Do not modify unrelated security findings.


    ---

    ## Technical Decisions

    ### 1. Dynamic slot availability instead of pre-seeded slots

    **Decision:** Therapist availability is represented by recurring/weekly schedule configuration, while bookable slots are dynamically derived for a requested date.

    **Reasoning discussed with AI:**
    - Avoid storing every possible future slot as a database record.
    - Generate candidate slots from therapist working hours, slot duration, buffer/break configuration, and date-specific overrides.
    - Exclude past slots, breaks, existing appointments, and active holds.

    **Implementation direction:**
    - Availability is dynamically calculated.
    - Patients request availability for a therapist/date.
    - Existing appointments and active holds are considered when determining availability.

    **Trade-off:**
    - Less persistent slot data and easier recurring schedules.
    - More computation/query work when availability is requested.

    ---

    ### 2. Calendar vs slot creation

    **Decision:** The therapist calendar is primarily a **viewing/agenda interface**, not the primary mechanism for creating availability.

    The therapist creates availability/slots through the dedicated availability flow. The calendar shows:
    - available slots
    - booked appointments
    - cancelled appointments
    - no-shows
    - other appointment states

    **Trade-off:**
    - Separating "availability configuration" from "calendar viewing" reduces ambiguity.
    - It makes the calendar easier to understand and prevents the calendar UI from becoming a second slot-management system.

    ---

    ### 3. Temporary appointment HOLD

    **Decision:** A patient selecting a slot does not immediately create a confirmed booking.

    The flow is:

    ```text
    Patient selects slot
            ↓
    POST /appointments/hold
            ↓
    HOLD
            ↓
    temporary expiration
            ↓
    payment
            ↓
    SCHEDULED

If payment does not complete before the hold expires, the slot becomes
available again.

**Trade-off:** - Prevents multiple users from completing payment for the
same slot. - Requires expiration handling and careful concurrency
control.

------------------------------------------------------------------------

### 4. Atomic slot concurrency

**Decision:** Slot booking must be protected against race conditions at
the database level.

The discussion emphasized that a simple:

``` text
check slot
↓
create appointment
```

is not enough because two requests can execute the check concurrently.

The implementation uses database transactions and concurrency controls
so that two patients attempting the same slot cannot both successfully
confirm it.

**Important lesson:** The frontend showing a slot as available is never
sufficient for correctness. The final booking operation must enforce the
invariant atomically.

------------------------------------------------------------------------

### 5. Recurring appointments without taking an end date from the patient

The recurring booking requirement supports:

-   Daily
-   Weekly
-   Bi-weekly
-   Monthly

The important design question was what happens when the therapist
already has an appointment during one of the future occurrences.

The system must not blindly create conflicting appointments.

**Decision discussed:** - Recurring booking is treated as a series. -
Future occurrences are checked for conflicts. - Existing appointments
and unavailable periods must be respected. - The recurring series
requires a defined boundary/booking policy rather than blindly creating
infinite appointments.

**Trade-off:** - More complex than one-time booking. - Prevents a
recurring request from silently overwriting or double-booking existing
appointments.

------------------------------------------------------------------------

### 6. Distributed idempotency

The application is expected to operate across three backend server
clusters.

**Decision:** Idempotency must not depend on in-memory state on a single
server.

For operations such as booking/payment-related requests, the idempotency
key and result must be handled using shared persistent state/database
semantics so that:

``` text
Cluster A
   │
   ├── request with key X
   │
Cluster B
   │
   └── same request with key X
```

cannot produce duplicate business operations.

**Trade-off:** - Requires persistent/shared coordination. - More
reliable than per-process memory in a distributed deployment.

------------------------------------------------------------------------

### 7. JWT storage architecture

The original architecture stored JWTs in browser storage.

After the security review, the architecture was changed to:

``` text
Access JWT
    ↓
short-lived
    ↓
frontend memory only

Refresh token
    ↓
opaque random token
    ↓
HttpOnly cookie
    ↓
RefreshSession database
```

**Important decisions:** - Refresh token is not stored in
`localStorage`. - Refresh token is not exposed through JSON. - Refresh
token is opaque rather than another JWT. - Only a hash of the refresh
token is stored server-side. - Refresh sessions are revocable and
rotatable.

**Trade-off:** - More secure against token theft through JavaScript/XSS
compared with localStorage refresh tokens. - Requires cookie/CORS/CSRF
considerations and session management.

------------------------------------------------------------------------

### 8. Refresh-token rotation

The refresh token is rotated on refresh.

Conceptually:

``` text
Token A
   ↓
refresh
   ↓
Token A revoked
   ↓
Token B issued
```

A previously consumed token must not be reusable.

The implementation uses a conditional database update/count check to
protect the rotation operation from concurrent reuse.

**Trade-off:** - Better protection against stolen/replayed refresh
tokens. - More database state and more complicated refresh logic.

------------------------------------------------------------------------

### 9. JWT validation hardening

The JWT implementation was hardened to explicitly validate:

-   HS256
-   issuer
-   audience
-   expiration
-   required claims
-   access/refresh token separation where applicable

Production configuration was also changed so insecure fallback secrets
such as `"changeme"` are not accepted.

**Trade-off:** - More configuration and stricter tests. - Prevents
tokens with incorrect metadata or weak configuration from being silently
accepted.

------------------------------------------------------------------------

### 10. Authorization / IDOR protection

The security review identified that authenticated users must not be
trusted merely because they provide a valid resource ID.

For example:

``` text
req.params.therapistId
req.body.patientId
req.params.seriesId
```

does not prove ownership.

Authorization must connect the requested resource to:

``` text
req.user.id
```

or another explicitly authorized relationship.

This was applied to therapist schedules, recurring appointment series,
and therapist agenda access.

**Trade-off:** - Adds database/authorization checks. - Prevents
IDOR/BOLA vulnerabilities.

------------------------------------------------------------------------

### 11. Therapist agenda and patient PII

Therapist agenda access was treated separately from public therapist
availability.

A therapist should be able to access their own authorized agenda, but
should not be able to retrieve another therapist's private agenda simply
by changing a `therapistId`.

The review also emphasized data minimization: agenda queries should not
unnecessarily return sensitive patient/account fields.

**Trade-off:** - Slightly more restrictive access logic. - Reduces
accidental exposure of patient information.

------------------------------------------------------------------------

### 12. Code cleanup strategy

The cleanup strategy was deliberately divided into phases:

``` text
Architecture discovery
        ↓
Dead/mock code discovery
        ↓
Verified dead-code removal
        ↓
Mock implementation cleanup
        ↓
Repository/architecture cleanup
        ↓
Naming/consistency cleanup
        ↓
Final senior review
```

The guiding rule is:

> Every file should exist for a reason, every function should have a
> consumer, every endpoint should have a real purpose, and production
> responses should come from legitimate data sources rather than mock
> values.

**Trade-off:** - Slower than doing a single large refactor. - Much lower
regression risk and easier review.

------------------------------------------------------------------------

## Incorrect AI Suggestions / Decisions

### 1. Broad refactoring was intentionally avoided

During the reviews, AI recommendations were constrained so that the
coding agent would not blindly rewrite the architecture into a textbook
"Clean Architecture" implementation.

The final approach explicitly avoids: - unnecessary microservices -
unnecessary repository interfaces - abstractions with no concrete
benefit - rewriting the backend - moving every piece of logic solely
because of folder conventions

The reason is that a production backend should be simplified based on
actual problems in the codebase, not on architecture patterns for their
own sake.

### 2. Security changes were intentionally split into phases

A potential risk in an AI-assisted workflow is attempting to change JWT
validation, refresh-token storage, cookies, CORS, CSRF, and
authorization simultaneously.

The work was instead split into: - JWT hardening - refresh-session
architecture - refresh rotation/revocation - cookie migration -
CORS/CSRF review - final verification

This made it possible to identify issues such as stale tests and
incomplete CSRF protection without obscuring which change introduced a
problem.

### 3. Mock statistics were not replaced with arbitrary database values

The therapist statistics endpoint was found to contain hardcoded values.
Rather than blindly replacing those numbers with a guessed query, the
cleanup process required determining the actual business meaning of each
statistic first.

This is particularly important for fields such as
`pendingConfirmationsCount`, where the correct business state must come
from the actual appointment model rather than from an invented status.

------------------------------------------------------------------------

## Final AI-Assisted Development Approach

The overall approach used AI as a **reviewer, architectural challenger,
implementation assistant, and verification assistant**, rather than
treating generated code as automatically correct.

The recurring process was:

``` text
Question / Problem
       ↓
AI analysis
       ↓
Challenge assumptions
       ↓
Agree on technical direction
       ↓
Focused implementation prompt
       ↓
Antigravity implementation
       ↓
Tests / type-check / audit
       ↓
Review implementation result
       ↓
Identify remaining gaps
       ↓
Next focused phase
```

This was especially important for the booking/concurrency and
authentication work, where correctness depends on server-side/database
guarantees rather than frontend behavior alone.
