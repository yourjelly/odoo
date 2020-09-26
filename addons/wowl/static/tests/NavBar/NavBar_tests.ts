import { NavBar } from "../../src/components/NavBar/NavBar";
import * as QUnit from "qunit";
import { mount, makeTestEnv, OdooEnv, getFixture } from "../helpers";

let target: HTMLElement;
let env: OdooEnv;

QUnit.module("Navbar", {
  beforeEach() {
    target = getFixture();
    env = makeTestEnv();
  },
});

QUnit.test("can be rendered", async (assert) => {
  assert.expect(1);
  await mount(NavBar, { env, target });
  assert.strictEqual(target.innerText, "NavBar");
});
