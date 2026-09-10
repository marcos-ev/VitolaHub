import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppLogger } from './common/logger/app-logger.service';

async function bootstrap() {
  // `rawBody: true` faz o Nest guardar o corpo bruto de toda requisição em
  // `req.rawBody` (além do parsing JSON normal), necessário para validar a
  // assinatura do webhook do Stripe em `POST /billing/webhook` (a validação
  // de assinatura exige o corpo exato como veio, não o objeto já parseado).
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });

  app.useLogger(app.get(AppLogger));
  app.use(helmet());
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableCors({ origin: true, credentials: true });

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Charuto API rodando em http://localhost:${port}/api/v1`);
}

bootstrap();
