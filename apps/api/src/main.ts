import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const { webUrl, port } = app.get<ConfigService>(ConfigService);

  app.enableCors({
    credentials: true,
    origin: [webUrl],
  });

  await app.listen(port);
}
bootstrap().catch((e: unknown) => console.error(e));
