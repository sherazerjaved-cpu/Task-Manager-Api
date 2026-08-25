# ADR-002: Adopt CQRS Pattern

## Status

Accepted

## Date

2026-08-07

---

# Context

The Task Manager API contains different types of operations:

- Operations that modify data.
- Operations that retrieve data.

Initially, these responsibilities can be handled together, but as the application grows, mixing read and write logic makes the code harder to maintain and optimize.

The system required a clear separation between:

- Commands that change application state.
- Queries that only retrieve information.

---

# Decision

We adopted Command Query Responsibility Segregation (CQRS) using the NestJS CQRS module.

The application separates operations into:

```
Commands

    |
    |
    v

Write Operations
```

and:

```
Queries

    |
    |
    v

Read Operations
```

---

# Implementation

CQRS is implemented using:

```
@nestjs/cqrs
```

The Task module uses:

- CommandBus
- QueryBus
- EventBus

---

# Commands

Commands represent operations that modify system state.

Location:

```
src/task/application/commands
```

Implemented commands:

```
CreateTaskCommand
UpdateTaskCommand
DeleteTaskCommand
UploadAttachmentCommand
DeleteAttachmentCommand
CreateCommentCommand
```

Example flow:

```
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
- Applying business rules.
- Updating persistence.
- Publishing domain events.

---

# Queries

Queries represent read-only operations.

Location:

```
src/task/application/queries
```

Implemented queries:

```
GetTasksQuery
GetTaskByIdQuery
GetTaskStatsQuery
GetCommentsQuery
GetAttachmentsQuery
```

Example flow:

```
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

---

# Benefits

## Separation of Responsibilities

Write operations and read operations have different responsibilities and can evolve independently.

---

## Improved Maintainability

Each handler has one clear purpose instead of large service methods handling multiple responsibilities.

---

## Better Testing

Individual commands and queries can be tested independently.

---

## Future Scalability

CQRS allows future improvements such as:

- Separate read databases.
- Optimized read models.
- Asynchronous processing.

---

# Consequences

## Positive

- Cleaner application structure.
- Easier debugging.
- Better separation of concerns.
- Easier extension of new features.

## Negative

- Increased number of files.
- More architectural complexity.
- Additional learning curve for developers.

---

# Alternatives Considered

## Traditional Service-Based Architecture

Rejected because:

- Services can become large.
- Read and write responsibilities become mixed.
- Harder to scale specific operations.

---

## Full Event Sourcing

Not selected because:

- The current application does not require complete historical state reconstruction.
- Additional complexity is not justified at this stage.

---

# Result

The Task Manager API now uses CQRS to clearly separate write operations from read operations, creating a more maintainable and scalable application structure.