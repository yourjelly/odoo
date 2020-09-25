import { WebClient } from "../../src/components/WebClient/WebClient";
import * as QUnit from "qunit";
import { makeTestEnv } from "../test_env";
import { mount } from "../helpers";

let target: HTMLElement;
QUnit.module("Web Client", {
  beforeEach() {
    target = document.querySelector("#qunit-fixture") as HTMLElement;
  },
});

QUnit.test("can be rendered", async (assert) => {
  assert.expect(1);
  const env = await makeTestEnv();
  await mount(WebClient, { env, target });
  assert.strictEqual(target.innerText, "NavBar\nHello WebClient\nHello Action");
});
