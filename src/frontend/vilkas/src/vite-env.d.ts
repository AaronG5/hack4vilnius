/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "false" disables the MSW mock API in development. */
  readonly VITE_API_MOCKS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
