export type AppDiagnosticContext = Readonly<Record<string, unknown>>;

export function reportAppError(message: string, error: unknown, context: AppDiagnosticContext = {}): void {
  console.error(message, { ...context, error });
}
