# Vitola Hub — Website

Site institucional / landing page da marca Vitola Hub.

## Desenvolvimento

Na raiz do monorepo:

```bash
npm install
npm run dev:api      # necessário para formulários de contato/fundador
npm run dev:website
```

Ou dentro desta pasta: `npm run dev`.

Abre em [http://localhost:5174](http://localhost:5174).

### Rotas

| Rota | Página |
|------|--------|
| `/` | Landing |
| `/contato` | Falar com a equipe (formulário → API) |
| `/fundador` | Programa fundador para lojas (formulário → API) |
| `/founding-member` | Redireciona para `/fundador` |

Em dev, o Vite faz proxy de `/api` → `http://localhost:3000`. Opcionalmente defina `VITE_API_URL` (ex.: `http://localhost:3000/api/v1`).

Os formulários enviam `POST /api/v1/contact` (tipos `contact` | `founding`). O e-mail vai para `vitolahub@gmail.com` (ou `CONTACT_TO_EMAIL`).

## Build

```bash
npm run build:website
```

## Notas

- Logo em `public/logo.png`.
- Links de App Store / Play ainda como “Em breve”.
