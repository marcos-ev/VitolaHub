import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateShopReviewDto {
  @IsNumber()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  body?: string;
}
