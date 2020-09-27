export interface SessionInfo {
  qweb: string;
}

export interface Odoo {
  session_info: SessionInfo;
}

export interface Type<T> extends Function {
  new (...args: any[]): T;
}
