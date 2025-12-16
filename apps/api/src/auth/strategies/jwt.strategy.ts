import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayloadDto } from 'src/_generated/zod/pfd-dtos';
import { ConfigService } from 'src/config/config.service';

import { PrismaService } from '../../db/prisma.service';

type RequestWithCookies = Request & {
  cookies: {
    token?: string;
  };
};

const cookieExtractor = (req: RequestWithCookies): string | null => {
  return req.cookies.token ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {
    const secretOrKey = configService.jwtSecret;
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey,
    });
  }

  async validate({ sub }: JwtPayloadDto) {
    const user = await this.prismaService.user.findUnique({
      where: { id: sub },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
