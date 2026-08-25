import { JwtAuthGuard } from './jwt-auth.guards';

describe('JwtAuthGuard', () => {
  it('should be defined', () => {
    const guard = new JwtAuthGuard();

    expect(guard).toBeDefined();
  });
});
