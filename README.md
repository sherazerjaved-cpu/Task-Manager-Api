# Task Manager API

A production-ready RESTful Task Manager API built with **NestJS**, **Node.js**, and **MongoDB**. The API enables users to securely manage tasks, organize them into categories, receive scheduled reminder notifications, upload attachments, and provides administrative features such as user and activity management.

---

# Features

## Authentication

* User registration
* User login
* JWT authentication
* Refresh token support
* Logout
* Password hashing using bcrypt

## Task Management

* Create, update, delete, and retrieve tasks
* User-specific task ownership
* Task priorities
* Task status tracking
* Due dates
* Soft delete
* Task comments
* File attachments
* Task tags
* Search tasks
* Filter tasks
* Pagination
* Multi-field sorting
* Task statistics

## Categories

* Create categories
* Update categories
* Delete categories
* Retrieve user categories

## User Management

* View all users (Admin only)
* Delete users (Admin only)

## Activity Logs

* Automatically records important user actions
* Admin-only activity history
* User activity endpoints

## Notifications

* Scheduled reminder jobs using Cron
* Email reminder support
* Real-time task updates using WebSockets

## Security & Performance

* JWT Authentication
* Refresh Tokens
* Role-Based Access Control (RBAC)
* Helmet security
* CORS configuration
* Request validation
* Redis-backed caching
* Redis-backed rate limiting

## Health Monitoring

* MongoDB health check using NestJS Terminus

## API Documentation

* Interactive Swagger documentation
* JWT Authorization support
* Request/Response schemas

---

# Tech Stack

* NestJS
* Node.js
* TypeScript
* MongoDB
* Mongoose
* Redis
* Keyv (`@keyv/redis`)
* Passport JWT
* bcrypt
* Swagger
* Socket.IO (WebSockets)
* NestJS Schedule (Cron Jobs)
* Docker
* Jest
* GitHub Actions

---

# Project Structure

```text
src
├── activity
├── auth
├── categories
├── common
├── health
├── mail
├── reminder
├── tasks
├── users
├── websocket
├── app.module.ts
└── main.ts
```

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

---

# Running the Application

## Development

```bash
npm run start:dev
```

## Production

```bash
npm run build
npm run start:prod
```

---

# Running with Docker

```bash
docker compose up --build
```

---

# Swagger Documentation

Once the application is running, open:

```
http://localhost:3000/api/docs
```

Swagger provides:

* Complete API documentation
* Request and response schemas
* JWT authentication
* Interactive endpoint testing

---

# Authentication

Authenticate using:

```
POST /api/v1/auth/login
```

Copy the returned access token.

In Swagger:

1. Click **Authorize**
2. Paste the JWT access token.
3. Execute protected endpoints.

---

# API Endpoints

## Authentication

| Method | Endpoint              |
| ------ | --------------------- |
| POST   | /api/v1/auth/register |
| POST   | /api/v1/auth/login    |
| POST   | /api/v1/auth/refresh  |
| POST   | /api/v1/auth/logout   |

---

## Tasks

| Method | Endpoint            |
| ------ | ------------------- |
| GET    | /api/v1/tasks       |
| GET    | /api/v1/tasks/:id   |
| POST   | /api/v1/tasks       |
| PATCH  | /api/v1/tasks/:id   |
| DELETE | /api/v1/tasks/:id   |
| GET    | /api/v1/tasks/stats |

---

## Categories

| Method | Endpoint               |
| ------ | ---------------------- |
| GET    | /api/v1/categories     |
| GET    | /api/v1/categories/:id |
| POST   | /api/v1/categories     |
| PATCH  | /api/v1/categories/:id |
| DELETE | /api/v1/categories/:id |

---

## Users (Admin)

| Method | Endpoint          |
| ------ | ----------------- |
| GET    | /api/v1/users     |
| DELETE | /api/v1/users/:id |

---

## Activity

| Method | Endpoint            |
| ------ | ------------------- |
| GET    | /api/v1/activity    |
| GET    | /api/v1/activity/me |

---

## Health

| Method | Endpoint       |
| ------ | -------------- |
| GET    | /api/v1/health |

---

# Testing

Run unit tests

```bash
npm test
```

Run end-to-end tests

```bash
npm run test:e2e
```

Run test coverage

```bash
npm run test:cov
```

Run linting

```bash
npm run lint
```

Format the project

```bash
npm run format
```

---

# Postman Collection

A Postman collection is included with the repository containing:

* Authentication requests
* Refresh token flow
* Task endpoints
* Category endpoints
* Activity endpoints
* User endpoints
* Health endpoint

---

# Features

* JWT Authentication
* Refresh Tokens
* Role-Based Access Control (RBAC)
* CRUD Operations
* Categories
* Comments
* File Attachments
* Activity Logging
* Pagination
* Filtering
* Searching
* Multi-field Sorting
* Task Statistics
* Redis-backed Caching
* Redis-backed Rate Limiting
* Scheduled Reminder Jobs
* Email Notifications
* WebSocket Notifications
* Helmet Security
* CORS
* Swagger Documentation
* Health Checks
* Docker Support
* GitHub Actions CI
* Unit Tests
* End-to-End Tests

---

# Author

**Sherazer Javed**

Backend Developer | NestJS | Node.js | TypeScript | MongoDB | Redis
