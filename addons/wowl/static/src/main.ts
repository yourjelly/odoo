import { WebClient } from "./components/WebClient/WebClient";
import { makeEnv } from "./env";
import * as owl from "@odoo/owl";

const { whenReady, loadFile } = owl.utils;

interface SessionInfo {
  qweb: string;
}

interface Odoo {
  session_info: SessionInfo;
}

declare const odoo: Odoo;

(async () => {
  const templatesUrl = `/wowl/templates/${odoo.session_info.qweb}`;
  const templates = await loadFile(templatesUrl);
  owl.Component.env = makeEnv(templates);

  const root = new WebClient();
  await whenReady();
  await root.mount(document.body);
})();
