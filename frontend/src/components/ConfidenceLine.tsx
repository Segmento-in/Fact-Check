import type { Confidence } from '../lib/contract';
import { CONFIDENCE_LABEL } from '../lib/vocabulary';

interface ConfidenceLineProps {
  confidence: Confidence;
}

export function ConfidenceLine({ confidence }: ConfidenceLineProps) {
  return (
    <span className="text-sm text-ink-secondary">
      {CONFIDENCE_LABEL[confidence]}
    </span>
  );
}

