import * as owl from "@odoo/owl";
import { Env } from "@odoo/owl/dist/types/component/component";

type RPC = () => Promise<void>;

export interface Services {
  rpc: RPC;
  [key: string]: any;
}

export type ServiceName = keyof Services;

export interface OdooEnv extends Env {
  services: Services;
}

export function makeEnv(templates: string): OdooEnv {
  const c = new owl.Component();
  const baseEnv = c.env;
  const qweb = new owl.QWeb();
  qweb.addTemplates(templates);
  const services: Services = {
    rpc: async () => console.log("this is an rpc"),
  };
  const env = {
    browser: baseEnv.browser,
    qweb,
    services,
  };
  return env;
}
