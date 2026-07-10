import { IsOptional, IsString } from "class-validator";

export class CreateCategryDto{
    @IsString()
    name!: string;

    @IsOptional()
    @IsString()
    color?: string;

}