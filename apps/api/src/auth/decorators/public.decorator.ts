import { SetMetadata } from '@nestjs/common';

export const isPublicKey = 'isPublic';

export const Public = () => SetMetadata(isPublicKey, true);
