import {
  INestApplication,
  ValidationPipe,
  VersioningType,
  Injectable,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Connection, Types } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import request from 'supertest';
import { shutdownIntegrationApp } from '../helpers/shutdown-helper';
import { AppModule } from '../../../src/app.module';
import { MailService } from '../../../src/mail/mail.service';
import { clearDatabase } from '../setup/database';
import { clearRedis } from '../setup/redis';
jest.setTimeout(15000);
/**
 * ---------------------------------------------------------------------------
 * Mail test double
 * ---------------------------------------------------------------------------
 *
 * CreateInvitationHandler generates a raw invitation token and only stores
 * the SHA-256 hash in MongoDB.
 *
 * The raw token is delivered through MailService, so the integration tests
 * replace MailService with this capturing double.
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
 * ---------------------------------------------------------------------------
 * Test application
 * ---------------------------------------------------------------------------
 */
async function createWorkspaceTestApp(): Promise<{
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
 * ---------------------------------------------------------------------------
 * Test user
 * ---------------------------------------------------------------------------
 */
interface TestUser {
  userId: string;
  email: string;
  accessToken: string;
}

/**
 * ---------------------------------------------------------------------------
 * Unique values
 * ---------------------------------------------------------------------------
 */
let counter = 0;

function unique(prefix: string): string {
  counter += 1;

  return `${prefix}-${Date.now()}-${counter}`;
}

/**
 * ---------------------------------------------------------------------------
 * Test IPs
 * ---------------------------------------------------------------------------
 *
 * Your application uses trust proxy and the throttler therefore sees the
 * X-Forwarded-For address.
 *
 * We deliberately rotate IPs between users/tests so integration tests do not
 * accidentally hit the application's real rate limit.
 */
let ipCounter = 1;

function nextTestIp(): string {
  const current = ipCounter++;

  const octet3 = Math.floor(current / 250) + 1;
  const octet4 = (current % 250) + 1;

  return `10.0.${octet3}.${octet4}`;
}

/**
 * ---------------------------------------------------------------------------
 * HTTP helper
 * ---------------------------------------------------------------------------
 */
function withIp<T extends request.Test>(req: T): T {
  return req.set('X-Forwarded-For', nextTestIp()) as T;
}

/**
 * ---------------------------------------------------------------------------
 * Register + verify + login
 * ---------------------------------------------------------------------------
 *
 * Registration and login are still performed through the real HTTP API.
 *
 * Email verification is intentionally bypassed by directly updating MongoDB.
 * This keeps Workspace integration tests focused on Workspace behavior.
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

  const registerRes = await withIp(
    request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Idempotency-Key', unique('idem-register'))
      .send({
        email,
        password,
      }),
  );

  if (registerRes.status >= 400) {
    throw new Error(
      `Register failed (${registerRes.status}): ${JSON.stringify(
        registerRes.body,
      )}`,
    );
  }

  await connection.collection('users').updateOne(
    { email },
    {
      $set: {
        emailVerified: true,
      },
    },
  );

  const loginRes = await withIp(
    request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email,
      password,
    }),
  );

  if (loginRes.status >= 400) {
    throw new Error(
      `Login failed (${loginRes.status}): ${JSON.stringify(loginRes.body)}`,
    );
  }

  const userDoc = await connection.collection('users').findOne({ email });

  if (!userDoc) {
    throw new Error(`User ${email} not found after registration`);
  }

  return {
    userId: userDoc._id.toString(),
    email,
    accessToken: loginRes.body.access_token,
  };
}

/**
 * ---------------------------------------------------------------------------
 * Workspace helper
 * ---------------------------------------------------------------------------
 */
async function createWorkspace(
  app: INestApplication,
  owner: TestUser,
  overrides: {
    name?: string;
    slug?: string;
  } = {},
) {
  const suffix = unique('ws');

  const response = await withIp(
    request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Idempotency-Key', unique('idem-create-ws'))
      .send({
        name: overrides.name ?? `Workspace ${suffix}`,
        slug: overrides.slug ?? `workspace-${suffix}`.toLowerCase(),
      }),
  );

  if (response.status !== 201) {
    throw new Error(
      `createWorkspace failed (${response.status}): ${JSON.stringify(
        response.body,
      )}`,
    );
  }

  return response.body;
}

/**
 * ---------------------------------------------------------------------------
 * Invitation helper
 * ---------------------------------------------------------------------------
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
 * ---------------------------------------------------------------------------
 * Accept invitation helper
 * ---------------------------------------------------------------------------
 */
async function acceptInvitation(
  app: INestApplication,
  invitee: TestUser,
  rawToken: string,
) {
  return withIp(
    request(app.getHttpServer())
      .post(`/api/v1/invitations/${rawToken}/accept`)
      .set('Authorization', `Bearer ${invitee.accessToken}`),
  );
}

/**
 * ---------------------------------------------------------------------------
 * Decline invitation helper
 * ---------------------------------------------------------------------------
 */
async function declineInvitation(
  app: INestApplication,
  invitee: TestUser,
  rawToken: string,
) {
  return withIp(
    request(app.getHttpServer())
      .post(`/api/v1/invitations/${rawToken}/decline`)
      .set('Authorization', `Bearer ${invitee.accessToken}`),
  );
}

/**
 * ---------------------------------------------------------------------------
 * Workspace integration tests
 * ---------------------------------------------------------------------------
 */
describe('Workspace Module (integration)', () => {
  let app: INestApplication;
  let mailDouble: MailTestDouble;
  let mongoConnection: Connection;

  beforeAll(async () => {
    const created = await createWorkspaceTestApp();

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
    await shutdownIntegrationApp(app, mongoConnection);
  }, 30000);

  // =========================================================================
  // CREATE WORKSPACE
  // =========================================================================

  describe('Create workspace', () => {
    it('owner creates a workspace and becomes its OWNER member', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner, {
        name: 'Engineering',
        slug: `engineering-${unique('slug')}`,
      });

      expect(workspace._id).toBeDefined();
      expect(workspace.name).toBe('Engineering');
      expect(workspace.owner).toBe(owner.userId);

      const membership = await mongoConnection
        .collection('memberships')
        .findOne({
          workspaceId: new Types.ObjectId(workspace._id),
          userId: new Types.ObjectId(owner.userId),
        });

      expect(membership).toBeTruthy();
      expect(membership?.role).toBe('OWNER');
      expect(membership?.status).toBe('ACTIVE');
    });

    it('rejects creating a workspace with a duplicate slug', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const slug = `duplicate-${unique('slug')}`;

      await createWorkspace(app, owner, { slug });

      const response = await withIp(
        request(app.getHttpServer())
          .post('/api/v1/workspaces')
          .set('Authorization', `Bearer ${owner.accessToken}`)
          .set('Idempotency-Key', unique('idem'))
          .send({
            name: 'Another',
            slug,
          }),
      );

      expect(response.status).toBe(409);
    });

    it('rejects creating a workspace without authentication', async () => {
      const response = await withIp(
        request(app.getHttpServer())
          .post('/api/v1/workspaces')
          .send({
            name: 'Workspace',
            slug: unique('workspace'),
          }),
      );

      expect(response.status).toBe(401);
    });
  });

  // =========================================================================
  // GET WORKSPACES
  // =========================================================================

  describe('Get workspaces', () => {
    it('returns only workspaces where the user is a member', async () => {
      const user = await registerVerifiedUser(app, mongoConnection);

      const otherUser = await registerVerifiedUser(app, mongoConnection);

      const workspaceA = await createWorkspace(app, user);

      await createWorkspace(app, otherUser);

      const response = await withIp(
        request(app.getHttpServer())
          .get('/api/v1/workspaces')
          .set('Authorization', `Bearer ${user.accessToken}`),
      );

      expect(response.status).toBe(200);

      expect(Array.isArray(response.body)).toBe(true);

      expect(
        response.body.some(
          (workspace: any) => workspace._id === workspaceA._id,
        ),
      ).toBe(true);

      expect(response.body.length).toBe(1);
    });

    it('returns an empty array when the user has no workspace memberships', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const outsider = await registerVerifiedUser(app, mongoConnection);

      await createWorkspace(app, owner);

      const response = await withIp(
        request(app.getHttpServer())
          .get('/api/v1/workspaces')
          .set('Authorization', `Bearer ${outsider.accessToken}`),
      );

      expect(response.status).toBe(200);

      expect(response.body).toEqual([]);
    });
  });

  // =========================================================================
  // GET SINGLE WORKSPACE
  // =========================================================================

  describe('Get workspace', () => {
    it('member can read their workspace', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      const response = await withIp(
        request(app.getHttpServer())
          .get(`/api/v1/workspaces/${workspace._id}`)
          .set('Authorization', `Bearer ${owner.accessToken}`),
      );

      expect(response.status).toBe(200);

      expect(response.body._id).toBe(workspace._id);
    });

    it('non-member cannot read the workspace', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const outsider = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      const response = await withIp(
        request(app.getHttpServer())
          .get(`/api/v1/workspaces/${workspace._id}`)
          .set('Authorization', `Bearer ${outsider.accessToken}`),
      );

      expect(response.status).toBe(403);
    });

    it('returns 404 for a non-existent workspace', async () => {
      const user = await registerVerifiedUser(app, mongoConnection);

      const fakeId = new Types.ObjectId().toString();

      const response = await withIp(
        request(app.getHttpServer())
          .get(`/api/v1/workspaces/${fakeId}`)
          .set('Authorization', `Bearer ${user.accessToken}`),
      );

      expect(response.status).toBe(403);
    });
  });

  // =========================================================================
  // INVITATIONS
  // =========================================================================

  describe('Invitations', () => {
    it('owner can invite a registered user', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const invitee = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      const response = await inviteMember(
        app,
        owner,
        workspace._id,
        invitee.email,
        'MEMBER',
      );

      expect(response.status).toBe(201);

      expect(response.body.email).toBe(invitee.email.toLowerCase());

      expect(response.body.role).toBe('MEMBER');

      expect(response.body.status).toBe('PENDING');

      expect(mailDouble.getLastTokenFor(invitee.email)).toBeDefined();
    });

    it('rejects inviting a non-existent user', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      const response = await inviteMember(
        app,
        owner,
        workspace._id,
        `missing-${unique('user')}@test.com`,
      );

      expect(response.status).toBe(404);
    });

    it('rejects a duplicate pending invitation', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const invitee = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      const first = await inviteMember(
        app,
        owner,
        workspace._id,
        invitee.email,
      );

      expect(first.status).toBe(201);

      const second = await inviteMember(
        app,
        owner,
        workspace._id,
        invitee.email,
      );

      expect(second.status).toBe(409);
    });

    it('rejects inviting an existing workspace member', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const member = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      const addResponse = await withIp(
        request(app.getHttpServer())
          .post(`/api/v1/workspaces/${workspace._id}/members`)
          .set('Authorization', `Bearer ${owner.accessToken}`)
          .set('Idempotency-Key', unique('idem'))
          .send({
            userId: member.userId,
            role: 'MEMBER',
          }),
      );

      expect(addResponse.status).toBe(201);

      const inviteResponse = await inviteMember(
        app,
        owner,
        workspace._id,
        member.email,
      );

      expect(inviteResponse.status).toBe(409);
    });

    it('cannot assign OWNER through invitation', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const invitee = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      const response = await inviteMember(
        app,
        owner,
        workspace._id,
        invitee.email,
        'OWNER' as any,
      );

      expect(response.status).toBe(400);
    });

    it('non-member cannot invite into a workspace', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const outsider = await registerVerifiedUser(app, mongoConnection);

      const target = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      const response = await inviteMember(
        app,
        outsider,
        workspace._id,
        target.email,
      );

      expect(response.status).toBe(403);
    });
  });

  // =========================================================================
  // ACCEPT INVITATION
  // =========================================================================

  describe('Accept invitation', () => {
    async function prepareInvitation(
      role: 'ADMIN' | 'MEMBER' | 'VIEWER' = 'MEMBER',
    ) {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const invitee = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      await inviteMember(app, owner, workspace._id, invitee.email, role);

      const token = mailDouble.getLastTokenFor(invitee.email);

      return {
        owner,
        invitee,
        workspace,
        token,
      };
    }

    it('invitee can accept a valid invitation', async () => {
      const { invitee, workspace, token } = await prepareInvitation('MEMBER');

      const response = await acceptInvitation(app, invitee, token);

      expect(response.status).toBe(201);

      expect(response.body.role).toBe('MEMBER');

      const membership = await mongoConnection
        .collection('memberships')
        .findOne({
          workspaceId: new Types.ObjectId(workspace._id),
          userId: new Types.ObjectId(invitee.userId),
        });

      expect(membership).toBeTruthy();

      expect(membership?.role).toBe('MEMBER');

      expect(membership?.status).toBe('ACTIVE');

      const invitation = await mongoConnection
        .collection('invitations')
        .findOne({
          email: invitee.email.toLowerCase(),
        });

      expect(invitation?.status).toBe('ACCEPTED');
    });

    it('rejects accepting an already accepted invitation', async () => {
      const { invitee, token } = await prepareInvitation();

      const first = await acceptInvitation(app, invitee, token);

      expect(first.status).toBe(201);

      const second = await acceptInvitation(app, invitee, token);

      expect(second.status).toBe(409);
    });

    it('rejects an invalid invitation token', async () => {
      const invitee = await registerVerifiedUser(app, mongoConnection);

      const response = await acceptInvitation(app, invitee, 'invalid-token');

      expect(response.status).toBe(404);
    });

    it('rejects accepting an invitation belonging to another email', async () => {
      const { invitee, token } = await prepareInvitation();

      const wrongUser = await registerVerifiedUser(app, mongoConnection);

      const response = await acceptInvitation(app, wrongUser, token);

      expect(response.status).toBe(403);

      void invitee;
    });

    it('rejects accepting an expired invitation', async () => {
      const { invitee, workspace, token } = await prepareInvitation();

      const invitation = await mongoConnection
        .collection('invitations')
        .findOne({
          email: invitee.email.toLowerCase(),
          workspaceId: new Types.ObjectId(workspace._id),
        });

      expect(invitation).toBeTruthy();

      await mongoConnection.collection('invitations').updateOne(
        {
          _id: invitation?._id,
        },
        {
          $set: {
            expiresAt: new Date(Date.now() - 60_000),
          },
        },
      );

      const response = await acceptInvitation(app, invitee, token);

      expect(response.status).toBe(409);
    });
  });

  // =========================================================================
  // DECLINE INVITATION
  // =========================================================================

  describe('Decline invitation', () => {
    it('invitee can decline a pending invitation', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const invitee = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      await inviteMember(app, owner, workspace._id, invitee.email, 'VIEWER');

      const token = mailDouble.getLastTokenFor(invitee.email);

      const response = await declineInvitation(app, invitee, token);

      expect(response.status).toBe(201);

      const invitation = await mongoConnection
        .collection('invitations')
        .findOne({
          email: invitee.email.toLowerCase(),
        });

      expect(invitation?.status).toBe('DECLINED');
    });

    it('declined invitation disappears from pending invitations', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const invitee = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      await inviteMember(app, owner, workspace._id, invitee.email, 'VIEWER');

      const token = mailDouble.getLastTokenFor(invitee.email);

      await declineInvitation(app, invitee, token);

      const response = await withIp(
        request(app.getHttpServer())
          .get('/api/v1/invitations/pending')
          .set('Authorization', `Bearer ${invitee.accessToken}`),
      );

      expect(response.status).toBe(200);

      expect(response.body).toEqual([]);
    });

    it('rejects declining an already declined invitation', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const invitee = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      await inviteMember(app, owner, workspace._id, invitee.email);

      const token = mailDouble.getLastTokenFor(invitee.email);

      const first = await declineInvitation(app, invitee, token);

      expect(first.status).toBe(201);

      const second = await declineInvitation(app, invitee, token);

      expect(second.status).toBe(409);
    });
  });

  // =========================================================================
  // ADD MEMBER DIRECTLY
  // =========================================================================

  describe('Add member directly', () => {
    it('OWNER can add a member directly', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const target = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      const response = await withIp(
        request(app.getHttpServer())
          .post(`/api/v1/workspaces/${workspace._id}/members`)
          .set('Authorization', `Bearer ${owner.accessToken}`)
          .set('Idempotency-Key', unique('idem-add-member'))
          .send({
            userId: target.userId,
            role: 'ADMIN',
          }),
      );

      expect(response.status).toBe(201);

      expect(response.body.role).toBe('ADMIN');

      const membership = await mongoConnection
        .collection('memberships')
        .findOne({
          workspaceId: new Types.ObjectId(workspace._id),
          userId: new Types.ObjectId(target.userId),
        });

      expect(membership).toBeTruthy();
      expect(membership?.role).toBe('ADMIN');
    });

    it('ADMIN can add a member directly', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const admin = await registerVerifiedUser(app, mongoConnection);

      const target = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      await inviteMember(app, owner, workspace._id, admin.email, 'ADMIN');

      const token = mailDouble.getLastTokenFor(admin.email);

      await acceptInvitation(app, admin, token);

      const response = await withIp(
        request(app.getHttpServer())
          .post(`/api/v1/workspaces/${workspace._id}/members`)
          .set('Authorization', `Bearer ${admin.accessToken}`)
          .set('Idempotency-Key', unique('idem'))
          .send({
            userId: target.userId,
            role: 'MEMBER',
          }),
      );

      expect(response.status).toBe(201);
    });

    it('MEMBER cannot add a member directly', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const member = await registerVerifiedUser(app, mongoConnection);

      const target = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      await inviteMember(app, owner, workspace._id, member.email, 'MEMBER');

      const token = mailDouble.getLastTokenFor(member.email);

      await acceptInvitation(app, member, token);

      const response = await withIp(
        request(app.getHttpServer())
          .post(`/api/v1/workspaces/${workspace._id}/members`)
          .set('Authorization', `Bearer ${member.accessToken}`)
          .set('Idempotency-Key', unique('idem'))
          .send({
            userId: target.userId,
            role: 'MEMBER',
          }),
      );

      expect(response.status).toBe(403);
    });

    it('VIEWER cannot add a member directly', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const viewer = await registerVerifiedUser(app, mongoConnection);

      const target = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      await inviteMember(app, owner, workspace._id, viewer.email, 'VIEWER');

      const token = mailDouble.getLastTokenFor(viewer.email);

      await acceptInvitation(app, viewer, token);

      const response = await withIp(
        request(app.getHttpServer())
          .post(`/api/v1/workspaces/${workspace._id}/members`)
          .set('Authorization', `Bearer ${viewer.accessToken}`)
          .set('Idempotency-Key', unique('idem'))
          .send({
            userId: target.userId,
            role: 'MEMBER',
          }),
      );

      expect(response.status).toBe(403);
    });

    it('rejects adding a user who is already a member', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const target = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      const first = await withIp(
        request(app.getHttpServer())
          .post(`/api/v1/workspaces/${workspace._id}/members`)
          .set('Authorization', `Bearer ${owner.accessToken}`)
          .set('Idempotency-Key', unique('idem'))
          .send({
            userId: target.userId,
            role: 'MEMBER',
          }),
      );

      expect(first.status).toBe(201);

      const second = await withIp(
        request(app.getHttpServer())
          .post(`/api/v1/workspaces/${workspace._id}/members`)
          .set('Authorization', `Bearer ${owner.accessToken}`)
          .set('Idempotency-Key', unique('idem'))
          .send({
            userId: target.userId,
            role: 'MEMBER',
          }),
      );

      expect(second.status).toBe(409);
    });

    it('cannot directly assign OWNER role', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const target = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      const response = await withIp(
        request(app.getHttpServer())
          .post(`/api/v1/workspaces/${workspace._id}/members`)
          .set('Authorization', `Bearer ${owner.accessToken}`)
          .set('Idempotency-Key', unique('idem'))
          .send({
            userId: target.userId,
            role: 'OWNER',
          }),
      );

      expect(response.status).toBe(400);
    });
  });

  // =========================================================================
  // WORKSPACE MEMBERS
  // =========================================================================

  describe('Workspace members', () => {
    it('member can list workspace members', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const member = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      await inviteMember(app, owner, workspace._id, member.email, 'MEMBER');

      const token = mailDouble.getLastTokenFor(member.email);

      await acceptInvitation(app, member, token);

      const response = await withIp(
        request(app.getHttpServer())
          .get(`/api/v1/workspaces/${workspace._id}/members`)
          .set('Authorization', `Bearer ${member.accessToken}`),
      );

      expect(response.status).toBe(200);

      expect(Array.isArray(response.body)).toBe(true);

      expect(response.body.length).toBe(2);
    });

    it('non-member cannot list workspace members', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const outsider = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      const response = await withIp(
        request(app.getHttpServer())
          .get(`/api/v1/workspaces/${workspace._id}/members`)
          .set('Authorization', `Bearer ${outsider.accessToken}`),
      );

      expect(response.status).toBe(403);
    });
  });

  // =========================================================================
  // TENANT ISOLATION
  // =========================================================================

  describe('Tenant isolation', () => {
    it('Workspace A member cannot read Workspace B', async () => {
      const ownerA = await registerVerifiedUser(app, mongoConnection);

      const ownerB = await registerVerifiedUser(app, mongoConnection);

      const workspaceA = await createWorkspace(app, ownerA);

      const workspaceB = await createWorkspace(app, ownerB);

      const response = await withIp(
        request(app.getHttpServer())
          .get(`/api/v1/workspaces/${workspaceB._id}`)
          .set('Authorization', `Bearer ${ownerA.accessToken}`),
      );

      expect(response.status).toBe(403);

      void workspaceA;
    });

    it('Workspace A member cannot list Workspace B members', async () => {
      const ownerA = await registerVerifiedUser(app, mongoConnection);

      const ownerB = await registerVerifiedUser(app, mongoConnection);

      await createWorkspace(app, ownerA);

      const workspaceB = await createWorkspace(app, ownerB);

      const response = await withIp(
        request(app.getHttpServer())
          .get(`/api/v1/workspaces/${workspaceB._id}/members`)
          .set('Authorization', `Bearer ${ownerA.accessToken}`),
      );

      expect(response.status).toBe(403);
    });

    it('Workspace A member cannot invite into Workspace B', async () => {
      const ownerA = await registerVerifiedUser(app, mongoConnection);

      const ownerB = await registerVerifiedUser(app, mongoConnection);

      const target = await registerVerifiedUser(app, mongoConnection);

      await createWorkspace(app, ownerA);

      const workspaceB = await createWorkspace(app, ownerB);

      const response = await inviteMember(
        app,
        ownerA,
        workspaceB._id,
        target.email,
      );

      expect(response.status).toBe(403);
    });

    it('user with no membership cannot add members to another workspace', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const outsider = await registerVerifiedUser(app, mongoConnection);

      const target = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      const response = await withIp(
        request(app.getHttpServer())
          .post(`/api/v1/workspaces/${workspace._id}/members`)
          .set('Authorization', `Bearer ${outsider.accessToken}`)
          .set('Idempotency-Key', unique('idem'))
          .send({
            userId: target.userId,
            role: 'MEMBER',
          }),
      );

      expect(response.status).toBe(403);
    });
  });

  // =========================================================================
  // FEATURE FLAGS
  // =========================================================================

  describe('Feature flags', () => {
    it('returns default feature flags after workspace creation', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      const response = await withIp(
        request(app.getHttpServer())
          .get(`/api/v1/workspaces/${workspace._id}/feature-flags`)
          .set('Authorization', `Bearer ${owner.accessToken}`),
      );

      expect(response.status).toBe(200);

      expect(response.body.webhooks).toBe(true);

      expect(response.body.advancedTaskFiltering).toBe(false);
    });

    it('OWNER can update feature flags', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      const response = await withIp(
        request(app.getHttpServer())
          .patch(`/api/v1/workspaces/${workspace._id}/feature-flags`)
          .set('Authorization', `Bearer ${owner.accessToken}`)
          .send({
            webhooks: false,
            advancedTaskFiltering: true,
          }),
      );

      expect(response.status).toBe(200);

      expect(response.body.flags.webhooks).toBe(false);

      expect(response.body.flags.advancedTaskFiltering).toBe(true);
    });

    it('ADMIN can update feature flags', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const admin = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      await inviteMember(app, owner, workspace._id, admin.email, 'ADMIN');

      const token = mailDouble.getLastTokenFor(admin.email);

      await acceptInvitation(app, admin, token);

      const response = await withIp(
        request(app.getHttpServer())
          .patch(`/api/v1/workspaces/${workspace._id}/feature-flags`)
          .set('Authorization', `Bearer ${admin.accessToken}`)
          .send({
            webhooks: false,
          }),
      );

      expect(response.status).toBe(200);

      expect(response.body.flags.webhooks).toBe(false);
    });

    it('MEMBER cannot update feature flags', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const member = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      await inviteMember(app, owner, workspace._id, member.email, 'MEMBER');

      const token = mailDouble.getLastTokenFor(member.email);

      await acceptInvitation(app, member, token);

      const response = await withIp(
        request(app.getHttpServer())
          .patch(`/api/v1/workspaces/${workspace._id}/feature-flags`)
          .set('Authorization', `Bearer ${member.accessToken}`)
          .send({
            webhooks: false,
          }),
      );

      expect(response.status).toBe(403);
    });

    it('VIEWER cannot update feature flags', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const viewer = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      await inviteMember(app, owner, workspace._id, viewer.email, 'VIEWER');

      const token = mailDouble.getLastTokenFor(viewer.email);

      await acceptInvitation(app, viewer, token);

      const response = await withIp(
        request(app.getHttpServer())
          .patch(`/api/v1/workspaces/${workspace._id}/feature-flags`)
          .set('Authorization', `Bearer ${viewer.accessToken}`)
          .send({
            webhooks: false,
          }),
      );

      expect(response.status).toBe(403);
    });
  });

  // =========================================================================
  // WORKSPACE SETTINGS
  // =========================================================================

  describe('Workspace settings', () => {
    it('returns default settings after workspace creation', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      const response = await withIp(
        request(app.getHttpServer())
          .get(`/api/v1/workspaces/${workspace._id}/settings`)
          .set('Authorization', `Bearer ${owner.accessToken}`),
      );

      expect(response.status).toBe(200);

      expect(response.body.timezone).toBe('UTC');

      expect(response.body.emailNotifications).toBe(true);
    });

    it('OWNER can update workspace settings', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      const response = await withIp(
        request(app.getHttpServer())
          .patch(`/api/v1/workspaces/${workspace._id}/settings`)
          .set('Authorization', `Bearer ${owner.accessToken}`)
          .send({
            timezone: 'Asia/Karachi',
            emailNotifications: false,
          }),
      );

      expect(response.status).toBe(200);

      expect(response.body.timezone).toBe('Asia/Karachi');

      expect(response.body.emailNotifications).toBe(false);
    });

    it('ADMIN can update workspace settings', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const admin = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      await inviteMember(app, owner, workspace._id, admin.email, 'ADMIN');

      const token = mailDouble.getLastTokenFor(admin.email);

      await acceptInvitation(app, admin, token);

      const response = await withIp(
        request(app.getHttpServer())
          .patch(`/api/v1/workspaces/${workspace._id}/settings`)
          .set('Authorization', `Bearer ${admin.accessToken}`)
          .send({
            timezone: 'Asia/Karachi',
            emailNotifications: false,
          }),
      );

      expect(response.status).toBe(200);

      expect(response.body.timezone).toBe('Asia/Karachi');

      expect(response.body.emailNotifications).toBe(false);
    });

    it('MEMBER cannot update workspace settings', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const member = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      await inviteMember(app, owner, workspace._id, member.email, 'MEMBER');

      const token = mailDouble.getLastTokenFor(member.email);

      await acceptInvitation(app, member, token);

      const response = await withIp(
        request(app.getHttpServer())
          .patch(`/api/v1/workspaces/${workspace._id}/settings`)
          .set('Authorization', `Bearer ${member.accessToken}`)
          .send({
            timezone: 'Asia/Karachi',
          }),
      );

      expect(response.status).toBe(403);
    });

    it('VIEWER cannot update workspace settings', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const viewer = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      await inviteMember(app, owner, workspace._id, viewer.email, 'VIEWER');

      const token = mailDouble.getLastTokenFor(viewer.email);

      await acceptInvitation(app, viewer, token);

      const response = await withIp(
        request(app.getHttpServer())
          .patch(`/api/v1/workspaces/${workspace._id}/settings`)
          .set('Authorization', `Bearer ${viewer.accessToken}`)
          .send({
            timezone: 'Asia/Karachi',
          }),
      );

      expect(response.status).toBe(403);
    });
  });

  // =========================================================================
  // PENDING INVITATIONS
  // =========================================================================

  describe('Pending invitations', () => {
    it('lists pending invitations for the authenticated user', async () => {
      const owner = await registerVerifiedUser(app, mongoConnection);

      const invitee = await registerVerifiedUser(app, mongoConnection);

      const workspace = await createWorkspace(app, owner);

      await inviteMember(app, owner, workspace._id, invitee.email, 'VIEWER');

      const response = await withIp(
        request(app.getHttpServer())
          .get('/api/v1/invitations/pending')
          .set('Authorization', `Bearer ${invitee.accessToken}`),
      );

      expect(response.status).toBe(200);

      expect(Array.isArray(response.body)).toBe(true);

      expect(response.body.length).toBe(1);

      expect(response.body[0].email).toBe(invitee.email.toLowerCase());

      expect(response.body[0].status).toBe('PENDING');
    });

    it('returns an empty list when there are no pending invitations', async () => {
      const user = await registerVerifiedUser(app, mongoConnection);

      const response = await withIp(
        request(app.getHttpServer())
          .get('/api/v1/invitations/pending')
          .set('Authorization', `Bearer ${user.accessToken}`),
      );

      expect(response.status).toBe(200);

      expect(response.body).toEqual([]);
    });
  });

  // =========================================================================
  // AUTHENTICATION
  // =========================================================================

  describe('Authentication requirement', () => {
    it('rejects GET /workspaces without authentication', async () => {
      const response = await withIp(
        request(app.getHttpServer()).get('/api/v1/workspaces'),
      );

      expect(response.status).toBe(401);
    });

    it('rejects GET workspace without authentication', async () => {
      const response = await withIp(
        request(app.getHttpServer()).get(
          `/api/v1/workspaces/${new Types.ObjectId().toString()}`,
        ),
      );

      expect(response.status).toBe(401);
    });

    it('rejects workspace member listing without authentication', async () => {
      const response = await withIp(
        request(app.getHttpServer()).get(
          `/api/v1/workspaces/${new Types.ObjectId().toString()}/members`,
        ),
      );

      expect(response.status).toBe(401);
    });

    it('rejects invitation creation without authentication', async () => {
      const response = await withIp(
        request(app.getHttpServer())
          .post(`/api/v1/invitations/${new Types.ObjectId().toString()}`)
          .send({
            email: 'someone@test.com',
            role: 'MEMBER',
          }),
      );

      expect(response.status).toBe(401);
    });
  });
});
