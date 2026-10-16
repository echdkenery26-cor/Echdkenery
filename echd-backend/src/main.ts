import 'dotenv/config';
import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { dirname, join } from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters';

function checkEnv() {
  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) missing.push('JWT_SECRET (32 caractères minimum)');
  if (missing.length) {
    // eslint-disable-next-line no-console
    console.error(`Configuration manquante dans .env : ${missing.join(', ')}`);
    process.exit(1);
  }
}

async function bootstrap() {
  checkEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });
  const logger = new Logger('Bootstrap');

  // Nombre de proxys devant l'API (le site Next.js compte pour 1, l'hébergeur pour 1 de plus)
  app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());

  const origins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true, maxAge: 600 });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: false,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  // Polices embarquées pour les documents imprimables (reçus, bulletins…), y compris l'arabe.
  for (const pkg of ['noto-naskh-arabic', 'figtree', 'noto-serif']) {
    try {
      const dir = join(dirname(require.resolve(`@fontsource/${pkg}/package.json`)), 'files');
      app.useStaticAssets(dir, { prefix: '/api/assets/fonts/', maxAge: '30d' });
    } catch {
      logger.warn(`Police @fontsource/${pkg} introuvable (documents : polices système utilisées)`);
    }
  }

  if (process.env.SWAGGER !== 'false') {
    const config = new DocumentBuilder()
      .setTitle('ECHD — API')
      .setDescription("Plateforme de gestion de l'école coranique")
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  }

  app.enableShutdownHooks();
  const port = Number(process.env.PORT || 4000);
  await app.listen(port, '0.0.0.0');
  logger.log(`API prête sur le port ${port} (préfixe /api)`);
}

bootstrap();
