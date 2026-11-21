'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { validateCheckInput } from '@/lib/check-input';
import { getDataSource } from '@/lib/data-source';

export default function CheckPage() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [iWroteThis, setIWroteThis] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const handleSubmit = async () => {
    setErrorMessage(null);
    setSubmitError(false);

    const validation = validateCheckInput(text);
    if (!validation.ok) {
      setErrorMessage(validation.message);
      return;
    }

    setIsSubmitting(true);
    try {
      const dataSource = getDataSource();
      const result = await dataSource.submitCheck({
        text: validation.value,
        iWroteThis,
      });
      router.push(`/report/${result.reportId}`);
    } catch {
      setSubmitError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <div className="mesh min-h-[calc(100vh-64px)] py-12 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-light text-ink tracking-tight">
            Check a post, headline or link
          </h1>
          <p className="text-ink-secondary text-lg font-light mt-3">
            Paste it below. We find the claims and show the proof from trusted Sources.
          </p>
        </div>

        <div className="bg-canvas rounded-xl shadow-float border border-hairline p-6 sm:p-8 mt-8">
          <label htmlFor="check-input" className="text-sm font-medium text-ink mb-2 block">
            Text or link
          </label>
          <textarea
            id="check-input"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (errorMessage) setErrorMessage(null);
              if (submitError) setSubmitError(false);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Paste a post, a headline, an article or a link"
            aria-invalid={Boolean(errorMessage)}
            aria-describedby={errorMessage ? 'check-error' : undefined}
            className="min-h-[160px] w-full rounded-lg border border-hairline-input p-4 text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-primary-soft bg-canvas resize-y font-normal"
          />

          {errorMessage && (
            <p id="check-error" role="alert" className="text-ink text-sm mt-2 font-medium">
              {errorMessage}
            </p>
          )}

          <div className="flex items-center justify-between mt-6 pt-6 border-t border-hairline">
            <div>
              <span id="author-switch-label" className="text-sm font-medium text-ink block">
                I wrote this
              </span>
              <span className="text-xs text-ink-mute">
                We will also list what to fix.
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={iWroteThis}
              aria-labelledby="author-switch-label"
              onClick={() => setIWroteThis(!iWroteThis)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-pill border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-soft ${
                iWroteThis ? 'bg-primary' : 'bg-ink-mute'
              }`}
            >
              <span className="sr-only">I wrote this</span>
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-pill bg-canvas shadow ring-0 transition duration-200 ease-in-out ${
                  iWroteThis ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="mt-8 flex flex-col items-center">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleSubmit()}
              className="w-full sm:w-auto min-w-[160px] rounded-pill bg-primary hover:bg-primary-deep text-on-primary px-8 py-3 font-medium transition-colors disabled:opacity-60 text-sm focus:outline-none focus:ring-2 focus:ring-primary-soft"
            >
              {isSubmitting ? 'Checking' : 'Check this'}
            </button>
            <p className="text-xs text-ink-mute mt-4">
              Only 8 trusted Sources count as proof.
            </p>
          </div>

          {submitError && (
            <div
              role="alert"
              className="mt-6 p-4 rounded-lg bg-canvas-soft border border-hairline text-center"
            >
              <h2 className="text-base font-medium text-ink">
                We could not finish this check
              </h2>
              <p className="text-sm text-ink-secondary mt-1">
                We could not send it. Nothing was checked.
              </p>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                className="mt-3 rounded-pill border border-hairline-input bg-canvas px-4 py-1.5 text-xs font-medium text-ink hover:border-primary-soft transition-colors focus:outline-none focus:ring-2 focus:ring-primary-soft"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
