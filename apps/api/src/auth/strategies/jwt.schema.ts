import { z } from 'zod';

export const JwtPayloadSchema = z.object({
  sub: z.string(),
  email: z.email(),
});
