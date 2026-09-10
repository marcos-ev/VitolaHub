/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base da API (ex.: http://localhost:3000/api/v1). Em dev, o proxy Vite cobre `/api`. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
