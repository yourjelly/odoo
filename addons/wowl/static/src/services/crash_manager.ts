import { OdooEnv } from "../env";
import { Service } from "../services";

export const crashManagerService: Service<void> = {
  name: "menus",
  async deploy(env: OdooEnv) {
    const console = env.browser.console;
    env.bus.on("RPC_ERROR", null, (error) => {
      console.error(error);
    });
  },
};
