import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export const initSwagger = (app: INestApplication): OpenAPIObject => {
  const config = new DocumentBuilder()
    .setTitle('PFD API')
    .setDescription('API documentation')
    .setVersion('1.0')
    .addBearerAuth() // If use JWT authentication
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (_controllerKey: string, methodKey: string) =>
      methodKey,
  });

  SwaggerModule.setup('api', app, document);

  return document;
};
