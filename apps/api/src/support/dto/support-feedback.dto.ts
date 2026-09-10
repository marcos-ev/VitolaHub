import { IsBoolean } from 'class-validator';

export class SupportFeedbackDto {
  @IsBoolean()
  helpful!: boolean;
}
