# CivicFix AI — Backend Service

Production-grade backend service for the CivicFix AI Smart Civic Complaint Platform.

## Architecture Highlights

* **Runtime & Framework**: Node.js (v20+ LTS) with Express.js and TypeScript
* **Database & ORM**: PostgreSQL with Prisma ORM
* **Authentication**: JWT with SHA-256 hashed refresh token storage, session rotation, and replay/reuse detection
* **Validation**: Strict schema validation via Zod on request body, query, and params
* **Security**: Helmet HTTP headers, CORS whitelisting, rate limiting (auth + global), bcrypt password hashing
* **Error Handling**: Centralized exception middleware mapping domain errors to standard RFC-aligned envelopes
* **Auditing**: Automatic mutation audit logging with credential redaction
* **State Machine**: Centralized complaint lifecycle transition enforcement decoupled from SLA escalation

## Directory Structure

```
apps/backend/
├── prisma/
│   ├── schema.prisma                  # PostgreSQL models, enums, relations & indexes
│   └── seed.ts                        # Development database seeder
├── src/
│   ├── config/                        # Typed environment and Prisma client
│   ├── constants/                     # Roles, complaint statuses, categories, severities
│   ├── controllers/                   # HTTP boundary controllers
│   ├── middlewares/                   # Auth, RBAC, Validation, Rate limit, Error handling
│   ├── routes/                        # Express API route modules
│   ├── services/                      # Business logic, token rotation, state machine, audit
│   ├── types/                         # Express request augmentations & DTOs
│   ├── utils/                         # Standard response builder, errors, logger
│   ├── validators/                    # Zod validation schemas
│   ├── app.ts                         # Express application factory
│   └── server.ts                      # Server lifecycle and graceful shutdown
├── tests/                             # Comprehensive unit & integration tests
│   ├── unit/                          # Unit tests (TokenService, StateMachine, Validators, Errors, RBAC)
│   └── integration/                   # Integration tests (Health, Auth lifecycle & reuse detection)
├── tsconfig.json
└── package.json
```

## Setup Instructions

### 1. Prerequisites
* Node.js v20+ LTS
* npm v10+
* PostgreSQL v15+ (local instance or Docker)

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Database Setup & Migrations
Ensure PostgreSQL is running (e.g. `docker compose up -d` from project root `infrastructure/`), then run:
```bash
# Generate Prisma Client
npm run prisma:generate

# Apply migrations
npm run prisma:migrate

# Seed development users and departments
npm run prisma:seed
```

### 5. Running the Application
```bash
# Development mode with hot-reload
npm run dev

# Production build & start
npm run build
npm start
```

### 6. Running Tests
```bash
# Run full Vitest suite
npm test

# Run tests with coverage
npm run test:coverage
```

## Seeded Development Accounts
The seed script provisions default accounts (password: `CivicFix@2026`):
* Admin: `admin@civicfix.gov`
* Authority Officer: `officer.roads@civicfix.gov`
* Field Worker: `worker.roads@civicfix.gov`
* Citizen: `citizen@example.com`

## AI and Complaint API

- `GET /api/v1/ai/health` checks FastAPI connectivity.
- `POST /api/v1/complaints` creates a citizen complaint and requests AI classification.
- `GET /api/v1/complaints` lists complaints according to the authenticated role.
- `GET /api/v1/complaints/:id` retrieves a complaint with media, assignment, and status history.
- `PATCH /api/v1/complaints/:id/status` applies lifecycle transitions.

The AI service is configured with `AI_SERVICE_URL` and `AI_SERVICE_TIMEOUT_MS`. Classification failure is handled gracefully: the complaint remains submitted and can be processed again through an authority workflow.
