import { RefreshTokenDto } from 'src/auth/DTO/refresh_token.dto';

export class RefreshTokenCommand {
  constructor(public readonly dto: RefreshTokenDto) {}
}
