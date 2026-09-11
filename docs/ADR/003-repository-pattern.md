# ADR-003: Adopt Repository Pattern

## Status

Accepted

## Date

2026-08-07

---

# Context

The Task Manager API uses MongoDB with Mongoose for persistence.

Directly injecting Mongoose models into application handlers would create a strong dependency between business logic and the database implementation.

This would make:

- Unit testing harder.
- Database changes more difficult.
- Application logic tightly coupled to infrastructure.

The application required a persistence abstraction that allows business logic to work independently from the database technology.

---

# Decision

We adopted the Repository Pattern.

The application layer depends on repository interfaces defined in the domain layer.

Infrastructure provides the concrete implementation.

The dependency flow is:

```text
Application Layer

        |

        v

ITaskRepository Interface

        |

        v

TaskRepository Implementation

        |

        v

Mongoose Database
```

---

# Implementation

## Repository Interface

Location:

```
src/task/domain/repositories/task.repository.interface.ts
```

The interface defines the operations required by the application layer.

Example:

```
ITaskRepository
```

---

## Repository Token

Location:

```
src/task/domain/constants/repository.tokens.ts
```

Dependency injection uses tokens to connect the abstraction with its implementation.

Example:

```
TASK_REPOSITORY
```

---

## Repository Implementation

Location:

```
src/task/infrastructure/persistence/task.repository.ts
```

Implementation:

```
TaskRepository
```

The repository handles:

- Database queries.
- Persistence operations.
- Mongoose-specific logic.

---

# Usage in Application Layer

Command handlers depend on the interface:

```text
CreateTaskHandler

        |

        v

ITaskRepository

        |

        v

TaskRepository
```

The handler does not know that MongoDB or Mongoose is being used.

---

# Benefits

## Database Independence

The application layer does not depend on MongoDB.

Future database changes require changing infrastructure only.

---

## Improved Testing

Repositories can be replaced with mocks during unit testing.

Example:

```
MockTaskRepository
```

can replace:

```
TaskRepository
```

---

## Separation of Concerns

Responsibilities remain separated:

Application:

- Business workflows.

Domain:

- Repository contracts.

Infrastructure:

- Database implementation.

---

# Consequences

## Positive

- Cleaner architecture.
- Easier unit testing.
- Reduced coupling.
- Better maintainability.

## Negative

- Additional abstraction layer.
- More files and interfaces.
- Slightly more development overhead.

---

# Alternatives Considered

## Direct Mongoose Model Injection

Rejected because:

- Application logic becomes coupled to MongoDB.
- Testing requires database dependencies.
- Infrastructure concerns leak into business logic.

---

## Service-Based Database Access

Rejected because:

- Services can become responsible for too many concerns.
- Database logic and business logic can become mixed.

---

# Result

The Task Manager API now uses repository abstractions, allowing application logic to remain independent from persistence technology while keeping infrastructure concerns isolated.