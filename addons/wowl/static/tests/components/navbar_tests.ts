import { NavBar } from "../../src/components/navbar/navbar";
import * as QUnit from "qunit";
import { mount, makeTestEnv, OdooEnv, getFixture } from "../helpers";
import { MenuData, menusService } from "./../../src/services/menus";
import { Registry } from "./../../src/core/registry";
import { Service } from "./../../src/services";

let target: HTMLElement;
let env: OdooEnv;
let menus: MenuData;
let services: Registry<Service>;
let browser: Partial<OdooEnv["browser"]>;

QUnit.module("Navbar", {
  async beforeEach() {
    services = new Registry();
    services.add(menusService.name, menusService);
    menus = {
      root: { id: "root", children: [1], name: "root" },
      1: { id: 1, children: [], name: "App0" },
    };
    target = getFixture();
    browser = {
      fetch: (input: any): Promise<Response> => {
        let blobBody = {};
        if (typeof input === "string" && input.includes("load_menus")) {
          blobBody = menus;
        }
        const blob = new Blob([JSON.stringify(blobBody)], { type: "application/json" });
        return Promise.resolve(new Response(blob, { status: 200 }));
      },
    };
    env = await makeTestEnv({ browser, services });
  },
});

QUnit.test("can be rendered", async (assert) => {
  assert.expect(1);
  const navbar = await mount(NavBar, { env, target });
  assert.containsOnce(navbar.el!, '.o_menu_apps a[role="menuitem"]', "1 app present");
});
