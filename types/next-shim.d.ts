// Minimal fallbacks so `tsc --noEmit` passes in environments without Next.js types.
declare module "next" {
  export type Metadata = Record<string, unknown>;
  export interface NextConfig {
    [key: string]: unknown;
  }
}

declare module "next/dynamic" {
  import type { ComponentType } from "react";

  export interface DynamicOptions<P = Record<string, unknown>> {
    ssr?: boolean;
    loading?: ComponentType<P>;
  }

  export default function dynamic<P extends Record<string, unknown> = Record<string, unknown>>(
    loader: () => Promise<{ default: ComponentType<P> }> | Promise<ComponentType<P>>,
    options?: DynamicOptions<P>
  ): ComponentType<P>;
}

declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_BACKEND_URL?: string;
    NEXT_PUBLIC_WS_SERVER?: string;
    NEXT_PUBLIC_EXIT_URL?: string;
  }

  interface Process {
    env: ProcessEnv;
  }
}

declare const process: NodeJS.Process;
