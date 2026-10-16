import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';

import type { UploadedMultipartFile } from '#multipart/index';
import {
  AnyFilesInterceptor,
  FileFieldsInterceptor,
  FileInterceptor,
  FilesInterceptor,
  NoFilesInterceptor,
  diskStorage,
} from '#multipart/index';
import { abortDirectory, directory, GALLERY, LIMIT, MAX_FILES } from './constants.ts';
import { summarize, textOnly } from './files.ts';

@Controller()
class UploadController {
  @Post('single')
  @UseInterceptors(FileInterceptor('file'))
  public single(
    @UploadedFile() file: UploadedMultipartFile | undefined,
    @Body() body: Record<string, unknown>,
  ): unknown {
    return { body, file: summarize(file) };
  }

  @Post('many')
  @UseInterceptors(FilesInterceptor('files', MAX_FILES))
  public many(@UploadedFiles() files: UploadedMultipartFile[]): unknown {
    return { files: files.map((file) => summarize(file)) };
  }

  @Post('fields')
  @UseInterceptors(
    FileFieldsInterceptor([
      { maxCount: 1, name: 'avatar' },
      { maxCount: GALLERY, name: 'gallery' },
    ]),
  )
  public fields(@UploadedFiles() files: Record<string, UploadedMultipartFile[]>): unknown {
    const { avatar, gallery } = files;
    let first: UploadedMultipartFile | undefined = undefined;
    if (avatar !== undefined) [first] = avatar;
    let count = 0;
    if (gallery !== undefined) count = gallery.length;
    return { avatar: summarize(first), gallery: count };
  }

  @Post('any')
  @UseInterceptors(AnyFilesInterceptor())
  public any(@UploadedFiles() files: UploadedMultipartFile[]): unknown {
    return {
      count: files.length,
      names: files.map((file) => file.fieldname),
    };
  }

  @Post('none')
  @UseInterceptors(NoFilesInterceptor())
  public none(@Body() body: Record<string, unknown>): unknown {
    return { body };
  }

  @Post('limited')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: LIMIT } }))
  public limited(@UploadedFile() file: UploadedMultipartFile | undefined): unknown {
    if (file === undefined) {
      return {};
    }
    const { size } = file;
    return { size };
  }

  @Post('disk')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({ destination: directory }),
    }),
  )
  public disk(@UploadedFile() file: UploadedMultipartFile | undefined): unknown {
    if (file === undefined) {
      return { hasBuffer: false, size: 0 };
    }
    const { buffer, filename, path: target, size } = file;
    return {
      filename,
      hasBuffer: buffer !== undefined,
      path: target,
      size,
    };
  }

  @Post('aborted')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({ destination: abortDirectory }),
    }),
  )
  public aborted(@UploadedFile() file: UploadedMultipartFile | undefined): unknown {
    return { file: summarize(file) };
  }

  @Post('filtered')
  @UseInterceptors(FileInterceptor('file', { fileFilter: textOnly }))
  public filtered(@UploadedFile() file: UploadedMultipartFile | undefined): unknown {
    return {
      file: summarize(file),
      hasFile: file !== undefined,
    };
  }
}

export { UploadController };
