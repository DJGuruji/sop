# Tech Stack
- Use Next.js App Router only (no Pages Router)
- Use TypeScript with strict mode enabled
- Do not use `any` (use proper types or generics)
- Use Prisma ORM for all database operations
- Database: Supabase PostgreSQL (use pooler connection)

# Project Structure
- API routes: /src/app/api
- Services: /src/services
- Prisma client: /src/lib/prisma.ts (singleton pattern)
- Validation schemas: /src/validators
- Types: /src/types

# API Design
- All route handlers must be thin (no business logic)
- Business logic must be in service layer
- Use REST conventions (GET, POST, PUT, DELETE)

# Response Format (STRICT)
All API responses must follow:

Success:
{
  "success": true,
  "data": {},
  "message": "optional"
}

Error:
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}

# Validation
- Use Zod for all request validation
- Validate body, params, and query
- Reject invalid requests with 400 status

# Authentication
- Use JWT (HS256)
- Store secret in environment variable
- Access token expiry: 15m
- Refresh token expiry: 7d
- Validate JWT in middleware

# Prisma Rules
- Use singleton Prisma client (avoid multiple instances)
- Use transactions for multi-step DB operations
- Do not write raw SQL unless absolutely required

# Error Handling
- Use centralized error handling
- Do not expose internal errors to client
- Log errors on server

# Code Style
- Use async/await only
- Use early returns (avoid nested if-else)
- Split files if >500 lines
- No duplicate logic

# Performance
- Avoid N+1 queries
- Use select/include in Prisma properly
- Cache only when necessary (do not overuse)

# Security
- Never expose secrets in code
- Sanitize inputs
- Protect sensitive routes with auth middleware

# Docker
- Use multi-stage builds
- Final image must not contain devDependencies
- Use .dockerignore properly

# Output Rules for AI
- Always generate production-ready code
- Follow folder structure strictly
- Create files in correct directories when needed
- Do not generate placeholder or incomplete code
- Do not add emojis in code
- if any document add it inside /docs