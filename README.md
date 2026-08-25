# Task Manager API

A production-grade, multi-tenant, collaborative, event-driven Task Manager API built with **NestJS**, **Node.js**, **TypeScript**, **MongoDB/Mongoose**, and **Redis**.

The project evolved from a single-user task management API into a production-oriented platform supporting **multi-tenancy, workspace collaboration, policy-based authorization, transactional data integrity, asynchronous processing, webhooks, exports, observability, security hardening, and automated CI/CD**.

---

# Features

## Authentication & Advanced Security

* User registration
* Email verification
* User login
* JWT access tokens
* Refresh token rotation
* Refresh token reuse detection
* Refresh token family revocation
* Secure logout
* Password hashing with bcrypt
* Password reset flow
* Tokenized, expiring password-reset links
* Brute-force login protection
* Redis-backed rate limiting
* Per-IP throttling
* Stricter protection for authentication flows
* Helmet security headers
* CORS configuration
* Request validation
* No secrets or credentials logged

---

## Multi-Tenancy & Workspaces

* Multi-workspace users
* Workspace creation
* Workspace membership
* Workspace roles:

  * OWNER
  * ADMIN
  * MEMBER
  * VIEWER
* Workspace invitations
* Tokenized, expiring invitations
* Accept/decline invitation flows
* Pending invitation management
* Workspace-scoped tasks
* Workspace-scoped authorization
* Strict tenant isolation
* Cross-workspace access protection
* Assignee-based task queries

Every task belongs to exactly one workspace, and access to workspace data is enforced through centralized authorization policies.

---

## Policy-Based Authorization

Authorization is implemented using **CASL** rather than relying only on simple role checks.

* CASL ability layer
* `PoliciesGuard`
* `@CheckPolicies()` decorator
* Record-level authorization
* Field-level authorization
* Workspace membership policies
* Role-based capabilities
* OWNER / ADMIN / MEMBER / VIEWER policies
* Read-only VIEWER permissions
* Task ownership/assignment policies
* Workspace-level access restrictions

---

## Task Management

* Create tasks
* Retrieve tasks
* Update tasks
* Delete tasks
* Soft deletion
* Workspace-scoped task ownership
* Task assignment
* Multiple assignees
* Assignee-scoped queries
* Task priorities
* Task status tracking
* Due dates
* Categories
* Comments
* Tags
* File attachments
* Search
* Filtering
* Offset pagination
* Cursor/keyset pagination
* Multi-field sorting
* Correct priority ordering
* Task statistics
* Aggregation-based queries

Priority sorting uses an explicit numeric weight:

```text
low < medium < high
```

---

## Data Integrity & MongoDB

* MongoDB with Mongoose
* MongoDB replica-set configuration
* ACID transactions
* Transactional invitation acceptance
* Transactional membership creation
* Transactional audit logging
* Optimistic concurrency control
* Version-based conflict detection
* `ETag` support
* `If-Match` conditional updates
* `409 Conflict` for stale writes
* Compound indexes
* Text search indexes
* Aggregation pipelines
* `$lookup`
* `$facet`
* Derived/computed fields
* Deliberate index design
* Database migrations with migrate-mongo
* Database seeding

---

## API Design

* REST API
* Consistent `/api/v1` versioning
* RFC 7807 `application/problem+json` error responses
* Standardized error fields:

  * `type`
  * `title`
  * `status`
  * `detail`
  * `instance`
* Idempotency-Key support for creation endpoints
* Duplicate-request protection
* ETag-based concurrency control
* If-Match conditional requests
* Pagination response metadata
* Rate-limit response headers
* Complete OpenAPI documentation
* Exported OpenAPI specification

---

## Event-Driven Architecture

The application uses **CQRS**, domain events, the **Outbox Pattern**, and **BullMQ** for asynchronous processing.

### CQRS

* Command/query separation
* `@nestjs/cqrs`
* Application-layer commands
* Application-layer queries
* Domain events
* Repository abstractions
* Infrastructure adapters

### Outbox Pattern

* Domain events persisted with state changes
* At-least-once event dispatch
* Pending event processing
* Retry handling
* Event status tracking

### Background Queues

BullMQ + Redis are used for:

* Email processing
* Reminder processing
* Webhook delivery
* Export generation
* Dead-letter handling

### Reliability

* Retry with backoff
* Dead-letter queue
* Idempotent job handling
* Graceful worker shutdown
* Queue lifecycle management

