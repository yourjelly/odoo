import { Dialog } from "../dialog/dialog";
import { DebugManager } from "../debug_manager/debug_manager";

// -----------------------------------------------------------------------------
// Dialog Action (Component)
// -----------------------------------------------------------------------------

export class DialogAction extends Dialog {
  static components = { ...Dialog.components, DebugManager };
  static template = "wowl.DialogAction";
}
