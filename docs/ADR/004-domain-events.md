# ADR-004: Adopt Domain Events

## Status

Accepted

## Date

2026-08-07

---

# Context

As the Task Manager API grows, certain actions can trigger additional behavior.

Examples:

- Creating a task may require notifications or logging.
- Completing a task may trigger reminders, analytics, or other workflows.

Keeping all side effects directly inside command handlers creates tight coupling.

For example:

```
UpdateTaskHandler

    |
    +---- Activity Logging
    |
    +---- Notification Logic
    |
    +---- Cache Handling
```

This makes handlers larger and harder to maintain.

The application required a way to notify other parts of the system when important business actions occur without creating direct dependencies.

---

# Decision

We adopted Domain Events using the NestJS CQRS EventBus.

Domain events represent important business occurrences inside the application.

Implemented events:

```
TaskCreatedEvent
TaskCompletedEvent
```

Events are published after successful business operations.

---

# Implementation

Location:

```
src/task/application/events
```

Structure:

```
events

├── task-created.event.ts
├── task-completed.event.ts
│
└── handlers

    ├── task-created.handler.ts
    └── task-completed.handler.ts
```

---

# Event Flow

The event-driven flow is:

```text
Command Handler

        |

        v

EventBus.publish()

        |

        v

Domain Event

        |

        v

Event Handler
```

---

# Task Created Event

When a task is created:

```
CreateTaskHandler

        |

        v

TaskCreatedEvent

        |

        v

TaskCreatedHandler
```

The event contains information such as:

- Task ID.
- Task title.
- Owner ID.

---

# Task Completed Event

When a task status changes to completed:

```
UpdateTaskHandler

        |

        v

TaskCompletedEvent

        |

        v

TaskCompletedHandler
```

The event is only published when the task transitions:

```
Previous Status != Done

AND

Current Status == Done
```

This prevents duplicate completion events.

---

# Benefits

## Loose Coupling

Handlers do not need to know which components react to an event.

---

## Extensibility

New behavior can be added by creating additional event handlers.

Example:

```
TaskCompletedEvent

        |

        +---- NotificationHandler

        |

        +---- AnalyticsHandler

        |

        +---- ActivityHandler
```

without changing the original command handler.

---

## Better Separation of Responsibilities

Command handlers focus on:

- Executing actions.
- Applying business rules.

Event handlers focus on:

- Reacting to completed actions.
- Handling side effects.

---

# Consequences

## Positive

- Reduced coupling.
- Easier feature expansion.
- Cleaner business workflows.
- Better organization of side effects.

## Negative

- More components to maintain.
- Event flow can become harder to trace.
- Requires clear event naming and documentation.

---

# Alternatives Considered

## Direct Method Calls

Example:

```
UpdateTaskHandler

        |

        v

NotificationService.send()
```

Rejected because:

- Creates tight coupling.
- Makes future changes harder.

---

## Message Broker

Not implemented at this stage because:

- Current requirements do not need distributed event processing.
- Additional infrastructure complexity is unnecessary.

Future migration to a message broker remains possible.

---

# Result

The Task Manager API now uses domain events to represent important business occurrences, allowing the system to grow with better separation between core actions and supporting behaviors.