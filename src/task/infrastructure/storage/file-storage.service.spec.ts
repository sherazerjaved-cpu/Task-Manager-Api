import * as fs from 'fs';
import * as path from 'path';

import { FileStorageService } from './file-storage.service';

jest.mock('fs');

describe('FileStorageService', () => {
  let service: FileStorageService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new FileStorageService();
  });

  describe('deleteFile', () => {
    it('should delete the file when the file exists', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      service.deleteFile('/uploads/test.pdf');

      const expectedPath = path.join(process.cwd(), 'uploads/test.pdf');

      expect(fs.existsSync).toHaveBeenCalledWith(expectedPath);
      expect(fs.unlinkSync).toHaveBeenCalledWith(expectedPath);
    });

    it('should not delete the file when the file does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      service.deleteFile('/uploads/test.pdf');

      const expectedPath = path.join(process.cwd(), 'uploads/test.pdf');

      expect(fs.existsSync).toHaveBeenCalledWith(expectedPath);
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('should remove the leading slash from the URL before creating the file path', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      service.deleteFile('/uploads/document.pdf');

      expect(fs.existsSync).toHaveBeenCalledWith(
        path.join(process.cwd(), 'uploads/document.pdf'),
      );

      expect(fs.unlinkSync).toHaveBeenCalledWith(
        path.join(process.cwd(), 'uploads/document.pdf'),
      );
    });

    it('should handle a URL without a leading slash', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      service.deleteFile('uploads/document.pdf');

      const expectedPath = path.join(process.cwd(), 'uploads/document.pdf');

      expect(fs.existsSync).toHaveBeenCalledWith(expectedPath);
      expect(fs.unlinkSync).toHaveBeenCalledWith(expectedPath);
    });

    it('should propagate an error from fs.unlinkSync', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      (fs.unlinkSync as jest.Mock).mockImplementation(() => {
        throw new Error('Unable to delete file');
      });

      expect(() => service.deleteFile('/uploads/test.pdf')).toThrow(
        'Unable to delete file',
      );

      expect(fs.unlinkSync).toHaveBeenCalledTimes(1);
    });

    it('should not call unlinkSync when existsSync returns false', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      service.deleteFile('/uploads/missing.pdf');

      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });
  });
});
