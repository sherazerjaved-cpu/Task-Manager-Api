import { ProblemDetailsDto } from './problem-details.dto';

describe('ProblemDetailsDto', () => {
  it('should be instantiable', () => {
    const dto = new ProblemDetailsDto();

    expect(dto).toBeInstanceOf(ProblemDetailsDto);
  });

  it('should allow all required properties', () => {
    const dto = new ProblemDetailsDto();

    dto.type = 'about:blank';
    dto.title = 'Bad Request';
    dto.status = 400;
    dto.detail = 'Validation failed';
    dto.instance = '/api/v1/tasks';

    expect(dto.type).toBe('about:blank');
    expect(dto.title).toBe('Bad Request');
    expect(dto.status).toBe(400);
    expect(dto.detail).toBe('Validation failed');
    expect(dto.instance).toBe('/api/v1/tasks');
  });

  it('should allow requestId', () => {
    const dto = new ProblemDetailsDto();

    dto.type = 'about:blank';
    dto.title = 'Bad Request';
    dto.status = 400;
    dto.detail = 'Validation failed';
    dto.instance = '/api/v1/tasks';
    dto.requestId = '01JXYZ123456789';

    expect(dto.requestId).toBe('01JXYZ123456789');
  });

  it('should allow errors', () => {
    const dto = new ProblemDetailsDto();

    dto.type = 'about:blank';
    dto.title = 'Bad Request';
    dto.status = 400;
    dto.detail = 'Validation failed';
    dto.instance = '/api/v1/tasks';
    dto.errors = [
      'email must be an email',
      'password must be longer than or equal to 8 characters',
    ];

    expect(dto.errors).toEqual([
      'email must be an email',
      'password must be longer than or equal to 8 characters',
    ]);
  });

  it('should allow optional properties to be omitted', () => {
    const dto = new ProblemDetailsDto();

    dto.type = 'about:blank';
    dto.title = 'Bad Request';
    dto.status = 400;
    dto.detail = 'Validation failed';
    dto.instance = '/api/v1/tasks';

    expect(dto.requestId).toBeUndefined();
    expect(dto.errors).toBeUndefined();
  });
});
