import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import mongoose, { Mongoose } from 'mongoose';

@Injectable()
export class ParseObjectIdPipe implements PipeTransform {
  transform(value: string, metadata: ArgumentMetadata){
    if(!mongoose.Types.ObjectId.isValid(value)){
      throw new BadRequestException ("Invalid Object ID")
    }
  return value;
    }
}
