// import { NavBar } from "../../src/components/NavBar/NavBar";
// import * as QUnit from "qunit";
// import { mount, makeTestEnv, OdooEnv, getFixture } from "../helpers";
// import { registries } from "../../src/registries";

// let target: HTMLElement;
// let env: OdooEnv;
// let _loadMenus;
// let menus;
// QUnit.module("Navbar", {
//   beforeEach() {
//     const menusService = registries.services.menusService;
//     _loadMenus = menusService._loadMenus;
//     menus = [
//       { id: "root", children: [1], name: "root" },
//       { id: 1, children: [1], name: "App0" },
//     ];
//     menusService._loadMenus = async () => menus;

//     target = getFixture();
//     env = makeTestEnv();
//   },
// });

// QUnit.test("can be rendered", async (assert) => {
//   assert.expect(1);
//   await mount(NavBar, { env, target });
//   assert.strictEqual(target.innerText, "NavBar");
// });
