/** @odoo-module **/

import {
  getFacetTexts,
  removeFacet,
  toggleComparisonMenu,
  toggleFilterMenu,
  toggleMenuItem,
  toggleMenuItemOption,
} from "../../helpers/control_panel";
import { patchDate } from "../../helpers/utils";
import { makeFakeLocalizationService, makeFakeRouterService, makeFakeUIService, makeFakeUserService } from "../../helpers/mock_services";
import { makeWithSearch } from "./helpers";
import { ControlPanel } from "@web/views/view_utils/control_panel/control_panel";
import { serviceRegistry } from "@web/webclient/service_registry";
import { viewService} from "@web/views/view_service";
import { ormService } from "@web/services/orm_service";
import { actionService } from "@web/actions/action_service";
import { hotkeyService } from "@web/hotkeys/hotkey_service";
import { effectService } from "@web/effects/effect_service";
import { notificationService } from "@web/notifications/notification_service";

let testConfig;

QUnit.module("ComparisonMenu", (hooks) => {
  hooks.beforeEach(async () => {
    const serverData = {
      models: {
        foo: {
          fields: {
            birthday: { string: "Birthday", type: "date", store: true, sortable: true },
            date_field: { string: "Date", type: "date", store: true, sortable: true },
          },
        },
      },
      views: {
        "foo,false,search": `
          <search>
            <filter name="birthday" date="birthday"/>
            <filter name="date_field" date="date_field"/>
          </search>
        `,
      },
    };
    const fakeLocalizationService = makeFakeLocalizationService();
    const fakeUserService = makeFakeUserService();
    const fakeUIService = makeFakeUIService();
    const fakeRouterService = makeFakeRouterService();

    serviceRegistry.add("action", actionService);
    serviceRegistry.add("hotkey", hotkeyService);
    serviceRegistry.add("localization", fakeLocalizationService);
    serviceRegistry.add("orm", ormService);
    serviceRegistry.add("user", fakeUserService);
    serviceRegistry.add("view", viewService);
    serviceRegistry.add("effect", effectService);
    serviceRegistry.add("notification", notificationService);
    serviceRegistry.add("router", fakeRouterService);
    serviceRegistry.add("ui", fakeUIService);

    testConfig = { serverData, serviceRegistry };
  });

  QUnit.test("simple rendering", async function (assert) {
    assert.expect(6);
    patchDate(1997, 0, 9, 12, 0, 0);
    const controlPanel = await makeWithSearch(
      { testConfig },
      {
        modelName: "foo",
        Component: ControlPanel,
        searchMenuTypes: ["filter", "comparison"],
        loadSearchView: true,
      }
    );
    assert.containsOnce(controlPanel, ".o_dropdown.o_filter_menu");
    assert.containsNone(controlPanel, ".o_dropdown.o_comparison_menu");
    await toggleFilterMenu(controlPanel);
    await toggleMenuItem(controlPanel, "Birthday");
    await toggleMenuItemOption(controlPanel, "Birthday", "January");
    assert.containsOnce(controlPanel, "div.o_comparison_menu > button i.fa.fa-adjust");
    assert.strictEqual(
      controlPanel.el
        .querySelector("div.o_comparison_menu > button span")
        .innerText.trim()
        .toUpperCase() /** @todo why do I need to upperCase */,
      "COMPARISON"
    );
    await toggleComparisonMenu(controlPanel);
    const comparisonOptions = [...controlPanel.el.querySelectorAll(".o_comparison_menu li")];
    assert.strictEqual(comparisonOptions.length, 2);
    assert.deepEqual(
      comparisonOptions.map((e) => e.innerText.trim()),
      ["Birthday: Previous Period", "Birthday: Previous Year"]
    );
  });

  QUnit.test("activate a comparison works", async function (assert) {
    assert.expect(5);
    patchDate(1997, 0, 9, 12, 0, 0);
    const controlPanel = await makeWithSearch(
      { testConfig },
      {
        modelName: "foo",
        Component: ControlPanel,
        searchMenuTypes: ["filter", "comparison"],
        loadSearchView: true,
      }
    );
    await toggleFilterMenu(controlPanel);
    await toggleMenuItem(controlPanel, "Birthday");
    await toggleMenuItemOption(controlPanel, "Birthday", "January");
    await toggleComparisonMenu(controlPanel);
    await toggleMenuItem(controlPanel, "Birthday: Previous Period");
    assert.deepEqual(getFacetTexts(controlPanel), [
      "Birthday: January 1997",
      "Birthday: Previous Period",
    ]);
    await toggleFilterMenu(controlPanel);
    await toggleMenuItem(controlPanel, "Date");
    await toggleMenuItemOption(controlPanel, "Date", "December");
    await toggleComparisonMenu(controlPanel);
    await toggleMenuItem(controlPanel, "Date: Previous Year");
    assert.deepEqual(getFacetTexts(controlPanel), [
      ["Birthday: January 1997", "Date: December 1996"].join("or"),
      "Date: Previous Year",
    ]);
    await toggleFilterMenu(controlPanel);
    await toggleMenuItem(controlPanel, "Date");
    await toggleMenuItemOption(controlPanel, "Date", "1996");
    assert.deepEqual(getFacetTexts(controlPanel), ["Birthday: January 1997"]);
    await toggleComparisonMenu(controlPanel);
    await toggleMenuItem(controlPanel, "Birthday: Previous Year");
    assert.deepEqual(getFacetTexts(controlPanel), [
      "Birthday: January 1997",
      "Birthday: Previous Year",
    ]);
    await removeFacet(controlPanel);
    assert.deepEqual(getFacetTexts(controlPanel), []);
  });
});
