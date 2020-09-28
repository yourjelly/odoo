interface CacheHashes {
  load_menus: string;
}

export interface SessionInfo {
  cache_hashes: CacheHashes;
  qweb: string;
}

export interface Odoo {
  session_info: SessionInfo;
}

export interface Type<T> extends Function {
  new (...args: any[]): T;
}
