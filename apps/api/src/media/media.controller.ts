import { Body, Controller, Post } from '@nestjs/common';
import { MediaService } from './media.service';
import { PresignUploadDto } from './dto/presign-upload.dto';

@Controller({ path: 'media', version: '1' })
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('presign')
  presign(@Body() dto: PresignUploadDto) {
    return this.mediaService.createPresignedUpload(dto.folder, dto.contentType);
  }
}
