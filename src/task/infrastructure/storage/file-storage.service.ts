import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FileStorageService {
  deleteFile(url: string): void {
    const filePath = path.join(process.cwd(), url.replace(/^\//, ''));

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
