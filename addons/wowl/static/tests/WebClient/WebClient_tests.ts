import { WebClient } from "../../src/components/WebClient/WebClient";
import * as QUnit from "qunit";
import { mount, makeTestEnv, OdooEnv } from "../helpers";

let target: HTMLElement;
let env: OdooEnv;
QUnit.module("Web Client", {
  beforeEach() {
    target = document.querySelector("#qunit-fixture") as HTMLElement;
    env = makeTestEnv();
  },
});

QUnit.test("can be rendered", async (assert) => {
  assert.expect(1);
  await mount(WebClient, { env, target });
  assert.strictEqual(target.innerText, "NavBar\nHello WebClient\nHello Action");
});
