import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let userModel: any;
  let jwtService: any;
  let configService: any;


  beforeEach(async () => {

    userModel = {
      findOne: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };


    jwtService = {
      signAsync: jest.fn(),
      verify: jest.fn(),
    };


    configService = {
      getOrThrow: jest.fn((key) => {
        const values = {
          JWT_ACCESS_SECRET: 'access-secret',
          JWT_REFRESH_SECRET: 'refresh-secret',
          JWT_ACCESS_EXPIRES_IN: '15m',
          JWT_REFRESH_EXPIRES_IN: '7d',
        };

        return values[key];
      }),
    };


    const module: TestingModule = await Test.createTestingModule({
      providers:[
        AuthService,
        {
          provide:getModelToken('User'),
          useValue:userModel,
        },
        {
          provide:JwtService,
          useValue:jwtService,
        },
        {
          provide:ConfigService,
          useValue:configService,
        }
      ]
    }).compile();


    service = module.get<AuthService>(AuthService);

  });


  it('should be defined',()=>{
    expect(service).toBeDefined();
  });



  describe('register()',()=>{

    it('should register a new user', async()=>{

      userModel.findOne.mockResolvedValue(null);

       (bcrypt.hash as jest.Mock)
    .mockResolvedValue('hashed-password');


      userModel.create.mockResolvedValue({
        _id:'user123',
        email:'test@test.com'
      });


      userModel.findById.mockResolvedValue({
        _id:'user123',
        email:'test@test.com'
      });



      const result = await service.register({
        email:'test@test.com',
        password:'password123'
      });



      expect(userModel.create).toHaveBeenCalled();
      expect(result?.email).toBe('test@test.com');

    });



    it('should throw error if email already exists',async()=>{

      userModel.findOne.mockResolvedValue({
        email:'test@test.com'
      });


      await expect(
        service.register({
          email:'test@test.com',
          password:'password123'
        })
      )
      .rejects
      .toThrow(ConflictException);


    });

  });



  describe('login()',()=>{


    it('should login user successfully', async()=>{


      const user = {
        _id:'user123',
        email:'test@test.com',
        role:'user',
        password:'hashedpassword'
      };


      userModel.findOne.mockReturnValue({
        select:jest.fn().mockResolvedValue(user)
      });



      (bcrypt.compare as jest.Mock).mockResolvedValue(true);



      jwtService.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');



      userModel.findByIdAndUpdate.mockResolvedValue(true);



      const result = await service.login({
        email:'test@test.com',
        password:'password123'
      });



      expect(result).toEqual({
        access_token:'access-token',
        refresh_token:'refresh-token'
      });


      expect(userModel.findByIdAndUpdate)
      .toHaveBeenCalled();


    });



    it('should reject invalid credentials', async()=>{


      userModel.findOne.mockReturnValue({
        select:jest.fn().mockResolvedValue(null)
      });



      await expect(
        service.login({
          email:'wrong@test.com',
          password:'password123'
        })
      )
      .rejects
      .toThrow(UnauthorizedException);


    });



  });



  describe('refreshToken()',()=>{


    it('should return new access token',async()=>{


      const user = {
        _id:'user123',
        email:'test@test.com',
        role:'user',
        refreshTokenHash:'hashed'
      };


      jwtService.verify.mockReturnValue({
        sub:'user123'
      });


      userModel.findById.mockReturnValue({
        select:jest.fn().mockResolvedValue(user)
      });


      (bcrypt.compare as jest.Mock).mockResolvedValue(true);



      jwtService.signAsync.mockResolvedValue('new-access-token');



      const result = await service.refreshToken({
        refresh_token:'valid-refresh-token'
      });



      expect(result).toEqual({
        access_token:'new-access-token'
      });


    });



    it('should reject invalid refresh token',async()=>{


      jwtService.verify.mockImplementation(()=>{
        throw new Error();
      });



      await expect(
        service.refreshToken({
          refresh_token:'bad-token'
        })
      )
      .rejects
      .toThrow(UnauthorizedException);


    });



  });



  describe('logout()',()=>{


    it('should invalidate refresh token',async()=>{


      userModel.findByIdAndUpdate.mockResolvedValue(true);



      const result = await service.logout('user123');



      expect(userModel.findByIdAndUpdate)
      .toHaveBeenCalledWith(
        'user123',
        {refreshTokenHash:null}
      );


      expect(result.message)
      .toBe('Logged out successfully');


    });


  });


});