import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const CONTACT_TYPES = ['contact', 'founding', 'support'] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export class CreateContactDto {
  @IsIn(CONTACT_TYPES)
  type!: ContactType;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  /** Nome fantasia / razão social da loja (fundador). */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  tradeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  whatsapp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  instagram?: string;
}
