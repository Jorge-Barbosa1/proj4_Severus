// Design tokens for FireAnalyst — dark ops-grade palette with fire accents.
// Derived from UI UX Pro Max skill output (Real-Time Ops pattern, Dark Mode style),
// tuned for a wildfire analyst tool (fire-orange CTAs, neutral slate chrome).

export const color = {
  // Backgrounds
  bgRoot:    '#0b1220',
  bgPanel:   '#111827',
  bgRaised:  '#1e293b',
  bgHover:   '#334155',
  bgInput:   '#1e293b',

  // Borders
  border:     '#1f2937',
  borderSoft: '#334155',
  borderHover:'#475569',

  // Text
  text:       '#f1f5f9',
  textMuted:  '#94a3b8',
  textFaint:  '#64748b',

  // Accents
  primary:       '#f97316', // fire orange — primary CTA
  primaryHover:  '#ea580c',
  primaryText:   '#0b1220',

  accent:        '#38bdf8', // sky — info / secondary CTA
  accentHover:   '#0ea5e9',

  // Semantic
  success: '#10b981',
  warning: '#f59e0b',
  danger:  '#ef4444',

  // Data viz
  fireRed:   '#dc2626',
  fireDeep:  '#7f1d1d',
} as const;

export const radius = {
  sm: '6px',
  md: '8px',
  lg: '12px',
  pill: '999px',
} as const;

export const space = (n: number) => `${n * 4}px`;

export const shadow = {
  sm: '0 1px 2px rgba(0,0,0,0.25)',
  md: '0 4px 12px rgba(0,0,0,0.35)',
  lg: '0 10px 30px rgba(0,0,0,0.45)',
} as const;

export const font = {
  sans: "'Inter', ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, 'SF Mono', Consolas, monospace",
} as const;

export const transition = '180ms ease';
