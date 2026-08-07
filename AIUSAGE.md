Act as a Staff Backend Engineer at Stripe, Uber, or Booking.com.

Your task is to scaffold a production-grade Node.js backend architecture for a healthcare appointment booking system.

Tech Stack:
- Node.js
- Express.js
- TypeScript
- Prisma ORM
- PostgreSQL
- Zod
- REST API

Do NOT implement any business logic.

Your goal is only to scaffold the backend architecture.

Requirements:

- Use a traditional layered architecture.
- API versioning must be supported from day one.
- Separate transport layer, business layer, and infrastructure.
- Keep the architecture scalable for a team of 20+ engineers.
- Follow SOLID, DRY, KISS, and high cohesion / low coupling.
- Create only folder structures, placeholder files, barrel exports, and TODO comments where appropriate.
- Do not write controller or service implementations.
- Use empty classes/functions or TODO placeholders.

Create the following structure:

backend/
├── src/
│
│   ├── config/
│
│   ├── internal/
│   │
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── controllers/
│   │   │   │   ├── routes/
│   │   │   │   ├── dto/
│   │   │   │   ├── responses/
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   └── v2/
│   │   │
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── validators/
│   │   ├── middleware/
│   │   ├── infrastructure/
│   │   │   ├── database/
│   │   │   ├── cache/
│   │   │   ├── queue/
│   │   │   ├── scheduler/
│   │   │   ├── locking/
│   │   │   └── external/
│   │   │
│   │   ├── shared/
│   │   │   ├── constants/
│   │   │   ├── enums/
│   │   │   ├── errors/
│   │   │   ├── helpers/
│   │   │   ├── responses/
│   │   │   ├── types/
│   │   │   └── utils/
│   │   │
│   │   └── bootstrap/
│   │       ├── routes.ts
│   │       └── middleware.ts
│   │
│   ├── app.ts
│   ├── server.ts
│   └── index.ts
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── docs/
│
├── .env.example
├── package.json
├── tsconfig.json
└── README.md

Guidelines:

1. Create every folder and placeholder file.
2. Add `.gitkeep` only for empty folders.
3. Create barrel `index.ts` files where appropriate.
4. Add descriptive TODO comments explaining the responsibility of each file.
5. Do not generate CRUD code.
6. Do not generate models or entities because Prisma schema is the source of truth.
7. Do not install unnecessary dependencies.
8. Keep controllers thin, services responsible for business logic, and repositories responsible for data access.
9. Version only the API layer (`v1`, `v2`), not the business logic.
10. Ensure the scaffold is production-ready and easy to extend.


Endpoints

Act as a Staff Backend Engineer at Stripe, Airbnb, or Booking.com.

You are responsible for designing and implementing a production-grade authentication module for a healthcare appointment booking system.

Tech Stack

- Node.js
- Express.js
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT
- bcrypt
- Zod

Architecture

The project follows this architecture:

src/
├── config/
├── internal/
│   ├── api/
│   │   └── v1/
│   │       ├── controllers/
│   │       ├── routes/
│   │       ├── dto/
│   │       └── responses/
│   ├── services/
│   ├── repositories/
│   ├── validators/
│   ├── middleware/
│   ├── infrastructure/
│   └── shared/

Think before writing code.

Do NOT immediately implement anything.

Step 1

Analyze the authentication requirements.

Identify:

- Business requirements
- Security concerns
- Failure scenarios
- Validation rules
- API contract
- Token strategy
- Password strategy
- Error handling
- Scalability concerns
- Future extensibility

Explain your reasoning first.

------------------------------------

Step 2

Design the authentication flow.

Describe:

Request

↓

Validation

↓

Repository

↓

Password verification

↓

JWT generation

↓

Refresh token generation

↓

Persistence

↓

Response

Do not write code yet.

------------------------------------

Step 3

Design the API contract.

Implement only these endpoints.

POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET /api/v1/auth/me

Explain

- request DTOs
- response DTOs
- status codes
- error responses

Follow REST best practices.

------------------------------------

Step 4

Design the folder responsibilities.

Explain what belongs inside

controllers
services
repositories
validators
middleware
dto
responses

Explain what should NEVER be placed there.

------------------------------------

Step 5

Implement the Login feature.

Requirements

- Thin controllers
- Business logic only inside services
- Data access only inside repositories
- Validation using Zod
- Password verification using bcrypt
- JWT access token
- Refresh token support
- Generic authentication errors
- No business logic inside controllers
- Dependency injection where appropriate
- Clean error propagation
- Strong TypeScript typing
- Async/await only

------------------------------------

Code Quality Rules

- SOLID
- DRY
- KISS
- High Cohesion
- Low Coupling
- Single Responsibility
- No duplicated logic
- No magic strings
- No hardcoded values
- Centralized constants
- Proper logging
- Production-ready error handling

------------------------------------

Before generating any file, explain why the file is needed.

After implementing, perform a self-review exactly like a Principal Engineer reviewing a pull request.

Critique:

- Security
- Maintainability
- Scalability
- Performance
- Architecture
- Error handling
- Naming
- Folder organization

Do not defend your implementation.

Point out weaknesses and recommend improvements.