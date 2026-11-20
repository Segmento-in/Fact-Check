import type { Verdict } from '@/lib/contract';
import {
  VERDICT_LABEL,
  VERDICT_ICON,
  VERDICT_STYLE,
  ICON_SIZE,
  ICON_SIZE_SM,
  ICON_STROKE,
} from '@/lib/vocabulary';

interface VerdictChipProps {
  verdict: Verdict;
  size?: 'sm' | 'md';
}

export function VerdictChip({ verdict, size = 'md' }: VerdictChipProps) {
  const Icon = VERDICT_ICON[verdict];
  const style = VERDICT_STYLE[verdict];
  const heightClass =
    size === 'sm' ? 'h-[24px] px-2 text-xs' : 'h-[28px] px-2.5 text-sm';
  const iconSize = size === 'sm' ? ICON_SIZE_SM : ICON_SIZE;

  return (
    <span
      data-verdict={verdict}
      className={`inline-flex items-center gap-1.5 rounded-pill border border-hairline font-medium leading-none ${style.tint} ${heightClass}`}
    >
      <Icon
        size={iconSize}
        strokeWidth={ICON_STROKE}
        aria-hidden="true"
        className={`shrink-0 ${style.icon}`}
      />
      <span className="text-ink">{VERDICT_LABEL[verdict]}</span>
    </span>
  );
}

