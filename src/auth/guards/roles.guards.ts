import { CanActivate, ForbiddenException, Injectable, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY, Role } from "../decorators/roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate{
    constructor (private reflector: Reflector){}

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);

        if(!requiredRoles){
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if(!user){
            throw new ForbiddenException ("User Not Found");
        }

        if(!requiredRoles.includes(user.role)){
            throw new ForbiddenException ("You do not have permission to access this resource")
        }

        return true;
        
    }

}