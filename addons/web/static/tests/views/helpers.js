/** @odoo-module **/

import { getFixture } from "../helpers/utils";
import { makeTestEnv } from "../helpers/mock_env";
import { registerCleanup } from "../helpers/cleanup";
import { View } from "../../src/views/view_utils/view/view";

const { mount } = owl;

export async function makeView(params, props) {
  const mockRPC = params.mockRPC || undefined;

  const env = await makeTestEnv({
    ...params.testConfig,
    mockRPC,
  });

  const target = getFixture();

  const view = await mount(View, { env, props, target });

  registerCleanup(() => view.destroy());

  const withSearch = Object.values(view.__owl__.children)[0];
  const concreteView = Object.values(withSearch.__owl__.children)[0];

  return concreteView;
}
