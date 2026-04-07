import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

export const R2_CLIENT = 'R2_CLIENT';

export const r2ClientProvider = {
  provide: R2_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    return new S3Client({
      region: 'auto',
      endpoint: config.getOrThrow<string>('R2_ENDPOINT'),
      credentials: {
        accessKeyId: config.getOrThrow<string>('R2_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow<string>('R2_SECRET_ACCESS_KEY'),
      },
    });
  },
};
