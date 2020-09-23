import { WebClient } from "./components/WebClient";
import * as owl from "@odoo/owl";

const { whenReady, loadFile } = owl.utils;

declare const qwebCheckSum: string;

(async () => {
  // Setup code
  function setup() {
    const root = new WebClient();
    root.mount(document.body);
  }

  const templatesUrl = `/wowl/templates/${qwebCheckSum}`;
  const templates = await loadFile(templatesUrl);
  const qweb = new owl.QWeb();
  qweb.addTemplates(templates);
  owl.Component.env = { qweb };

  return whenReady(setup);
})();