---

## Webhooks

* Workspace webhook registration
* Workspace-scoped webhook configuration
* Event subscriptions
* HMAC-signed payloads
* Retry support
* Delivery tracking
* Webhook delivery logs
* Asynchronous webhook processing through BullMQ

---

## Export

* Asynchronous export generation
* Export jobs processed through BullMQ
* Background export workers
* Queue-based processing
* Export lifecycle handling

---

## Notifications

* Scheduled reminder processing
* Dynamic reminder schedule configuration
* SchedulerRegistry-based cron configuration
* Email notifications
* BullMQ email processing
* WebSocket notifications
* Real-time task updates

---

## Caching & Performance

* Redis-backed cache
* Keyv Redis integration
* Cache-aside strategy
* Explicit cache invalidation
* TTL-based caching
* Redis-backed rate limiting
* Optimized aggregation queries
* Pagination for large collections
* Priority-aware sorting

---

## Observability

### Structured Logging

* Structured application logging
* Request/correlation IDs
* Sanitized request information
* Sensitive data protection

### Distributed Tracing

OpenTelemetry instrumentation provides tracing for:

* HTTP requests
* MongoDB operations
* Redis operations

Jaeger can be used to inspect distributed traces.

### Metrics

Prometheus-compatible metrics are exposed through:

```text
GET /api/v1/metrics
```

Metrics include application and request-level observability such as:

* Request latency
* Request counts
* Queue-related metrics
* Application metrics

### Health Checks

Separate health endpoints are provided for:

```text
GET /api/v1/health/live
GET /api/v1/health/ready
```

Liveness verifies that the application is running.

Readiness verifies required infrastructure dependencies such as:

* MongoDB
* Redis

---

# Architecture

The project follows a layered / Clean Architecture approach.

```text
Presentation
    │
    ├── Controllers
    ├── Guards
    └── DTOs
    │
    ▼
Application
    │
    ├── Commands
    ├── Queries
    ├── Services
    └── Event Handlers
    │
    ▼
Domain
    │
    ├── Entities
    ├── Value Objects
    ├── Repository Interfaces
    └── Domain Events
    │
    ▼
Infrastructure
    │
    ├── MongoDB / Mongoose
    ├── Redis
    ├── BullMQ
    ├── Mail
    ├── Webhooks
    └── External Services
```

Business logic does not directly depend on Mongoose models.

Repository interfaces define application/domain boundaries, while Mongoose implementations act as infrastructure adapters.

Architecture decisions and important boundaries are documented in:

```text
ARCHITECTURE.md
```

---

# Project Structure

```text
src
├── activity
├── auth
├── categories
├── common
├── config
├── health
├── mail
├── reminder
├── tasks
├── users
├── workspaces
├── invitations
├── audit
├── webhooks
├── outbox
├── queues
├── export
├── metrics
├── websocket
├── app.module.ts
└── main.ts
```

---

# Tech Stack

## Backend

* NestJS
* Node.js
* TypeScript
* Mongoose
* MongoDB

## Authentication & Security

* Passport
* JWT
* bcrypt
* CASL
* Helmet
* NestJS Throttler

## Data & Infrastructure

* Redis
* Keyv
* ioredis
* BullMQ
* MongoDB replica set
* migrate-mongo

## API & Documentation

* REST
* Swagger / OpenAPI
* RFC 7807
* Socket.IO

## Observability

* OpenTelemetry
* Jaeger
* Prometheus
* Structured logging

## Testing

* Jest
* Supertest
* Unit tests
* Integration tests
* E2E tests

## DevOps

* Docker
* Docker Compose
* GitHub Actions

---

# Installation

## Clone the repository

```bash
git clone https://github.com/sherazerjaved-cpu/Task-Manager-Api.git
```

## Navigate into the project

```bash
cd task-manager-api
```

## Install dependencies

```bash
npm install
```

---

# Environment Variables

Create a `.env` file in the project root.

A complete example is provided in:

```text
.env.example
```

Example configuration:

```env
PORT=3000

MONGODB_URI=your_mongodb_connection_string

REDIS_URL=redis://localhost:6379

JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=15m

JWT_REFRESH_SECRET=your_refresh_secret
JWT_REFRESH_EXPIRES_IN=7d

REMINDER_CRON=*/30 * * * * *

SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_email
SMTP_PASS=your_app_password
SMTP_FROM=your_email
```

