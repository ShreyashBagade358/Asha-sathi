import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

export interface ASHAInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  errorText?: string;
  prefixIcon?: ReactNode;
}

export const ASHAInput = forwardRef<HTMLInputElement, ASHAInputProps>(
  function ASHAInput(
    { label, errorText, prefixIcon, className, id, ...rest },
    ref
  ) {
    const autoId = useId();
    const inputId = id ?? autoId;
    const errorId = `${inputId}-error`;
    const hasError = Boolean(errorText);

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[16px] leading-6 text-onSurface"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {prefixIcon && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-onSurfaceVariant"
            >
              {prefixIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={hasError || undefined}
            aria-describedby={hasError ? errorId : undefined}
            className={[
              'w-full rounded-lg border border-outline bg-surfaceContainerLowest px-4 py-3 text-[16px] leading-6 text-onSurface placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none',
              prefixIcon ? 'pl-10' : '',
              hasError ? 'border-error focus:border-error focus:ring-error/30' : '',
              className ?? ''
            ].join(' ')}
            {...rest}
          />
        </div>
        {hasError && (
          <p id={errorId} className="text-[12px] leading-4 text-error">
            {errorText}
          </p>
        )}
      </div>
    );
  }
);
