import * as owl from "@odoo/owl";
import { Env } from "@odoo/owl/dist/types/component/component";
import { Registry } from "./registry";
import { Service, Services, deployServices } from "./services";

export interface OdooEnv extends Env {
  services: Services;
}

export function makeEnv(templates: string, serviceRegistry: Registry<Service>): OdooEnv {
  const c = new owl.Component();
  const baseEnv = c.env;
  const qweb = new owl.QWeb();
  qweb.addTemplates(templates);

  const env = {
    browser: baseEnv.browser,
    qweb,
    services: {} as any,
  };

  deployServices(env, serviceRegistry);
  return env;
}
