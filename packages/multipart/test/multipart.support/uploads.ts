import { Module } from '@nestjs/common';

import { MultipartModule } from '#multipart/index';
import { request, startProbe } from '#test/probe';
import { LIMIT } from './constants.ts';
import { UploadController } from './controller.ts';

/** The module that registers the upload controller. */
@Module({ controllers: [UploadController] })
class UploadModule {}

/** The upload module whose limits arrive from `registerAsync`. */
@Module({
  controllers: [UploadController],
  imports: [
    MultipartModule.registerAsync({
      useFactory: () => ({ limits: { fileSize: LIMIT } }),
    }),
  ],
})
class AsyncUploadModule {}

/** Sends one form to a route of a fresh application. */
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
