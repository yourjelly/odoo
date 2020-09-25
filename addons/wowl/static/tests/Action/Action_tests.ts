import { Action } from "../../src/components/Action/Action";
import * as QUnit from "qunit";
import { makeTestEnv } from "../test_env";
import { mount } from "../helpers";

let target: HTMLElement;
QUnit.module("Action", {
  beforeEach() {
    target = document.querySelector("#qunit-fixture") as HTMLElement;
  },
});

QUnit.test("can be rendered", async (assert) => {
  assert.expect(1);
  const env = await makeTestEnv();
  await mount(Action, { env, target });

  assert.strictEqual(target.innerText, "Hello Action");
});
