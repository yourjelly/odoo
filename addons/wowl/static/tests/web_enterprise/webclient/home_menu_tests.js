/** @odoo-module **/
import { homeMenuService } from "@wowl/web_enterprise/webclient/home_menu/home_menu_service";
import { menusService } from "@wowl/services/menus";
import { modelService } from "@wowl/services/model";
import { Registry } from "@wowl/core/registry";
import testUtils from "web.test_utils";
import { getFixture, makeTestEnv, mount } from "../../helpers/utility";
import { makeFakeUIService, makeFakeRouterService } from "../../helpers/mocks";

const { core } = owl;
const { EventBus } = core;
const patchDate = testUtils.mock.patchDate;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

async function toggleHomeMenu(env) {
  await env.services.home_menu.toggle();
  return testUtils.nextTick();
}

async function createHomeMenu(testConfig) {
  const env = await makeTestEnv(testConfig);
  const HMWrap = odoo.mainComponentRegistry.get("HomeMenu");
  const homeMenu = await mount(HMWrap, { env });
  await toggleHomeMenu(env);
  return homeMenu;
}

async function walkOn(assert, homeMenu, path) {
  for (const step of path) {
    await testUtils.dom.triggerEvent(window, "keydown", {
      key: step.key,
      shiftKey: step.shiftKey,
    });
    assert.hasClass(
      homeMenu.el.querySelectorAll(".o_menuitem")[step.index],
      "o_focused",
      `step ${step.number}`
    );
  }
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

let testConfig;
let bus;
QUnit.module(
  "web_enterprise",
  {
    beforeEach: function () {
      const menus = {
        root: {
          id: "root",
          children: [1, 2, 3],
          name: "root",
          appID: false,
          actionID: false,
        },
        1: {
          id: 1,
          children: [],
          name: "Discuss",
          appID: 1,
          actionID: 1,
          webIcon: false,
          xmlid: "app.1",
        },
        2: {
          id: 2,
          children: [],
          name: "Calendar",
          appID: 2,
          actionID: 2,
          webIcon: false,
          xmlid: "app.2",
        },
        3: {
          id: 3,
          children: [4, 5],
          name: "Contacts",
          appID: 3,
          actionID: 4,
          webIcon: false,
          xmlid: "app.3",
        },
        4: {
          id: 4,
          children: [],
          name: "Contacts",
          appID: 3,
          actionID: 4,
          webIcon: false,
          xmlid: "menu.4",
        },
        5: {
          id: 5,
          children: [6, 7, 8],
          name: "Configuration",
          appID: 3,
          actionID: 5,
          webIcon: false,
          xmlid: "menu.5",
        },
        6: {
          id: 6,
          children: [],
          name: "Contact Tags",
          appID: 3,
          actionID: 6,
          webIcon: false,
          xmlid: "menu.6",
        },
        7: {
          id: 7,
          children: [],
          name: "Contact Titles",
          appID: 3,
          actionID: 7,
          webIcon: false,
          xmlid: "menu.7",
        },
        8: {
          id: 8,
          children: [9, 10],
          name: "Localization",
          appID: 3,
          actionID: 8,
          webIcon: false,
          xmlid: "menu.8",
        },
        9: {
          id: 9,
          children: [],
          name: "Countries",
          appID: 3,
          actionID: 9,
          webIcon: false,
          xmlid: "menu.9",
        },
        10: {
          id: 10,
          children: [],
          name: "Fed. States",
          appID: 3,
          actionID: 10,
          webIcon: false,
          xmlid: "menu.10",
        },
      };
      const serverData = { menus };

      const serviceRegistry = new Registry();
      const fakeEnterpriseService = {
        name: "enterprise",
        deploy() {
          return {
            expirationDate: false,
            expirationReason: false,
            moduleList: [],
            warning: false,
          };
        },
      };
      bus = new EventBus();
      const fakeActionManagerService = {
        name: "action_manager",
        deploy(env) {
          return {
            doAction(action, options) {
              bus.trigger("do_action", { action, options });
            },
            async restore() {
              env.bus.trigger("ACTION_MANAGER:UI-UPDATED", "current");
            },
          };
        },
      };
      serviceRegistry.add(fakeEnterpriseService.name, fakeEnterpriseService);
      serviceRegistry.add(fakeActionManagerService.name, fakeActionManagerService);
      serviceRegistry.add(homeMenuService.name, homeMenuService);
      serviceRegistry.add(menusService.name, menusService);
      serviceRegistry.add("router", makeFakeRouterService());

      testConfig = {
        serverData,
        serviceRegistry,
      };
    },
  },
  function () {
    QUnit.module("HomeMenu");

    QUnit.test("ESC Support", async function (assert) {
      // crash when pressing escape with no background action (cannot restore controller)
      assert.expect(8);

      const homeMenu = await createHomeMenu(testConfig);

      assert.hasClass(homeMenu.el, "o_search_hidden", "search bar must be hidden by default");

      const searchInput = homeMenu.el.querySelector(".o_menu_search_input");
      await testUtils.fields.editInput(searchInput, "dis");

      assert.containsOnce(homeMenu.el, ".o_menuitem.o_focused");
      assert.doesNotHaveClass(
        homeMenu.el,
        "o_search_hidden",
        "search must be visible after some input"
      );

      assert.strictEqual(searchInput.value, "dis", "search bar input must contain the input text");

      await testUtils.dom.triggerEvent(window, "keydown", { key: "Escape" });
      assert.containsOnce(homeMenu.el, ".o_menuitem.o_focused");

      assert.strictEqual(searchInput.value, "", "search must have no text after ESC");

      assert.doesNotHaveClass(
        homeMenu.el,
        "o_search_hidden",
        "search must still become visible after clearing some non-empty text"
      );

      await testUtils.dom.triggerEvent(window, "keydown", { key: "Escape" });

      assert.strictEqual(homeMenu.el.innerHTML, "");

      homeMenu.destroy();
    });

    QUnit.test("Navigation and search in the home menu", async function (assert) {
      assert.expect(8);

      bus.on("do_action", null, (payload) => {
        assert.step(`do_action ${payload.action}`);
      });
      const homeMenu = await createHomeMenu(testConfig);

      const input = homeMenu.el.querySelector(".o_menu_search_input");
      await testUtils.dom.triggerEvent(input, "focus");
      await testUtils.fields.editInput(input, "a");

      assert.hasClass(homeMenu.el.querySelectorAll(".o_menuitem")[0], "o_focused");

      assert.doesNotHaveClass(
        homeMenu.el,
        "o_search_hidden",
        "search must be visible after some input"
      );

      assert.strictEqual(input.value, "a", "search bar input must contain the input text");

      const path = [
        { number: 1, key: "ArrowRight", index: 1 },
        { number: 2, key: "Tab", index: 2 },
        { number: 3, key: "ArrowUp", index: 0 },
      ];

      await walkOn(assert, homeMenu, path);

      // open first app (Calendar)
      await testUtils.dom.triggerEvent(window, "keydown", { key: "Enter" });

      assert.verifySteps(["do_action 2"]);

      homeMenu.destroy();
    });

    QUnit.test("Click on an app", async function (assert) {
      assert.expect(2);

      bus.on("do_action", null, (payload) => {
        assert.step(`do_action ${payload.action}`);
      });
      const homeMenu = await createHomeMenu(testConfig);

      await testUtils.dom.click(homeMenu.el.querySelectorAll(".o_menuitem")[0]);
      assert.verifySteps(["do_action 1"]);

      homeMenu.destroy();
    });

    QUnit.test("Click on a menu item", async function (assert) {
      assert.expect(2);

      bus.on("do_action", null, (payload) => {
        assert.step(`do_action ${payload.action}`);
      });
      const homeMenu = await createHomeMenu(testConfig);

      const input = homeMenu.el.querySelector(".o_menu_search_input");
      input.focus();

      await testUtils.fields.editInput(input, "a");

      await testUtils.dom.click(homeMenu.el.querySelectorAll(".o_menuitem")[2]);
      assert.verifySteps(["do_action 8"]);

      homeMenu.destroy();
    });

    QUnit.test("search displays matches in parents", async function (assert) {
      assert.expect(2);

      const homeMenu = await createHomeMenu(testConfig);

      const input = homeMenu.el.querySelector(".o_menu_search_input");
      input.focus();

      assert.containsN(homeMenu.el, ".o_menuitem", 3);

      await testUtils.fields.editInput(input, "Conf");

      assert.containsN(homeMenu.el, ".o_menuitem", 6);

      homeMenu.destroy();
    });

    QUnit.test("navigate to a non app item and open it", async function (assert) {
      assert.expect(5);

      bus.on("do_action", null, (payload) => {
        assert.step(`do_action ${payload.action}`);
      });
      const homeMenu = await createHomeMenu(testConfig);

      const input = homeMenu.el.querySelector(".o_menu_search_input");
      input.focus();

      assert.containsN(homeMenu.el, ".o_menuitem", 3);

      await testUtils.fields.editInput(input, "Cont");

      assert.containsN(homeMenu.el, ".o_menuitem", 8);

      // go down
      await testUtils.dom.triggerEvent(window, "keydown", { key: "ArrowDown" });

      assert.hasClass(homeMenu.el.querySelectorAll(".o_menuitem")[1], "o_focused");

      // press ENTER
      await testUtils.dom.triggerEvent(window, "keydown", { key: "Enter" });

      assert.verifySteps(["do_action 4"]);

      homeMenu.destroy();
    });

    QUnit.test("Display Expiration Panel (no module installed)", async function (assert) {
      assert.expect(3);

      const unpatchDate = patchDate(2019, 9, 10, 0, 0, 0);

      const mockedEnterpriseService = {
        name: "enterprise",
        deploy() {
          return {
            expirationDate: "2019-11-01 12:00:00",
            expirationReason: "",
            moduleList: [],
            warning: "admin",
          };
        },
      };
      let cookie = false;
      const mockedCookieService = {
        name: "cookie",
        deploy() {
          return {
            get current() {
              return cookie;
            },
            setCookie() {
              cookie = true;
            },
          };
        },
      };

      testConfig.serviceRegistry.add(mockedEnterpriseService.name, mockedEnterpriseService, true);
      testConfig.serviceRegistry.add(mockedCookieService.name, mockedCookieService);
      testConfig.serviceRegistry.add("ui", makeFakeUIService());
      testConfig.serviceRegistry.add("model", modelService);

      const homeMenu = await createHomeMenu(testConfig);

      assert.containsOnce(homeMenu.el, ".database_expiration_panel");
      assert.strictEqual(
        homeMenu.el.querySelector(".database_expiration_panel .oe_instance_register").innerText,
        "You will be able to register your database once you have installed your first app.",
        "There should be an expiration panel displayed"
      );

      // Close the expiration panel
      await testUtils.dom.click(
        homeMenu.el.querySelector(".database_expiration_panel .oe_instance_hide_panel")
      );
      assert.containsNone(homeMenu.el, ".database_expiration_panel");

      homeMenu.destroy();
      unpatchDate();
    });

    QUnit.test("Navigation (only apps, only one line)", async function (assert) {
      assert.expect(9);

      testConfig.serverData.menus = {
        root: {
          id: "root",
          children: [1, 2, 3],
          name: "root",
          appID: false,
          actionID: false,
        },
        1: {
          id: 1,
          children: [],
          name: "00",
          appID: 1,
          actionID: 120,
          webIcon: false,
          xmlid: "app.1",
        },
        2: {
          id: 2,
          children: [],
          name: "01",
          appID: 2,
          actionID: 121,
          webIcon: false,
          xmlid: "app.2",
        },
        3: {
          id: 3,
          children: [],
          name: "02",
          appID: 3,
          actionID: 122,
          webIcon: false,
          xmlid: "app.3",
        },
      };
      const homeMenu = await createHomeMenu(testConfig);

      const input = homeMenu.el.querySelector(".o_menu_search_input");
      input.focus();
      await testUtils.nextTick();
      // we make possible full navigation (i.e. also TAB management)
      await testUtils.fields.editInput(input, "0");

      // begin with focus on first app
      assert.hasClass(homeMenu.el.querySelectorAll(".o_menuitem")[0], "o_focused");

      const path = [
        { number: 1, key: "ArrowRight", index: 1 },
        { number: 2, key: "Tab", index: 2 },
        { number: 3, key: "ArrowRight", index: 0 },
        { number: 4, key: "Tab", shiftKey: true, index: 2 },
        // no movement input.selectionStart value is 1
        { number: 5, key: "ArrowLeft", index: 2 },
        // stop and modify input.selectionStart
        { number: 6, key: "ArrowLeft", index: 1 },
        { number: 7, key: "ArrowDown", index: 1 },
        { number: 8, key: "ArrowUp", index: 1 },
      ];

      await walkOn(assert, homeMenu, path.slice(0, 5));

      // allow movement to left
      input.setSelectionRange(0, 0);

      await walkOn(assert, homeMenu, path.slice(5));

      homeMenu.destroy();
    });

    QUnit.test("Navigation (only apps, two lines, one incomplete)", async function (assert) {
      assert.expect(19);

      testConfig.serverData.menus = {
        root: {
          id: "root",
          children: [1, 2, 3, 4, 5, 6, 7, 8],
          name: "root",
          appID: false,
          actionID: false,
        },
        1: {
          id: 1,
          children: [],
          name: "00",
          appID: 1,
          actionID: 121,
          webIcon: false,
          xmlid: "app.1",
        },
        2: {
          id: 2,
          children: [],
          name: "01",
          appID: 2,
          actionID: 121,
          webIcon: false,
          xmlid: "app.2",
        },
        3: {
          id: 3,
          children: [],
          name: "03",
          appID: 3,
          actionID: 121,
          webIcon: false,
          xmlid: "app.3",
        },
        4: {
          id: 4,
          children: [],
          name: "04",
          appID: 4,
          actionID: 121,
          webIcon: false,
          xmlid: "app.4",
        },
        5: {
          id: 5,
          children: [],
          name: "05",
          appID: 5,
          actionID: 121,
          webIcon: false,
          xmlid: "app.5",
        },
        6: {
          id: 6,
          children: [],
          name: "06",
          appID: 6,
          actionID: 121,
          webIcon: false,
          xmlid: "app.6",
        },
        7: {
          id: 7,
          children: [],
          name: "07",
          appID: 7,
          actionID: 121,
          webIcon: false,
          xmlid: "app.7",
        },
        8: {
          id: 8,
          children: [],
          name: "08",
          appID: 8,
          actionID: 121,
          webIcon: false,
          xmlid: "app.8",
        },
      };
      const homeMenu = await createHomeMenu(testConfig);

      const input = homeMenu.el.querySelector(".o_menu_search_input");
      input.focus();
      await testUtils.nextTick();
      // allow navigation (without TAB management)
      await testUtils.fields.editInput(input, "");

      // begin with focus on first app
      assert.hasClass(homeMenu.el.querySelectorAll(".o_menuitem")[0], "o_focused");

      const path = [
        { number: 1, key: "ArrowUp", index: 6 },
        { number: 2, key: "ArrowUp", index: 0 },
        { number: 3, key: "ArrowDown", index: 6 },
        { number: 4, key: "ArrowDown", index: 0 },
        { number: 5, key: "ArrowRight", index: 1 },
        { number: 6, key: "ArrowRight", index: 2 },
        { number: 7, key: "ArrowUp", index: 7 },
        { number: 8, key: "ArrowUp", index: 1 },
        { number: 9, key: "ArrowRight", index: 2 },
        { number: 10, key: "ArrowDown", index: 7 },
        { number: 11, key: "ArrowDown", index: 1 },
        { number: 12, key: "ArrowUp", index: 7 },
        { number: 13, key: "ArrowRight", index: 6 },
        { number: 14, key: "ArrowLeft", index: 7 },
        { number: 15, key: "ArrowUp", index: 1 },
        { number: 16, key: "ArrowLeft", index: 0 },
        { number: 17, key: "ArrowLeft", index: 5 },
        { number: 18, key: "ArrowRight", index: 0 },
      ];

      await walkOn(assert, homeMenu, path);

      homeMenu.destroy();
    });

    QUnit.test(
      "Navigation (only apps, two lines, one incomplete, no searchbar)",
      async function (assert) {
        assert.expect(19);

        testConfig.serverData.menus = {
          root: {
            id: "root",
            children: [1, 2, 3, 4, 5, 6, 7, 8],
            name: "root",
            appID: false,
            actionID: false,
          },
          1: {
            id: 1,
            children: [],
            name: "00",
            appID: 1,
            actionID: 121,
            webIcon: false,
            xmlid: "app.1",
          },
          2: {
            id: 2,
            children: [],
            name: "01",
            appID: 2,
            actionID: 121,
            webIcon: false,
            xmlid: "app.2",
          },
          3: {
            id: 3,
            children: [],
            name: "03",
            appID: 3,
            actionID: 121,
            webIcon: false,
            xmlid: "app.3",
          },
          4: {
            id: 4,
            children: [],
            name: "04",
            appID: 4,
            actionID: 121,
            webIcon: false,
            xmlid: "app.4",
          },
          5: {
            id: 5,
            children: [],
            name: "05",
            appID: 5,
            actionID: 121,
            webIcon: false,
            xmlid: "app.5",
          },
          6: {
            id: 6,
            children: [],
            name: "06",
            appID: 6,
            actionID: 121,
            webIcon: false,
            xmlid: "app.6",
          },
          7: {
            id: 7,
            children: [],
            name: "07",
            appID: 7,
            actionID: 121,
            webIcon: false,
            xmlid: "app.7",
          },
          8: {
            id: 8,
            children: [],
            name: "08",
            appID: 8,
            actionID: 121,
            webIcon: false,
            xmlid: "app.8",
          },
        };
        const homeMenu = await createHomeMenu(testConfig);

        async function walkOnButCheckFocus(path) {
          for (let i = 0; i < path.length; i++) {
            const step = path[i];
            await testUtils.dom.triggerEvent(window, "keydown", {
              key: step.key,
              shiftKey: step.shiftKey,
            });
            assert.ok(
              homeMenu.el.querySelectorAll(".o_menuitem")[step.index] === document.activeElement,
              `step ${i + 1}`
            );
          }
        }

        const path = [
          { number: 1, key: "ArrowRight", index: 0 },
          { number: 2, key: "ArrowUp", index: 6 },
          { number: 3, key: "ArrowUp", index: 0 },
          { number: 4, key: "ArrowDown", index: 6 },
          { number: 5, key: "ArrowDown", index: 0 },
          { number: 6, key: "ArrowRight", index: 1 },
          { number: 7, key: "ArrowRight", index: 2 },
          { number: 8, key: "ArrowUp", index: 7 },
          { number: 9, key: "ArrowUp", index: 1 },
          { number: 10, key: "ArrowRight", index: 2 },
          { number: 11, key: "ArrowDown", index: 7 },
          { number: 12, key: "ArrowDown", index: 1 },
          { number: 13, key: "ArrowUp", index: 7 },
          { number: 14, key: "ArrowRight", index: 6 },
          { number: 15, key: "ArrowLeft", index: 7 },
          { number: 16, key: "ArrowUp", index: 1 },
          { number: 17, key: "ArrowLeft", index: 0 },
          { number: 18, key: "ArrowLeft", index: 5 },
          { number: 19, key: "ArrowRight", index: 0 },
        ];

        await walkOnButCheckFocus(path);

        homeMenu.destroy();
      }
    );

    QUnit.test("Navigation (only 3 menuItems)", async function (assert) {
      assert.expect(10);

      testConfig.serverData.menus = {
        root: { id: "root", children: [1], name: "root", appID: false, actionID: false },
        1: { id: 1, children: [2, 3, 4], name: "app", appID: 1, actionID: false },
        2: {
          id: 2,
          children: [],
          name: "00",
          appID: 1,
          actionID: 2,
          webIcon: false,
          xmlid: "menu.0",
        },
        3: {
          id: 3,
          children: [],
          name: "01",
          appID: 1,
          actionID: 3,
          webIcon: false,
          xmlid: "menu.1",
        },
        4: {
          id: 4,
          children: [],
          name: "02",
          appID: 1,
          actionID: 4,
          webIcon: false,
          xmlid: "menu.2",
        },
      };
      const homeMenu = await createHomeMenu(testConfig);

      const input = homeMenu.el.querySelector(".o_menu_search_input");
      input.focus();
      await testUtils.nextTick();
      // allow navigation (without TAB management)
      await testUtils.fields.editInput(input, "0");

      // begin with focus on first app
      assert.hasClass(homeMenu.el.querySelectorAll(".o_menuitem")[0], "o_focused");

      const path = [
        { number: 1, key: "ArrowUp", index: 2 },
        { number: 2, key: "ArrowUp", index: 1 },
        { number: 3, key: "ArrowUp", index: 0 },
        { number: 4, key: "ArrowDown", index: 1 },
        { number: 5, key: "ArrowDown", index: 2 },
        { number: 6, key: "ArrowDown", index: 0 },
        { number: 7, key: "ArrowRight", index: 0 },
        // no movement here because of input.selectionStart value
        { number: 8, key: "ArrowLeft", index: 0 },
        // no movement here because the item is the only one on its line
        { number: 9, key: "ArrowLeft", index: 0 },
      ];

      await walkOn(assert, homeMenu, path.slice(0, 8));
      // modify position of 'cursor' in query to allow movement to the left
      input.setSelectionRange(0, 0);

      await walkOn(assert, homeMenu, path.slice(8));

      homeMenu.destroy();
    });

    QUnit.test("Navigation (one line of 3 apps and 2 menuItems)", async function (assert) {
      assert.expect(13);

      testConfig.serverData.menus = {
        root: {
          id: "root",
          children: [1, 2, 3],
          name: "root",
          appID: false,
          actionID: false,
        },
        1: {
          id: 1,
          children: [4, 5],
          name: "00",
          appID: 1,
          actionID: 120,
          webIcon: false,
          xmlid: "app.1",
        },
        2: {
          id: 2,
          children: [],
          name: "01",
          appID: 2,
          actionID: 121,
          webIcon: false,
          xmlid: "app.2",
        },
        3: {
          id: 3,
          children: [],
          name: "02",
          appID: 3,
          actionID: 122,
          webIcon: false,
          xmlid: "app.3",
        },
        4: {
          id: 4,
          children: [],
          name: "01",
          appID: 1,
          actionID: 120,
          webIcon: false,
          xmlid: "menu.0",
        },
        5: {
          id: 5,
          children: [],
          name: "02",
          appID: 1,
          actionID: 121,
          webIcon: false,
          xmlid: "menu.1",
        },
      };

      const homeMenu = await createHomeMenu(testConfig);

      const input = homeMenu.el.querySelector(".o_menu_search_input");
      input.focus();
      await testUtils.nextTick();
      // allow navigation (without TAB management)
      await testUtils.fields.editInput(input, "0");

      // begin with focus on first app
      assert.hasClass(homeMenu.el.querySelectorAll(".o_menuitem")[0], "o_focused");

      const path = [
        { number: 1, key: "ArrowRight", index: 1 },
        { number: 2, key: "ArrowRight", index: 2 },
        { number: 3, key: "ArrowRight", index: 0 },
        { number: 4, key: "ArrowDown", index: 3 },
        { number: 5, key: "ArrowDown", index: 4 },
        { number: 6, key: "ArrowDown", index: 0 },
        { number: 7, key: "ArrowRight", index: 1 },
        { number: 8, key: "ArrowUp", index: 4 },
        { number: 9, key: "ArrowUp", index: 3 },
        { number: 10, key: "ArrowUp", index: 0 },
        // no movement here because of input.selectionStart value
        { number: 11, key: "ArrowLeft", index: 0 },
        { number: 12, key: "ArrowLeft", index: 2 },
      ];

      await walkOn(assert, homeMenu, path.slice(0, 11));
      // modify position of 'cursor' in query to allow movement to the left
      input.setSelectionRange(0, 0);

      await walkOn(assert, homeMenu, path.slice(11));

      homeMenu.destroy();
    });

    QUnit.test("State reset", async function (assert) {
      assert.expect(7);

      const homeMenu = await createHomeMenu(testConfig);

      let input = homeMenu.el.querySelector(".o_menu_search_input");

      assert.hasClass(homeMenu.el, "o_search_hidden", "search bar must be hidden by default");

      await testUtils.fields.editInput(input, "dis");

      assert.doesNotHaveClass(
        homeMenu.el,
        "o_search_hidden",
        "search must be visible after some input"
      );
      assert.strictEqual(input.value, "dis", "search bar input must contain the input text");

      await toggleHomeMenu(homeMenu.env);

      assert.strictEqual(homeMenu.el.innerHTML, "", "home menu should no longer be displayed");

      await toggleHomeMenu(homeMenu.env);

      input = homeMenu.el.querySelector(".o_menu_search_input");
      assert.hasClass(homeMenu.el, "o_search_hidden", "search bar is hidden after remount");
      assert.strictEqual(input.value, "", "search bar input must be empty");

      await testUtils.fields.editInput(input, "dis");

      assert.strictEqual(input.value, "dis", "search bar input must contain the input text");

      homeMenu.destroy();
    });

    QUnit.test("Scroll bar padding", async function (assert) {
      assert.expect(3);

      const target = getFixture();
      target.style.height = "300px";

      const homeMenu = await createHomeMenu(testConfig);

      const scrollable = document.querySelector(".o_home_menu_scrollable");
      const input = document.querySelector(".o_menu_search_input");

      function getPaddingLeft() {
        return Number(scrollable.style.paddingLeft.split("px")[0]);
      }

      assert.strictEqual(getPaddingLeft(), 0);

      await testUtils.dom.triggerEvent(input, "focus");
      await testUtils.fields.editInput(input, "a");

      assert.ok(getPaddingLeft() > 0); // Browser dependant

      await testUtils.dom.triggerEvent(window, "keydown", { key: "Escape" });

      assert.strictEqual(getPaddingLeft(), 0);

      homeMenu.destroy();
    });
  }
);
