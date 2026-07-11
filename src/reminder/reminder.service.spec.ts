import { Test, TestingModule } from '@nestjs/testing';
import { ReminderService } from './reminder.service';
import { getModelToken } from '@nestjs/mongoose';
import { Task } from 'src/task/Schema/task.schema';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { MailService } from 'src/mail/mail.service';

describe('ReminderService', () => {
  let service: ReminderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReminderService,
        {
          provide: getModelToken(Task.name),
          useValue: {},
        },
        {
          provide: ConfigService,
          useValue: {},
        },
        {
          provide: SchedulerRegistry,
          useValue: {},
        },
        {
          provide: MailService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<ReminderService>(ReminderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
