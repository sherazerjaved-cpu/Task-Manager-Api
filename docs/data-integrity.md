Data Integrity & MongoDB Mastery

1. Overview

Section 6 focuses on MongoDB data integrity, concurrency control,deliberate indexing, aggregation pipelines, and databasemigrations/seeding.

Implemented capabilities:

ACID transactions using MongoDB sessions

MongoDB replica-set configuration for transactions

Atomic invitation acceptance

Optimistic concurrency using Mongoose __v

HTTP ETag / If-Match support

409 Conflict responses for stale writes

Deliberate compound and text indexes

explain("executionStats") evidence

Aggregation with $lookup, $facet, and computed fields

migrate-mongo migrations and demo seeding

2. ACID Transactions

2.1 Invitation acceptance

Accepting an invitation spans multiple collections:

Create a workspace membership.

Mark the invitation as accepted.

Create an audit-log entry.

These operations are executed inside one MongoDB transaction using aClientSession.

The transaction is started with:

const session = await this.connection.startSession();

await session.withTransaction(async () => {
  await this.membershipRepository.create(
    workspaceId,
    userId,
    invitation.role,
    session,
  );

  await this.invitationRepository.markAccepted(
    invitationId,
    session,
  );

  await this.auditService.log(
    {
      actorId: userId,
      action: 'INVITATION_ACCEPTED',
      resource: 'INVITATION',
      workspaceId,
      meta: {
        role: invitation.role,
      },
    },
    session,
  );
});

Each repository receives the same session.

2.2 Transaction-aware repository operations

Membership creation uses:

await this.membershipModel.create(
  [
    {
      workspaceId: new Types.ObjectId(workspaceId),
      userId: new Types.ObjectId(userId),
      role,
    },
  ],
  { session },
);

Invitation acceptance uses:

await this.invitationModel.updateOne(
  {
    _id: invitationId,
    status: InvitationStatus.PENDING,
  },
  {
    $set: {
      status: InvitationStatus.ACCEPTED,
    },
  },
  { session },
);

Audit logging also receives the same session, so all three writesparticipate in the same transaction.

2.3 Why this matters

If any operation fails, the transaction is rolled back. This preventsstates such as:

membership created but invitation still pending;

invitation accepted but audit record missing;

audit record created without the membership.

MongoDB transactions require a replica-set deployment, which is why theproject MongoDB container runs with replicaSet=rs0.

3. Optimistic Concurrency

The Task schema enables optimistic concurrency:

@Schema({ timestamps: true, optimisticConcurrency: true })
export class Task {
  // ...
}

Mongoose maintains the __v version key.

The update flow receives the expected version from the HTTP If-Matchheader.

Example:

If-Match: "3"

The handler compares the client's expected version with the current taskversion:

if (task.__v !== expectedVersion) {
  throw new ConflictException(
    'Task has been modified. Please refresh and try again.',
  );
}

The task is then saved inside a transaction. Mongoose's optimisticconcurrency protection also catches a concurrent version conflict:

try {
  await task.save({ session });
} catch (error) {
  if (
    error instanceof Error &&
    error.name === 'VersionError'
  ) {
    throw new ConflictException(
      'Task has been modified. Please refresh and try again.',
    );
  }

  throw error;
}

This prevents a stale client from silently overwriting a newer update.

4. ETag / If-Match

4.1 GET task

The current task version is returned as an HTTP ETag:

const etag = `"${task.__v}"`;
res.setHeader('ETag', etag);

The client can then use that value for cache validation.

If the client's If-None-Match value matches the current version, theAPI returns:

304 Not Modified

4.2 PATCH task

Updates require If-Match.

The expected version is parsed from the header:

const expectedVersion = parseIfMatch(ifMatch);

If the header is missing, the API returns:

428 Precondition Required

If the value is invalid, the API returns:

400 Bad Request

If the version is stale, the API returns:

409 Conflict

After a successful update, the new version is returned:

res.setHeader('ETag', `"${task.__v}"`);

This gives the API HTTP-level optimistic concurrency control.

5. Deliberate Indexing

5.1 Compound workspace/status/dueDate index

The task schema defines:

TaskSchema.index({
  workspace: 1,
  status: 1,
  dueDate: 1,
});

Index name:

workspace_1_status_1_dueDate_1

This index is appropriate for common workspace task queries that filterby:

workspace;

task status;

due-date range.

It supports queries such as:

db.tasks.find({
  workspace: ObjectId('...'),
  status: 'pending',
  dueDate: {
    $gte: new Date('2026-08-15'),
    $lte: new Date('2026-08-30')
  }
})

5.2 Text search index

The task schema also defines:

TaskSchema.index({
  title: 'text',
  description: 'text',
  tags: 'text',
});

Index name:

