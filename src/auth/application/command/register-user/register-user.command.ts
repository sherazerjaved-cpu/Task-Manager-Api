import { RegisterDto } from 'src/auth/DTO/register.dto';

export class RegisterUserCommand {
  constructor(public readonly dto: RegisterDto) {}
}
