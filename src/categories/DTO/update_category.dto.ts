import { PartialType } from "@nestjs/mapped-types";
import { CreateCategryDto } from "./create_category.dto";

export class UpdateCategoryDto extends PartialType(CreateCategryDto){}