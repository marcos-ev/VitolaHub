import { IsOptional, IsString } from 'class-validator';

export class SetPushTokenDto {
  // Nulo/omitido para o app "desregistrar" o token (ex.: logout).
  @IsOptional()
  @IsString()
  expoPushToken?: string;
}
