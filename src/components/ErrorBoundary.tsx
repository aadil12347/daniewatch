import React from "react";
import { Button } from "@/components/ui/button";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error?: unknown;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  private autoRecoveredOnce = false;
  private autoRecoverTimer: number | null = null;

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // This will show up in Lovable console logs.
    console.error("[ErrorBoundary] Unhandled render error", error, info);

    // If this is a transient first-render issue (common around auth/admin),
    // automatically do what the user was manually doing via "Try again" once.
    if (!this.autoRecoveredOnce) {
      this.autoRecoveredOnce = true;
      if (this.autoRecoverTimer) window.clearTimeout(this.autoRecoverTimer);
      this.autoRecoverTimer = window.setTimeout(() => {
        this.setState({ hasError: false, error: undefined });
      }, 50);
    }
  }

  componentWillUnmount() {
    if (this.autoRecoverTimer) window.clearTimeout(this.autoRecoverTimer);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The app hit an error while rendering (this is why you were seeing a blank screen). Please reload. If it keeps
            happening, we can inspect the logged error.
          </p>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => window.location.reload()}>Reload</Button>
            <Button
              variant="outline"
              onClick={() => {
                this.setState({ hasError: false, error: undefined });
              }}
            >
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
