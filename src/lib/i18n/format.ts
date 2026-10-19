/** "Còn {n} việc" + {n: 3} -> "Còn 3 việc" */
export function fmt(str: string, vars: Record<string, string | number>) {
  return str.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}
