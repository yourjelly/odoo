import { NavBar } from "../../src/components/NavBar/NavBar";
import * as QUnit from "qunit";
import { makeTestEnv } from "../test_env";
import { mount } from "../helpers";

let target: HTMLElement;
QUnit.module("Navbar", {
  beforeEach() {
    target = document.querySelector("#qunit-fixture") as HTMLElement;
  },
});

QUnit.test("can be rendered", async (assert) => {
  assert.expect(1);
  const env = await makeTestEnv();
  await mount(NavBar, { env, target });
  assert.strictEqual(target.innerText, "NavBar");
});
