import * as owl from "@odoo/owl";
import { setTemplates } from "./helpers";

// import here every test suite files
import "./components/Action/Action_tests";
import "./components/NavBar/NavBar_tests";
import "./services_tests";
import "./services/router_tests";
import "./components/WebClient/WebClient_tests";

const { whenReady, loadFile } = owl.utils;

QUnit.config.autostart = false;

(async () => {
  const templatesUrl = `/wowl/templates/${new Date().getTime()}`;
  const templates = await loadFile(templatesUrl);
  setTemplates(templates);
  await whenReady();
  QUnit.start();
})();
