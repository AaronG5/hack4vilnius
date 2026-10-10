/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" serves the API from the MSW mocks instead of the Django backend. */
  readonly VITE_API_MOCKS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
