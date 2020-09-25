import { WebClient } from "./components/WebClient/WebClient";
import { makeEnv } from "./env";
import * as owl from "@odoo/owl";

const { whenReady } = owl.utils;

(async () => {
  // Setup code
  function setup() {
    const root = new WebClient();
    root.mount(document.body);
  }

  owl.Component.env = await makeEnv();

  return whenReady(setup);
})();