Environment variables are validated at application startup. Invalid or missing required configuration causes the application to fail fast.

**Never commit real secrets to the repository.**

---

# Running the Application

## Development

```bash
npm run start:dev
```

## Build

```bash
npm run build
```

## Production

```bash
npm run start:prod
```

---

# Running with Docker

The project includes a multi-stage Dockerfile and Docker Compose configuration containing:

* API
* MongoDB replica set
* Redis
* Jaeger

Start the complete environment with:

```bash
docker compose up --build
```

The MongoDB configuration uses a replica set so MongoDB transactions can operate correctly.

The application container runs as a non-root user and includes a health check.

---

# Swagger Documentation

Once the application is running, open:

```text
http://localhost:3000/api/docs
```

Swagger provides:

* Complete API documentation
* Request/response schemas
* Authentication support
* JWT authorization
* Error schemas
* Interactive endpoint testing

---

# Authentication

Login through:

```text
POST /api/v1/auth/login
```

Copy the returned access token.

In Swagger:

1. Click **Authorize**
2. Enter the JWT access token
3. Execute protected endpoints

---

# API Endpoints

All API routes are versioned under:

```text
/api/v1
```

## Authentication

| Method | Endpoint                       |
| ------ | ------------------------------ |
| POST   | `/api/v1/auth/register`        |
| POST   | `/api/v1/auth/login`           |
| POST   | `/api/v1/auth/refresh`         |
| POST   | `/api/v1/auth/logout`          |
| POST   | `/api/v1/auth/forgot-password` |
| POST   | `/api/v1/auth/reset-password`  |
| POST   | `/api/v1/auth/verify-email`    |

---

## Workspaces

| Method | Endpoint             |
| ------ | -------------------- |
| POST   | `/api/v1/workspaces` |
| GET    | `/api/v1/workspaces` |

Workspace endpoints are protected by authentication and workspace membership policies.

---

## Invitations

| Method | Endpoint                             |
| ------ | ------------------------------------ |
| POST   | `/api/v1/workspaces/:id/invitations` |
| POST   | `/api/v1/invitations/:token/accept`  |

---

## Tasks

| Method | Endpoint                      |
| ------ | ----------------------------- |
| GET    | `/api/v1/tasks`               |
| GET    | `/api/v1/tasks/:id`           |
| POST   | `/api/v1/tasks`               |
| PATCH  | `/api/v1/tasks/:id`           |
| DELETE | `/api/v1/tasks/:id`           |
| GET    | `/api/v1/tasks/stats`         |
| PATCH  | `/api/v1/tasks/:id/assignees` |

Tasks are tenant-scoped and protected by CASL authorization policies.

---

## Categories

| Method | Endpoint                 |
| ------ | ------------------------ |
| GET    | `/api/v1/categories`     |
| GET    | `/api/v1/categories/:id` |
| POST   | `/api/v1/categories`     |
| PATCH  | `/api/v1/categories/:id` |
| DELETE | `/api/v1/categories/:id` |

---

## Users

| Method | Endpoint            |
| ------ | ------------------- |
| GET    | `/api/v1/users`     |
| DELETE | `/api/v1/users/:id` |

Administrative authorization is enforced through policies.

---

## Activity & Audit

| Method | Endpoint                            |
| ------ | ----------------------------------- |
| GET    | `/api/v1/activity`                  |
| GET    | `/api/v1/activity/me`               |
| GET    | `/api/v1/workspaces/:id/audit-logs` |

Audit logs are append-only and record security/data mutation activity.

---

## Webhooks

| Method | Endpoint                          |
| ------ | --------------------------------- |
| POST   | `/api/v1/workspaces/:id/webhooks` |
| GET    | `/api/v1/workspaces/:id/webhooks` |

Webhook delivery is handled asynchronously through BullMQ.

---

## Health & Operations

| Method | Endpoint               |
| ------ | ---------------------- |
| GET    | `/api/v1/health/live`  |
| GET    | `/api/v1/health/ready` |
| GET    | `/api/v1/metrics`      |

---

# Error Handling

The API follows **RFC 7807 Problem Details**.

Error responses use:

```text
Content-Type: application/problem+json
```

Example structure:

```json
{
  "type": "https://example.com/errors/conflict",
  "title": "Conflict",
  "status": 409,
  "detail": "The resource was modified by another request.",
  "instance": "/api/v1/tasks/123"
}
```

