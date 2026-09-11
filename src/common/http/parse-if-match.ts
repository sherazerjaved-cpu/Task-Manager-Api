import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';

export function parseIfMatch(ifMatch?: string): number {
  if (!ifMatch) {
    throw new HttpException(
      'If-Match header is required',
      HttpStatus.PRECONDITION_REQUIRED,
    );
  }

  const normalized = ifMatch.trim().replace(/^W\//, '').replace(/^"|"$/g, '');

  const version = Number(normalized);

  if (!Number.isInteger(version) || version < 0) {
    throw new BadRequestException('Invalid If-Match header');
  }

  return version;
}
