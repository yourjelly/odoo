/** @odoo-module **/

import { getFixture } from "../../helpers/utils";
import { makeTestEnv } from "../../helpers/mock_env";
import { registerCleanup } from "../../helpers/cleanup";
import { WithSearch } from "@web/views/search/with_search/with_search";

const { mount } = owl;

export async function makeWithSearch(params, props) {
  const mockRPC = params.mockRPC || undefined;
  const env = await makeTestEnv({
    ...params.testConfig,
    mockRPC,
  });
  const target = getFixture();
  const withSearch = await mount(WithSearch, { env, props, target });
  registerCleanup(() => withSearch.destroy());
  const component = Object.values(withSearch.__owl__.children)[0];
  return component;
}
