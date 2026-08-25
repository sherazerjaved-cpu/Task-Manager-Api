import { createHmac } from 'crypto';
import { ExportDownloadTokenService } from './export-download-token.service';

describe('ExportDownloadTokenService', () => {
  const originalSecret = process.env.EXPORT_DOWNLOAD_SECRET;

  beforeEach(() => {
    process.env.EXPORT_DOWNLOAD_SECRET =
      'test-export-download-secret-which-is-long-enough';
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.EXPORT_DOWNLOAD_SECRET;
    } else {
      process.env.EXPORT_DOWNLOAD_SECRET = originalSecret;
    }

    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should throw when EXPORT_DOWNLOAD_SECRET is not configured', () => {
      delete process.env.EXPORT_DOWNLOAD_SECRET;

      expect(() => new ExportDownloadTokenService()).toThrow(
        'EXPORT_DOWNLOAD_SECRET is not configured',
      );
    });

    it('should create the service when EXPORT_DOWNLOAD_SECRET is configured', () => {
      expect(() => new ExportDownloadTokenService()).not.toThrow();
    });
  });

  describe('generateToken', () => {
    it('should generate a token containing payload and signature', () => {
      const service = new ExportDownloadTokenService();

      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      const token = service.generateToken({
        exportId: 'export-123',
        userId: 'user-123',
        expiresAt,
      });

      expect(token).toEqual(expect.any(String));

      const parts = token.split('.');

      expect(parts).toHaveLength(2);
      expect(parts[0]).toBeTruthy();
      expect(parts[1]).toBeTruthy();
    });

    it('should generate a token that can be successfully verified', () => {
      const service = new ExportDownloadTokenService();

      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      const token = service.generateToken({
        exportId: 'export-123',
        userId: 'user-123',
        expiresAt,
      });

      const payload = service.verifyToken(token);

      expect(payload).toEqual({
        exportId: 'export-123',
        userId: 'user-123',
        expiresAt: expiresAt.getTime(),
      });
    });

    it('should encode the expiration date as a timestamp', () => {
      const service = new ExportDownloadTokenService();

      const expiresAt = new Date('2030-01-01T00:00:00.000Z');

      const token = service.generateToken({
        exportId: 'export-123',
        userId: 'user-123',
        expiresAt,
      });

      const [encodedPayload] = token.split('.');

      const decodedPayload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf-8'),
      );

      expect(decodedPayload).toEqual({
        exportId: 'export-123',
        userId: 'user-123',
        expiresAt: expiresAt.getTime(),
      });
    });

    it('should generate different tokens when the payload changes', () => {
      const service = new ExportDownloadTokenService();

      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      const token1 = service.generateToken({
        exportId: 'export-123',
        userId: 'user-123',
        expiresAt,
      });

      const token2 = service.generateToken({
        exportId: 'export-456',
        userId: 'user-123',
        expiresAt,
      });

      expect(token1).not.toBe(token2);
    });

    it('should generate the same token for the same payload and secret', () => {
      const service = new ExportDownloadTokenService();

      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      const data = {
        exportId: 'export-123',
        userId: 'user-123',
        expiresAt,
      };

      const token1 = service.generateToken(data);
      const token2 = service.generateToken(data);

      expect(token1).toBe(token2);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const service = new ExportDownloadTokenService();

      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      const token = service.generateToken({
        exportId: 'export-123',
        userId: 'user-123',
        expiresAt,
      });

      expect(service.verifyToken(token)).toEqual({
        exportId: 'export-123',
        userId: 'user-123',
        expiresAt: expiresAt.getTime(),
      });
    });

    it('should reject a token without a payload', () => {
      const service = new ExportDownloadTokenService();

      expect(() => service.verifyToken('')).toThrow('Invalid download token');
    });

    it('should reject a token without a signature', () => {
      const service = new ExportDownloadTokenService();

      expect(() => service.verifyToken('some-payload')).toThrow(
        'Invalid download token',
      );
    });

    it('should reject a token with an extra segment', () => {
      const service = new ExportDownloadTokenService();

      expect(() => service.verifyToken('payload.signature.extra')).toThrow(
        'Invalid download token',
      );
    });

    it('should reject a token with an invalid signature', () => {
      const service = new ExportDownloadTokenService();

      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      const token = service.generateToken({
        exportId: 'export-123',
        userId: 'user-123',
        expiresAt,
      });

      const [encodedPayload] = token.split('.');

      const tamperedToken = `${encodedPayload}.invalid-signature`;

      expect(() => service.verifyToken(tamperedToken)).toThrow(
        'Invalid download token',
      );
    });

    it('should reject a token when the payload is tampered with', () => {
      const service = new ExportDownloadTokenService();

      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      const token = service.generateToken({
        exportId: 'export-123',
        userId: 'user-123',
        expiresAt,
      });

      const [, signature] = token.split('.');

      const tamperedPayload = Buffer.from(
        JSON.stringify({
          exportId: 'different-export',
          userId: 'user-123',
          expiresAt: expiresAt.getTime(),
        }),
      ).toString('base64url');

      const tamperedToken = `${tamperedPayload}.${signature}`;

      expect(() => service.verifyToken(tamperedToken)).toThrow(
        'Invalid download token',
      );
    });

    it('should reject a token with invalid base64 JSON payload', () => {
      const service = new ExportDownloadTokenService();

      expect(() => service.verifyToken('not-valid-base64.abc')).toThrow(
        'Invalid download token',
      );
    });

    it('should reject a token with missing exportId', () => {
      const service = new ExportDownloadTokenService();

      const expiresAt = Date.now() + 15 * 60 * 1000;

      const payload = Buffer.from(
        JSON.stringify({
          userId: 'user-123',
          expiresAt,
        }),
      ).toString('base64url');

      const signature = createHmac(
        'sha256',
        process.env.EXPORT_DOWNLOAD_SECRET as string,
      )
        .update(payload)
        .digest('base64url');

      expect(() => service.verifyToken(`${payload}.${signature}`)).toThrow(
        'Invalid download token',
      );
    });

    it('should reject a token with missing userId', () => {
      const service = new ExportDownloadTokenService();

      const expiresAt = Date.now() + 15 * 60 * 1000;

      const payload = Buffer.from(
        JSON.stringify({
          exportId: 'export-123',
          expiresAt,
        }),
      ).toString('base64url');

      const signature = createHmac(
        'sha256',
        process.env.EXPORT_DOWNLOAD_SECRET as string,
      )
        .update(payload)
        .digest('base64url');

      expect(() => service.verifyToken(`${payload}.${signature}`)).toThrow(
        'Invalid download token',
      );
    });

    it('should reject a token with missing expiresAt', () => {
      const service = new ExportDownloadTokenService();

      const payload = Buffer.from(
        JSON.stringify({
          exportId: 'export-123',
          userId: 'user-123',
        }),
      ).toString('base64url');

      const signature = createHmac(
        'sha256',
        process.env.EXPORT_DOWNLOAD_SECRET as string,
      )
        .update(payload)
        .digest('base64url');

      expect(() => service.verifyToken(`${payload}.${signature}`)).toThrow(
        'Invalid download token',
      );
    });

    it('should reject an expired token', () => {
      const service = new ExportDownloadTokenService();

      const expiresAt = new Date(Date.now() - 1000);

      const token = service.generateToken({
        exportId: 'export-123',
        userId: 'user-123',
        expiresAt,
      });

      expect(() => service.verifyToken(token)).toThrow(
        'Download token has expired',
      );
    });

    it('should reject a token that expires exactly now', () => {
      const service = new ExportDownloadTokenService();

      const expiresAt = new Date(Date.now());

      const token = service.generateToken({
        exportId: 'export-123',
        userId: 'user-123',
        expiresAt,
      });

      expect(() => service.verifyToken(token)).toThrow(
        'Download token has expired',
      );
    });

    it('should accept a token that has not expired', () => {
      const service = new ExportDownloadTokenService();

      const expiresAt = new Date(Date.now() + 60 * 1000);

      const token = service.generateToken({
        exportId: 'export-123',
        userId: 'user-123',
        expiresAt,
      });

      expect(() => service.verifyToken(token)).not.toThrow();
    });

    it('should reject a token signed with a different secret', () => {
      const service = new ExportDownloadTokenService();

      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      const token = service.generateToken({
        exportId: 'export-123',
        userId: 'user-123',
        expiresAt,
      });

      process.env.EXPORT_DOWNLOAD_SECRET = 'different-secret-value';

      const differentService = new ExportDownloadTokenService();

      expect(() => differentService.verifyToken(token)).toThrow(
        'Invalid download token',
      );
    });
  });
});
