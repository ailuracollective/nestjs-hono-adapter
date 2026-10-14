import { Module } from '@nestjs/common';

import { FramesController } from './sse-controller/frames.ts';
import { StreamingController } from './sse-controller/streaming.ts';

/** The module declaring the event-stream controllers. */
@Module({
  controllers: [FramesController, StreamingController],
})
class SseModule {}

export { SseModule };
export { SECOND_FRAME_DELAY } from './sse-controller/frames.ts';
export {
  FLOOD_FRAMES,
  torn,
} from './sse-controller/streaming.ts';
