import { Component, mount, tags } from "@odoo/owl";
import { useSearch } from "../../../src/views/view_utils/hooks";
import {
  getFacetTexts,
  removeFacet,
  toggleComparisonMenu,
  toggleFilterMenu,
  toggleMenuItem,
  toggleMenuItemOption,
} from "../../helpers/control_panel";
import { patchDate } from "./search_model_tests";
import { SearchBar } from "../../../src/views/view_utils/search_bar/search_bar";
import { FilterMenu } from "../../../src/views/view_utils/filter_menu/filter_menu";
import { ComparisonMenu } from "../../../src/views/view_utils/comparison_menu/comparison_menu";
import { getFixture, makeFakeUserService, makeTestEnv, OdooEnv } from "../../helpers/index";
import { Registry } from "../../../src/core/registry";
import { Service } from "../../../src/types";
import { makeFakeLocalizationService } from "../../helpers/mocks";
import { modelService } from "../../../src/services/model";
import { RPC } from "../../../src/services/rpc";
import { viewManagerService } from "../../../src/services/view_manager";

class PseudoControlPanel extends Component {
  static template = tags.xml`
    <div>
        <SearchBar searchModel="searchModel"/>
        <FilterMenu searchModel="searchModel"/>
        <ComparisonMenu t-if="searchModel.getSearchItems(i => i.type === 'comparison').length" searchModel="searchModel"/>
    </div>
    `;
  static components = { SearchBar, FilterMenu, ComparisonMenu };
  searchModel = useSearch({
    searchMenuTypes: ["filter", "comparison"],
  });
  mounted() {
    this.searchModel.on("update", this, this.render);
  }
  willUnmount() {
    this.searchModel.off("update", this);
  }
}

const mockRPC: RPC = async function (route, args) {
  if (args && args.method === "load_views") {
    return {
      fields: {
        birthday: { string: "Birthday", type: "date", store: true, sortable: true },
        date_field: { string: "Date", type: "date", store: true, sortable: true },
      },
      fields_views: {
        search: {
          arch: `
                        <search>
                            <filter name="birthday" date="birthday"/>
                            <filter name="date_field" date="date_field"/>
                        </search>
                    `,
          type: "search",
          view_id: 1,
        },
      },
    };
  }
};

const props = {
  model: "partner",
  views: [[1, "search"]],
  context: {},
};

let controlPanel: PseudoControlPanel;
let env: OdooEnv;
let target: HTMLElement;

QUnit.module(
  "ComparisonMenu",
  {
    async beforeEach() {
      const serviceRegistry = new Registry<Service>();
      const fakeUserService = makeFakeUserService();
      const fakeLocalizationService = makeFakeLocalizationService();
      serviceRegistry
        .add(fakeUserService.name, fakeUserService)
        .add(fakeLocalizationService.name, fakeLocalizationService)
        .add(modelService.name, modelService)
        .add(viewManagerService.name, viewManagerService);

      env = await makeTestEnv({ mockRPC, serviceRegistry });
      target = getFixture();
    },
  },
  function () {
    QUnit.test("simple rendering", async function (assert) {
      assert.expect(6);

      const unpatchDate = patchDate(1997, 0, 9, 12, 0, 0);

      controlPanel = await mount(PseudoControlPanel, { env, target, props });

      assert.containsOnce(controlPanel, ".o_dropdown.o_filter_menu");
      assert.containsNone(controlPanel, ".o_dropdown.o_comparison_menu");

      await toggleFilterMenu(controlPanel);
      await toggleMenuItem(controlPanel, "Birthday");
      await toggleMenuItemOption(controlPanel, "Birthday", "January");

      assert.containsOnce(controlPanel, "div.o_comparison_menu > button i.fa.fa-adjust");
      assert.strictEqual(
        (controlPanel.el!.querySelector(
          "div.o_comparison_menu > button span"
        ) as any).innerText.trim(),
        "Comparison"
      );

      await toggleComparisonMenu(controlPanel);

      const comparisonOptions = [...controlPanel.el!.querySelectorAll(".o_comparison_menu li")];
      assert.strictEqual(comparisonOptions.length, 2);
      assert.deepEqual(
        comparisonOptions.map((e) => (e as HTMLElement).innerText.trim()),
        ["Birthday: Previous Period", "Birthday: Previous Year"]
      );

      controlPanel.destroy();
      unpatchDate();
    });

    QUnit.test("activate a comparison works", async function (assert) {
      assert.expect(5);

      const unpatchDate = patchDate(1997, 0, 9, 12, 0, 0);

      controlPanel = await mount(PseudoControlPanel, {
        env,
        target,
        props: {
          model: "partner",
          views: [[1, "search"]],
          context: {},
        },
      });

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

      controlPanel.destroy();
      unpatchDate();
    });
  }
);
