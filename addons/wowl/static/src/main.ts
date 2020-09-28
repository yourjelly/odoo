import * as owl from "@odoo/owl";
import { WebClient } from "./components/webclient/webclient";
import { makeEnv } from "./env";
import { registries } from "./registries";
import { Odoo } from "./types";

const { whenReady, loadFile } = owl.utils;

declare const odoo: Odoo;

(async () => {
  // load templates
  const templatesUrl = `/wowl/templates/${odoo.session_info.qweb}`;
  const templates = await loadFile(templatesUrl);

  // prepare env
  const env = makeEnv(templates, registries);

  // start web client
  owl.Component.env = env;
  const root = new WebClient();
  await whenReady();
  await root.mount(document.body);

  // DEBUG. Remove this someday
  (window as any).root = root;
})();
