import { WebClient } from "./components/WebClient";
import * as owl from "@odoo/owl";

const { whenReady } = owl.utils;

// Setup code
function setup() {
  const root = new WebClient();
  root.mount(document.body);
}

whenReady(setup);
