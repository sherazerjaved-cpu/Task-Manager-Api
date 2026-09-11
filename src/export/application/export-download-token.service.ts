import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class ExportDownloadTokenService {
  private readonly secret: string;

  constructor() {
    const secret = process.env.EXPORT_DOWNLOAD_SECRET;

    if (!secret) {
      throw new Error('EXPORT_DOWNLOAD_SECRET is not configured');
    }

    this.secret = secret;
  }

  generateToken(data: {
    exportId: string;
    userId: string;
    expiresAt: Date;
  }): string {
    const payload = JSON.stringify({
      exportId: data.exportId,
      userId: data.userId,
      expiresAt: data.expiresAt.getTime(),
    });

    const encodedPayload = Buffer.from(payload).toString('base64url');

    const signature = createHmac('sha256', this.secret)
      .update(encodedPayload)
      .digest('base64url');

    return `${encodedPayload}.${signature}`;
  }

  verifyToken(token: string): {
    exportId: string;
    userId: string;
    expiresAt: number;
  } {
    const [encodedPayload, signature] = token.split('.');

    if (!encodedPayload || !signature) {
      throw new Error('Invalid download token');
    }

    const expectedSignature = createHmac('sha256', this.secret)
      .update(encodedPayload)
      .digest('base64url');

    const providedBuffer = Buffer.from(signature);

    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      throw new Error('Invalid download token');
    }

    let payload: {
      exportId: string;
      userId: string;
      expiresAt: number;
    };

    try {
      payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf-8'),
      );
    } catch {
      throw new Error('Invalid download token');
    }

    if (!payload.exportId || !payload.userId || !payload.expiresAt) {
      throw new Error('Invalid download token');
    }

    if (Date.now() >= payload.expiresAt) {
      throw new Error('Download token has expired');
    }

    return payload;
  }
}
