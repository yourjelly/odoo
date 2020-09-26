import * as QUnit from "qunit";
import { WebClient } from "../../src/components/WebClient/WebClient";
import { getFixture, makeTestEnv, mount, OdooEnv } from "../helpers";

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
