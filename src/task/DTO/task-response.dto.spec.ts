import { TaskResponseDto } from './task-response.dto';

describe('TaskResponseDto', () => {
  it('should be constructable', () => {
    const dto = new TaskResponseDto();

    expect(dto).toBeInstanceOf(TaskResponseDto);
  });

  it('should allow all response properties to be assigned', () => {
    const dto = new TaskResponseDto();

    dto._id = '68a123456789abcdef123456';
    dto.title = 'Complete Backend Assignment';
    dto.description = 'Finish the remaining requirements.';
    dto.status = 'pending' as any;
    dto.priority = 'high' as any;
    dto.dueDate = new Date('2026-08-20T18:00:00.000Z');
    dto.category = '68a123456789abcdef123459';
    dto.tags = ['nestjs', 'backend'];
    dto.isDeleted = false;
    dto.deletedAt = null;
    dto.reminderSent = false;

    dto.comments = [
      {
        author: '68a123456789abcdef123458',
        body: 'Ready for review.',
        createdAt: new Date(),
      },
    ];

    dto.attachments = [
      {
        _id: '68a123456789abcdef123457',
        filename: 'assignment.pdf',
        mime: 'application/pdf',
        size: 245760,
        url: '/uploads/assignment.pdf',
      },
    ];

    dto.owner = '68a123456789abcdef123460';
    dto.workspace = '68a123456789abcdef123461';
    dto.assignees = ['68a123456789abcdef123462'];
    dto.createdAt = new Date();
    dto.updatedAt = new Date();
    dto.__v = 3;

    expect(dto._id).toBe('68a123456789abcdef123456');
    expect(dto.title).toBe('Complete Backend Assignment');
    expect(dto.tags).toEqual(['nestjs', 'backend']);
    expect(dto.comments).toHaveLength(1);
    expect(dto.attachments).toHaveLength(1);
    expect(dto.assignees).toHaveLength(1);
    expect(dto.__v).toBe(3);
  });
});
