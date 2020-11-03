// import * as QUnit from "qunit";
// import { DebugManager } from "../../src/components/debug_manager/debug_manager";
// import { click, getFixture, makeTestEnv, mount, OdooEnv } from "../helpers/index";
// import { Registry } from "./../../src/core/registry";
// import { Service } from "./../../src/types";

// let target: HTMLElement;
// let env: OdooEnv;
// let services: Registry<Service>;
// let debugManager: DebugManager;

// QUnit.module("DebugManager", {
//   async beforeEach() {
//     services = new Registry();
//     target = getFixture();
//     env = await makeTestEnv({
//       services,
//       mockRPC(...args) {
//         if (args[0] === "/wowl/debug_manager/check_access_model") {
//           return {
//             canEditView: true,
//             canSeeRecordRules: true,
//             canSeeModelAccess: true,
//           };
//         }
//       },
//     });
//   },
//   afterEach() {
//     debugManager.unmount();
//   },
// });

// LPE FIXME
// QUnit.test("can be rendered", async (assert) => {
//   env.registries.debugManager.add("item_1", () => {
//     return {
//       name: "item_1",
//       type: "item",
//       description: "Item 1",
//       callback: () => {
//         assert.step("callback item_1");
//       },
//       sequence: 10,
//     };
//   });
//   env.registries.debugManager.add("item_2", () => {
//     return {
//       name: "item_2",
//       type: "item",
//       description: "Item 2",
//       callback: () => {
//         assert.step("callback item_2");
//       },
//       sequence: 5,
//     };
//   });
//   env.registries.debugManager.add("item_3", () => {
//     return {
//       name: "item_3",
//       type: "item",
//       description: "Item 3",
//       callback: () => {
//         assert.step("callback item_3");
//       },
//     };
//   });
//   env.registries.debugManager.add("separator", () => {
//     return {
//       name: "separator",
//       type: "separator",
//       sequence: 20,
//     };
//   });
//   env.registries.debugManager.add("separator_2", () => {
//     return {
//       name: "separator_2",
//       type: "separator",
//       sequence: 7,
//       hide: true,
//     };
//   });
//   env.registries.debugManager.add("item_4", () => {
//     return {
//       name: "item_4",
//       type: "item",
//       description: "Item 4",
//       callback: () => {
//         assert.step("callback item_4");
//       },
//       hide: true,
//       sequence: 10,
//     };
//   });
//   debugManager = await mount(DebugManager, { env, target });
//   let debugManagerEl = debugManager.el as HTMLElement;
//   await click(debugManager.el?.querySelector("button.o_dropdown_toggler") as HTMLElement);
//   debugManagerEl = debugManager.el as HTMLElement;
//   assert.containsN(debugManagerEl, "ul.o_dropdown_menu li.o_dropdown_item", 3);
//   assert.containsOnce(debugManagerEl, "div.dropdown-divider");

//   const children = [...(debugManagerEl.querySelector("ul.o_dropdown_menu")?.children || [])];
//   assert.deepEqual(
//     children.map((el) => el.tagName),
//     ["LI", "LI", "DIV", "LI"]
//   );
//   const items =
//     [...debugManagerEl.querySelectorAll("ul.o_dropdown_menu li.o_dropdown_item span")] || [];
//   assert.deepEqual(
//     items.map((el) => el.textContent),
//     ["Item 2", "Item 1", "Item 3"]
//   );
//   for (const item of items) {
//     click(item as HTMLElement);
//   }
//   assert.verifySteps(["callback item_2", "callback item_1", "callback item_3"]);
// });
