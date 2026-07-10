import { Type } from "class-transformer";
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";


export class GetTasksQueryDto{
    @IsOptional()
    @Type(()=> Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(()=> Number)
    @IsInt()
    @Min(1)
    limit?: number = 10;

    @IsOptional()
    @IsString()
    status?: string;

    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsString()
    sort?: string;
    
    @IsOptional()
    @IsString()
    sortBy?: string;

    @IsOptional()
    @IsIn(["asc", "desc"])
    order?: "asc" | "desc";

    @IsOptional()
    @IsDateString()
    dueFrom?: string;
    
    @IsOptional()
    @IsDateString()
    dueTo?: string;

    @IsOptional()
    @IsString()
    tags?: string;
}