import { IsNotEmpty, IsString } from 'class-validator';

/**
 * A imagem já foi enviada ao storage pelo fluxo de upload por URL
 * pré-assinada existente (`POST /media/presign` com `folder: 'recognition'`).
 * Aqui só recebemos o `objectKey` resultante — nunca um novo mecanismo de
 * upload.
 */
export class ScanRecognitionDto {
  @IsString()
  @IsNotEmpty()
  objectKey!: string;
}
