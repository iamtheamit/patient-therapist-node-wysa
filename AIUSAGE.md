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