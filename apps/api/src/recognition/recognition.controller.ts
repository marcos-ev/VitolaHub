import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { FeatureKey } from '@charuto/shared';
import { CurrentUser, RequestUser } from '../auth/decorators/current-user.decorator';
import { EntitlementsGuard } from '../entitlements/entitlements.guard';
import { RequireFeature } from '../entitlements/decorators/require-feature.decorator';
import { RecognitionService } from './recognition.service';
import { ScanRecognitionDto } from './dto/scan-recognition.dto';
import { ConfirmRecognitionDto } from './dto/confirm-recognition.dto';

@Controller({ path: 'recognition', version: '1' })
export class RecognitionController {
  constructor(private readonly recognitionService: RecognitionService) {}

  /**
   * Reconhecimento por foto é recurso exclusivo Premium/trial (seção 6.2):
   * "tem custo real por chamada de API".
   */
  @Post('scan')
  @UseGuards(EntitlementsGuard)
  @RequireFeature(FeatureKey.PHOTO_RECOGNITION)
  scan(@CurrentUser() user: RequestUser, @Body() dto: ScanRecognitionDto) {
    return this.recognitionService.scan(user.id, dto);
  }

  @Post(':matchId/confirm')
  confirm(
    @CurrentUser() user: RequestUser,
    @Param('matchId') matchId: string,
    @Body() dto: ConfirmRecognitionDto,
  ) {
    return this.recognitionService.confirm(user.id, matchId, dto);
  }
}
