import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ActivityService } from './activity.service';
import { Activity } from './Schema/activity.schema';

describe('ActivityService', () => {
  let service: ActivityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityService,
        {
          provide: getModelToken(Activity.name),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<ActivityService>(ActivityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
