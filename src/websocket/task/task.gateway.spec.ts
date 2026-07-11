import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { TaskGateway } from './task.gateway';

describe('TaskGateway', () => {
  let gateway: TaskGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskGateway,
        {
          provide: JwtService,
          useValue: {},
        },
      ],
    }).compile();

    gateway = module.get<TaskGateway>(TaskGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});