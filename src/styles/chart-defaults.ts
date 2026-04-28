import { Chart as ChartJS } from 'chart.js';
import { color, font } from './theme';

let applied = false;

export function applyChartDefaults() {
  if (applied) return;
  applied = true;

  ChartJS.defaults.color = color.textMuted;
  ChartJS.defaults.font.family = font.sans;
  ChartJS.defaults.font.size = 11.5;
  ChartJS.defaults.borderColor = color.border;

  const scale = ChartJS.defaults.scale as any;
  scale.grid = {
    ...(scale.grid || {}),
    color: color.border,
    lineWidth: 1,
    drawTicks: false,
  };
  scale.border = { ...(scale.border || {}), color: color.borderSoft };
  scale.ticks = {
    ...(scale.ticks || {}),
    color: color.textMuted,
    padding: 6,
  };
  scale.title = {
    ...(scale.title || {}),
    color: color.textFaint,
    font: { size: 10.5, weight: 600 },
  };

  ChartJS.defaults.plugins.tooltip = {
    ...(ChartJS.defaults.plugins.tooltip || {}),
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    titleColor: color.text,
    bodyColor: color.text,
    borderColor: color.borderSoft,
    borderWidth: 1,
    padding: 10,
    cornerRadius: 6,
    displayColors: true,
    boxPadding: 4,
  };

  ChartJS.defaults.plugins.legend = {
    ...(ChartJS.defaults.plugins.legend || {}),
    labels: { color: color.textMuted, usePointStyle: true, pointStyle: 'line' },
  };

  ChartJS.defaults.plugins.title = {
    ...(ChartJS.defaults.plugins.title || {}),
    color: color.text,
    font: { size: 13, weight: 600 },
    padding: { top: 4, bottom: 12 },
  };
}

export function makeLineGradient(
  ctx: CanvasRenderingContext2D,
  hex: string,
  height: number,
) {
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, hexToRgba(hex, 0.35));
  g.addColorStop(1, hexToRgba(hex, 0));
  return g;
}

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const bigint = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
