import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { parseIfMatch } from './parse-if-match';

describe('parseIfMatch', () => {
  describe('missing header', () => {
    it('should throw 428 Precondition Required when header is missing', () => {
      expect(() => parseIfMatch()).toThrow(HttpException);

      try {
        parseIfMatch();
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);

        const exception = error as HttpException;

        expect(exception.getStatus()).toBe(HttpStatus.PRECONDITION_REQUIRED);

        expect(exception.getResponse()).toBe('If-Match header is required');
      }
    });

    it('should throw 428 when header is an empty string', () => {
      expect(() => parseIfMatch('')).toThrow(HttpException);

      try {
        parseIfMatch('');
      } catch (error) {
        const exception = error as HttpException;

        expect(exception.getStatus()).toBe(HttpStatus.PRECONDITION_REQUIRED);
      }
    });
  });

  describe('valid headers', () => {
    it('should parse a quoted version number', () => {
      expect(parseIfMatch('"3"')).toBe(3);
    });

    it('should parse an unquoted version number', () => {
      expect(parseIfMatch('3')).toBe(3);
    });

    it('should parse a weak ETag', () => {
      expect(parseIfMatch('W/"3"')).toBe(3);
    });

    it('should parse a weak ETag without quotes', () => {
      expect(parseIfMatch('W/3')).toBe(3);
    });

    it('should accept version 0', () => {
      expect(parseIfMatch('"0"')).toBe(0);
    });

    it('should trim surrounding whitespace', () => {
      expect(parseIfMatch('  "3"  ')).toBe(3);
    });

    it('should parse a large integer version', () => {
      expect(parseIfMatch('"999999"')).toBe(999999);
    });
  });

  describe('invalid headers', () => {
    it('should reject a non-numeric value', () => {
      expect(() => parseIfMatch('abc')).toThrow(BadRequestException);
      expect(() => parseIfMatch('abc')).toThrow('Invalid If-Match header');
    });

    it('should reject a negative version', () => {
      expect(() => parseIfMatch('-1')).toThrow(BadRequestException);
      expect(() => parseIfMatch('-1')).toThrow('Invalid If-Match header');
    });

    it('should reject a negative quoted version', () => {
      expect(() => parseIfMatch('"-1"')).toThrow(BadRequestException);
    });

    it('should reject a decimal version', () => {
      expect(() => parseIfMatch('1.5')).toThrow(BadRequestException);
    });

    it('should reject a quoted decimal version', () => {
      expect(() => parseIfMatch('"1.5"')).toThrow(BadRequestException);
    });

    it('should reject Infinity', () => {
      expect(() => parseIfMatch('Infinity')).toThrow(BadRequestException);
    });

    it('should reject NaN', () => {
      expect(() => parseIfMatch('NaN')).toThrow(BadRequestException);
    });

    it('should reject an invalid weak ETag', () => {
      expect(() => parseIfMatch('W/"abc"')).toThrow(BadRequestException);
    });
  });

  describe('exception types and status codes', () => {
    it('should use 428 for a missing If-Match header', () => {
      try {
        parseIfMatch();
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(428);
      }
    });

    it('should use 400 for an invalid If-Match header', () => {
      try {
        parseIfMatch('invalid');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).getStatus()).toBe(400);
      }
    });
  });
});
