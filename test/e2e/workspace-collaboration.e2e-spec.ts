import {
  INestApplication,
  ValidationPipe,
  VersioningType,
  Injectable,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { MailService } from '../../src/mail/mail.service';
import { clearDatabase, closeDatabase } from '../integration/setup/database';

import { clearRedis, closeRedis } from '../integration/setup/redis';

/**
 * ============================================================================
 * Mail test double
 * ============================================================================
 *
 * Workspace invitations contain a raw token which is sent through MailService.
 *
 * In production the token is delivered by email.
 * In E2E we capture that token so the second user can complete the
 * invitation flow through the real HTTP API.
 */
@Injectable()
class MailTestDouble {
  public sentInvitations: {
    to: string;
    workspaceName: string;
    token: string;
    expiresAt: Date;
  }[] = [];

  async sendWorkspaceInvitation(
    to: string,
    workspaceName: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    this.sentInvitations.push({
      to,
      workspaceName,
      token,
      expiresAt,
    });
  }

  async sendReminderEmail(): Promise<void> {}

  async sendVerificationEmail(): Promise<void> {}

  async sendPasswordResetEmail(): Promise<void> {}

  getLastTokenFor(email: string): string {
    const invitation = [...this.sentInvitations]
      .reverse()
      .find((item) => item.to.toLowerCase() === email.toLowerCase());

    if (!invitation) {
      throw new Error(`No invitation email captured for ${email}`);
    }

    return invitation.token;
  }

  reset(): void {
    this.sentInvitations = [];
  }
}

/**
 * ============================================================================
 * E2E application factory
 * ============================================================================
 */
async function createWorkspaceCollaborationE2EApp(): Promise<{
  app: INestApplication;
  mailDouble: MailTestDouble;
}> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(MailService)
    .useClass(MailTestDouble)
    .compile();

  const app = moduleFixture.createNestApplication();

  /**
   * The application uses trust proxy and the throttler
   * therefore uses X-Forwarded-For when determining the
   * client IP.
   */
  app.getHttpAdapter().getInstance().set('trust proxy', true);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableVersioning({
    type: VersioningType.URI,
    prefix: 'api/v',
    defaultVersion: '1',
  });

  await app.init();

  const mailDouble = app.get<MailTestDouble>(MailService);

  return {
    app,
    mailDouble,
  };
}

/**
 * ============================================================================
 * Test user
 * ============================================================================
 */
interface TestUser {
  userId: string;
  email: string;
  password: string;
  accessToken: string;
}

/**
 * ============================================================================
 * Test workspace
 * ============================================================================
 */
interface TestWorkspace {
  _id: string;
  name: string;
  slug: string;
  owner: string;
}

/**
 * ============================================================================
 * Unique values
 * ============================================================================
 */
let counter = 0;

function unique(prefix: string): string {
  counter += 1;

  return `${prefix}-${Date.now()}-${counter}`;
}

/**
 * ============================================================================
 * Test IP rotation
 * ============================================================================
 *
 * The application uses trust proxy and throttling.
 *
 * Each HTTP request gets a different test IP so the E2E suite does not
 * accidentally hit the application's real rate limits.
 */
let ipCounter = 1;

function nextTestIp(): string {
  const current = ipCounter++;

  const octet3 = Math.floor(current / 250) + 1;

  const octet4 = (current % 250) + 1;

  return `10.0.${octet3}.${octet4}`;
}

/**
 * ============================================================================
 * HTTP helper
 * ============================================================================
 */
function withIp<T extends request.Test>(req: T): T {
  return req.set('X-Forwarded-For', nextTestIp()) as T;
}

/**
 * ============================================================================
 * Register + verify + login
 * ============================================================================
 *
 * This is not an Auth E2E test.
 *
 * We only use the real authentication endpoints to obtain real access tokens
 * needed for the Workspace collaboration journey.
 *
 * Email verification is completed directly in MongoDB so that this E2E suite
 * remains focused on Workspace Collaboration rather than duplicating the
 * dedicated Auth test suite.
 */
