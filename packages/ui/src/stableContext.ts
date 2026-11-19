import { createContext, type Context } from 'react';

/**
 * createContext that keeps ONE context object per key for the lifetime of the page.
 *
 * Why: during development, Vite hot-reloads a file that is edited. A context file that is reloaded would
 * normally create a brand-new context object while components that already imported the old module keep
 * using the old one, so the provider and its consumers stop matching and the app dies with
 * "useX must be used within a XProvider" (a white screen). Re-using the same object makes that impossible.
 * In production the module loads once, so this behaves exactly like createContext.
 */
export function createStableContext<T>(key: string, defaultValue: T): Context<T> {
  const registry = ((globalThis as Record<string, unknown>)['__poeageContexts'] ??= {}) as Record<string, Context<unknown>>;
  return (registry[key] ??= createContext<unknown>(defaultValue) as Context<unknown>) as Context<T>;
}
