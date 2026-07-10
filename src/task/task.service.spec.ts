import { Test, TestingModule } from '@nestjs/testing';
import { TaskService } from './task.service';
import { getModelToken } from '@nestjs/mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import * as fs from 'fs';
import { Task } from './Schema/task.schema';
import { Category } from '../categories/Schema/categories.schema';
import { TaskGateway } from 'src/websocket/task/task.gateway';
import { ActivityService } from 'src/activity/activity.service';


jest.mock('fs', () => ({
  existsSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

describe('TaskService', () => {
  let service: TaskService;

  const mockTaskModel = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
     findByIdAndUpdate: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(), 
  };


  const mockCategoryModel = {
    findOne: jest.fn(),
  };

  const mockCache = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };


  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        {
          provide: getModelToken(Task.name),
          useValue: mockTaskModel,
        },
        {
          provide: getModelToken(Category.name),
          useValue: mockCategoryModel,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCache,
        },
        { provide: TaskGateway,
      useValue: {
        emitTaskCreated: jest.fn(),
        emitTaskUpdated: jest.fn(),
        emitTaskDeleted: jest.fn(),
      },
      },
      {
        provide: ActivityService,
        useValue: {
        create: jest.fn(),
      },
    },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create()', () => {
    it('should create a task successfully', async () => {
      const dto = {
        title: 'Learn NestJS',
      };

      const createdTask = {
        _id: new Types.ObjectId(),
        ...dto,
      };

      const userId = new Types.ObjectId().toString();
      
      mockTaskModel.create.mockResolvedValue(createdTask);

      const result = await service.create(dto as any, userId);

      expect(mockTaskModel.create).toHaveBeenCalled();

      expect(result).toEqual(createdTask);
    });

    it('should throw ForbiddenException when user does not own the task', async () => {
  mockTaskModel.findOne.mockReturnValue({
    populate: jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        owner: {
          _id: new Types.ObjectId(),
        },
      }),
    }),
  });

  await expect(
    service.findOne(
      'taskId',
      new Types.ObjectId().toString(),
      'user',
    ),
  ).rejects.toThrow(ForbiddenException);
});

    it('should throw NotFoundException when category does not exist', async () => {
      mockCategoryModel.findOne.mockResolvedValue(null);

      await expect(
        service.create(
          {
            title: 'Task',
            category: new Types.ObjectId().toString(),
          } as any,
          'user123',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne()', () => {
    it('should return a task', async () => {
      mockCache.get.mockResolvedValue(null);

      const task = {
        title: 'Task',
      };

      mockTaskModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(task),
        }),
      });

      const result = await service.findOne(
        'taskId',
        'userId',
        'user',
      );

      expect(result).toEqual(task);
    });

    it('should apply ownership filter for normal users', async () => {
      const userId = new Types.ObjectId().toString();
      const taskId = new Types.ObjectId().toString();
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
      };
      mockTaskModel.findOne.mockReturnValue(mockQuery);
      mockQuery.populate.mockReturnValueOnce(mockQuery)
    .mockReturnValueOnce(Promise.resolve({
      _id: taskId,
      owner: {
        _id: new Types.ObjectId(userId),
      },
    }));
    await service.findOne(taskId, userId, 'user');
    expect(mockTaskModel.findOne).toHaveBeenCalledWith({
    _id: taskId,
    isDeleted: false,
    });
    });

    it('should not apply ownership filter for admin users', async () => {
      const adminId = new Types.ObjectId().toString();
      const taskId = new Types.ObjectId().toString();
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
      };

    mockTaskModel.findOne.mockReturnValue(mockQuery);

    mockQuery.populate
    .mockReturnValueOnce(mockQuery)
    .mockReturnValueOnce(Promise.resolve({
      _id: taskId,
    }));

    await service.findOne(taskId, adminId, 'admin');

    expect(mockTaskModel.findOne).toHaveBeenCalledWith({
    _id: taskId,
    isDeleted: false,
    });
    });

    it('should throw NotFoundException if task is not found', async () => {
      mockCache.get.mockResolvedValue(null);

      mockTaskModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        service.findOne(
          'taskId',
          'userId',
          'user',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return cached task if available', async () => {
      const cachedTask = {
        title: 'Cached Task',
      };

      mockCache.get.mockResolvedValue(cachedTask);

      const result = await service.findOne(
        'taskId',
        'userId',
        'user',
      );

      expect(result).toEqual(cachedTask);

      expect(mockTaskModel.findOne).not.toHaveBeenCalled();
    });
  });

  describe('findAll()', () => {
    it('should return paginated tasks', async () => {
      mockCache.get.mockResolvedValue(null);

      const tasks = [
        { title: 'Task 1' },
        { title: 'Task 2' },
      ];

      mockTaskModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue(tasks),
              }),
            }),
          }),
        }),
      });

      mockTaskModel.countDocuments.mockResolvedValue(2);

      const userId = new Types.ObjectId().toString()

      const result:any = await service.findAll(
        userId,
        'user',
        {},
      );

      expect(result.data).toEqual(tasks);

      expect(result.meta.total).toBe(2);

      expect(mockTaskModel.countDocuments).toHaveBeenCalled();
    });

    it('should return cached tasks', async () => {
      const cachedResult = {
        data: [],
        meta: {
          total: 0,
        },
      };

      mockCache.get.mockResolvedValue(cachedResult);

      const result = await service.findAll(
        'user1',
        'user',
        {},
      );

      expect(result).toEqual(cachedResult);

      expect(mockTaskModel.find).not.toHaveBeenCalled();
    });
  });
    describe('update()', () => {
    it('should update a task successfully', async () => {
      
      const userId = new Types.ObjectId().toString()
      const updateDto = {
        title: 'Updated Task',
      };

      const updatedTask = {
        _id: new Types.ObjectId(),
        ...updateDto,
         owner: {
      _id: new Types.ObjectId(userId),
       },
        save: jest.fn().mockResolvedValue(true),
      };

      mockTaskModel.findOne.mockReturnValue({
    populate: jest.fn()
      .mockReturnValueOnce({
        populate: jest.fn()
          .mockResolvedValue(updatedTask)
              }),
      });

      mockTaskModel.findByIdAndUpdate.mockResolvedValue(updatedTask);

      const result = await service.update(
         new Types.ObjectId().toString(),
        updateDto as any,
        userId,
        'user',
      );

      expect(updatedTask.save).toHaveBeenCalled();

      expect(result).toEqual(updatedTask);
    });

    it('should throw NotFoundException when task does not exist', async () => {
      mockTaskModel.findOne.mockReturnValue({
      populate: jest.fn()
    .mockReturnValue({
      populate: jest.fn()
        .mockResolvedValue(null),
    }),
     });

      await expect(
        service.update(
          'taskId',
          {
            title: 'Updated',
          } as any,
          'user1',
          'user',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when category does not exist', async () => {
      mockCategoryModel.findOne.mockResolvedValue(null);

      await expect(
        service.update(
          'taskId',
          {
            category: new Types.ObjectId().toString(),
          } as any,
          'user1',
          'user',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove()', () => {
    it('should soft delete a task', async () => {
      const userId = new Types.ObjectId().toString();

     const task = {
    _id: new Types.ObjectId(),
    owner: {
      _id: new Types.ObjectId(userId),
    },
    isDeleted: false,
    deletedAt: null,
    save: jest.fn().mockResolvedValue(true),
  };
      
      mockTaskModel.findOne.mockReturnValue({
        populate: jest.fn()
         .mockReturnValueOnce({
          populate: jest.fn()
          .mockResolvedValue(task), 
          }),
         })

      const result = await service.remove(
        new Types.ObjectId().toString(),
        userId,
          'user',
      );

      expect(task.save).toHaveBeenCalled();

      expect(result).toEqual({
        message: 'Task Deleted Successfully!',
      });
    });

    it('should throw NotFoundException if task does not exist', async () => {
       const userId = new Types.ObjectId().toString();
       mockTaskModel.findOne.mockReturnValue({
      populate: jest.fn().mockReturnValue({
      populate: jest.fn().mockResolvedValue(null),
       }),
      });


      await expect(
        service.remove(
          'taskId',
          userId,
          'user',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('addComment()', () => {
  it('should add a comment successfully', async () => {
    const task = {
      comments: [],
      save: jest.fn().mockResolvedValue(true),
    };

    jest
      .spyOn(service as any, 'getAuthorizedTask')
      .mockResolvedValue(task);

    jest
      .spyOn(service as any, 'clearTaskCache')
      .mockResolvedValue(undefined);

    const dto = {
      body: 'This is a comment',
    };

    const result = await service.addComment(
      new Types.ObjectId().toString(),
      dto as any,
      new Types.ObjectId().toString(),
      'user',
    );

    expect(task.comments).toHaveLength(1);

    expect(task.comments[0]).toMatchObject({
      body: 'This is a comment',
    });

    expect(task.save).toHaveBeenCalled();

    expect((service as any).clearTaskCache).toHaveBeenCalled();

    expect(result).toEqual(task);
  });
});

describe('getComments()', () => {
  it('should return comments', async () => {
    const comments = [
      {
        body: 'First Comment',
        author: {
          _id: 'user1',
        },
      },
    ];

    const task = {
      comments,
      populate: jest.fn().mockResolvedValue(true),
    };

    jest
      .spyOn(service as any, 'getAuthorizedTask')
      .mockResolvedValue(task);

    const result = await service.getComments(
      'taskId',
      'userId',
      'user',
    );

    expect(task.populate).toHaveBeenCalledWith(
      'comments.author',
    );

    expect(result).toEqual(comments);
  });
});

describe('uploadAttachment()', () => {
  it('should upload an attachment successfully', async () => {
    const task = {
      attachments: [],
      save: jest.fn().mockResolvedValue(true),
    };

    jest
      .spyOn(service as any, 'getAuthorizedTask')
      .mockResolvedValue(task);

    jest
      .spyOn(service as any, 'clearTaskCache')
      .mockResolvedValue(undefined);

    const file = {
      filename: 'test.pdf',
      mimetype: 'application/pdf',
      size: 1024,
    } as Express.Multer.File;

    const result = await service.uploadAttachment(
      new Types.ObjectId().toString(),
      file,
      new Types.ObjectId().toString(),
      'user',
    );

    expect(task.attachments).toHaveLength(1);

    expect(task.attachments[0]).toEqual({
      filename: 'test.pdf',
      mime: 'application/pdf',
      size: 1024,
      url: '/uploads/test.pdf',
    });

    expect(task.save).toHaveBeenCalled();

    expect((service as any).clearTaskCache).toHaveBeenCalled();

    expect(result).toEqual(task.attachments);
  });
});


describe('getAttachments()', () => {
  it('should return task attachments', async () => {
    const attachments = [
      {
        filename: 'file.pdf',
        mime: 'application/pdf',
        size: 2000,
        url: '/uploads/file.pdf',
      },
    ];

    const task = {
      attachments,
    };

    jest
      .spyOn(service as any, 'getAuthorizedTask')
      .mockResolvedValue(task);

    const result = await service.getAttachments(
      'taskId',
      'userId',
      'user',
    );

    expect(result).toEqual(attachments);
  });
});

describe('deleteAttachment()', () => {
  it('should delete an attachment successfully', async () => {
    const attachment = {
      _id: new Types.ObjectId(),
      filename: 'test.pdf',
      mime: 'application/pdf',
      size: 100,
      url: '/uploads/test.pdf',
    };

    const task = {
      attachments: [attachment],
      save: jest.fn().mockResolvedValue(true),
    };

    jest
      .spyOn(service as any, 'getAuthorizedTask')
      .mockResolvedValue(task);

    jest
      .spyOn(service as any, 'clearTaskCache')
      .mockResolvedValue(undefined);

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.unlinkSync as jest.Mock).mockImplementation(() => {});

    const result = await service.deleteAttachment(
      new Types.ObjectId().toString(),
      attachment._id.toString(),
       new Types.ObjectId().toString(),
      'user',
    );

    expect(fs.existsSync).toHaveBeenCalled();

    expect(fs.unlinkSync).toHaveBeenCalled();

    expect(task.attachments).toHaveLength(0);

    expect(task.save).toHaveBeenCalled();

    expect((service as any).clearTaskCache).toHaveBeenCalled();

    expect(result).toEqual({
      message: 'Attachment deleted successfully.',
    });
  });

    it('should throw NotFoundException when attachment does not exist', async () => {
    const task = {
      attachments: [],
      save: jest.fn(),
    };

    jest
      .spyOn(service as any, 'getAuthorizedTask')
      .mockResolvedValue(task);

    await expect(
      service.deleteAttachment(
        'taskId',
        new Types.ObjectId().toString(),
        'userId',
        'user',
      ),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('getStats()', () => {
  it('should return cached stats', async () => {
    mockCache.get.mockReset();
    mockCache.set.mockReset();
    mockTaskModel.aggregate.mockReset();
    const cachedStats = {
      status: { pending: 2 },
      priority: { high: 1 },
      overdue: 0,
    };

    mockCache.get.mockResolvedValue(cachedStats);

    const result = await service.getStats(
      'userId',
      'user',
    );

    expect(mockCache.get).toHaveBeenCalled();

    expect(mockTaskModel.aggregate).not.toHaveBeenCalled();

    expect(result).toEqual(cachedStats);
  });

    it('should aggregate stats for normal user', async () => {
          mockCache.get.mockReset();
          mockCache.set.mockReset();
          mockTaskModel.aggregate.mockReset();
    mockCache.get.mockResolvedValue(null);

    mockTaskModel.aggregate.mockResolvedValue([
      {
        status: [
          { _id: 'pending', count: 2 },
          { _id: 'done', count: 1 },
        ],
        priority: [
          { _id: 'high', count: 1 },
          { _id: 'medium', count: 2 },
        ],
        overdue: [
          { count: 3 },
        ],
      },
    ]);

    const result = await service.getStats(
      new Types.ObjectId().toString(),
      'user',
    );

    expect(mockTaskModel.aggregate).toHaveBeenCalled();

    expect(mockCache.set).toHaveBeenCalled();

    expect(result).toEqual({
      status: {
        pending: 2,
        done: 1,
      },
      priority: {
        high: 1,
        medium: 2,
      },
      overdue: 3,
    });
  });

    it('should aggregate stats for admin', async () => {
          mockCache.get.mockReset();
          mockCache.set.mockReset();
          mockTaskModel.aggregate.mockReset();
    mockCache.get.mockResolvedValue(null);

    mockTaskModel.aggregate.mockResolvedValue([
      {
        status: [
          { _id: 'pending', count: 5 },
        ],
        priority: [
          { _id: 'high', count: 5 },
        ],
        overdue: [],
      },
    ]);

    const result = await service.getStats(
      'adminId',
      'admin',
    );

    expect(mockTaskModel.aggregate).toHaveBeenCalled();

    const pipeline = mockTaskModel.aggregate.mock.calls[0][0];

    expect(pipeline[0].$match).toEqual({
      isDeleted: false,
    });

    expect(result).toEqual({
      status: {
        pending: 5,
      },
      priority: {
        high: 5,
      },
      overdue: 0,
    });
  });
});


  });