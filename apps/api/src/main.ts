import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';

import { initSwagger } from './_lib/swagger.config';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const { webUrl, port } = app.get<ConfigService>(ConfigService);

  app.use(cookieParser());

  app.enableCors({
    credentials: true,
    origin: [webUrl],
  });

  initSwagger(app);

  await app.listen(port);
}

bootstrap().catch((err: unknown) => console.error(err));