title_text_description_text_tags_text

This supports text search across task titles, descriptions, and tags.

6. explain("executionStats") Evidence

MongoDB queries were tested with:

.explain('executionStats')

6.1 Compound index --- date range query

Test query:

db.tasks.find({
  workspace: ObjectId('68a9a0020000000000000001'),
  status: 'pending',
  dueDate: {
    $gte: new Date('2026-08-15'),
    $lte: new Date('2026-08-30')
  }
}).explain('executionStats')

Relevant result:

winningPlan:
  stage: FETCH
  inputStage:
    stage: IXSCAN
    indexName: workspace_1_status_1_dueDate_1

nReturned: 2
totalKeysExamined: 2
totalDocsExamined: 2
executionTimeMillis: 1

The query planner selected the intended compound index.

The index bounds covered the exact workspace, status, and due-daterange.

This demonstrates that MongoDB can locate the matching documents throughthe compound index rather than scanning the entire collection.

6.2 Text search index

Test query:

db.tasks.find({
  workspace: ObjectId('68a9a0020000000000000001'),
  $text: {
    $search: 'NestJS'
  }
}).explain('executionStats')

Relevant result:

winningPlan:
  stage: FETCH
  inputStage:
    stage: TEXT_MATCH
    indexName: title_text_description_text_tags_text

nReturned: 1
totalKeysExamined: 1
totalDocsExamined: 1
executionTimeMillis: 0

The query used the intended text index:

title_text_description_text_tags_text

The planner produced a TEXT_MATCH stage rather than performing acollection scan.

6.3 Exact-date query note

An earlier test used:

dueDate: new Date()

That query returned zero documents because it searched for an exacttimestamp matching the current millisecond.

The important point is that the query planner still selected:

workspace_1_status_1_dueDate_1

The date-range test above is the more representative performance test.

7. Aggregation

7.1 Task → assignees → users

The workspace task aggregation uses $lookup to resolve assigned users:

{
  $lookup: {
    from: 'users',
    localField: 'assignees',
    foreignField: '_id',
    as: 'assignees',
  },
}

This converts task assignee IDs into user documents.

7.2 Task → workspace

The aggregation also resolves the workspace:

{
  $lookup: {
    from: 'workspaces',
    localField: 'workspace',
    foreignField: '_id',
    as: 'workspace',
  },
}

The result is then flattened with $unwind.

7.3 Computed fields

The aggregation calculates derived values such as:

{
  $addFields: {
    assigneeCount: {
      $size: '$assignees',
    },

    isOverdue: {
      $and: [
        { $ne: ['$status', 'done'] },
        { $lt: ['$dueDate', new Date()] },
      ],
    },

    priorityWeight: {
      $switch: {
        branches: [
          {
            case: { $eq: ['$priority', 'high'] },
            then: 3,
          },
          {
            case: { $eq: ['$priority', 'medium'] },
            then: 2,
          },
          {
            case: { $eq: ['$priority', 'low'] },
            then: 1,
          },
        ],
        default: 0,
      },
    },
  },
}

These fields allow the API to derive useful information directly insideMongoDB.

8. $facet for Pagination + Total + Stats

The workspace aggregation uses $facet to calculate multiple results inone aggregation pipeline:

{
  $facet: {
    data: [
      { $sort: { priorityWeight: -1, dueDate: 1 } },
      { $skip: skip },
      { $limit: limit },
    ],

    total: [
      { $count: 'count' },
    ],

    stats: [
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ],
  },
}

This produces:

the paginated task data;

the total number of matching tasks;

status-based statistics.

The API returns these values together:

{
  data: [...],
  total: ...,
  stats: [...]
}

This avoids running separate aggregation pipelines for each part of theresponse.

9. Migrations and Seeding

Database migrations and demo seeding are implemented withmigrate-mongo.

The migration/seed setup creates demonstration data including:

users;

a demo workspace;

workspace memberships;

demo tasks.

The seeded task data was verified directly in MongoDB.

Example verified tasks include:

Prepare NestJS architecture documentation
Implement MongoDB transaction tests
Add API security documentation
Optimize task search queries
Review production deployment checklist

This provides reproducible database initialization for development andtesting.

Completion

requirements are implemented:

Requirement                            Status

ACID transactions / sessions           CompleteMongoDB replica set                    CompleteAtomic invitation acceptance           CompleteOptimistic concurrency / version key   Complete409 Conflict for stale writes          CompleteETag / If-Match                        CompleteCompound indexing                      CompleteText indexing                          Completeexplain() evidence                   Complete$lookup aggregation                  Complete$facet aggregation                   CompleteComputed fields                        Completemigrate-mongo migrations             CompleteDemo seeding                           Complete

Data Integrity & MongoDB Mastery is therefore complete.