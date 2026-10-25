//echd-backend/src/main.ts
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

  // Nombre de proxys devant l'API : Vercel (rewrite) + Render = 2 en production (variable TRUST_PROXY=2 sur Render).
  // Trop bas : l'IP vue est celle de Vercel et tous les visiteurs partagent le même quota. Trop haut : l'IP est falsifiable.
  const trustProxy = Number(process.env.TRUST_PROXY ?? 1);
  app.set('trust proxy', trustProxy);
  if (process.env.NODE_ENV === 'production' && !process.env.TRUST_PROXY) {
    logger.warn('TRUST_PROXY non défini : 1 proxy supposé. Derrière Vercel + Render, définissez TRUST_PROXY=2.');
  }
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

  // Documentation de l'API : visible en développement, masquée en production sauf SWAGGER=true
  const swaggerOn = process.env.SWAGGER ? process.env.SWAGGER === 'true' : process.env.NODE_ENV !== 'production';
  if (swaggerOn) {
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

  // Option pour l'hébergement gratuit qui endort le serveur après ~15 min sans visite : KEEP_ALIVE=true
  // (l'adresse publique est lue dans RENDER_EXTERNAL_URL, ou KEEP_ALIVE_URL). Inutile sur une offre payante.
  const keepAliveUrl = process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL;
  if (process.env.KEEP_ALIVE === 'true' && keepAliveUrl) {
    const target = `${keepAliveUrl.replace(/\/$/, '')}/api/health`;
    setInterval(() => {
      fetch(target).catch(() => undefined);
    }, 10 * 60_000).unref();
    logger.log(`Maintien en éveil activé : ${target} toutes les 10 min`);
  }
}

bootstrap();
