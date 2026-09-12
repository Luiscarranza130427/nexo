import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Security headers (HSTS, no-sniff, frame-ancestors, and friends).
  app.use(helmet());

  // Required to read the HttpOnly refresh cookie.
  app.use(cookieParser());

  // Credentials are enabled, so the origin must be explicit: browsers reject
  // "*" together with credentials, and accepting any origin would hand the
  // refresh cookie to whoever asked.
  app.enableCors({
    origin: configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      // Drop properties without a decorator, so a client cannot smuggle extra
      // fields into a DTO.
      whitelist: true,
      // And reject the request outright when it tries.
      forbidNonWhitelisted: true,
      // Turn plain JSON into DTO instances so @Transform and types apply.
      transform: true,
    }),
  );

  const port = Number(configService.get<string>('PORT') ?? 3001);

  await app.listen(port);
}
await bootstrap();
