import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TaskModule } from 'src/task/task.module';
import { ExportController } from './presentation/export.controller';
import { ExportService } from './application/export.service';
import { ExportDownloadTokenService } from './application/export-download-token.service';
import {
  Export,
  ExportSchema,
} from './infrastructure/database/schemas/export.schema';
import { ExportRepository } from './infrastructure/database/repositories/export.repository';
import { OutboxModule } from 'src/outbox/outbox.module';
import { EXPORT_REPOSITORY } from './domain/constants/repository.tokens';
import { AuthorizationModule } from 'src/common/authorization/authorization.module';
import { WorkspaceModule } from 'src/workspace/workspace.module';
import { PoliciesGuard } from 'src/common/authorization/policies.guard';

@Module({
  imports: [
    AuthorizationModule,
    forwardRef(() => TaskModule),
    forwardRef(() => OutboxModule),
    forwardRef(() => WorkspaceModule),
    MongooseModule.forFeature([
      {
        name: Export.name,
        schema: ExportSchema,
      },
    ]),
  ],

  controllers: [ExportController],

  providers: [
    ExportService,
    ExportRepository,
    ExportDownloadTokenService,
    PoliciesGuard,

    {
      provide: EXPORT_REPOSITORY,
      useExisting: ExportRepository,
    },
  ],

  exports: [ExportService, EXPORT_REPOSITORY],
})
export class ExportModule {}
