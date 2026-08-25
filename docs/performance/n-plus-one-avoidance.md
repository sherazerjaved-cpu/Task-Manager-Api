N+1 Query Avoidance Demonstration

## Requirement

Demonstrate that aggregation paths avoid the N+1 query pattern.

## Result

**PASS — N+1 avoidance is implemented using MongoDB aggregation `$lookup` stages.**

The main task aggregation paths are:

- `TaskRepository.findAll()`
- `TaskRepository.aggregateWorkspaceTasks()`

Both retrieve related data inside a MongoDB aggregation pipeline rather than loading each task and then issuing separate application-level queries for each related document.

## 1. Task list aggregation

`TaskRepository.findAll()` builds one aggregation pipeline containing:

1. `$match`
2. `$addFields`
3. `$sort`
4. `$skip` / `$limit`
5. `$lookup` into `users` for the task owner
6. `$unwind`
7. `$lookup` into `categories`
8. `$unwind`
9. `$project`

The important stages are:

```text
$lookup → users
$lookup → categories
```

The related owner and category data are therefore joined by MongoDB as part of the aggregation rather than by running one query per task from application code.

For a page containing N tasks, the application does **not** execute:

```text
1 query for tasks
+ N queries for owners
+ N queries for categories
```

Instead, the related data is resolved within the aggregation command.

### Note about offset pagination

The offset path also executes a separate `countDocuments(filter)` query to calculate pagination metadata.

That produces:

```text
1 aggregation query
+
1 countDocuments query
```

This is still not an N+1 pattern because the number of database commands does not grow with the number of returned tasks.

## 2. Workspace task aggregation

`TaskRepository.aggregateWorkspaceTasks()` uses one aggregation pipeline containing:

```text
$match
$lookup → users
$lookup → workspaces
$unwind
$addFields
$facet
```

The `$facet` stage simultaneously produces:

- paginated task data
- total count
- status statistics

This avoids separate application-level queries for each task's related workspace/user information and keeps pagination/statistics work inside the same aggregation operation.

## 3. What an N+1 implementation would look like

An N+1 implementation would look conceptually like:

```text
Query tasks
    ↓
for each task:
    query owner
    query category
```

For 100 tasks this can become:

```text
1 task query
+
100 owner queries
+
100 category queries
=
201 database queries
```

That pattern is avoided in the current implementation.

## 4. Current implementation

The current aggregation approach is:

```text
MongoDB aggregation
    │
    ├── $match
    ├── $sort
    ├── $limit
    ├── $lookup users
    ├── $lookup categories
    └── $project
            ↓
       result set
```

The application receives the enriched task documents from MongoDB without issuing a separate repository call for every task.

## 5. Additional performance consideration

The `$lookup` stages are placed after `$limit` in `findAll()`.

For the normal task-list path, filtering, sorting, pagination, and limiting therefore occur before the owner/category joins. This reduces the number of task documents that need enrichment for a paginated response.

## 6. Conclusion

**N+1 avoidance: PASS**

The task aggregation paths use MongoDB `$lookup` and `$facet` rather than application-level per-record queries. Database command count remains bounded by the aggregation operation (plus the pagination count query on the offset path) instead of increasing linearly with the number of tasks returned.

This satisfies the requirement to demonstrate N+1 avoidance in the aggregation paths.
