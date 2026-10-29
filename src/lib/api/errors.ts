/** RFC 9457 problem from the backend (or the BFF), with the backend's machine-readable `code` and field errors. */
export interface Problem {
  type?: string | null;
  title?: string | null;
  status?: number | null;
  detail?: string | null;
  code?: string;
  errors?: Record<string, string[]>;
  traceId?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string[]>;
  readonly detail: string | null;

  constructor(status: number, problem: Problem | null) {
    const code = problem?.code ?? problem?.title ?? `http.${status}`;
    super(code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = problem?.errors ?? {};
    this.detail = problem?.detail ?? null;
  }

  /** First error code for a field (FluentValidation property names are camelCase). */
  field(name: string): string | undefined {
    return this.fields[name]?.[0] ?? this.fields[name.charAt(0).toUpperCase() + name.slice(1)]?.[0];
  }

  get isPlanLimit(): boolean {
    return this.status === 402;
  }
}

export async function toApiError(response: Response): Promise<ApiError> {
  const problem = (await response.json().catch(() => null)) as Problem | null;
  return new ApiError(response.status, problem);
}
