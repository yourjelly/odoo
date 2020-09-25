import * as owl from "@odoo/owl";
import { Env } from "@odoo/owl/dist/types/component/component";
import { OdooEnv, Services } from "../src/env";

let templates: string;
let browser: Env["browser"];

const templatesUrl = `/wowl/templates/${new Date().getTime()}`;

export async function makeTestEnv(): Promise<OdooEnv> {
  const qweb = new owl.QWeb();
  if (!templates) {
    templates = await owl.utils.loadFile(templatesUrl);
  }
  if (!browser) {
    const c = new owl.Component();
    const baseEnv = c.env;
    browser = baseEnv.browser;
  }
  qweb.addTemplates(templates);
  const services: Services = {
    rpc: () => {
      throw new Error("not implemented yet");
    },
  };
  const env = {
    browser,
    qweb,
    services,
  };
  return env;
}
