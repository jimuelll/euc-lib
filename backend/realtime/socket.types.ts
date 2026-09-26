export interface SocketLike {
  readonly readyState: number;
  readonly OPEN: number;
  send(data: string): void;
  close(code?: number, data?: string): void;
  on(event: "close", listener: () => void): this;
}

export interface AuthenticatedUser {
  id: number;
  role: string;
  [key: string]: unknown;
}

export interface AuthenticatedSocket extends SocketLike {
  user?: AuthenticatedUser;
}
