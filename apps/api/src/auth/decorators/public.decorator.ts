import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Marca uma rota como acessível sem token de acesso (cadastro, login, refresh,
// webhooks de pagamento). O guard global de JWT verifica este metadado.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
