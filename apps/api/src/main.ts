import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';
import { initSwagger } from './lib/swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const { webUrl, port } = app.get<ConfigService>(ConfigService);

  app.enableCors({
    credentials: true,
    origin: [webUrl],
  });

  initSwagger(app);

  await app.listen(port);
}

bootstrap().catch((err: unknown) => console.error(err));
