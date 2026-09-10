import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface RequestUser {
  id: string;
  username: string;
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestUser => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});

// Versão que devolve null em vez de lançar, para rotas que aceitam tanto
// visitante anônimo quanto autenticado (ex.: detalhe de post público).
export const OptionalCurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.user ?? null;
  },
);