async function registerVerifiedUser(
  app: INestApplication,
  connection: Connection,
  overrides: {
    email?: string;
    password?: string;
  } = {},
): Promise<TestUser> {
  const email = overrides.email ?? `${unique('user')}@test.com`;

  const password = overrides.password ?? 'Password123!';

  const registerResponse = await withIp(
    request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Idempotency-Key', unique('idem-register'))
      .send({
        email,
        password,
      }),
  );

  if (registerResponse.status >= 400) {
    throw new Error(
      `Registration failed (${registerResponse.status}): ${JSON.stringify(
        registerResponse.body,
      )}`,
    );
  }

  /**
   * Mark the user as verified.
   *
   * Auth itself is already covered by the dedicated Auth integration tests.
   */
  await connection.collection('users').updateOne(
    { email },
    {
      $set: {
        emailVerified: true,
      },
    },
  );

  const loginResponse = await withIp(
    request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email,
      password,
    }),
  );

  if (loginResponse.status >= 400) {
    throw new Error(
      `Login failed (${loginResponse.status}): ${JSON.stringify(
        loginResponse.body,
      )}`,
    );
  }

  const user = await connection.collection('users').findOne({ email });

  if (!user) {
    throw new Error(`User ${email} was not found after registration`);
  }

  return {
    userId: user._id.toString(),
    email,
    password,
    accessToken: loginResponse.body.access_token,
  };
}

/**
 * ============================================================================
 * Create workspace
 * ============================================================================
 */
async function createWorkspace(
  app: INestApplication,
  owner: TestUser,
  overrides: {
    name?: string;
    slug?: string;
  } = {},
): Promise<TestWorkspace> {
  const suffix = unique('workspace');

  const response = await withIp(
    request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Idempotency-Key', unique('idem-create-workspace'))
      .send({
        name: overrides.name ?? `Workspace ${suffix}`,
        slug: overrides.slug ?? `workspace-${suffix}`.toLowerCase(),
      }),
  );

  if (response.status !== 201) {
    throw new Error(
      `Workspace creation failed (${response.status}): ${JSON.stringify(
        response.body,
      )}`,
    );
  }

  return response.body as TestWorkspace;
}

/**
 * ============================================================================
 * Invite member
 * ============================================================================
 */
async function inviteMember(
  app: INestApplication,
  inviter: TestUser,
  workspaceId: string,
  email: string,
  role: 'ADMIN' | 'MEMBER' | 'VIEWER' = 'MEMBER',
) {
  return withIp(
    request(app.getHttpServer())
      .post(`/api/v1/invitations/${workspaceId}`)
      .set('Authorization', `Bearer ${inviter.accessToken}`)
      .set('Idempotency-Key', unique('idem-invite'))
      .send({
        email,
        role,
      }),
  );
}

/**
 * ============================================================================
 * Accept invitation
 * ============================================================================
 */
async function acceptInvitation(
  app: INestApplication,
  invitee: TestUser,
  token: string,
) {
  return withIp(
    request(app.getHttpServer())
      .post(`/api/v1/invitations/${token}/accept`)
      .set('Authorization', `Bearer ${invitee.accessToken}`),
  );
}

/**
 * ============================================================================
 * Workspace Collaboration E2E
 * ============================================================================
 */
