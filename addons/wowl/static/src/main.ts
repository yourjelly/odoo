import { WebClient } from "./components/WebClient/WebClient";
import * as owl from "@odoo/owl";

const { whenReady, loadFile } = owl.utils;

interface SessionInfo {
  templates_checksum: string;
}

interface Odoo {
  session_info: SessionInfo;
}

declare const odoo: Odoo;

(async () => {
  // Setup code
  function setup() {
    const root = new WebClient();
    root.mount(document.body);
  }

  const templatesUrl = `/wowl/templates/${odoo.session_info.templates_checksum}`;
  const templates = await loadFile(templatesUrl);
  const qweb = new owl.QWeb();
  qweb.addTemplates(templates);
  owl.Component.env = { qweb };

  return whenReady(setup);
})();
