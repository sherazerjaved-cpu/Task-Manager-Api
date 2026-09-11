import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

import { User, UserDocument } from '../../Schema/user.schema';
import { IUserRepository } from '../../domain/repositories/user.repository.interface';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,

    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async findAll(): Promise<UserDocument[]> {
    const cacheKey = 'users:all';

    const cached = await this.cacheManager.get<UserDocument[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const users = await this.userModel.find().select('-password').exec();

    await this.cacheManager.set(cacheKey, users, 60 * 1000);

    return users;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).select('+password');
  }

  async findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).select('+password').exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    const cacheKey = `user:${id}`;

    const cached = await this.cacheManager.get<UserDocument>(cacheKey);

    if (cached) {
      return cached;
    }

    const user = await this.userModel.findById(id).select('-password').exec();

    if (user) {
      await this.cacheManager.set(cacheKey, user, 60 * 1000);
    }

    return user;
  }

  async createUser(
    email: string,
    password: string,
    emailVerificationTokenHash: string,
    emailVerificationExpiresAt: Date,
  ): Promise<UserDocument> {
    const user = await this.userModel.create({
      email,
      password,
      emailVerified: false,
      emailVerificationTokenHash,
      emailVerificationExpiresAt,
    });

    const createdUser = await this.userModel
      .findById(user._id)
      .select('-password')
      .exec();

    if (!createdUser) {
      throw new Error('User creation failed');
    }

    await this.cacheManager.del('users:all');

    return createdUser;
  }

  async findByIdWithRefreshToken(id: string): Promise<UserDocument | null> {
    return this.userModel
      .findById(id)
      .select('+refreshTokenHash +currentTokenId');
  }

  async clearRefreshToken(id: string): Promise<UserDocument | null> {
    const user = await this.userModel.findByIdAndUpdate(
      id,
      {
        refreshTokenHash: null,
        tokenFamily: null,
        currentTokenId: null,
      },
      {
        new: true,
      },
    );

    await this.invalidateUserCache(id);

    return user;
  }

  async deleteUser(id: string): Promise<UserDocument | null> {
    const user = await this.userModel.findOneAndDelete({
      _id: id,
    });

    await this.invalidateUserCache(id);
    await this.cacheManager.del('users:all');

    return user;
  }

  async updateRefreshToken(
    id: string,
    refreshTokenHash: string | null,
    tokenFamily?: string | null,
    currentTokenId?: string | null,
  ): Promise<UserDocument | null> {
    const user = await this.userModel.findByIdAndUpdate(
      id,
      {
        refreshTokenHash,
        tokenFamily,
        currentTokenId,
      },
      {
        new: true,
      },
    );

    await this.invalidateUserCache(id);

    return user;
  }

  async setEmailVerificationToken(
    id: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<UserDocument | null> {
    const user = await this.userModel
      .findByIdAndUpdate(
        id,
        {
          emailVerificationTokenHash: tokenHash,
          emailVerificationExpiresAt: expiresAt,
          emailVerified: false,
        },
        {
          new: true,
        },
      )
      .exec();

    await this.invalidateUserCache(id);

    return user;
  }

  async verifyEmail(tokenHash: string): Promise<UserDocument | null> {
    const user = await this.userModel
      .findOneAndUpdate(
        {
          emailVerificationTokenHash: tokenHash,
          emailVerificationExpiresAt: { $gt: new Date() },
          emailVerified: false,
        },
        {
          $set: {
            emailVerified: true,
          },
          $unset: {
            emailVerificationTokenHash: 1,
            emailVerificationExpiresAt: 1,
          },
        },
        {
          new: true,
        },
      )
      .exec();

    if (user) {
      await this.invalidateUserCache(user._id.toString());
    }

    return user;
  }

  async clearEmailVerificationToken(id: string): Promise<UserDocument | null> {
    const user = await this.userModel
      .findByIdAndUpdate(
        id,
        {
          $unset: {
            emailVerificationTokenHash: 1,
            emailVerificationExpiresAt: 1,
          },
        },
        {
          new: true,
        },
      )
      .exec();

    await this.invalidateUserCache(id);

    return user;
  }

  async findByEmailWithoutPassword(
    email: string,
  ): Promise<UserDocument | null> {
    return this.userModel.findOne({
      email: email.toLowerCase(),
    });
  }

  async setPasswordResetToken(
    id: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<UserDocument | null> {
    const user = await this.userModel
      .findByIdAndUpdate(
        id,
        {
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: expiresAt,
        },
        {
          new: true,
        },
      )
      .exec();

    await this.invalidateUserCache(id);

    return user;
  }

  async findByPasswordResetToken(
    tokenHash: string,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findOne({
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: { $gt: new Date() },
      })
      .select('+password')
      .exec();
  }

  async clearPasswordResetToken(id: string): Promise<UserDocument | null> {
    const user = await this.userModel
      .findByIdAndUpdate(
        id,
        {
          $unset: {
            passwordResetTokenHash: 1,
            passwordResetExpiresAt: 1,
          },
        },
        {
          new: true,
        },
      )
      .exec();

    await this.invalidateUserCache(id);

    return user;
  }

  async updatePassword(
    id: string,
    passwordHash: string,
  ): Promise<UserDocument | null> {
    const user = await this.userModel
      .findByIdAndUpdate(
        id,
        {
          password: passwordHash,
        },
        {
          new: true,
        },
      )
      .select('-password')
      .exec();

    await this.invalidateUserCache(id);

    return user;
  }

  private async invalidateUserCache(id: string): Promise<void> {
    await this.cacheManager.del(`user:${id}`);
    await this.cacheManager.del('users:all');
  }
}
