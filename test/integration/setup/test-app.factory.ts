import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module';
import { APP_GUARD } from '@nestjs/core';
import { MetricsInterceptor } from '../../../src/metrics/presentation/metrics.interceptor';

export async function createIntegrationApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideGuard(APP_GUARD)
    .useValue({
      canActivate: () => true,
    })
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

  app.useGlobalInterceptors(app.get(MetricsInterceptor));

  app.enableVersioning({
    type: VersioningType.URI,
    prefix: 'api/v',
    defaultVersion: '1',
  });

  await app.init();

  return app;
}
