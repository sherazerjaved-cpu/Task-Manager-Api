import { LoginDto } from 'src/auth/DTO/login.dto';

export class LoginCommand {
  constructor(
    public readonly dto: LoginDto,
    public readonly ip?: string,
  ) {}
}
