import { Action } from "../../src/components/Action/Action";
import * as QUnit from "qunit";
import { mount, makeTestEnv, OdooEnv, getFixture } from "../helpers";

let target: HTMLElement;
let env: OdooEnv;

QUnit.module("Action", {
  beforeEach() {
    target = getFixture();
    env = makeTestEnv();
  },
});

QUnit.test("can be rendered", async (assert) => {
  assert.expect(1);
  await mount(Action, { env, target });
  assert.strictEqual(target.innerText, "Hello Action");
});
