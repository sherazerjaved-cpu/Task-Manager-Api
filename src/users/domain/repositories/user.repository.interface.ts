import { UserDocument } from 'src/users/Schema/user.schema';

export interface IUserRepository {
  findAll(): Promise<UserDocument[]>;

  findByEmail(email: string): Promise<UserDocument | null>;

  findByEmailWithPassword(email: string): Promise<UserDocument | null>;

  findByEmailWithoutPassword(email: string): Promise<UserDocument | null>;

  findById(id: string): Promise<UserDocument | null>;

  createUser(
    email: string,
    password: string,
    emailVerificationTokenHash: string,
    emailVerificationExpiresAt: Date,
  ): Promise<UserDocument>;

  findByIdWithRefreshToken(id: string): Promise<UserDocument | null>;

  clearRefreshToken(id: string): Promise<UserDocument | null>;

  deleteUser(id: string): Promise<UserDocument | null>;

  updateRefreshToken(
    id: string,
    refreshTokenHash: string | null,
    tokenFamily?: string | null,
    currentTokenId?: string | null,
  ): Promise<UserDocument | null>;

  verifyEmail(tokenHash: string): Promise<UserDocument | null>;

  setEmailVerificationToken(
    id: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<UserDocument | null>;

  clearEmailVerificationToken(id: string): Promise<UserDocument | null>;

  setPasswordResetToken(
    id: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<UserDocument | null>;

  findByPasswordResetToken(tokenHash: string): Promise<UserDocument | null>;

  clearPasswordResetToken(id: string): Promise<UserDocument | null>;

  updatePassword(
    id: string,
    passwordHash: string,
  ): Promise<UserDocument | null>;
}
