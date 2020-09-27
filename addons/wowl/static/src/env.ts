import * as owl from "@odoo/owl";
import { Env } from "@odoo/owl/dist/types/component/component";
import { EventBus } from "@odoo/owl/dist/types/core/event_bus";
import type { Registries } from "./registries";
import { deployServices, Services } from "./services";

export interface OdooEnv extends Env {
  services: Services;
  registries: Registries;
  bus: EventBus;
}

export function makeEnv(templates: string, registries: Registries): OdooEnv {
  const c = new owl.Component();
  const baseEnv = c.env;
  const qweb = new owl.QWeb();
  qweb.addTemplates(templates);

  const env = {
    browser: baseEnv.browser,
    qweb,
    bus: new owl.core.EventBus(),
    registries,
    services: {} as any,
  };

  deployServices(env, registries.services);
  return env;
}
