import { UserDocument } from 'src/users/Schema/user.schema';

export interface IAuthRepository {
  findByEmail(email: string): Promise<UserDocument | null>;

  createUser(email: string, password: string): Promise<UserDocument>;

  findById(id: string): Promise<UserDocument | null>;
}
