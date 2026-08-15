import React, { type ErrorInfo, type ReactNode } from 'react'
import { ASHAErrorScreen } from 'asha-design-system'

interface Props {
  children?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info)
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={this.handleRetry} />
    }
    return this.props.children
  }
}

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <ASHAErrorScreen
      type="serverError500"
      onPrimary={() => window.location.assign('/')}
      onSecondary={onRetry}
    />
  )
}

export { ErrorBoundary }