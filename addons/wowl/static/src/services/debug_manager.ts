import { OdooEnv, Service } from "../types";
import { debugManager } from "../components/debug_manager/debug_manager";

export function editModelDebug(
  env: OdooEnv,
  title: string,
  model: string,
  id: number
): Promise<void> {
  return env.services.action_manager.doAction({
    res_model: model,
    res_id: id,
    name: title,
    type: "ir.actions.act_window",
    views: [[false, "form"]],
    view_mode: "form",
    target: "new",
    flags: { action_buttons: true, headless: true },
  });
}

export interface DebuggingAccessRights {
  canEditView: boolean;
  canSeeModelAccess: boolean;
  canSeeRecordRules: boolean;
}

interface DebugManagerService {
  getAccessRights(): Promise<DebuggingAccessRights>;
}

export const debugManagerService: Service<DebugManagerService> = {
  name: "debug_manager",
  dependencies: ["rpc"],
  async deploy(env: OdooEnv): Promise<DebugManagerService> {
    let accessRightsProm: Promise<DebuggingAccessRights> | undefined;
    if (env.debug !== "") {
      env.registries.systray.add("wowl.debug_mode_menu", debugManager);
    }

    return {
      getAccessRights() {
        if (!accessRightsProm) {
          accessRightsProm = new Promise((resolve, reject) => {
            const accessRights = {
              canEditView: false,
              canSeeRecordRules: false,
              canSeeModelAccess: false,
            };
            const canEditView = env.services
              .model("ir.ui.view")
              .call("check_access_rights", [], { operation: "write", raise_exception: false })
              .then((result) => (accessRights.canEditView = result));

            const canSeeRecordRules = env.services
              .model("ir.rule")
              .call("check_access_rights", [], { operation: "read", raise_exception: false })
              .then((result) => (accessRights.canSeeRecordRules = result));
            const canSeeModelAccess = env.services
              .model("ir.model.access")
              .call("check_access_rights", [], { operation: "read", raise_exception: false })
              .then((result) => (accessRights.canSeeModelAccess = result));
            Promise.all([canEditView, canSeeRecordRules, canSeeModelAccess])
              .then(() => resolve(accessRights))
              .catch((error) => {
                accessRightsProm = undefined;
                reject(error);
              });
          });
        }
        return accessRightsProm;
      },
    };
  },
};
