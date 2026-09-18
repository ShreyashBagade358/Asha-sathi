interface ErrorStateProps {
  message: string
  onRetry?: () => void
}

function messageFrom(err: unknown): string {
  if (err instanceof Error) return err.message
  return 'Something went wrong while loading this data.'
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest px-6 py-14 text-center">
      <span className="material-symbols-outlined text-[36px] text-error">error_outline</span>
      <p className="max-w-md text-body-md text-on-surface-variant">{messageFrom(message)}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-label-md font-semibold text-on-primary transition-colors hover:bg-primary-hover"
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          Retry
        </button>
      )}
    </div>
  )
}

export function getErrorMessage(err: unknown): string {
  return messageFrom(err)
}