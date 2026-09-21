"use client";

import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
};

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown): void {
    console.error("Vinylify render error:", error, info);
  }

  handleReset = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--color-bg)] px-6 text-center">
          <div className="h-16 w-16 rounded-full bg-[var(--color-surface)] flex items-center justify-center">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-vinyl-headline text-[var(--color-text-primary)]">
            Something went wrong
          </h2>
          <p className="max-w-sm text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
            Vinylify hit an unexpected error. Try reloading the page.
          </p>
          <button
            onClick={this.handleReset}
            className="rounded-full bg-[var(--color-accent)] px-6 py-3 text-[15px] font-bold text-[var(--color-text-on-accent)] transition-all duration-fast play-btn-hover"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}