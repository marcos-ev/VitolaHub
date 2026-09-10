import { SupportTicketCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class SupportClientMetaDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  appVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  deviceModel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  osName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  osVersion?: string;
}

export class CreateSupportTicketDto {
  @IsEnum(SupportTicketCategory)
  category!: SupportTicketCategory;

  @IsString()
  @MinLength(3)
  @MaxLength(60)
  subject!: string;

  @IsString()
  @MinLength(15)
  @MaxLength(4000)
  message!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  attachmentUrls?: string[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SupportClientMetaDto)
  clientMeta?: SupportClientMetaDto;
}
