import { Module } from '@nestjs/common';

import { MultipartModule } from '#multipart/index';
import { request, startProbe } from '#test/probe';
import { LIMIT } from './constants.ts';
import { UploadController } from './controller.ts';

@Module({ controllers: [UploadController] })
class UploadModule {}

@Module({
  controllers: [UploadController],
  imports: [
    MultipartModule.registerAsync({
      useFactory: () => ({ limits: { fileSize: LIMIT } }),
    }),
  ],
})
class AsyncUploadModule {}

const upload = async (
  route: string,
  form: FormData,
): Promise<Awaited<ReturnType<typeof request>>> => {
  const probe = await startProbe({
    mode: 'in-process',
    module: UploadModule,
  });
  try {
    return await request(probe, route, {
      body: form,
      method: 'POST',
    });
  } finally {
    await probe.close();
  }
};

export { AsyncUploadModule, UploadModule, upload };
