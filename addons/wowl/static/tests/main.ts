import "./WebClient/WebClient_tests";
import * as owl from "@odoo/owl";

const { whenReady, loadFile } = owl.utils;

QUnit.config.autostart = false;

(async () => {
  const templatesUrl = `/wowl/templates/tests`;
  const templates = await loadFile(templatesUrl);
  const qweb = new owl.QWeb();
  qweb.addTemplates(templates);
  owl.Component.env = { qweb };

  await whenReady();

  QUnit.start();
})();
