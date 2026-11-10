import { ProgressSchema, type Progress } from '../engine/progress';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(`${status} ${code}`);
  }
  /** Tarmoq yo'q / server javob bermadi (offline). */
  get offline() {
    return this.status === 0;
  }
}

export interface ClassInfo {
  name: string;
  grade: number;
  school: string;
}
export interface TeacherClass extends ClassInfo {
  id: number;
  code: string;
  rankingEnabled: boolean;
  students: number;
}
export interface ClassStats {
  class: TeacherClass;
  students: { id: string; name: string; stars: number; tasks: number; coins: number; levels: number; lastSeen: string | null }[];
  tasks: { taskId: string; players: number; avgStars: number; avgMistakes: number; avgAttempts: number; medianTimeMs: number | null }[];
  goal: { target: number; stars: number };
  ranking: { rank: number; name: string; stars: number }[] | null;
}
export interface MyClass {
  class: { name: string; grade: number };
  goal: { target: number; stars: number };
  ranking: { rank: number; name: string; stars: number }[] | null;
}

type Fetch = typeof fetch;

export function defaultApiBase(): string {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  return env?.VITE_API_URL ?? '/api';
}

export class ApiClient {
  constructor(
    public base: string = defaultApiBase(),
    public token: string | null = null,
    private fetchImpl: Fetch = (...a) => fetch(...a),
    private timeoutMs = 10_000,
  ) {}

  /** Xuddi shu server va fetch bilan, boshqa token. */
  withToken(token: string | null) {
    return new ApiClient(this.base, token, this.fetchImpl, this.timeoutMs);
  }

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), this.timeoutMs) : null;
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.base}${path}`, {
        method,
        headers: {
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ctrl?.signal,
      });
    } catch {
      throw new ApiError(0, 'network');
    } finally {
      if (timer) clearTimeout(timer);
    }
    if (res.status === 204) return undefined as T;
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      /* bo'sh javob */
    }
    if (!res.ok) throw new ApiError(res.status, (data as { error?: string } | null)?.error ?? 'error');
    return data as T;
  }

  async available(): Promise<boolean> {
    try {
      const r = await this.req<{ ok: boolean }>('GET', '/health');
      return r?.ok === true;
    } catch {
      return false;
    }
  }

  // o'quvchi
  joinInfo(code: string) {
    return this.req<{ class: ClassInfo; students: { id: string; name: string }[] }>('GET', `/join/${encodeURIComponent(code)}`);
  }
  join(input: { code: string; name?: string; studentId?: string }) {
    return this.req<{ token: string; student: { id: string; name: string; grade: number }; class: ClassInfo }>('POST', '/join', input);
  }
  async getProgress(): Promise<Progress> {
    return ProgressSchema.parse(await this.req('GET', '/me/progress'));
  }
  async putProgress(p: Progress): Promise<Progress> {
    return ProgressSchema.parse(await this.req('PUT', '/me/progress', p));
  }
  myClass() {
    return this.req<MyClass>('GET', '/me/class');
  }

  // o'qituvchi
  teacherRegister(input: { name: string; email: string; password: string; invite?: string }) {
    return this.req<{ token: string; name: string }>('POST', '/teachers/register', input);
  }
  teacherLogin(input: { email: string; password: string }) {
    return this.req<{ token: string; name: string }>('POST', '/teachers/login', input);
  }
  classes() {
    return this.req<TeacherClass[]>('GET', '/classes');
  }
  createClass(input: { name: string; grade: number; school: string }) {
    return this.req<TeacherClass>('POST', '/classes', input);
  }
  stats(id: number) {
    return this.req<ClassStats>('GET', `/classes/${id}/stats`);
  }
  setRanking(id: number, rankingEnabled: boolean) {
    return this.req<{ ok: true }>('PATCH', `/classes/${id}`, { rankingEnabled });
  }
  rotateCode(id: number) {
    return this.req<{ code: string }>('POST', `/classes/${id}/rotate-code`);
  }
  deleteStudent(classId: number, studentId: string) {
    return this.req<void>('DELETE', `/classes/${classId}/students/${studentId}`);
  }
  logout() {
    return this.req<void>('POST', '/logout');
  }
}
