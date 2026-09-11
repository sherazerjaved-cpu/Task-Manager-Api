import {
  Inject,
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession, PipelineStage } from 'mongoose';
import { ITaskRepository } from 'src/task/domain/repositories/task.repository.interface';
import { Task, TaskDocument } from '../../Schema/task.schema';
import { CreateTaskDto } from '../../DTO/create-task.dto';
import { UpdateTaskDto } from '../../DTO/update-task.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { GetTasksQueryDto } from 'src/task/DTO/get-task-query.dto';
import { CreateCommentDto } from 'src/task/DTO/create-comment.dto';
import { FeatureFlagsService } from 'src/workspace/application/services/feature-flags.service';
import { WorkspaceFeatureFlag } from 'src/workspace/domain/enums/workspace-feature-flag.enum';

@Injectable()
export class TaskRepository implements ITaskRepository {
  private readonly taskCacheKeys = new Set<string>();

  constructor(
    @InjectModel(Task.name)
    private readonly taskModel: Model<TaskDocument>,

    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,

    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  async create(
    createTaskDto: CreateTaskDto,
    ownerId: string,
    session?: ClientSession,
  ): Promise<TaskDocument> {
    const { workspaceId, ...taskData } = createTaskDto;

    const [task] = await this.taskModel.create(
      [
        {
          ...taskData,
          owner: new Types.ObjectId(ownerId),
          workspace: new Types.ObjectId(workspaceId),
        },
      ],
      { session },
    );

    return task;
  }

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<TaskDocument | null> {
    return this.taskModel.findOne({
      _id: id,
      workspace: new Types.ObjectId(workspaceId),
      isDeleted: false,
    });
  }

  async findAuthorizedTask(
    id: string,
    userId: string,
    role: string,
    workspaceId: string,
  ): Promise<TaskDocument> {
    const task = await this.taskModel
      .findOne({
        _id: id,
        workspace: new Types.ObjectId(workspaceId),
        isDeleted: false,
      })
      .populate('owner')
      .populate('category');

    if (!task) {
      throw new NotFoundException('Task Not Found');
    }

    return task;
  }

  async save(task: TaskDocument): Promise<TaskDocument> {
    return task.save();
  }

  async update(
    id: string,
    workspaceId: string,
    updateTaskDto: UpdateTaskDto,
  ): Promise<TaskDocument | null> {
    return this.taskModel.findOneAndUpdate(
      {
        _id: id,
        workspace: new Types.ObjectId(workspaceId),
        isDeleted: false,
      },
      updateTaskDto,
      {
        new: true,
      },
    );
  }

  async delete(id: string, workspaceId: string): Promise<void> {
    await this.taskModel.findOneAndUpdate(
      {
        _id: id,
        workspace: new Types.ObjectId(workspaceId),
        isDeleted: false,
      },
      {
        isDeleted: true,
        deletedAt: new Date(),
      },
    );
  }

  async findAll(
    userId: string,
    role: string,
    workspaceId: string,
    query: GetTasksQueryDto,
  ): Promise<unknown> {
    const {
      page = 1,
      limit = 10,
      pagination = 'offset',
      cursor,
      status,
      search,
      sort,
      sortBy = 'createdAt',
      order = 'desc',
      dueFrom,
      dueTo,
      tags,
      assignee,
    } = query;

    const advancedFilteringRequested =
      dueFrom !== undefined ||
      dueTo !== undefined ||
      tags !== undefined ||
      assignee !== undefined ||
      sort !== undefined ||
      sortBy !== 'createdAt' ||
      order !== 'desc';

    if (advancedFilteringRequested) {
      const advancedFilteringEnabled = await this.featureFlagsService.isEnabled(
        workspaceId,
        WorkspaceFeatureFlag.ADVANCED_TASK_FILTERING,
      );

      if (!advancedFilteringEnabled) {
        throw new ForbiddenException(
          'Advanced task filtering is disabled for this workspace',
        );
      }
    }

    const cacheKey = `tasks:${JSON.stringify({
      userId,
      role,
      workspaceId,
      page,
      limit,
      pagination,
      cursor,
      status,
      search,
      sort,
      sortBy,
      order,
      dueFrom,
      dueTo,
      tags,
      assignee,
    })}`;

    const cached = await this.cacheManager.get(cacheKey);

    if (cached) {
      return cached;
    }

    const isCursorPagination = pagination === 'cursor';

    const cursorFilter =
      isCursorPagination && cursor
        ? {
            _id: {
              $gt: new Types.ObjectId(cursor),
            },
          }
        : {};

    const filter: any = {
      isDeleted: false,
      workspace: new Types.ObjectId(workspaceId),
    };

    if (role !== 'admin') {
      filter.owner = new Types.ObjectId(userId);
    }

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$text = {
        $search: search,
      };
    }

    if (dueFrom || dueTo) {
      filter.dueDate = {};

      if (dueFrom) {
        filter.dueDate.$gte = new Date(dueFrom);
      }

      if (dueTo) {
        filter.dueDate.$lte = new Date(dueTo);
      }
    }

    if (tags) {
      filter.tags = {
        $all: tags.split(','),
      };
    }

    if (assignee) {
      if (assignee === 'me') {
        filter.assignees = new Types.ObjectId(userId);
      } else {
        if (!Types.ObjectId.isValid(assignee)) {
          throw new BadRequestException('Invalid assignee ID');
        }

        filter.assignees = new Types.ObjectId(assignee);
      }
    }

    const sortObj: Record<string, 1 | -1> = {};

    if (isCursorPagination) {
      sortObj._id = 1;
    } else if (sort) {
      const sortFields = sort.split(',');

      sortFields.forEach((field: string) => {
        const [key, direction] = field.split(':');

        sortObj[key] = direction === 'asc' ? 1 : -1;
      });
    } else {
      sortObj[sortBy] = order === 'asc' ? 1 : -1;
    }

    const aggregateSort: Record<string, 1 | -1> = {};

    if (isCursorPagination) {
      aggregateSort._id = 1;
    } else {
      const priorityDirection = sortObj.priority;
      delete sortObj.priority;

      if (priorityDirection !== undefined) {
        aggregateSort.priorityWeight = priorityDirection;
      }

      Object.assign(aggregateSort, sortObj);
      aggregateSort._id = 1;
    }

    if (
      isCursorPagination &&
      (sort || sortBy !== 'createdAt' || order !== 'desc')
    ) {
      throw new BadRequestException(
        'Cursor pagination does not support custom sorting.',
      );
    }

    const skip = (page - 1) * Number(limit);

    const pipeline: PipelineStage[] = [
      {
        $match: {
          ...filter,
          ...cursorFilter,
        },
      },
      {
        $addFields: {
          priorityWeight: {
            $switch: {
              branches: [
                {
                  case: {
                    $eq: ['$priority', 'low'],
                  },
                  then: 1,
                },
                {
                  case: {
                    $eq: ['$priority', 'medium'],
                  },
                  then: 2,
                },
                {
                  case: {
                    $eq: ['$priority', 'high'],
                  },
                  then: 3,
                },
              ],
              default: 0,
            },
          },
        },
      },
      {
        $sort: aggregateSort,
      },

      ...(isCursorPagination
        ? []
        : [
            {
              $skip: skip,
            },
          ]),

      {
        $limit: isCursorPagination ? Number(limit) + 1 : Number(limit),
      },

      {
        $lookup: {
          from: 'users',
          let: {
            ownerId: '$owner',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$_id', '$$ownerId'],
                },
              },
            },
            {
              $project: {
                password: 0,
                refreshTokenHash: 0,
              },
            },
          ],
          as: 'owner',
        },
      },
      {
        $unwind: {
          path: '$owner',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'category',
        },
      },
      {
        $unwind: {
          path: '$category',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          priorityWeight: 0,
        },
      },
    ];

    const tasks = await this.taskModel.aggregate(pipeline);
    if (isCursorPagination) {
      const hasNextPage = tasks.length > Number(limit);
      if (hasNextPage) {
        tasks.pop();
      }

      const nextCursor =
        hasNextPage && tasks.length > 0
          ? tasks[tasks.length - 1]._id.toString()
          : null;

      const result = {
        data: tasks,
        meta: {
          limit: Number(limit),
          nextCursor,
        },
      };

      await this.cacheManager.set(cacheKey, result, 60 * 1000);
      this.taskCacheKeys.add(cacheKey);

      return result;
    }
    const total = await this.taskModel.countDocuments(filter);

    const result = {
      data: tasks,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };

    await this.cacheManager.set(cacheKey, result, 60 * 1000);
    this.taskCacheKeys.add(cacheKey);

    return result;
  }

  async clearCache(): Promise<void> {
    for (const key of this.taskCacheKeys) {
      await this.cacheManager.del(key);
    }
    this.taskCacheKeys.clear();
  }

  async uploadAttachment(
    taskId: string,
    file: Express.Multer.File,
  ): Promise<TaskDocument> {
    const task = await this.taskModel.findById(taskId);

    if (!task) {
      throw new NotFoundException('Task Not Found');
    }

    task.attachments.push({
      filename: file.filename,
      mime: file.mimetype,
      size: file.size,
      url: `/uploads/${file.filename}`,
    });

    return task.save();
  }

  async deleteAttachment(
    taskId: string,
    attachmentId: string,
  ): Promise<TaskDocument> {
    const task = await this.taskModel.findById(taskId);

    if (!task) {
      throw new NotFoundException('Task Not Found');
    }

    const attachment = task.attachments.find(
      (attachment) => attachment._id?.toString() === attachmentId.toString(),
    );

    if (!attachment) {
      throw new NotFoundException('Attachment Not Found');
    }

    task.attachments = task.attachments.filter(
      (attachment) => attachment._id?.toString() !== attachmentId.toString(),
    );

    return task.save();
  }

  async getAttachments(taskId: string): Promise<TaskDocument> {
    const task = await this.taskModel.findById(taskId);
    if (!task) {
      throw new NotFoundException('Task Not Found');
    }

    return task;
  }

  async addComment(
    taskId: string,
    createCommentDto: CreateCommentDto,
    userId: string,
  ): Promise<TaskDocument> {
    const task = await this.taskModel.findById(taskId);

    if (!task) {
      throw new NotFoundException('Task Not Found');
    }

    task.comments.push({
      author: userId as any,
      body: createCommentDto.body,
      createdAt: new Date(),
    });

    return task.save();
  }

  async getComments(taskId: string): Promise<TaskDocument> {
    const task = await this.taskModel
      .findById(taskId)
      .populate('comments.author');

    if (!task) {
      throw new NotFoundException('Task Not Found');
    }

    return task;
  }

  async getStats(userId: string, role: string): Promise<unknown> {
    const cacheKey = `stats:${userId}:${role}`;

    const cached = await this.cacheManager.get(cacheKey);

    if (cached) {
      return cached;
    }

    const matchStage =
      role === 'admin'
        ? { isDeleted: false }
        : {
            owner: new Types.ObjectId(userId),
            isDeleted: false,
          };

    const stats = await this.taskModel.aggregate([
      {
        $match: matchStage,
      },
      {
        $facet: {
          status: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
              },
            },
          ],

          priority: [
            {
              $group: {
                _id: '$priority',
                count: { $sum: 1 },
              },
            },
          ],

          overdue: [
            {
              $match: {
                dueDate: { $lt: new Date() },
                status: { $ne: 'done' },
              },
            },
            {
              $count: 'count',
            },
          ],
        },
      },
    ]);

    const result = stats[0];

    const response = {
      status: Object.fromEntries(
        result.status.map((item) => [item._id, item.count]),
      ),

      priority: Object.fromEntries(
        result.priority.map((item) => [item._id, item.count]),
      ),

      overdue: result.overdue[0]?.count || 0,
    };

    await this.cacheManager.set(cacheKey, response, 60 * 1000);
    this.taskCacheKeys.add(cacheKey);

    return response;
  }

  async assignUsers(taskId: string, userIds: string[]): Promise<TaskDocument> {
    const task = await this.taskModel.findById(taskId);

    if (!task) {
      throw new NotFoundException('Task Not Found');
    }

    task.assignees = userIds.map((userId) => new Types.ObjectId(userId));

    return task.save();
  }

  async aggregateWorkspaceTasks(
    workspaceId: string,
    page: number,
    limit: number,
    status?: string,
    search?: string,
  ) {
    const match: Record<string, any> = {
      workspace: new Types.ObjectId(workspaceId),
      isDeleted: false,
    };

    if (status) {
      match.status = status;
    }

    if (search) {
      match.$text = {
        $search: search,
      };
    }

    const skip = (page - 1) * limit;

    const result = await this.taskModel
      .aggregate([
        {
          $match: match,
        },

        {
          $lookup: {
            from: 'users',
            localField: 'assignees',
            foreignField: '_id',
            as: 'assignees',
          },
        },

        {
          $lookup: {
            from: 'workspaces',
            localField: 'workspace',
            foreignField: '_id',
            as: 'workspace',
          },
        },

        {
          $unwind: {
            path: '$workspace',
            preserveNullAndEmptyArrays: true,
          },
        },

        {
          $addFields: {
            assigneeCount: {
              $size: '$assignees',
            },

            isOverdue: {
              $and: [
                {
                  $ne: ['$status', 'done'],
                },
                {
                  $lt: ['$dueDate', new Date()],
                },
              ],
            },

            priorityWeight: {
              $switch: {
                branches: [
                  {
                    case: {
                      $eq: ['$priority', 'high'],
                    },
                    then: 3,
                  },
                  {
                    case: {
                      $eq: ['$priority', 'medium'],
                    },
                    then: 2,
                  },
                  {
                    case: {
                      $eq: ['$priority', 'low'],
                    },
                    then: 1,
                  },
                ],
                default: 0,
              },
            },
          },
        },

        {
          $facet: {
            data: [
              {
                $sort: {
                  priorityWeight: -1,
                  dueDate: 1,
                },
              },
              {
                $skip: skip,
              },
              {
                $limit: limit,
              },
            ],

            total: [
              {
                $count: 'count',
              },
            ],

            stats: [
              {
                $group: {
                  _id: '$status',
                  count: {
                    $sum: 1,
                  },
                },
              },
            ],
          },
        },
      ])
      .exec();

    const output = result[0] ?? {
      data: [],
      total: [],
      stats: [],
    };

    return {
      data: output.data,
      total: output.total[0]?.count ?? 0,
      stats: output.stats,
    };
  }

  async findAllForExport(workspaceId: string): Promise<any[]> {
    return this.taskModel
      .find({
        workspace: new Types.ObjectId(workspaceId),
        isDeleted: false,
      })
      .select('-__v')
      .lean()
      .exec();
  }
}
