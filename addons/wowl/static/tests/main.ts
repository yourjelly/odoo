import "./Action/Action_tests";
import "./NavBar/NavBar_tests";
import "./WebClient/WebClient_tests";
import * as owl from "@odoo/owl";

const { whenReady } = owl.utils;

QUnit.config.autostart = false;

(async () => {
  await whenReady();
  QUnit.start();
})();
