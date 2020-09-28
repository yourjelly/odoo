import { Component, tags } from "@odoo/owl";
import * as QUnit from "qunit";
import { WebClient } from "../../../src/components/WebClient/WebClient";
import { Registries } from "../../../src/registries";
import { Registry } from "../../../src/core/registry";
import { getFixture, makeTestEnv, mount, OdooEnv } from "../../helpers";

const { xml } = tags;

let target: HTMLElement;
let env: OdooEnv;
QUnit.module("Web Client", {
  beforeEach() {
    target = getFixture();
    env = makeTestEnv();
  },
});

QUnit.test("can be rendered", async (assert) => {
  assert.expect(1);
  await mount(WebClient, { env, target });
  assert.strictEqual(target.innerText, "NavBar\nHello WebClient\nHello Action");
});

QUnit.test("can render a main component", async (assert) => {
  assert.expect(1);
  class MyComponent extends Component {
    static template = xml`<span class="chocolate">MyComponent</span>`;
  }

  const componentRegistry: Registries["Components"] = new Registry();
  componentRegistry.add("mycomponent", MyComponent);

  env = makeTestEnv({ Components: componentRegistry });
  await mount(WebClient, { env, target });
  assert.ok(target.querySelector(".chocolate"));
});
