# ADR-001: Adopt Clean Architecture

## Status

Accepted

## Date

2026-08-07

---

# Context

As the Task Manager API grows, having business logic mixed with controllers, database models, and external services would make the code difficult to maintain and test.

The project required a structure where:

- Business rules are separated from infrastructure.
- Database technology can be changed without rewriting business logic.
- Application workflows remain easy to understand.
- Individual components can be tested independently.

A traditional layered architecture can become tightly coupled when controllers directly access database models or services contain too many responsibilities.

---

# Decision

We adopted Clean Architecture principles by separating the Task module into distinct layers:

```
Presentation Layer

        |

        v

Application Layer

        |

        v

Domain Layer

        ^

        |

Infrastructure Layer
```

The project structure follows:

```
src/task

├── application
│
├── domain
│
├── infrastructure
│
├── DTO
│
├── Enums
│
└── Schema
```

---

# Layer Responsibilities

## Presentation Layer

Responsible for:

- Handling HTTP requests.
- Request validation.
- Calling application use cases.

Contains:

```
task.controller.ts
task.service.ts
```

Controllers remain thin and contain no business rules.

---

## Application Layer

Responsible for:

- Executing use cases.
- Coordinating application workflows.
- Handling commands, queries, and events.

Contains:

```
commands
queries
events
```

---

## Domain Layer

Responsible for:

- Business abstractions.
- Repository contracts.

Contains:

```
repository interfaces
```

The domain layer does not depend on:

- NestJS
- MongoDB
- External services

---

## Infrastructure Layer

Responsible for:

- Database implementations.
- External integrations.

Contains:

```
TaskRepository
FileStorageService
```

---

# Consequences

## Positive

- Business logic is isolated.
- Easier unit testing.
- Better maintainability.
- Reduced coupling.
- Infrastructure can be replaced with minimal changes.

## Negative

- More files and folders.
- More initial development effort.
- Requires developers to understand architectural boundaries.

---

# Alternatives Considered

## Traditional Layered Architecture

Rejected because:

- Services can become too large.
- Business logic becomes coupled with frameworks.
- Database concerns can leak into application logic.

---

## Direct Mongoose Usage

Rejected because:

- Application logic would depend on MongoDB.
- Testing would become harder.
- Database changes would affect many files.

---

# Result

The Task Manager API now follows a maintainable architecture where business rules are independent from external technologies.