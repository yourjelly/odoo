interface CacheHashes {
  load_menus: string;
}

interface UserContext {
  lang: string;
  tz: string;
  uid: number;
}

interface UserCompanies {
  allowed_companies: [number, string][];
  current_company: [number, string];
}

export interface SessionInfo {
  cache_hashes: CacheHashes;
  user_context: UserContext;
  qweb: string;
  uid: number;
  username: string;
  is_admin: boolean;
  partner_id: number;
  user_companies: UserCompanies;
}

export interface Odoo {
  session_info: SessionInfo;
}

export interface Type<T> extends Function {
  new (...args: any[]): T;
}
