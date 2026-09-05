import React from "react";
import { reportAppError } from "@/app/diagnostics/app-diagnostics";
import { resolveAppErrorBoundaryCopy } from "@/app/shell/services/app-error-boundary-copy";

export type AppRenderErrorReport = {
  componentStack: string;
  error: unknown;
  scope: "root" | "route";
};

type AppRenderErrorReporter = (report: AppRenderErrorReport) => void;

const defaultRenderErrorReporter: AppRenderErrorReporter = report => {
  reportAppError("Unexpected application render failure.", report.error, {
    componentStack: report.componentStack,
    scope: report.scope,
  });
};

type AppErrorBoundaryProps = React.PropsWithChildren<{
  onError?: AppRenderErrorReporter;
  onHome?: () => void;
  onLogout?: () => void;
  onReload?: () => void;
  scope: AppRenderErrorReport["scope"];
}>;

type AppErrorBoundaryState = { failed: boolean };

const recoverySurfaceStyle: React.CSSProperties = {
  alignItems: "center",
  background: "#f7f8fa",
  color: "#172033",
  display: "flex",
  justifyContent: "center",
  minHeight: "100dvh",
  padding: "2rem",
};

const recoveryCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d8deea",
  borderRadius: "1rem",
  boxShadow: "0 1rem 3rem rgba(23, 32, 51, 0.12)",
  maxWidth: "36rem",
  padding: "clamp(1.5rem, 5vw, 3rem)",
  width: "100%",
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.75rem",
  marginTop: "1.5rem",
};

const buttonStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #64748b",
  borderRadius: "0.5rem",
  color: "#172033",
  cursor: "pointer",
  font: "inherit",
  fontWeight: 600,
  minHeight: "2.75rem",
  padding: "0.625rem 1rem",
};

function goHome(): void {
  window.location.assign("/");
}

function reloadApplication(): void {
  window.location.reload();
}

export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  override state: AppErrorBoundaryState = { failed: false };

  private readonly headingRef = React.createRef<HTMLHeadingElement>();

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, errorInfo: React.ErrorInfo): void {
    (this.props.onError ?? defaultRenderErrorReporter)({
      componentStack: errorInfo.componentStack ?? "",
      error,
      scope: this.props.scope,
    });
    this.headingRef.current?.focus();
  }

  private readonly retry = (): void => {
    this.setState({ failed: false });
  };

  override render(): React.ReactNode {
    if (!this.state.failed) return this.props.children;

    const { onHome = goHome, onLogout, onReload = reloadApplication } = this.props;
    const copy = resolveAppErrorBoundaryCopy();

    return (
      <main aria-labelledby="app-recovery-title" style={recoverySurfaceStyle}>
        <section style={recoveryCardStyle}>
          <h1 id="app-recovery-title" ref={this.headingRef} tabIndex={-1}>
            {copy.heading}
          </h1>
          <p role="alert">{copy.message}</p>
          <div aria-label={copy.actions} role="group" style={actionsStyle}>
            <button onClick={this.retry} style={buttonStyle} type="button">
              {copy.retry}
            </button>
            <button onClick={onHome} style={buttonStyle} type="button">
              {copy.home}
            </button>
            <button onClick={onReload} style={buttonStyle} type="button">
              {copy.reload}
            </button>
            {onLogout ? (
              <button onClick={onLogout} style={buttonStyle} type="button">
                {copy.signOut}
              </button>
            ) : null}
          </div>
        </section>
      </main>
    );
  }
}
