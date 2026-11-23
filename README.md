# CivicFix AI — Smart Civic Complaint Platform

A production-quality platform enabling citizens to report civic issues (garbage, road damage, streetlights, water leakage, drainage) with intelligent AI classification, authority management dashboards, field worker dispatching, resolution verification, and automated SLA tracking.

## Workspace Layout

```
CivicFix-AI/
├── apps/
│   ├── backend/        # Express.js + Prisma ORM + PostgreSQL Backend Core
│   ├── frontend/       # React Client Application
│   └── ai-service/     # Python FastAPI AI Inference Service
├── infrastructure/     # Docker Compose and deployment manifests
│   └── docker-compose.yml
├── docs/               # System architecture and API documentation
└── tests/              # End-to-end integration test suites
```

## Quick Start (Backend)

```bash
# 1. Start PostgreSQL
docker compose -f infrastructure/docker-compose.yml up -d

# 2. Navigate to backend
cd apps/backend

# 3. Install packages & generate Prisma client
npm install
npm run prisma:generate

# 4. Run tests
npm test

# 5. Start development server
npm run dev
```
