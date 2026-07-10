import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

    app.use(helmet());

    app.enableCors({
      origin: ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']});

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform:true,
      forbidNonWhitelisted:true,
    })
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  app.enableVersioning({type: VersioningType.URI, prefix: 'api/v', defaultVersion: '1'});

   const config = new DocumentBuilder()
    .setTitle('Task Manager API')
    .setDescription('NestJS Task Manager API Documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