describe('Workspace Collaboration (E2E)', () => {
  let app: INestApplication;
  let mailDouble: MailTestDouble;
  let mongoConnection: Connection;

  beforeAll(async () => {
    const created = await createWorkspaceCollaborationE2EApp();

    app = created.app;
    mailDouble = created.mailDouble;

    mongoConnection = app.get<Connection>(getConnectionToken());
  }, 30000);

  beforeEach(async () => {
    await clearDatabase(mongoConnection);

    await clearRedis();

    mailDouble.reset();
  }, 30000);

  afterAll(async () => {
    await closeRedis();

    if (mongoConnection) {
      await closeDatabase(mongoConnection);
    }

    if (app) {
      await app.close();
    }
  }, 30000);

  // ==========================================================================
  // COMPLETE COLLABORATION JOURNEY
  // ==========================================================================

  describe('Complete collaboration journey', () => {
    it('allows an owner to create a workspace, invite a member, and collaborate with the member', async () => {
      /**
       * ----------------------------------------------------------------------
       * 1. Create two real users through the HTTP API
       * ----------------------------------------------------------------------
       */
      const owner = await registerVerifiedUser(app, mongoConnection);

      const member = await registerVerifiedUser(app, mongoConnection);

      /**
       * ----------------------------------------------------------------------
       * 2. Owner creates workspace
       * ----------------------------------------------------------------------
       */
      const workspace = await createWorkspace(app, owner, {
        name: 'Engineering',
      });

      expect(workspace._id).toBeDefined();
      expect(workspace.name).toBe('Engineering');
      expect(workspace.owner).toBe(owner.userId);

      /**
       * ----------------------------------------------------------------------
       * 3. Owner verifies that the workspace is accessible
       * ----------------------------------------------------------------------
       */
      const ownerWorkspaceResponse = await withIp(
        request(app.getHttpServer())
          .get(`/api/v1/workspaces/${workspace._id}`)
          .set('Authorization', `Bearer ${owner.accessToken}`),
      );

      expect(ownerWorkspaceResponse.status).toBe(200);

      expect(ownerWorkspaceResponse.body._id).toBe(workspace._id);

      /**
       * ----------------------------------------------------------------------
       * 4. Owner invites member
       * ----------------------------------------------------------------------
       */
      const invitationResponse = await inviteMember(
        app,
        owner,
        workspace._id,
        member.email,
        'MEMBER',
      );

      expect(invitationResponse.status).toBe(201);

      expect(invitationResponse.body.email).toBe(member.email.toLowerCase());

      expect(invitationResponse.body.role).toBe('MEMBER');

      expect(invitationResponse.body.status).toBe('PENDING');

      /**
       * ----------------------------------------------------------------------
       * 5. Obtain the raw invitation token from the mail boundary
       * ----------------------------------------------------------------------
       */
      const invitationToken = mailDouble.getLastTokenFor(member.email);

      expect(invitationToken).toBeDefined();

      /**
       * ----------------------------------------------------------------------
       * 6. Member accepts the invitation
       * ----------------------------------------------------------------------
       */
      const acceptResponse = await acceptInvitation(
        app,
        member,
        invitationToken,
      );

      expect(acceptResponse.status).toBe(201);

      expect(acceptResponse.body.role).toBe('MEMBER');

      /**
       * ----------------------------------------------------------------------
       * 7. Member can now access the workspace
       * ----------------------------------------------------------------------
       */
      const memberWorkspaceResponse = await withIp(
        request(app.getHttpServer())
          .get(`/api/v1/workspaces/${workspace._id}`)
          .set('Authorization', `Bearer ${member.accessToken}`),
      );

      expect(memberWorkspaceResponse.status).toBe(200);

      expect(memberWorkspaceResponse.body._id).toBe(workspace._id);

      /**
       * ----------------------------------------------------------------------
       * 8. Member can see the workspace in their workspace list
       * ----------------------------------------------------------------------
       */
      const memberWorkspacesResponse = await withIp(
        request(app.getHttpServer())
          .get('/api/v1/workspaces')
          .set('Authorization', `Bearer ${member.accessToken}`),
      );

      expect(memberWorkspacesResponse.status).toBe(200);

      expect(
        memberWorkspacesResponse.body.some(
          (item: TestWorkspace) => item._id === workspace._id,
        ),
      ).toBe(true);

      /**
       * ----------------------------------------------------------------------
       * 9. Member can see the other collaborators
       * ----------------------------------------------------------------------
       */
      const membersResponse = await withIp(
        request(app.getHttpServer())
          .get(`/api/v1/workspaces/${workspace._id}/members`)
          .set('Authorization', `Bearer ${member.accessToken}`),
      );

      expect(membersResponse.status).toBe(200);

      expect(Array.isArray(membersResponse.body)).toBe(true);

      expect(membersResponse.body.length).toBe(2);
    });
  });

  // ==========================================================================
  // ADMIN COLLABORATION
  // ==========================================================================

  describe('Role-based collaboration', () => {
    it('allows an ADMIN to perform an administrative collaboration action while preventing a MEMBER from doing so', async () => {
      /**
       * Create owner, admin, member and target users.
       */
      const owner = await registerVerifiedUser(app, mongoConnection);

      const admin = await registerVerifiedUser(app, mongoConnection);

      const member = await registerVerifiedUser(app, mongoConnection);

      const target = await registerVerifiedUser(app, mongoConnection);

      /**
       * Owner creates the collaboration workspace.
       */
      const workspace = await createWorkspace(app, owner);

      /**
       * Owner invites ADMIN.
       */
      const adminInvitation = await inviteMember(
        app,
        owner,
        workspace._id,
        admin.email,
        'ADMIN',
      );

      expect(adminInvitation.status).toBe(201);

      const adminToken = mailDouble.getLastTokenFor(admin.email);

      const adminAccept = await acceptInvitation(app, admin, adminToken);

      expect(adminAccept.status).toBe(201);

      /**
       * Owner invites MEMBER.
       */
      const memberInvitation = await inviteMember(
        app,
        owner,
        workspace._id,
        member.email,
        'MEMBER',
      );

      expect(memberInvitation.status).toBe(201);

      const memberToken = mailDouble.getLastTokenFor(member.email);

      const memberAccept = await acceptInvitation(app, member, memberToken);

      expect(memberAccept.status).toBe(201);

      /**
       * ADMIN can directly add another member.
       */
      const adminAddResponse = await withIp(
        request(app.getHttpServer())
          .post(`/api/v1/workspaces/${workspace._id}/members`)
          .set('Authorization', `Bearer ${admin.accessToken}`)
          .set('Idempotency-Key', unique('idem-admin-add'))
          .send({
            userId: target.userId,
            role: 'MEMBER',
          }),
      );

      expect(adminAddResponse.status).toBe(201);

      /**
       * MEMBER cannot perform the same administrative action.
       */
      const anotherTarget = await registerVerifiedUser(app, mongoConnection);

      const memberAddResponse = await withIp(
        request(app.getHttpServer())
          .post(`/api/v1/workspaces/${workspace._id}/members`)
          .set('Authorization', `Bearer ${member.accessToken}`)
          .set('Idempotency-Key', unique('idem-member-add'))
          .send({
            userId: anotherTarget.userId,
            role: 'MEMBER',
          }),
      );

      expect(memberAddResponse.status).toBe(403);
    });
  });

  // ==========================================================================
  // FEATURE FLAGS COLLABORATION
  // ==========================================================================

  describe('Shared workspace configuration', () => {
    it('allows OWNER and ADMIN to update shared feature flags while MEMBER cannot', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const admin = await registerVerifiedUser(app, mongoConnection);

      const member = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      /**
       * Add ADMIN through the real invitation flow.
       */
      await inviteMember(app, owner, workspace._id, admin.email, 'ADMIN');

      const adminToken = mailDouble.getLastTokenFor(admin.email);

      await acceptInvitation(app, admin, adminToken);

      /**
       * Add MEMBER through the real invitation flow.
       */
      await inviteMember(app, owner, workspace._id, member.email, 'MEMBER');

      const memberToken = mailDouble.getLastTokenFor(member.email);

      await acceptInvitation(app, member, memberToken);

      /**
       * ADMIN changes a workspace-level feature flag.
       */
      const adminUpdateResponse = await withIp(
        request(app.getHttpServer())
          .patch(`/api/v1/workspaces/${workspace._id}/feature-flags`)
          .set('Authorization', `Bearer ${admin.accessToken}`)
          .send({
            webhooks: false,
          }),
      );

      expect(adminUpdateResponse.status).toBe(200);

      expect(adminUpdateResponse.body.flags.webhooks).toBe(false);

      /**
       * MEMBER cannot change the shared configuration.
       */
      const memberUpdateResponse = await withIp(
        request(app.getHttpServer())
          .patch(`/api/v1/workspaces/${workspace._id}/feature-flags`)
          .set('Authorization', `Bearer ${member.accessToken}`)
          .send({
            webhooks: true,
          }),
      );

      expect(memberUpdateResponse.status).toBe(403);

      /**
       * The ADMIN's change is still visible to another authorized
       * collaborator, proving that the configuration belongs to the
       * workspace rather than the individual user.
       */
      const ownerReadResponse = await withIp(
        request(app.getHttpServer())
          .get(`/api/v1/workspaces/${workspace._id}/feature-flags`)
          .set('Authorization', `Bearer ${owner.accessToken}`),
      );

      expect(ownerReadResponse.status).toBe(200);

      expect(ownerReadResponse.body.webhooks).toBe(false);
    });
  });

  // ==========================================================================
  // PENDING INVITATION JOURNEY
  // ==========================================================================

  describe('Invitation lifecycle', () => {
    it('shows a newly invited collaborator in pending invitations before acceptance', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const invitee = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      const invitation = await inviteMember(
        app,
        owner,
        workspace._id,
        invitee.email,
        'VIEWER',
      );

      expect(invitation.status).toBe(201);

      /**
       * The invitee can see the pending invitation.
       */
      const pendingResponse = await withIp(
        request(app.getHttpServer())
          .get('/api/v1/invitations/pending')
          .set('Authorization', `Bearer ${invitee.accessToken}`),
      );

      expect(pendingResponse.status).toBe(200);

      expect(pendingResponse.body.length).toBe(1);

      expect(pendingResponse.body[0].email).toBe(invitee.email.toLowerCase());

      expect(pendingResponse.body[0].status).toBe('PENDING');

      /**
       * Accept the invitation.
       */
      const token = mailDouble.getLastTokenFor(invitee.email);

      const acceptResponse = await acceptInvitation(app, invitee, token);

      expect(acceptResponse.status).toBe(201);

      /**
       * After acceptance the pending list is empty.
       */
      const afterAcceptResponse = await withIp(
        request(app.getHttpServer())
          .get('/api/v1/invitations/pending')
          .set('Authorization', `Bearer ${invitee.accessToken}`),
      );

      expect(afterAcceptResponse.status).toBe(200);

      expect(afterAcceptResponse.body).toEqual([]);
    });
  });

  // ==========================================================================
  // TENANT ISOLATION
  // ==========================================================================

  describe('Tenant isolation', () => {
    it('prevents a member of Workspace A from accessing Workspace B', async () => {
      const userA = await registerVerifiedUser(app, mongoConnection);

      const userB = await registerVerifiedUser(app, mongoConnection);

      const workspaceA = await createWorkspace(app, userA);

      const workspaceB = await createWorkspace(app, userB);

      /**
       * User A can access their own workspace.
       */
      const ownWorkspaceResponse = await withIp(
        request(app.getHttpServer())
          .get(`/api/v1/workspaces/${workspaceA._id}`)
          .set('Authorization', `Bearer ${userA.accessToken}`),
      );

      expect(ownWorkspaceResponse.status).toBe(200);

      /**
       * User A cannot access Workspace B.
       */
      const foreignWorkspaceResponse = await withIp(
        request(app.getHttpServer())
          .get(`/api/v1/workspaces/${workspaceB._id}`)
          .set('Authorization', `Bearer ${userA.accessToken}`),
      );

      expect(foreignWorkspaceResponse.status).toBe(403);
    });

    it('prevents a member of Workspace A from listing Workspace B members', async () => {
      const userA = await registerVerifiedUser(app, mongoConnection);

      const userB = await registerVerifiedUser(app, mongoConnection);

      const targetB = await registerVerifiedUser(app, mongoConnection);

      await createWorkspace(app, userA);

      const workspaceB = await createWorkspace(app, userB);

      /**
       * Add another collaborator to Workspace B.
       */
      const invitation = await inviteMember(
        app,
        userB,
        workspaceB._id,
        targetB.email,
        'MEMBER',
      );

      expect(invitation.status).toBe(201);

      const targetToken = mailDouble.getLastTokenFor(targetB.email);

      const targetAccept = await acceptInvitation(app, targetB, targetToken);

      expect(targetAccept.status).toBe(201);

      /**
       * User A must not be able to see Workspace B's collaborators.
       */
      const response = await withIp(
        request(app.getHttpServer())
          .get(`/api/v1/workspaces/${workspaceB._id}/members`)
          .set('Authorization', `Bearer ${userA.accessToken}`),
      );

      expect(response.status).toBe(403);
    });

    it('prevents a member of Workspace A from inviting users into Workspace B', async () => {
      const userA = await registerVerifiedUser(app, mongoConnection);

      const userB = await registerVerifiedUser(app, mongoConnection);

      const target = await registerVerifiedUser(app, mongoConnection);

      await createWorkspace(app, userA);

      const workspaceB = await createWorkspace(app, userB);

      const response = await inviteMember(
        app,
        userA,
        workspaceB._id,
        target.email,
        'MEMBER',
      );

      expect(response.status).toBe(403);
    });
  });

  // ==========================================================================
  // UNAUTHENTICATED COLLABORATION ACCESS
  // ==========================================================================

  describe('Authentication boundary', () => {
    it('rejects unauthenticated access to workspace collaboration endpoints', async () => {
      const workspaceId = unique('workspace-id');

      const getWorkspaceResponse = await withIp(
        request(app.getHttpServer()).get(`/api/v1/workspaces/${workspaceId}`),
      );

      expect(getWorkspaceResponse.status).toBe(401);

      const membersResponse = await withIp(
        request(app.getHttpServer()).get(
          `/api/v1/workspaces/${workspaceId}/members`,
        ),
      );

      expect(membersResponse.status).toBe(401);

      const invitationResponse = await withIp(
        request(app.getHttpServer())
          .post(`/api/v1/invitations/${workspaceId}`)
          .send({
            email: 'target@test.com',
            role: 'MEMBER',
          }),
      );

      expect(invitationResponse.status).toBe(401);
    });
  });
});
