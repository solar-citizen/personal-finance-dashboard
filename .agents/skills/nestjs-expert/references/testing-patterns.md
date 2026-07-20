# Testing Patterns

## Unit Test Setup (mocking PrismaService, not a TypeORM repo)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';
import { MonoBankService } from './monobank.service';

describe('MonoBankService', () => {
  let service: MonoBankService;
  let prisma: { monoBankAccount: Record<string, jest.Mock> };

  beforeEach(async () => {
    const mockPrisma = {
      monoBankAccount: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonoBankService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(MonoBankService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());
});
```

## Service Tests

```typescript
describe('connectAccount', () => {
  it('creates an account when none exists yet', async () => {
    const dto = { token: 'sometoken' };
    const account = { id: '1', userId: 'u1', ...dto };

    prisma.monoBankAccount.findFirst.mockResolvedValue(null);
    prisma.monoBankAccount.create.mockResolvedValue(account);

    const result = await service.connectAccount('u1', dto);

    expect(prisma.monoBankAccount.create).toHaveBeenCalledWith({
      data: { userId: 'u1', ...dto },
    });
    expect(result).toEqual([account]);
  });

  it('throws ConflictException when account already connected', async () => {
    prisma.monoBankAccount.findFirst.mockResolvedValue({ id: '1', userId: 'u1' });
    await expect(
      service.connectAccount('u1', { token: 'sometoken' }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('getAccountById', () => {
  it('returns the account when found', async () => {
    const account = { id: '1', userId: 'u1' };
    prisma.monoBankAccount.findUnique.mockResolvedValue(account);

    const result = await service.getAccountById('1');
    expect(result).toEqual(account);
  });

  it('throws NotFoundException when missing', async () => {
    prisma.monoBankAccount.findUnique.mockResolvedValue(null);
    await expect(service.getAccountById('1')).rejects.toThrow(NotFoundException);
  });
});
```

## Controller Tests

```typescript
describe('MonoBankController', () => {
  let controller: MonoBankController;
  let service: jest.Mocked<MonoBankService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [MonoBankController],
      providers: [
        {
          provide: MonoBankService,
          useValue: {
            connectAccount: jest.fn(),
            getAccountById: jest.fn(),
          },
        },
      ],
    })
      // Global guard/pipe aren't auto-applied in a controller-only test module —
      // override them explicitly if the route under test needs to pass through.
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(MonoBankController);
    service = module.get(MonoBankService);
  });

  it('connects an account', async () => {
    const dto = { token: 'sometoken' };
    const account = { id: '1', userId: 'u1', ...dto };
    service.connectAccount.mockResolvedValue([account]);

    const result = await controller.connectAccount('u1', dto);
    expect(result).toEqual([account]);
  });
});
```

## E2E Tests

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from 'src/app.module';

describe('MonoBankController (e2e)', () => {
  let app: INestApplication;
  let cookie: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // ZodValidationPipe is already global via APP_PIPE in AppModule — no need
    // to add app.useGlobalPipes() here, unlike a class-validator setup.
    await app.init();

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'password' });

    // Auth is via httpOnly cookie, not a bearer token in the response body —
    // grab the Set-Cookie header and reuse it on subsequent requests.
    cookie = loginRes.headers['set-cookie'][0];
  });

  afterAll(() => app.close());

  it('/api/mono/accounts (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/mono/accounts')
      .set('Cookie', cookie)
      .expect(200);
  });

  it('/api/mono/:accountId (GET) - 404', () => {
    return request(app.getHttpServer())
      .get('/api/mono/nonexistent-id')
      .set('Cookie', cookie)
      .expect(404);
  });
});
```

## Mock Factory (Prisma model, not a repo)

```typescript
export const createMockPrismaModel = () => ({
  findFirst: jest.fn(),
  findUnique: jest.fn(),
  findMany: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

// usage: { provide: PrismaService, useValue: { monoBankAccount: createMockPrismaModel() } }
```

## Quick Reference

| Pattern | Use Case |
|---------|----------|
| `Test.createTestingModule()` | Create test module |
| `{ provide: PrismaService, useValue: mockPrisma }` | Mock DB access — no repository token needed |
| `.overrideGuard(JwtAuthGuard)` | Bypass the global auth guard in controller-only tests |
| `rejects.toThrow(ConflictException)` / `NotFoundException` | Assert a service throws — use the specific built-in subclass, not raw `HttpException` |
| `supertest` + `Cookie` header | E2E auth — this project uses cookie auth, not a bearer token in the response body |
