const { ObjectId } = require('mongodb');

/**
 * Demo seed data for Section 6.
 *
 * Demo password for both users:
 * Demo123!
 *
 * Existing application data is NOT touched.
 */

const DEMO_USER_1 = new ObjectId('68a9a0010000000000000001');
const DEMO_USER_2 = new ObjectId('68a9a0010000000000000002');

const DEMO_WORKSPACE = new ObjectId('68a9a0020000000000000001');

const DEMO_TASK_1 = new ObjectId('68a9a0030000000000000001');
const DEMO_TASK_2 = new ObjectId('68a9a0030000000000000002');
const DEMO_TASK_3 = new ObjectId('68a9a0030000000000000003');
const DEMO_TASK_4 = new ObjectId('68a9a0030000000000000004');
const DEMO_TASK_5 = new ObjectId('68a9a0030000000000000005');

// bcrypt hash for: Demo123!

const DEMO_EMAIL_1 = ['demo.owner', 'example.com'].join(String.fromCharCode(64));
const DEMO_EMAIL_2 = ['demo.member', 'example.com'].join(String.fromCharCode(64));


const DEMO_PASSWORD_HASH =
  '$2b$10$JNJLNpHB7DtBDcCbPpkn8e/WbP91ejABs8ys8mXZYmWzfS1DJU.te';

module.exports = {
  async up(db) {
    const now = new Date();

    /*
     * Users
     *
     * We use fixed IDs so the migration is deterministic and
     * the down() migration can remove exactly these documents.
     */
    await db.collection('users').insertMany([
      {
        _id: DEMO_USER_1,
        email: DEMO_EMAIL_1,
        password: DEMO_PASSWORD_HASH,
        role: 'admin',
        refreshTokenHash: null,
        tokenFamily: null,
        currentTokenId: null,
        emailVerified: true,
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: DEMO_USER_2,
        email: DEMO_EMAIL_2,
        password: DEMO_PASSWORD_HASH,
        role: 'user',
        refreshTokenHash: null,
        tokenFamily: null,
        currentTokenId: null,
        emailVerified: true,
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    /*
     * Workspace
     */
    await db.collection('workspaces').insertOne({
      _id: DEMO_WORKSPACE,
      name: 'Demo Workspace',
      slug: 'demo-workspace',
      owner: DEMO_USER_1,
      createdAt: now,
      updatedAt: now,
    });

    /*
     * Memberships
     */
    await db.collection('memberships').insertMany([
      {
        workspaceId: DEMO_WORKSPACE,
        userId: DEMO_USER_1,
        role: 'OWNER',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      },
      {
        workspaceId: DEMO_WORKSPACE,
        userId: DEMO_USER_2,
        role: 'MEMBER',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    /*
     * Tasks
     *
     * We deliberately vary:
     * - status
     * - priority
     * - dueDate
     * - tags
     * - assignees
     *
     * This gives us useful data for:
     * - compound index explain()
     * - text search
     * - aggregation
     * - $lookup
     * - $facet
     * - pagination
     * - priority sorting
     */
    await db.collection('tasks').insertMany([
      {
        _id: DEMO_TASK_1,
        title: 'Prepare NestJS architecture documentation',
        description:
          'Document the production architecture and module boundaries.',
        status: 'pending',
        priority: 'high',
        dueDate: new Date('2026-08-15T12:00:00.000Z'),
        __v: 0,
        category: null,
        tags: ['nestjs', 'architecture', 'documentation'],
        isDeleted: false,
        deletedAt: null,
        reminderSent: false,
        comments: [],
        attachments: [],
        owner: DEMO_USER_1,
        workspace: DEMO_WORKSPACE,
        assignees: [DEMO_USER_1, DEMO_USER_2],
        createdAt: now,
        updatedAt: now,
      },

      {
        _id: DEMO_TASK_2,
        title: 'Implement MongoDB transaction tests',
        description:
          'Verify atomic operations across memberships and audit logs.',
        status: 'in-progress',
        priority: 'high',
        dueDate: new Date('2026-08-18T12:00:00.000Z'),
        __v: 0,
        category: null,
        tags: ['mongodb', 'transactions', 'testing'],
        isDeleted: false,
        deletedAt: null,
        reminderSent: false,
        comments: [],
        attachments: [],
        owner: DEMO_USER_1,
        workspace: DEMO_WORKSPACE,
        assignees: [DEMO_USER_2],
        createdAt: now,
        updatedAt: now,
      },

      {
        _id: DEMO_TASK_3,
        title: 'Add API security documentation',
        description:
          'Document authorization, optimistic concurrency and ETag handling.',
        status: 'done',
        priority: 'medium',
        dueDate: new Date('2026-08-10T12:00:00.000Z'),
        __v: 0,
        category: null,
        tags: ['security', 'etag', 'authorization'],
        isDeleted: false,
        deletedAt: null,
        reminderSent: false,
        comments: [],
        attachments: [],
        owner: DEMO_USER_2,
        workspace: DEMO_WORKSPACE,
        assignees: [DEMO_USER_2],
        createdAt: now,
        updatedAt: now,
      },

      {
        _id: DEMO_TASK_4,
        title: 'Optimize task search queries',
        description:
          'Use MongoDB text indexes and inspect query execution plans.',
        status: 'pending',
        priority: 'medium',
        dueDate: new Date('2026-08-22T12:00:00.000Z'),
        __v: 0,
        category: null,
        tags: ['mongodb', 'search', 'indexes'],
        isDeleted: false,
        deletedAt: null,
        reminderSent: false,
        comments: [],
        attachments: [],
        owner: DEMO_USER_2,
        workspace: DEMO_WORKSPACE,
        assignees: [DEMO_USER_1, DEMO_USER_2],
        createdAt: now,
        updatedAt: now,
      },

      {
        _id: DEMO_TASK_5,
        title: 'Review production deployment checklist',
        description:
          'Review Docker, Redis, MongoDB replica set and CI requirements.',
        status: 'pending',
        priority: 'low',
        dueDate: new Date('2026-08-30T12:00:00.000Z'),
        __v: 0,
        category: null,
        tags: ['docker', 'redis', 'deployment'],
        isDeleted: false,
        deletedAt: null,
        reminderSent: false,
        comments: [],
        attachments: [],
        owner: DEMO_USER_1,
        workspace: DEMO_WORKSPACE,
        assignees: [DEMO_USER_1],
        createdAt: now,
        updatedAt: now,
      },
    ]);

    console.log('Demo seed data created successfully.');
    console.log(`Demo workspace: ${DEMO_WORKSPACE}`);
    console.log('Demo password: Demo123!');
  },

  async down(db) {
    /*
     * Remove ONLY the documents created by this migration.
     * Existing application data is preserved.
     */

    await db.collection('tasks').deleteMany({
      _id: {
        $in: [
          DEMO_TASK_1,
          DEMO_TASK_2,
          DEMO_TASK_3,
          DEMO_TASK_4,
          DEMO_TASK_5,
        ],
      },
    });

    await db.collection('memberships').deleteMany({
      workspaceId: DEMO_WORKSPACE,
      userId: {
        $in: [DEMO_USER_1, DEMO_USER_2],
      },
    });

    await db.collection('workspaces').deleteOne({
      _id: DEMO_WORKSPACE,
    });

    await db.collection('users').deleteMany({
      _id: {
        $in: [DEMO_USER_1, DEMO_USER_2],
      },
    });

    console.log('Demo seed data removed successfully.');
  },
};