---

# Concurrency Control

Task updates support optimistic concurrency through:

* Version keys
* ETags
* `If-Match`

A stale update results in:

```text
409 Conflict
```

This prevents concurrent requests from silently overwriting newer changes.

---

# Idempotency

Creation endpoints support:

```text
Idempotency-Key
```

This prevents duplicate resource creation when clients retry the same request.

---

# Pagination

The API supports both:

### Offset pagination

Useful for traditional page-based navigation.

### Cursor pagination

Keyset/cursor pagination is available for large datasets and uses deterministic ordering with a stable tie-breaker.

This prevents duplicate or missing records while navigating changing datasets.

---

# Testing

The project includes multiple testing levels.

## Unit Tests

```bash
npm test
```

Unit tests cover application/domain behavior using mocked dependencies where appropriate.

## Integration Tests

Integration tests exercise real infrastructure such as:

* MongoDB
* Redis
* Application modules
* Queues and infrastructure components

## E2E Tests

```bash
npm run test:e2e
```

End-to-end tests verify complete API flows including:

* Authentication
* Workspace collaboration
* Task lifecycle
* CASL authorization
* Tenant isolation
* API correctness
* Async processing
* Export flows
* Security and operational endpoints

## Coverage

```bash
npm run test:cov
```

The project targets:

```text
≥ 85% line coverage
```

Coverage is enforced as part of the CI pipeline.

## Linting

```bash
npm run lint
```

## Formatting

```bash
npm run format
```

---

# CI/CD

GitHub Actions is configured to validate the project before delivery.

The CI pipeline performs:

```text
Lint
  ↓
Typecheck
  ↓
Tests
  ↓
Coverage Gate
  ↓
Build
  ↓
Docker Build
```

The pipeline is designed to prevent broken, untested, or under-covered code from progressing through the delivery process.

The project also follows **Conventional Commits** and includes a pull-request template.

---

# Observability

For local distributed tracing, Jaeger can be started through Docker Compose.

OpenTelemetry instruments:

```text
HTTP
MongoDB
Redis
```

Prometheus-compatible application metrics are available through:

```text
GET /api/v1/metrics
```

Health endpoints distinguish between application liveness and infrastructure readiness.

---

# Postman Collection

A Postman collection is included with the repository.

It covers major API flows including:

* Authentication
* Refresh token rotation
* Email verification
* Password reset
* Workspaces
* Invitations
* Tasks
* Task assignment
* Categories
* Activity
* Audit logs
* Webhooks
* Health checks
* Metrics

All requests use the `/api/v1` API version.

---

# Production-Oriented Features

This project demonstrates:

* Clean Architecture
* CQRS
* Repository pattern
* Multi-tenancy
* Strict tenant isolation
* CASL policy-based authorization
* JWT authentication
* Refresh token rotation
* Refresh token reuse detection
* Password reset
* Email verification
* Brute-force protection
* Rate limiting
* Immutable audit logging
* MongoDB transactions
* Optimistic concurrency
* ETag / If-Match
* Idempotency keys
* Cursor pagination
* Redis caching
* BullMQ background jobs
* Retry/backoff
* Dead-letter handling
* Idempotent job handlers
* Outbox pattern
* Webhooks
* HMAC webhook signatures
* Asynchronous exports
* WebSocket notifications
* OpenTelemetry tracing
* Prometheus metrics
* Structured logging
* Health/readiness checks
* Docker
* Docker Compose
* GitHub Actions
* Unit testing
* Integration testing
* E2E testing
* Coverage enforcement

---

# Phase 3 Scope

This repository implements the core **Phase 3 production-grade requirements**, including:

* Multi-tenancy and collaboration
* CASL authorization
* Advanced authentication security
* MongoDB transactions and concurrency control
* Event-driven architecture
* Outbox pattern
* BullMQ queues
* Webhooks
* Export processing
* Observability
* Docker-based delivery
* GitHub Actions CI
* Automated testing and coverage

## Stretch Goals Not Implemented

The following optional Phase 3 stretch goals were intentionally not implemented:

* GraphQL API alongside REST
* Kubernetes / Helm deployment
* Terraform infrastructure provisioning

The project remains REST-based and is deployed using Docker/Docker Compose rather than Kubernetes/Terraform.

---

# Author

**Sherazer Javed**

Backend Developer | NestJS | Node.js | TypeScript | MongoDB | Redis
