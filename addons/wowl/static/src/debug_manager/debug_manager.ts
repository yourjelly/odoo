import { Component, hooks } from "@odoo/owl";
import { OwlEvent } from "@odoo/owl/dist/types/core/owl_event";
import { MenuElement, MenuItemEventPayload, OdooEnv, SystrayItem } from "../types";
import { Dropdown } from "../components/dropdown/dropdown";
import { DropdownItem } from "../components/dropdown/dropdown_item";
import { useService } from "../core/hooks";
import { DebuggingAccessRights } from "./debug_manager_service";

export class DebugManager extends Component<{}, OdooEnv> {
  static debugElementsId: number = 1;
  static template = "wowl.DebugManager";
  static components = { Dropdown, DropdownItem };
  debugFactories: {
    [id: string]: DebugManagerElementsFactory;
  } = {};
  debugService = useService("debug_manager");
  accessRights: DebuggingAccessRights | undefined;

  // Defined as arrow to be passed as prop
  // @ts-ignore
  private beforeOpenDropdown = async (): Promise<void> => {
    if (!this.accessRights) {
      this.accessRights = await this.debugService.getAccessRights();
    }
  };

  constructor(...args: any[]) {
    super(...args);
    this.env.bus.on("DEBUG-MANAGER:NEW-ITEMS", this, (payload: useDebugManagerPayload) => {
      const { inDialog, elementsId, elementsFactory } = payload;
      if (this.isInDialog === inDialog) {
        this.debugFactories[elementsId] = elementsFactory;
      }
    });
    this.env.bus.on("DEBUG-MANAGER:REMOVE-ITEMS", this, (payload: useDebugManagerPayload) => {
      const { inDialog, elementsId } = payload;
      if (this.isInDialog === inDialog) {
        delete this.debugFactories[elementsId];
      }
    });

    if (!this.isInDialog) {
      this.debugFactories["global"] = (accessRights) =>
        this.env.registries.debugManager.getAll().map((el) => el(this.env));
    }
  }
  get isInDialog(): true | undefined {
    return (this.env as any).inDialog;
  }

  getItems(): MenuElement[] {
    const sortedItems = Object.values(this.debugFactories)
      .map((factory: DebugManagerElementsFactory) => factory(this.accessRights!))
      .reduce((acc: MenuElement[], elements: MenuElement[]) => acc.concat(elements))
      .sort((x: MenuElement, y: MenuElement) => {
        const xSeq = x.sequence ? x.sequence : 1000;
        const ySeq = y.sequence ? y.sequence : 1000;
        return xSeq - ySeq;
      });
    return sortedItems;
  }

  onDropdownItemSelected(ev: OwlEvent<MenuItemEventPayload>) {
    ev.detail.payload.callback();
  }
}

export const debugManager: SystrayItem = {
  name: "wowl.debug_mode_menu",
  Component: DebugManager,
  sequence: 100,
};

type DebugManagerElementsFactory = (accessRights: DebuggingAccessRights) => MenuElement[];

interface useDebugManagerPayload {
  elementsId: number;
  elementsFactory: DebugManagerElementsFactory;
  inDialog?: true;
}

export function useDebugManager(elementsFactory: DebugManagerElementsFactory): void {
  const elementsId = DebugManager.debugElementsId++;
  const component = Component.current!;
  const env = component.env as OdooEnv;

  const payload: useDebugManagerPayload = {
    elementsId,
    elementsFactory,
    inDialog: (env as any).inDialog,
  };
  hooks.onMounted(() => {
    env.bus.trigger("DEBUG-MANAGER:NEW-ITEMS", payload);
  });

  hooks.onWillUnmount(() => {
    env.bus.trigger("DEBUG-MANAGER:REMOVE-ITEMS", payload);
  });
}
