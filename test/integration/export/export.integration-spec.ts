import request from 'supertest';
import { Types } from 'mongoose';
import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { readFile, unlink, access } from 'fs/promises';
import { constants } from 'fs';
import { Connection } from 'mongoose';
import { writeFile } from 'fs/promises';
import { createIntegrationApp } from '../setup/test-app.factory';
import { ExportService } from 'src/export/application/export.service';
import { ExportDownloadTokenService } from 'src/export/application/export-download-token.service';
import { shutdownIntegrationApp } from '../helpers/shutdown-helper';
import { clearRedis } from '../setup/redis';

import {
  Export,
  ExportDocument,
} from 'src/export/infrastructure/database/schemas/export.schema';

import { ExportStatus } from 'src/export/domain/enums/export-status.enum';
jest.setTimeout(30000);
describe('Export Module (integration)', () => {
  let app: INestApplication;
  let connection: Connection;
  let exportModel: Model<ExportDocument>;

  let authToken: string;
  let secondUserToken: string;

  let userId: string;
  let secondUserId: string;

  let workspaceId: string;
  let secondWorkspaceId: string;

  const createdFiles: string[] = [];

  const unique = () =>
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  // =========================================================================
  // SETUP
  // =========================================================================

  beforeAll(async () => {
    process.env.EXPORT_DOWNLOAD_SECRET =
      process.env.EXPORT_DOWNLOAD_SECRET ??
      'integration-test-export-download-secret';

    app = await createIntegrationApp();

    exportModel = app.get<Model<ExportDocument>>(getModelToken(Export.name));

    connection = exportModel.db;

    /*
     * Authentication/workspace setup is intentionally done through
     * the public API, just like our other integration suites.
     */

    const email = `export-${unique()}@example.com`;
    const password = 'Password123!';

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', `10.20.0.${Math.floor(Math.random() * 200)}`)
      .set('Idempotency-Key', `export-register-${unique()}`)
      .send({
        email,
        password,
      });

    expect([200, 201]).toContain(registerResponse.status);

    /*
     * The existing Auth integration flow is responsible for verification.
     * For this suite we retrieve the user directly so that this suite
     * remains focused on Export behavior.
     */

    const userModel = app.get<Model<any>>(getModelToken('User'));

    const user = await userModel.findOne({ email }).exec();

    expect(user).toBeDefined();

    user.emailVerified = true;

    await user.save();

    userId = user._id.toString();

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', `10.20.1.${Math.floor(Math.random() * 200)}`)
      .send({
        email,
        password,
      });

    expect(loginResponse.status).toBe(201);

    authToken =
      loginResponse.body.accessToken ?? loginResponse.body.access_token;

    expect(authToken).toBeDefined();

    /*
     * Second user.
     */

    const secondEmail = `export-second-${unique()}@example.com`;

    const secondRegisterResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', `10.21.0.${Math.floor(Math.random() * 200)}`)
      .set('Idempotency-Key', `export-register-${unique()}`)
      .send({
        email: secondEmail,
        password,
      });

    expect([200, 201]).toContain(secondRegisterResponse.status);

    const secondUser = await userModel.findOne({ email: secondEmail }).exec();

    expect(secondUser).toBeDefined();

    secondUser.emailVerified = true;

    await secondUser.save();

    secondUserId = secondUser._id.toString();

    const secondLoginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', `10.22.0.${Math.floor(Math.random() * 200)}`)
      .send({
        email: secondEmail,
        password,
      });

    expect([200, 201]).toContain(secondLoginResponse.status);

    secondUserToken =
      secondLoginResponse.body.accessToken ??
      secondLoginResponse.body.access_token;

    expect(secondUserToken).toBeDefined();

    /*
     * Workspace creation.
     */

    const workspaceSuffix = unique();

    const workspaceResponse = await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${authToken}`)
      .set('X-Forwarded-For', '10.23.0.10')
      .set('Idempotency-Key', `export-workspace-${unique()}`)
      .send({
        name: `Export Workspace ${workspaceSuffix}`,
        slug: `export-workspace-${workspaceSuffix}`,
      });

    expect([200, 201]).toContain(workspaceResponse.status);

    workspaceId =
      workspaceResponse.body.workspaceId ??
      workspaceResponse.body.id ??
      workspaceResponse.body._id;

    expect(workspaceId).toBeDefined();

    /*
     * Second workspace.
     */

    const secondWorkspaceResponse = await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${secondUserToken}`)
      .set('X-Forwarded-For', '10.24.0.10')
      .set('Idempotency-Key', `export-workspace-${unique()}`)
      .send({
        name: `Second Export Workspace ${workspaceSuffix}`,
        slug: `second-export-workspace-${workspaceSuffix}`,
      });

    expect([200, 201]).toContain(secondWorkspaceResponse.status);

    secondWorkspaceId =
      secondWorkspaceResponse.body.workspaceId ??
      secondWorkspaceResponse.body.id ??
      secondWorkspaceResponse.body._id;

    expect(secondWorkspaceId).toBeDefined();
  });

  beforeEach(async () => {
    await clearRedis();
  });

  afterEach(async () => {
    for (const filePath of createdFiles.splice(0)) {
      try {
        await unlink(filePath);
      } catch {
        // File may already have been removed.
      }
    }

    await exportModel.deleteMany({});
  });

  afterAll(async () => {
    for (const filePath of createdFiles.splice(0)) {
      try {
        await unlink(filePath);
      } catch {
        // Ignore cleanup errors.
      }
    }

    await shutdownIntegrationApp(app, connection);
  }, 30000);

  // =========================================================================
  // EXPORT REQUEST
  // =========================================================================

  describe('Export request', () => {
    it('creates a JSON export request', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/exports`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '10.30.0.10')
        .set('Idempotency-Key', `export-json-${unique()}`)
        .send({
          format: 'json',
        });

      expect(response.status).toBe(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          message: 'Export requested successfully',
          exportId: expect.any(String),
          exportEventId: expect.any(String),
          status: ExportStatus.QUEUED,
        }),
      );

      const exportRecord = await exportModel
        .findById(response.body.exportId)
        .lean()
        .exec();

      expect(exportRecord).toBeDefined();

      expect(exportRecord?.workspaceId).toBe(workspaceId);

      expect(exportRecord?.userId).toBe(userId);

      expect(exportRecord?.format).toBe('json');

      expect(exportRecord?.status).toBe(ExportStatus.QUEUED);

      expect(exportRecord?.outboxEventId).toBe(response.body.exportEventId);
    });

    it('creates a CSV export request', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/exports`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '10.30.0.11')
        .set('Idempotency-Key', `export-csv-${unique()}`)
        .send({
          format: 'csv',
        });

      expect(response.status).toBe(201);

      const exportRecord = await exportModel
        .findById(response.body.exportId)
        .lean()
        .exec();

      expect(exportRecord?.format).toBe('csv');

      expect(exportRecord?.status).toBe(ExportStatus.QUEUED);
    });

    it('creates an XLSX export request', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/exports`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '10.30.0.12')
        .set('Idempotency-Key', `export-xlsx-${unique()}`)
        .send({
          format: 'xlsx',
        });

      expect(response.status).toBe(201);

      const exportRecord = await exportModel
        .findById(response.body.exportId)
        .lean()
        .exec();

      expect(exportRecord?.format).toBe('xlsx');

      expect(exportRecord?.status).toBe(ExportStatus.QUEUED);
    });

    it('rejects an unsupported export format', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/exports`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '10.30.0.13')
        .set('Idempotency-Key', `export-invalid-${unique()}`)
        .send({
          format: 'pdf',
        });

      expect(response.status).toBe(400);
    });

    it('requires authentication', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/exports`)
        .set('X-Forwarded-For', '10.30.0.14')
        .set('Idempotency-Key', `export-no-auth-${unique()}`)
        .send({
          format: 'json',
        });

      expect(response.status).toBe(401);
    });

    it('rejects a missing format', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/exports`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '10.30.0.15')
        .set('Idempotency-Key', `export-no-format-${unique()}`)
        .send({});

      expect(response.status).toBe(400);
    });

    it('creates an EXPORT_REQUESTED outbox event', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/exports`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '10.30.0.16')
        .set('Idempotency-Key', `export-outbox-${unique()}`)
        .send({
          format: 'json',
        });

      expect(response.status).toBe(201);

      const outboxModel = app.get<Model<any>>(getModelToken('OutboxEvent'));

      const outboxEvent = await outboxModel
        .findOne({
          _id: response.body.exportEventId,
        })
        .lean()
        .exec();

      expect(outboxEvent).toBeDefined();

      expect(outboxEvent?.eventType).toBe('EXPORT_REQUESTED');

      expect(outboxEvent?.aggregateType).toBe('WORKSPACE');

      expect(outboxEvent?.aggregateId?.toString()).toBe(workspaceId.toString());

      expect(outboxEvent?.workspaceId?.toString()).toBe(workspaceId.toString());

      expect(outboxEvent?.payload).toEqual(
        expect.objectContaining({
          exportId: response.body.exportId,
          outboxEventId: response.body.exportEventId,
          workspaceId,
          userId,
          format: 'json',
        }),
      );
    });

    it('returns the same result for a repeated Idempotency-Key', async () => {
      const idempotencyKey = `export-idempotency-${unique()}`;

      const firstResponse = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/exports`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '10.30.0.17')
        .set('Idempotency-Key', idempotencyKey)
        .send({
          format: 'json',
        });

      expect(firstResponse.status).toBe(201);

      const secondResponse = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/exports`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '10.30.0.18')
        .set('Idempotency-Key', idempotencyKey)
        .send({
          format: 'json',
        });

      expect(secondResponse.status).toBe(firstResponse.status);

      expect(secondResponse.body.exportId).toBe(firstResponse.body.exportId);
    });
  });

  // =========================================================================
  // EXPORT STATUS
  // =========================================================================

  describe('Export status', () => {
    it('returns a queued export', async () => {
      const createResponse = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/exports`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '10.31.0.10')
        .set('Idempotency-Key', `export-status-${unique()}`)
        .send({
          format: 'json',
        });

      expect(createResponse.status).toBe(201);

      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/workspaces/${workspaceId}/exports/${createResponse.body.exportId}`,
        )
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '10.31.0.11');

      expect(response.status).toBe(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          exportId: createResponse.body.exportId,
          workspaceId,
          format: 'json',
          status: ExportStatus.QUEUED,
          fileName: null,
          downloadUrl: null,
          error: null,
        }),
      );
    });

    it('returns a completed export with a download URL', async () => {
      const exportId = new Types.ObjectId();
      const outboxEventId = unique();

      const filePath = `${process.cwd()}/exports/integration-${exportId.toString()}.json`;

      await exportModel.create({
        _id: exportId,
        outboxEventId,
        workspaceId,
        userId,
        format: 'json',
        status: ExportStatus.COMPLETED,
        filePath,
        fileName: `integration-${exportId.toString()}.json`,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      createdFiles.push(filePath);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/workspaces/${workspaceId}/exports/${exportId.toString()}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '10.31.0.12');

      expect(response.status).toBe(200);

      expect(response.body.status).toBe(ExportStatus.COMPLETED);

      expect(response.body.downloadUrl).toEqual(
        expect.stringContaining(
          `/api/v1/workspaces/${workspaceId}/exports/${exportId.toString()}/download?token=`,
        ),
      );
    });

    it('returns 404 for a nonexistent export', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/workspaces/${workspaceId}/exports/${unique()}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '10.31.0.13');

      expect(response.status).toBe(404);
    });

    it('prevents a user from accessing another user export', async () => {
      const exportId = new Types.ObjectId();

      await exportModel.create({
        _id: exportId,
        outboxEventId: unique(),
        workspaceId,
        userId,
        format: 'json',
        status: ExportStatus.QUEUED,
      });

      const response = await request(app.getHttpServer())
        .get(`/api/v1/workspaces/${workspaceId}/exports/${exportId.toString()}`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .set('X-Forwarded-For', '10.31.0.14');

      expect(response.status).toBe(403);
    });

    it('prevents access from another workspace', async () => {
      const exportId = new Types.ObjectId();

      await exportModel.create({
        _id: exportId,
        outboxEventId: unique(),
        workspaceId,
        userId,
        format: 'json',
        status: ExportStatus.QUEUED,
      });

      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/workspaces/${secondWorkspaceId}/exports/${exportId.toString()}`,
        )
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '10.31.0.15');

      expect([403, 404]).toContain(response.status);
    });
  });

  // =========================================================================
  // EXPORT GENERATION
  // =========================================================================

  describe('Export generation', () => {
    async function createExportRecord(format: 'json' | 'csv' | 'xlsx') {
      const exportId = new Types.ObjectId();
      const outboxEventId = unique();

      await exportModel.create({
        _id: exportId,
        outboxEventId,
        workspaceId,
        userId,
        format,
        status: ExportStatus.QUEUED,
      });

      return {
        exportId,
        outboxEventId,
      };
    }

    it('generates a JSON export successfully', async () => {
      const record = await createExportRecord('json');

      const exportService = app.get(ExportService);

      await exportService.generateExport({
        workspaceId,
        userId,
        format: 'json',
        outboxEventId: record.outboxEventId,
      });

      const updated = await exportModel.findById(record.exportId).lean().exec();

      expect(updated?.status).toBe(ExportStatus.COMPLETED);

      expect(updated?.filePath).toBeDefined();

      expect(updated?.fileName).toMatch(/\.json$/);

      expect(updated?.expiresAt).toBeInstanceOf(Date);

      createdFiles.push(updated!.filePath!);

      await access(updated!.filePath!, constants.R_OK);

      const contents = await readFile(updated!.filePath!, 'utf8');

      expect(() => JSON.parse(contents)).not.toThrow();
    });

    it('generates a CSV export successfully', async () => {
      const record = await createExportRecord('csv');

      const exportService = app.get(ExportService);

      await exportService.generateExport({
        workspaceId,
        userId,
        format: 'csv',
        outboxEventId: record.outboxEventId,
      });

      const updated = await exportModel.findById(record.exportId).lean().exec();

      expect(updated?.status).toBe(ExportStatus.COMPLETED);

      expect(updated?.filePath).toMatch(/\.csv$/);

      createdFiles.push(updated!.filePath!);

      const contents = await readFile(updated!.filePath!, 'utf8');

      expect(contents).toContain('id,title,description,status,priority');
    });

    it('generates an XLSX export successfully', async () => {
      const record = await createExportRecord('xlsx');

      const exportService = app.get(ExportService);

      await exportService.generateExport({
        workspaceId,
        userId,
        format: 'xlsx',
        outboxEventId: record.outboxEventId,
      });

      const updated = await exportModel.findById(record.exportId).lean().exec();

      expect(updated?.status).toBe(ExportStatus.COMPLETED);

      expect(updated?.filePath).toMatch(/\.xlsx$/);

      createdFiles.push(updated!.filePath!);

      await access(updated!.filePath!, constants.R_OK);

      const contents = await readFile(updated!.filePath!);

      expect(contents.length).toBeGreaterThan(0);
    });

    it('throws when the export record does not exist', async () => {
      const exportService = app.get(ExportService);

      await expect(
        exportService.generateExport({
          workspaceId,
          userId,
          format: 'json',
          outboxEventId: unique(),
        }),
      ).rejects.toThrow(/Export record not found/);
    });
  });

  // =========================================================================
  // DOWNLOAD TOKEN
  // =========================================================================

  describe('Export download token', () => {
    it('generates and verifies a valid token', () => {
      const tokenService = app.get(ExportDownloadTokenService);

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      const token = tokenService.generateToken({
        exportId: 'export-123',
        userId,
        expiresAt,
      });

      expect(token).toContain('.');

      const payload = tokenService.verifyToken(token);

      expect(payload.exportId).toBe('export-123');

      expect(payload.userId).toBe(userId);

      expect(payload.expiresAt).toBe(expiresAt.getTime());
    });

    it('rejects a malformed token', () => {
      const tokenService = app.get(ExportDownloadTokenService);

      expect(() => tokenService.verifyToken('invalid-token')).toThrow(
        'Invalid download token',
      );
    });

    it('rejects a tampered token', () => {
      const tokenService = app.get(ExportDownloadTokenService);

      const token = tokenService.generateToken({
        exportId: 'export-123',
        userId,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const [payload] = token.split('.');

      expect(() =>
        tokenService.verifyToken(`${payload}.tampered-signature`),
      ).toThrow('Invalid download token');
    });

    it('rejects an expired token', () => {
      const tokenService = app.get(ExportDownloadTokenService);

      const token = tokenService.generateToken({
        exportId: 'export-123',
        userId,
        expiresAt: new Date(Date.now() - 1000),
      });

      expect(() => tokenService.verifyToken(token)).toThrow(
        'Download token has expired',
      );
    });
  });

  // =========================================================================
  // EXPORT DOWNLOAD
  // =========================================================================

  describe('Export download', () => {
    async function createCompletedExport() {
      const exportId = new Types.ObjectId();
      const outboxEventId = unique();

      const fileName = `download-${exportId.toString()}.json`;

      const filePath = `${process.cwd()}/exports/${fileName}`;

      await exportModel.create({
        _id: exportId,
        outboxEventId,
        workspaceId,
        userId,
        format: 'json',
        status: ExportStatus.COMPLETED,
        filePath,
        fileName,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      /*
       * The controller uses res.download(), so the actual file
       * must exist for the HTTP integration test.
       */

      await writeFile(
        filePath,
        JSON.stringify([
          {
            id: 'task-1',
            title: 'Integration task',
          },
        ]),
        'utf8',
      );

      createdFiles.push(filePath);

      return {
        exportId,
        filePath,
        fileName,
      };
    }

    it('downloads a completed export with a valid token', async () => {
      const record = await createCompletedExport();

      const tokenService = app.get(ExportDownloadTokenService);

      const exportRecord = await exportModel.findById(record.exportId).exec();

      const token = tokenService.generateToken({
        exportId: record.exportId.toString(),
        userId,
        expiresAt: exportRecord!.expiresAt!,
      });

      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/workspaces/${workspaceId}/exports/${record.exportId.toString()}/download`,
        )
        .query({ token })
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '10.32.0.10');

      expect(response.status).toBe(200);

      expect(response.headers['content-disposition']).toContain(
        record.fileName,
      );
    });

    it('rejects an invalid download token', async () => {
      const record = await createCompletedExport();

      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/workspaces/${workspaceId}/exports/${record.exportId.toString()}/download`,
        )
        .query({
          token: 'invalid-token',
        })
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '10.32.0.11');

      expect(response.status).toBe(401);
    });

    it('rejects a token belonging to another user', async () => {
      const record = await createCompletedExport();

      const tokenService = app.get(ExportDownloadTokenService);

      const exportRecord = await exportModel.findById(record.exportId).exec();

      const token = tokenService.generateToken({
        exportId: record.exportId.toString(),
        userId: secondUserId,
        expiresAt: exportRecord!.expiresAt!,
      });

      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/workspaces/${workspaceId}/exports/${record.exportId.toString()}/download`,
        )
        .query({ token })
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '10.32.0.12');

      expect([401, 403]).toContain(response.status);
    });

    it('rejects a download when the export is not completed', async () => {
      const exportId = new Types.ObjectId();

      await exportModel.create({
        _id: exportId,
        outboxEventId: unique(),
        workspaceId,
        userId,
        format: 'json',
        status: ExportStatus.PROCESSING,
      });

      const tokenService = app.get(ExportDownloadTokenService);

      const token = tokenService.generateToken({
        exportId: exportId.toString(),
        userId,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/workspaces/${workspaceId}/exports/${exportId.toString()}/download`,
        )
        .query({ token })
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '10.32.0.13');

      expect(response.status).toBe(400);
    });

    it('rejects a download when the export file is missing', async () => {
      const exportId = new Types.ObjectId();

      await exportModel.create({
        _id: exportId,
        outboxEventId: unique(),
        workspaceId,
        userId,
        format: 'json',
        status: ExportStatus.COMPLETED,
        filePath: `${process.cwd()}/exports/does-not-exist-${unique()}.json`,
        fileName: 'missing.json',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const tokenService = app.get(ExportDownloadTokenService);

      const token = tokenService.generateToken({
        exportId: exportId.toString(),
        userId,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/workspaces/${workspaceId}/exports/${exportId.toString()}/download`,
        )
        .query({ token })
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '10.32.0.14');

      expect(response.status).toBe(404);
    });

    it('rejects an expired export download', async () => {
      const exportId = new Types.ObjectId();

      const filePath = `${process.cwd()}/exports/expired-${unique()}.json`;

      await writeFile(filePath, '{}', 'utf8');

      createdFiles.push(filePath);

      const expiresAt = new Date(Date.now() - 1000);

      await exportModel.create({
        _id: exportId,
        outboxEventId: unique(),
        workspaceId,
        userId,
        format: 'json',
        status: ExportStatus.COMPLETED,
        filePath,
        fileName: 'expired.json',
        expiresAt,
      });

      const tokenService = app.get(ExportDownloadTokenService);

      const token = tokenService.generateToken({
        exportId: exportId.toString(),
        userId,
        expiresAt,
      });

      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/workspaces/${workspaceId}/exports/${exportId.toString()}/download`,
        )
        .query({ token })
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '10.32.0.15');

      expect(response.status).toBe(401);
    });

    it('rejects access from another workspace', async () => {
      const record = await createCompletedExport();

      const tokenService = app.get(ExportDownloadTokenService);

      const exportRecord = await exportModel.findById(record.exportId).exec();

      const token = tokenService.generateToken({
        exportId: record.exportId.toString(),
        userId,
        expiresAt: exportRecord!.expiresAt!,
      });

      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/workspaces/${secondWorkspaceId}/exports/${record.exportId.toString()}/download`,
        )
        .query({ token })
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '10.32.0.16');

      expect([403, 404]).toContain(response.status);
    });
  });

  // =========================================================================
  // EXPORT REPOSITORY
  // =========================================================================

  describe('ExportRepository persistence', () => {
    it('persists and retrieves an export by ID', async () => {
      const exportId = new Types.ObjectId();

      await exportModel.create({
        _id: exportId,
        outboxEventId: unique(),
        workspaceId,
        userId,
        format: 'json',
        status: ExportStatus.QUEUED,
      });

      const record = await exportModel.findById(exportId).lean().exec();

      expect(record).toBeDefined();

      expect(record?.workspaceId).toBe(workspaceId);

      expect(record?.userId).toBe(userId);

      expect(record?.format).toBe('json');

      expect(record?.status).toBe(ExportStatus.QUEUED);
    });

    it('persists and retrieves an export by outbox event ID', async () => {
      const outboxEventId = unique();

      await exportModel.create({
        _id: new Types.ObjectId(),
        outboxEventId,
        workspaceId,
        userId,
        format: 'csv',
        status: ExportStatus.QUEUED,
      });

      const record = await exportModel
        .findOne({
          outboxEventId,
        })
        .lean()
        .exec();

      expect(record).toBeDefined();

      expect(record?.outboxEventId).toBe(outboxEventId);
    });

    it('updates export status and file metadata', async () => {
      const exportId = new Types.ObjectId();

      await exportModel.create({
        _id: exportId,
        outboxEventId: unique(),
        workspaceId,
        userId,
        format: 'xlsx',
        status: ExportStatus.QUEUED,
      });

      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      const updated = await exportModel
        .findByIdAndUpdate(
          exportId,
          {
            $set: {
              status: ExportStatus.COMPLETED,
              filePath: '/exports/test.xlsx',
              fileName: 'test.xlsx',
              expiresAt,
            },
          },
          { new: true },
        )
        .lean()
        .exec();

      expect(updated?.status).toBe(ExportStatus.COMPLETED);

      expect(updated?.filePath).toBe('/exports/test.xlsx');

      expect(updated?.fileName).toBe('test.xlsx');

      expect(updated?.expiresAt).toEqual(expiresAt);
    });
  });
});
