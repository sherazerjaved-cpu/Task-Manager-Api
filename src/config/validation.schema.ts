import * as Joi from "joi";

export const validationSchema =Joi.object({
    NODE_ENV: Joi.string()
    .valid("development", "production", "test")
    .default("development"),

    PORT: Joi.number().default(3000),
    
    MONGODB_URI: Joi.string().required(),
    
    JWT_SECRET: Joi.string().required(),
    JWT_ACCESS_SECRET: Joi.string().required(),
    JWT_REFRESH_SECRET: Joi.string().required(),
    
    JWT_ACCESS_EXPIRES_IN: Joi.string().required(),
    JWT_REFRESH_EXPIRES_IN: Joi.string().required(),
    
    REMINDER_CRON: Joi.string().required(),
    
    SMTP_HOST: Joi.string().required(),
    SMTP_PORT: Joi.number().required(),
    SMTP_USER: Joi.string().required(),
    SMTP_PASS: Joi.string().required(),
    SMTP_FROM_EMAIL: Joi.string().email().required(),
    SMTP_FROM_NAME: Joi.string().required(),
    
    REDIS_URL: Joi.string().uri().required(),
})