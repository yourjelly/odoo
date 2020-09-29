import { Component, tags } from "@odoo/owl";
import * as QUnit from "qunit";
import { WebClient } from "../../src/components/webclient/webclient";
import { Registries } from "../../src/registries";
import { Registry } from "../../src/core/registry";
import { getFixture, makeFakeUserService, makeTestEnv, mount, OdooEnv } from "../helpers";
import { Service } from "../../src/services";

const { xml } = tags;

let target: HTMLElement;
let env: OdooEnv;

QUnit.module("Web Client", {
  async beforeEach() {
    target = getFixture();
    const services: Registry<Service> = new Registry();
    services.add("user", makeFakeUserService());
    env = await makeTestEnv({ services });
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

  env = await makeTestEnv({ Components: componentRegistry });
  await mount(WebClient, { env, target });
  assert.ok(target.querySelector(".chocolate"));
});
