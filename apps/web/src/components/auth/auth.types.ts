import { z } from 'zod';

import { LoginSchema, RegisterSchema } from '#pfd-schemas';

export type LoginFormData = z.infer<typeof LoginSchema>;

export type RegisterFormData = z.infer<typeof RegisterSchema>;
