import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Category, CategoryDocument } from './Schema/categories.schema';
import { Model} from 'mongoose';
import { CreateCategryDto } from './DTO/create_category.dto';
import { UpdateCategoryDto } from './DTO/update_category.dto';

@Injectable()
export class CategoriesService {
    constructor (@InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>){}

    async create(createCategoryDto: CreateCategryDto, ownerId: string){
        return this.categoryModel.create({...createCategoryDto, owner: ownerId})
    }

    async findAll(ownerId:string, role:string){
        return this.categoryModel.find({owner:ownerId})
    }

    async findOne(id: string, ownerId:string, role:string){
        const category = await this.categoryModel.findOne({_id:id, owner:ownerId})
        if (!category){
            throw new NotFoundException("Category not found")
        }
        return category;
    }

    async update(id:string, updateCategoryDto:UpdateCategoryDto, ownerId:string, role:string){
        const updatedCategory = await this.categoryModel.findOneAndUpdate({_id:id, owner:ownerId}, updateCategoryDto, {new:true, runValidators:true})
        if(!updatedCategory){
            throw new NotFoundException("Category Not Found")
        }
        return updatedCategory;
    }

    async remove (id:string, ownerId:string, role:string){
        const deletedCategory = await this.categoryModel.findOneAndDelete({_id:id, owner:ownerId});
        if(!deletedCategory){
            throw new NotFoundException("Category Not Found")
        }
        return {message: "Category Deleted Successfully"}
    }
}
