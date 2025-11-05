import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const { clientUrl, port } = app.get<ConfigService>(ConfigService);

  app.enableCors({
    credentials: true,
    origin: [clientUrl],
  });

  await app.listen(port);
}
bootstrap().catch((e: unknown) => console.error(e));
