import {
  INestApplication,
  Injectable,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Test as SupertestTest } from 'supertest';
import { AppModule } from '../../src/app.module';
import { MailService } from '../../src/mail/mail.service';
import { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { ExportStatus } from '../../src/export/domain/enums/export-status.enum';
import { promises as fs } from 'fs';
import { Types } from 'mongoose';
import { constants } from 'fs';
import { join } from 'path';
import * as XLSX from 'xlsx';

/**
 * ===========================================================================
 * Mail test double
 * ===========================================================================
 *
 * Export tests do not depend on email delivery, but AppModule starts the
 * asynchronous email infrastructure. Keeping the same MailService test
 * double used by the async-architecture E2E tests prevents real email
 * delivery.
 */
@Injectable()
class MailTestDouble {
  public sentInvitations: {
    to: string;
    workspaceName: string;
    token: string;
    expiresAt: Date;
  }[] = [];

  public sentVerificationEmails: {
    to: string;
    token: string;
    expiresAt: Date;
  }[] = [];

  public sentPasswordResetEmails: {
    to: string;
    token: string;
    expiresAt: Date;
  }[] = [];

  public sentReminderEmails: {
    to: string;
    taskTitle: string;
    dueDate: Date;
    priority: string;
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

  async sendVerificationEmail(
    to: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    this.sentVerificationEmails.push({
      to,
      token,
      expiresAt,
    });
  }

  async sendPasswordResetEmail(
    to: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    this.sentPasswordResetEmails.push({
      to,
      token,
      expiresAt,
    });
  }

  async sendReminderEmail(
    to: string,
    taskTitle: string,
    dueDate: Date,
    priority: string,
  ): Promise<void> {
    this.sentReminderEmails.push({
      to,
      taskTitle,
      dueDate,
      priority,
    });
  }

  reset(): void {
    this.sentInvitations = [];
    this.sentVerificationEmails = [];
    this.sentPasswordResetEmails = [];
    this.sentReminderEmails = [];
  }
}

/**
 * ===========================================================================
 * Helpers
 * ===========================================================================
 */

let counter = 0;

function unique(prefix: string): string {
  counter += 1;

  return `${prefix}-${Date.now()}-${counter}`;
}

let ipCounter = 1;

function nextTestIp(): string {
  const current = ipCounter++;

  const octet3 = Math.floor(current / 250) + 1;
  const octet4 = (current % 250) + 1;

  return `10.10.${octet3}.${octet4}`;
}

function withIp<T extends SupertestTest>(req: T): T {
  return req.set('X-Forwarded-For', nextTestIp()) as T;
}

/**
 * BullMQ + Outbox dispatcher are asynchronous.
 *
 * The dispatcher runs periodically, therefore these tests poll for the
 * expected state instead of relying on arbitrary short sleeps.
 */
async function waitFor(
  condition: () => Promise<boolean>,
  timeout = 30000,
  interval = 250,
): Promise<void> {
  const startedAt = Date.now();

  let lastError: unknown;

  while (Date.now() - startedAt < timeout) {
    try {
      if (await condition()) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error(`Async condition was not satisfied within ${timeout}ms`);
}

async function createApp(): Promise<{
  app: INestApplication;
  mongoConnection: Connection;
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

  return {
    app,
    mongoConnection: app.get<Connection>(getConnectionToken()),
  };
}

/**
 * ===========================================================================
 * Auth / workspace / task helpers
 * ===========================================================================
 */

interface AuthContext {
  accessToken: string;
  userId: string;
  email: string;
  password: string;
}

async function registerAndLogin(app: INestApplication): Promise<AuthContext> {
  const email = `${unique('export-user')}@example.com`;
  const password = 'Password123!';

  const mailDouble = app.get<MailTestDouble>(MailService);

  const registerResponse = await withIp(
    request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Idempotency-Key', unique('register-export'))
      .send({
        email,
        password,
      }),
  );

  expect(registerResponse.status).toBe(201);

  const userId =
    registerResponse.body.id ??
    registerResponse.body._id ??
    registerResponse.body.user?.id ??
    registerResponse.body.user?._id ??
    registerResponse.body.userId;

  expect(userId).toBeDefined();

  // Registration email is asynchronous.
  // Wait for the real Outbox → BullMQ → EmailProcessor flow.
  await waitFor(
    async () =>
      mailDouble.sentVerificationEmails.some(
        (emailRecord) => emailRecord.to === email,
      ),
    30000,
  );

  const verificationEmail = mailDouble.sentVerificationEmails.find(
    (emailRecord) => emailRecord.to === email,
  );

  expect(verificationEmail).toBeDefined();
  expect(verificationEmail?.token).toBeDefined();

  const verifyResponse = await withIp(
    request(app.getHttpServer()).post('/api/v1/auth/verify-email').send({
      token: verificationEmail!.token,
    }),
  );

  expect([200, 201]).toContain(verifyResponse.status);

  const loginResponse = await withIp(
    request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email,
      password,
    }),
  );

  expect([200, 201]).toContain(loginResponse.status);

  const accessToken =
    loginResponse.body.accessToken ?? loginResponse.body.access_token;

  expect(accessToken).toBeDefined();

  return {
    accessToken,
    userId,
    email,
    password,
  };
}

async function createWorkspace(
  app: INestApplication,
  accessToken: string,
): Promise<string> {
  const workspaceName = unique('Export Workspace');
  const workspaceSlug = unique('export-workspace')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');

  const response = await withIp(
    request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', unique('workspace')),
  )
    .send({
      name: workspaceName,
      slug: workspaceSlug,
    })
    .expect(201);

  expect(response.body).toBeDefined();

  const workspaceId =
    response.body._id ??
    response.body.id ??
    response.body.workspaceId ??
    response.body.workspace?.id ??
    response.body.workspace?._id;

  expect(workspaceId).toEqual(expect.any(String));

  return workspaceId;
}

async function createTask(
  app: INestApplication,
  accessToken: string,
  workspaceId: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const response = await withIp(
    request(app.getHttpServer())
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Workspace-Id', workspaceId)
      .set('Idempotency-Key', unique('task'))
      .send({
        workspaceId,

        title: unique('Export Task'),

        description: 'Task created for export E2E testing',

        priority: 'medium',

        status: 'pending',

        ...overrides,
      }),
  );

  if (response.status !== 201) {
    console.log('CREATE TASK FAILED:', JSON.stringify(response.body, null, 2));
  }

  expect(response.status).toBe(201);

  const taskId =
    response.body.task?.id ??
    response.body.task?._id ??
    response.body.id ??
    response.body._id;

  expect(taskId).toBeDefined();

  return taskId;
}
/**
 * ===========================================================================
 * Export helpers
 * ===========================================================================
 */

async function requestExport(
  app: INestApplication,
  accessToken: string,
  workspaceId: string,
  format: 'json' | 'csv' | 'xlsx',
) {
  return withIp(
    request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceId}/exports`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', unique(`export-${format}`))
      .send({
        format,
      }),
  );
}

async function getExport(
  app: INestApplication,
  accessToken: string,
  workspaceId: string,
  exportId: string,
) {
  return withIp(
    request(app.getHttpServer())
      .get(`/api/v1/workspaces/${workspaceId}/exports/${exportId}`)
      .set('Authorization', `Bearer ${accessToken}`),
  );
}

async function waitForExportStatus(
  app: INestApplication,
  accessToken: string,
  workspaceId: string,
  exportId: string,
  status: ExportStatus,
  timeout = 45000,
) {
  let latest: any;

  await waitFor(async () => {
    const response = await getExport(app, accessToken, workspaceId, exportId);

    latest = response.body;

    return latest.status === status;
  }, timeout);

  return latest;
}

/**
 * ===========================================================================
 * Test suite
 * ===========================================================================
 */

describe('Export E2E', () => {
  let app: INestApplication;
  let mongoConnection: Connection;

  beforeAll(async () => {
    process.env.EXPORT_DOWNLOAD_SECRET =
      process.env.EXPORT_DOWNLOAD_SECRET ?? 'test-export-download-secret';

    ({ app, mongoConnection } = await createApp());
  }, 60000);

  afterAll(async () => {
    await app.close();
  }, 30000);

  afterEach(async () => {
    /**
     * Remove generated export files so one test cannot affect another.
     */
    const exportDirectory = join(process.cwd(), 'exports');

    try {
      const files = await fs.readdir(exportDirectory);

      await Promise.all(
        files.map(async (file) => {
          try {
            await fs.unlink(join(exportDirectory, file));
          } catch {
            // Ignore files that disappeared during async processing.
          }
        }),
      );
    } catch {
      // The directory may not exist if no export was generated.
    }
  });

  /**
   * =========================================================================
   * 1. JSON export
   * =========================================================================
   */

  describe('JSON export', () => {
    it('should request and asynchronously complete a JSON export containing workspace tasks', async () => {
      const auth = await registerAndLogin(app);

      const workspaceId = await createWorkspace(app, auth.accessToken);

      await createTask(app, auth.accessToken, workspaceId, {
        title: 'JSON Export Task',
        description: 'JSON export task description',
        priority: 'high',
      });

      const createResponse = await requestExport(
        app,
        auth.accessToken,
        workspaceId,
        'json',
      );

      expect(createResponse.status).toBe(201);

      expect(createResponse.body.exportId).toBeDefined();

      expect(createResponse.body.status).toBe(ExportStatus.QUEUED);

      const exportId = createResponse.body.exportId;

      const completed = await waitForExportStatus(
        app,
        auth.accessToken,
        workspaceId,
        exportId,
        ExportStatus.COMPLETED,
      );

      expect(completed.status).toBe(ExportStatus.COMPLETED);

      expect(completed.fileName).toMatch(/\.json$/);

      expect(completed.downloadUrl).toEqual(
        expect.stringContaining(
          `/api/v1/workspaces/${workspaceId}/exports/${exportId}/download?token=`,
        ),
      );

      expect(completed.expiresAt).toBeDefined();

      const filePath = completed.fileName
        ? join(process.cwd(), 'exports', completed.fileName)
        : undefined;

      expect(filePath).toBeDefined();

      await fs.access(filePath!, constants.R_OK);

      const contents = await fs.readFile(filePath!, 'utf-8');

      const tasks = JSON.parse(contents);

      expect(Array.isArray(tasks)).toBe(true);

      expect(tasks.some((task: any) => task.title === 'JSON Export Task')).toBe(
        true,
      );
    }, 60000);
  });

  /**
   * =========================================================================
   * 2. CSV export
   * =========================================================================
   */

  describe('CSV export', () => {
    it('should asynchronously generate a CSV export', async () => {
      const auth = await registerAndLogin(app);

      const workspaceId = await createWorkspace(app, auth.accessToken);

      await createTask(app, auth.accessToken, workspaceId, {
        title: 'CSV Export Task',
        description: 'CSV description with, comma',
        priority: 'low',
      });

      const response = await requestExport(
        app,
        auth.accessToken,
        workspaceId,
        'csv',
      );

      expect(response.status).toBe(201);

      const exportId = response.body.exportId;

      const completed = await waitForExportStatus(
        app,
        auth.accessToken,
        workspaceId,
        exportId,
        ExportStatus.COMPLETED,
      );

      expect(completed.fileName).toMatch(/\.csv$/);

      const filePath = join(process.cwd(), 'exports', completed.fileName);

      await fs.access(filePath, constants.R_OK);

      const csv = await fs.readFile(filePath, 'utf-8');

      expect(csv).toContain(
        'id,title,description,status,priority,workspace,owner,dueDate,createdAt,updatedAt',
      );

      expect(csv).toContain('CSV Export Task');

      expect(csv).toContain('"CSV description with, comma"');
    }, 60000);
  });

  /**
   * =========================================================================
   * 3. XLSX export
   * =========================================================================
   */

  describe('XLSX export', () => {
    it('should asynchronously generate a valid XLSX export', async () => {
      const auth = await registerAndLogin(app);

      const workspaceId = await createWorkspace(app, auth.accessToken);

      await createTask(app, auth.accessToken, workspaceId, {
        title: 'XLSX Export Task',
        description: 'XLSX export description',
        priority: 'high',
      });

      const response = await requestExport(
        app,
        auth.accessToken,
        workspaceId,
        'xlsx',
      );

      expect(response.status).toBe(201);

      const exportId = response.body.exportId;

      const completed = await waitForExportStatus(
        app,
        auth.accessToken,
        workspaceId,
        exportId,
        ExportStatus.COMPLETED,
      );

      expect(completed.fileName).toMatch(/\.xlsx$/);

      const filePath = join(process.cwd(), 'exports', completed.fileName);

      await fs.access(filePath, constants.R_OK);

      const workbook = XLSX.readFile(filePath);

      expect(workbook.SheetNames).toContain('Tasks');

      const worksheet = workbook.Sheets['Tasks'];

      const rows = XLSX.utils.sheet_to_json<any>(worksheet);

      expect(rows.some((row) => row.title === 'XLSX Export Task')).toBe(true);
    }, 60000);
  });

  /**
   * =========================================================================
   * 4. Export status + signed download URL
   * =========================================================================
   */

  describe('Export status', () => {
    it('should return completed export metadata and a signed download URL', async () => {
      const auth = await registerAndLogin(app);

      const workspaceId = await createWorkspace(app, auth.accessToken);

      await createTask(app, auth.accessToken, workspaceId);

      const response = await requestExport(
        app,
        auth.accessToken,
        workspaceId,
        'json',
      );

      expect(response.status).toBe(201);

      const exportId = response.body.exportId;

      const completed = await waitForExportStatus(
        app,
        auth.accessToken,
        workspaceId,
        exportId,
        ExportStatus.COMPLETED,
      );

      const statusResponse = await getExport(
        app,
        auth.accessToken,
        workspaceId,
        exportId,
      );

      expect(statusResponse.status).toBe(200);

      expect(statusResponse.body.exportId).toBe(exportId);

      expect(statusResponse.body.workspaceId).toBe(workspaceId);

      expect(statusResponse.body.status).toBe(ExportStatus.COMPLETED);

      expect(statusResponse.body.format).toBe('json');

      expect(statusResponse.body.fileName).toBe(completed.fileName);

      expect(statusResponse.body.downloadUrl).toEqual(
        expect.stringContaining('/download?token='),
      );

      const token = new URL(
        `http://localhost${statusResponse.body.downloadUrl}`,
      ).searchParams.get('token');

      expect(token).toBeTruthy();

      expect(token!.split('.')).toHaveLength(2);
    }, 60000);
  });

  /**
   * =========================================================================
   * 5. Download completed export
   * =========================================================================
   */

  describe('Export download', () => {
    it('should download a completed export using the signed token', async () => {
      const auth = await registerAndLogin(app);

      const workspaceId = await createWorkspace(app, auth.accessToken);

      await createTask(app, auth.accessToken, workspaceId, {
        title: 'Downloadable Export Task',
      });

      const response = await requestExport(
        app,
        auth.accessToken,
        workspaceId,
        'json',
      );

      expect(response.status).toBe(201);

      const exportId = response.body.exportId;

      const completed = await waitForExportStatus(
        app,
        auth.accessToken,
        workspaceId,
        exportId,
        ExportStatus.COMPLETED,
      );

      const token = new URL(
        `http://localhost${completed.downloadUrl}`,
      ).searchParams.get('token');

      expect(token).toBeTruthy();

      const downloadResponse = await withIp(
        request(app.getHttpServer())
          .get(`/api/v1/workspaces/${workspaceId}/exports/${exportId}/download`)
          .query({
            token,
          })
          .set('Authorization', `Bearer ${auth.accessToken}`),
      ).expect(200);

      expect(downloadResponse.headers['content-disposition']).toContain(
        completed.fileName,
      );

      expect(downloadResponse.headers['content-type']).toContain(
        'application/json',
      );

      expect(downloadResponse.body).toBeDefined();
    }, 60000);
  });

  /**
   * =========================================================================
   * 6. Invalid / tampered download token
   * =========================================================================
   */

  describe('Download token security', () => {
    it('should reject a tampered download token', async () => {
      const auth = await registerAndLogin(app);

      const workspaceId = await createWorkspace(app, auth.accessToken);

      await createTask(app, auth.accessToken, workspaceId);

      const response = await requestExport(
        app,
        auth.accessToken,
        workspaceId,
        'json',
      );

      const exportId = response.body.exportId;

      const completed = await waitForExportStatus(
        app,
        auth.accessToken,
        workspaceId,
        exportId,
        ExportStatus.COMPLETED,
      );

      const token = new URL(
        `http://localhost${completed.downloadUrl}`,
      ).searchParams.get('token');

      expect(token).toBeTruthy();

      const parts = token!.split('.');

      const tamperedToken = `${parts[0]}.${parts[1]}tampered`;

      const downloadResponse = await withIp(
        request(app.getHttpServer())
          .get(`/api/v1/workspaces/${workspaceId}/exports/${exportId}/download`)
          .query({
            token: tamperedToken,
          })
          .set('Authorization', `Bearer ${auth.accessToken}`),
      );

      expect(downloadResponse.status).toBe(401);

      expect(downloadResponse.body.statusCode).toBe(401);
    }, 60000);
  });

  /**
   * =========================================================================
   * 7. Token cannot be used by another user
   * =========================================================================
   */

  describe('User isolation', () => {
    it('should reject a valid download token when another user tries to use it', async () => {
      const owner = await registerAndLogin(app);

      const workspaceId = await createWorkspace(app, owner.accessToken);

      await createTask(app, owner.accessToken, workspaceId);

      const response = await requestExport(
        app,
        owner.accessToken,
        workspaceId,
        'json',
      );

      const exportId = response.body.exportId;

      const completed = await waitForExportStatus(
        app,
        owner.accessToken,
        workspaceId,
        exportId,
        ExportStatus.COMPLETED,
      );

      const token = new URL(
        `http://localhost${completed.downloadUrl}`,
      ).searchParams.get('token');

      expect(token).toBeTruthy();

      const otherUser = await registerAndLogin(app);

      const downloadResponse = await withIp(
        request(app.getHttpServer())
          .get(`/api/v1/workspaces/${workspaceId}/exports/${exportId}/download`)
          .query({
            token,
          })
          .set('Authorization', `Bearer ${otherUser.accessToken}`),
      );

      expect(downloadResponse.status).toBe(403);
    }, 60000);
  });

  /**
   * =========================================================================
   * 8. Workspace isolation
   * =========================================================================
   */

  describe('Workspace isolation', () => {
    it('should reject access to an export from another workspace', async () => {
      const auth = await registerAndLogin(app);

      const workspaceA = await createWorkspace(app, auth.accessToken);

      const workspaceB = await createWorkspace(app, auth.accessToken);

      await createTask(app, auth.accessToken, workspaceA);

      const response = await requestExport(
        app,
        auth.accessToken,
        workspaceA,
        'json',
      );

      expect(response.status).toBe(201);

      const exportId = response.body.exportId;

      await waitForExportStatus(
        app,
        auth.accessToken,
        workspaceA,
        exportId,
        ExportStatus.COMPLETED,
      );

      const statusResponse = await getExport(
        app,
        auth.accessToken,
        workspaceB,
        exportId,
      );

      expect(statusResponse.status).toBe(403);
    }, 60000);
  });

  /**
   * =========================================================================
   * 9. Feature flag
   * =========================================================================
   */

  describe('Export feature flag', () => {
    it('should reject export creation when exports are disabled for the workspace', async () => {
      const auth = await registerAndLogin(app);

      const workspaceId = await createWorkspace(app, auth.accessToken);

      /**
       * Feature flag manipulation is intentionally done through the
       * application API rather than directly changing MongoDB.
       *
       * If the workspace implementation exposes a different feature-flag
       * endpoint in your current controller, this is the only setup call
       * that may need to be adjusted.
       */
      const disableResponse = await withIp(
        request(app.getHttpServer())
          .patch(`/api/v1/workspaces/${workspaceId}/feature-flags`)
          .set('Authorization', `Bearer ${auth.accessToken}`)
          .send({
            exports: false,
          }),
      );

      /**
       * The feature-flag endpoint may return 200 or 204 depending on the
       * current WorkspaceController implementation.
       */
      expect([200, 204].includes(disableResponse.status)).toBe(true);

      const exportResponse = await requestExport(
        app,
        auth.accessToken,
        workspaceId,
        'json',
      );

      expect(exportResponse.status).toBe(403);

      expect(
        exportResponse.body.detail ?? exportResponse.body.message,
      ).toContain('exports');
    }, 60000);
  });

  /**
   * =========================================================================
   * 10. Export repository state
   * =========================================================================
   */

  describe('Persistence and asynchronous state', () => {
    it('should persist the export through QUEUED, PROCESSING and COMPLETED states', async () => {
      const auth = await registerAndLogin(app);

      const workspaceId = await createWorkspace(app, auth.accessToken);

      await createTask(app, auth.accessToken, workspaceId);

      const response = await requestExport(
        app,
        auth.accessToken,
        workspaceId,
        'json',
      );

      expect(response.status).toBe(201);

      const exportId = response.body.exportId;

      expect(response.body.status).toBe(ExportStatus.QUEUED);

      const collection = mongoConnection.collection('exports');

      await waitFor(async () => {
        const record = await collection.findOne({
          _id: new Types.ObjectId(exportId),
        });

        return (
          record?.status === ExportStatus.PROCESSING ||
          record?.status === ExportStatus.COMPLETED
        );
      }, 30000);

      await waitFor(async () => {
        const record = await collection.findOne({
          _id: new Types.ObjectId(exportId),
        });

        return record?.status === ExportStatus.COMPLETED;
      }, 45000);

      const record = await collection.findOne({
        _id: new Types.ObjectId(exportId),
      });

      expect(record).toBeDefined();

      expect(record?.status).toBe(ExportStatus.COMPLETED);

      expect(record?.filePath).toBeDefined();
      expect(record?.fileName).toBeDefined();
      expect(record?.expiresAt).toBeDefined();
      expect(record?.error).toBeUndefined();
    }, 60000);
  });
});
