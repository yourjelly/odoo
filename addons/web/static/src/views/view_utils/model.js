/** @odoo-module **/

import { useBus } from "../../utils/hooks";

const { core, hooks } = owl;
const { EventBus } = core;
const { useComponent } = hooks;

export class Model extends EventBus {
  constructor(env) {
    super();
    this.env = env;
    this.setup();
  }

  setup() {}
}

export function useModel(params = {}) {
  const component = useComponent();
  const ModelClass = params.Model;
  const model = new ModelClass(component.env);
  useBus(model, "update", params.onUpdate || component.render);
  return model;
}
