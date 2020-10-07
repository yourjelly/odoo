import { Service, ServiceParams } from "../services";

export const crashManagerService: Service<void> = {
  name: "crash_manager",
  deploy(params: ServiceParams) {
    const { env } = params;
    const console = env.browser.console;
    env.bus.on("RPC_ERROR", null, (error) => {
      console.error(error);
    });
  },
};
