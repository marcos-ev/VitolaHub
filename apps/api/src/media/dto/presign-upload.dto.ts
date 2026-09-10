import { IsIn, IsString } from 'class-validator';

export class PresignUploadDto {
  @IsIn(['avatars', 'posts', 'shops', 'recognition', 'support'])
  folder!: 'avatars' | 'posts' | 'shops' | 'recognition' | 'support';

  @IsString()
  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  contentType!: string;
}
