# Task Manager API Architecture

## 1. Overview

The Task Manager API follows a Clean Architecture approach combined with:

- CQRS (Command Query Responsibility Segregation)
- Repository Pattern
- Domain Events

The goal of this architecture is to maintain a clear separation between:

- Business logic
- Application workflows
- Database persistence
- External infrastructure concerns

The design allows individual layers to evolve independently while keeping the core application logic isolated from frameworks and external technologies.

---

# 2. High-Level Architecture

The system is organized into four main layers:

```text
        Presentation Layer
                |
                v
        Application Layer
                |
                v
             Domain Layer
                ^
                |
                |
     Infrastructure Layer
```

## Dependency Rules

The dependency direction follows Clean Architecture principles:

- Presentation Layer depends on Application Layer.
- Application Layer depends on Domain abstractions.
- Infrastructure Layer implements Domain interfaces.
- Domain Layer does not depend on external frameworks or infrastructure.

---

# 3. Layer Responsibilities

## 3.1 Presentation Layer

Location:

```
src/task/task.controller.ts
src/task/task.service.ts
```

Responsibilities:

- Handle HTTP requests.
- Validate incoming requests.
- Convert requests into commands and queries.
- Return responses to clients.

Controllers remain thin and do not contain business logic.

Flow:

```text
HTTP Request
      |
      v
Controller
      |
      v
CommandBus / QueryBus
      |
      v
Application Layer
```

---

# 3.2 Application Layer

Location:

```
src/task/application
```

The application layer contains the use cases of the system.

Structure:

```text
application

├── commands
├── queries
└── events
```

The application layer coordinates business operations but does not directly handle database implementation details.

---

## Commands

Location:

```
src/task/application/commands
```

Commands represent operations that modify system state.

Implemented commands:

```
CreateTaskCommand
UpdateTaskCommand
DeleteTaskCommand
UploadAttachmentCommand
DeleteAttachmentCommand
CreateCommentCommand
```

Flow:

```text
Controller
    |
    v
CommandBus
    |
    v
CommandHandler
    |
    v
Repository
    |
    v
Database
```

Command handlers are responsible for:

- Executing application use cases.
- Validating business conditions.
- Coordinating domain operations.
- Publishing domain events.

---

## Queries

Location:

```
src/task/application/queries
```

Queries represent read-only operations.

Implemented queries:

```
GetTasksQuery
GetTaskByIdQuery
GetTaskStatsQuery
GetCommentsQuery
GetAttachmentsQuery
```

Flow:

```text
Controller
    |
    v
QueryBus
    |
    v
QueryHandler
    |
    v
Repository
    |
    v
Database
```

Separating queries from commands allows read operations to be optimized independently.

---

# 4. CQRS Implementation

The system uses CQRS to separate write operations from read operations.

## Write Side

```text
CreateTaskCommand

        |
        v

CreateTaskHandler

        |
        v

TaskRepository

        |
        v

MongoDB
```

## Read Side

```text
GetTasksQuery

        |
        v

GetTasksHandler

        |
        v

TaskRepository

        |
        v

MongoDB
```

Benefits:

- Clear separation between reads and writes.
- Easier testing.
- Better maintainability.
- Allows independent scaling.
- Keeps responsibilities explicit.

---

# 5. Repository Pattern

The application does not directly depend on Mongoose models.

## Repository Interface

Location:

```
src/task/domain/repositories/task.repository.interface.ts
```

Example:

```
ITaskRepository
```

## Repository Implementation

Location:

```
src/task/infrastructure/persistence/task.repository.ts
```

Implementation:

```
TaskRepository
```

Flow:

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

Benefits:

- Database independence.
- Easier unit testing.
- Business logic remains isolated.
- Persistence concerns stay in infrastructure.

---

# 6. Domain Events

The system uses domain events for important business occurrences.

Location:

```
src/task/application/events
```

Implemented events:

```
TaskCreatedEvent
TaskCompletedEvent
```

Handlers:

```
src/task/application/events/handlers
```

Implemented handlers:

```
TaskCreatedHandler
TaskCompletedHandler
```

Flow:

```text
Command Handler

        |
        v

EventBus

        |
        v

Domain Event

        |
        v

Event Handler
```

Example:

```text
UpdateTaskHandler

        |
        v

TaskCompletedEvent

        |
        v

TaskCompletedHandler
```

Benefits:

- Loose coupling.
- Easier extension.
- Separation of business actions from side effects.

---

# 7. Dependency Rules

Allowed dependency direction:

```text
Presentation

      |

      v

Application

      |

      v

Domain
```

Infrastructure provides implementations:

```text
Infrastructure

      |

      v

Domain Interfaces
```

Avoided dependencies:

```
Domain -> NestJS

Domain -> MongoDB

Application -> Mongoose Models

Controller -> Database Access
```

---

# 8. Current Architectural Trade-offs

Some side effects currently remain inside command handlers:

Examples:

- Activity logging.
- Cache invalidation.
- WebSocket notifications.

Current flow:

```text
Command Handler

        |
        +---- Activity Logging

        |
        +---- Cache Clearing

        |
        +---- WebSocket Notification
```

Future improvement:

Move these responsibilities into dedicated event handlers.

Future flow:

```text
Command Handler

        |
        v

Domain Event

        |
        +---- Activity Handler

        |
        +---- Notification Handler

        |
        +---- Cache Handler
```

---

# 9. Future Improvements

Potential improvements:

- Separate read models.
- Event-driven background processing.
- Message broker integration.
- Event sourcing for audit-heavy workflows.
- Dedicated notification service.

---

# 10. Summary

The Task Manager API architecture provides:

- Clean separation of responsibilities.
- Testable application logic.
- Database abstraction.
- CQRS-based organization.
- Repository-based persistence.
- Event-driven extensibility.

The architecture is designed to remain maintainable as the application grows and new features are introduced.