import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Quote, Link2, MessageSquare, Heading } from 'lucide-react';
import type { ContentKind } from '@/lib/contract';
import {
  CONTENT_KIND_ORDER,
  CONTENT_KIND_LABEL,
  ICON_STROKE,
  ICON_SIZE,
} from '@/lib/vocabulary';

const KIND_ICONS: Record<ContentKind, LucideIcon> = {
  claim_or_text: Quote,
  article_link: Link2,
  social_post: MessageSquare,
  headline: Heading,
};

export interface ContentKindSelectorProps {
  value: ContentKind;
  onChange: (kind: ContentKind) => void;
  disabled?: boolean;
}

export function ContentKindSelector({
  value,
  onChange,
  disabled = false,
}: ContentKindSelectorProps) {
  return (
    <fieldset className="mb-6">
      <legend className="text-xs font-medium text-ink-secondary mb-2 block">
        What are you checking?
      </legend>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {CONTENT_KIND_ORDER.map((kind) => {
          const Icon = KIND_ICONS[kind];
          const isSelected = value === kind;
          const inputId = `content-kind-${kind}`;

          return (
            <div key={kind} className="relative">
              <input
                type="radio"
                id={inputId}
                name="content-kind"
                value={kind}
                checked={isSelected}
                disabled={disabled}
                onChange={() => onChange(kind)}
                className="sr-only peer"
              />
              <label
                htmlFor={inputId}
                className={`flex items-center gap-2 px-3 py-2 rounded-pill bg-canvas cursor-pointer select-none transition-colors motion-reduce:transition-none peer-focus-visible:ring-2 peer-focus-visible:ring-primary-soft peer-focus-visible:outline-none ${
                  disabled ? 'cursor-not-allowed opacity-60' : ''
                } ${
                  isSelected
                    ? 'border-2 border-primary text-ink font-medium shadow-sm'
                    : 'border border-hairline-input text-ink-secondary hover:text-ink hover:border-hairline-input'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`w-3.5 h-3.5 rounded-pill border flex items-center justify-center shrink-0 ${
                    isSelected ? 'border-primary' : 'border-hairline-input'
                  }`}
                >
                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-pill bg-primary" />
                  )}
                </span>
                <Icon
                  size={ICON_SIZE}
                  strokeWidth={ICON_STROKE}
                  aria-hidden="true"
                  className={`shrink-0 ${isSelected ? 'text-primary' : 'text-ink-secondary'}`}
                />
                <span className="text-xs sm:text-sm whitespace-nowrap truncate">
                  {CONTENT_KIND_LABEL[kind]}
                </span>
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

