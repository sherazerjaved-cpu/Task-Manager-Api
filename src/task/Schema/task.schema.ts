import { Prop, Schema, SchemaFactory} from "@nestjs/mongoose"
import { Types, Document } from "mongoose"
import { TaskPriority } from "../Enums/task-priority.enum"
import { TaskStatus } from "../Enums/task-status.enum"


export type TaskDocument = Task & Document;

@Schema({timestamps:true}) export class Task{
    
    @Prop({required:true, minlength:3})
    title!: string;

    @Prop()
    description!: string;

    @Prop({enum:TaskStatus, default:TaskStatus.Pending})
    status!: TaskStatus;

    @Prop({enum:TaskPriority, default:TaskPriority.Medium})
    priority!: TaskPriority;

    @Prop()
    duedate!: Date;

    @Prop({type: Types.ObjectId, ref: 'User', required:true})
    owner!:Types.ObjectId;
}

export const TaskSchema = SchemaFactory.createForClass(Task);