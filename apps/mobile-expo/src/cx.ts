/**
 * Minimal className composer.
 *
 * NativeWind accepts className arrays at runtime, but its bundled types declare
 * `className?: string`, and a TypeScript interface merge cannot widen a property
 * that is already declared. So conditional class lists are composed here instead,
 * which keeps the call sites readable:
 *
 *   className={cx('rounded-2xl', elevated && 'shadow-card', rail && 'overflow-hidden')}
 */
export type ClassValue = string | false | null | undefined;

export function cx(...values: ClassValue[]): string {
  let out = '';
  for (const v of values) {
    if (!v) continue;
    out = out ? `${out} ${v}` : v;
  }
  return out;
}
