import { WebClient } from "./components/WebClient/WebClient";
import { makeEnv } from "./env";
import * as owl from "@odoo/owl";
import { serviceRegistry } from "./services";
import { rpcService } from "./rpc";
import { routerService } from "./router";

const { whenReady, loadFile } = owl.utils;

interface SessionInfo {
  qweb: string;
}

interface Odoo {
  session_info: SessionInfo;
}

declare const odoo: Odoo;

(async () => {
  // load templates
  const templatesUrl = `/wowl/templates/${odoo.session_info.qweb}`;
  const templates = await loadFile(templatesUrl);

  // fill registries
  serviceRegistry.add(rpcService.name, rpcService);
  serviceRegistry.add(routerService.name, routerService);

  // prepare env
  const env = makeEnv(templates, serviceRegistry);

  // start web client
  owl.Component.env = env;
  const root = new WebClient();
  await whenReady();
  await root.mount(document.body);

  // DEBUG. Remove this someday
  (window as any).root = root;
})();
