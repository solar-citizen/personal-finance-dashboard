import {
  type INestApplication,
  Injectable,
  Logger,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from 'src/@generated/prisma-client/client';

type PrismaClientWithEvents = PrismaClient & {
  $on(eventType: 'query', callback: (e: Prisma.QueryEvent) => void): void;
};

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });

    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();

    if (process.env.NODE_ENV === 'development') {
      (this as PrismaClientWithEvents).$on('query', (e: Prisma.QueryEvent) => {
        this.logger.debug(`Query: ${e.query}`);
        this.logger.debug(`Params: ${e.params}`);
        this.logger.debug(`Duration: ${e.duration}ms`);
      });
    }
  }

  enableShutdownHooks(app: INestApplication): void {
    process.on('beforeExit', () => {
      app.close().catch((e: unknown) => console.error(e));
    });
  }
}
