import { parseIfNoneMatch } from './parse-if-none-match';

describe('parseIfNoneMatch', () => {
  describe('missing header', () => {
    it('should return an empty array when the header is missing', () => {
      expect(parseIfNoneMatch()).toEqual([]);
    });

    it('should return an empty array when the header is empty', () => {
      expect(parseIfNoneMatch('')).toEqual([]);
    });
  });

  describe('wildcard', () => {
    it('should return [-1] for a wildcard', () => {
      expect(parseIfNoneMatch('*')).toEqual([-1]);
    });

    it('should handle whitespace around the wildcard', () => {
      expect(parseIfNoneMatch('  *  ')).toEqual([-1]);
    });
  });

  describe('valid ETags', () => {
    it('should parse a quoted ETag', () => {
      expect(parseIfNoneMatch('"3"')).toEqual([3]);
    });

    it('should parse an unquoted version', () => {
      expect(parseIfNoneMatch('3')).toEqual([3]);
    });

    it('should parse a weak ETag', () => {
      expect(parseIfNoneMatch('W/"3"')).toEqual([3]);
    });

    it('should parse multiple ETags', () => {
      expect(parseIfNoneMatch('"1", "2", "3"')).toEqual([1, 2, 3]);
    });

    it('should parse multiple weak ETags', () => {
      expect(parseIfNoneMatch('W/"1", W/"2", W/"3"')).toEqual([1, 2, 3]);
    });

    it('should handle whitespace around ETags', () => {
      expect(parseIfNoneMatch('  "1"  ,  "2"  ')).toEqual([1, 2]);
    });

    it('should accept version 0', () => {
      expect(parseIfNoneMatch('"0"')).toEqual([0]);
    });

    it('should parse large integer versions', () => {
      expect(parseIfNoneMatch('"100", "999999"')).toEqual([100, 999999]);
    });
  });

  describe('invalid values', () => {
    it('should ignore non-numeric values', () => {
      expect(parseIfNoneMatch('"abc"')).toEqual([]);
    });

    it('should ignore negative values', () => {
      expect(parseIfNoneMatch('"-1"')).toEqual([]);
    });

    it('should ignore decimal values', () => {
      expect(parseIfNoneMatch('"1.5"')).toEqual([]);
    });

    it('should keep valid values while ignoring invalid values', () => {
      expect(parseIfNoneMatch('"1", "abc", "2", "invalid"')).toEqual([1, 2]);
    });

    it('should return an empty array when all values are invalid', () => {
      expect(parseIfNoneMatch('abc, xyz, invalid')).toEqual([]);
    });
  });
});
