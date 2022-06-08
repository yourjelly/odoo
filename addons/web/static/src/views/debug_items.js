/** @odoo-module **/

import { _lt } from "@web/core/l10n/translation";
import { Dialog } from "@web/core/dialog/dialog";
import { editModelDebug } from "@web/core/debug/debug_utils";
import { registry } from "@web/core/registry";

// import { FormViewDialog } from 'web.view_dialogs';
// import { formatDateTime, parseDateTime } from "@web/core/l10n/dates";
// import { formatMany2one } from "@web/fields/formatters";
// import { standaloneAdapter } from 'web.OwlCompatibility';

const { Component, xml } = owl;
// const { Component, onWillStart, useState, xml } = owl;

const debugRegistry = registry.category("debug");

class FieldViewGetDialog extends Component {}
FieldViewGetDialog.template = xml`<Dialog title="this.constructor.title">
    <pre t-esc="props.arch"/>
</Dialog>`;
FieldViewGetDialog.components = { Dialog };
FieldViewGetDialog.props = {
    arch: { type: String },
    close: { type: Function },
};
FieldViewGetDialog.title = _lt("Fields View Get");

function viewSeparator() {
    return {
        type: "separator",
        sequence: 300,
    };
}

function fieldsViewGet({ component, env }) {
    let { arch } = component.props;
    if ("viewInfo" in component.props) {
        //legacy
        arch = component.props.viewInfo.arch;
    }
    return {
        type: "item",
        description: env._t("Fields View Get"),
        callback: () => {
            env.services.dialog.add(FieldViewGetDialog, { arch });
        },
        sequence: 340,
    };
}

export function editView({ accessRights, component, env }) {
    if (!accessRights.canEditView) {
        return null;
    }
    let { viewId, viewType: type } = component.env.config || {}; // fallback is there for legacy
    if ("viewInfo" in component.props) {
        // legacy
        viewId = component.props.viewInfo.view_id;
        type = component.props.viewInfo.type;
        type = type === "tree" ? "list" : type;
    }
    const displayName = type[0].toUpperCase() + type.slice(1);
    const description = env._t("Edit View: ") + displayName;
    return {
        type: "item",
        description,
        callback: () => {
            editModelDebug(env, description, "ir.ui.view", viewId);
        },
        sequence: 350,
    };
}

export function editSearchView({ accessRights, component, env }) {
    if (!accessRights.canEditView) {
        return null;
    }
    let { searchViewId } = component.props.info || {}; // fallback is there for legacy
    if ("viewParams" in component.props) {
        //legacy
        if (!component.props.viewParams.action.controlPanelFieldsView) {
            return null;
        }
        searchViewId = component.props.viewParams.action.controlPanelFieldsView.view_id;
    }
    if (searchViewId === undefined) {
        return null;
    }
    const description = env._t("Edit ControlPanelView");
    return {
        type: "item",
        description,
        callback: () => {
            editModelDebug(env, description, "ir.ui.view", searchViewId);
        },
        sequence: 360,
    };
}

// class GetMetadataDialog extends Component {
//     setup() {
//         this.state = useState({});
//         onWillStart(() => this.getMetadata());
//     }

//     async onClickCreateXmlid() {
//         const context = Object.assign({}, this.context, {
//             default_module: '__custom__',
//             default_res_id: this.state.id,
//             default_model: this.props.res_model,
//         });
//         const adapterParent = standaloneAdapter({ Component });
//         const dialog = new FormViewDialog(adapterParent, {
//             context: context,
//             on_saved: () => this.getMetadata(),
//             disable_multiple_selection: true,
//             res_model: 'ir.model.data',
//         });
//         dialog.on('dialog_form_loaded', this, () => {
//             dialog.$el.find('[name="name"]').focus();
//         });
//         await dialog.open();
//     }

//     async toggleNoupdate() {
//         await this.env.services.orm.call("ir.model.data", "toggle_noupdate", [
//             this.props.res_model,
//             this.state.id,
//         ]);
//         await this.getMetadata();
//     }

//     async getMetadata() {
//         const metadata = (
//             await this.env.services.orm.call(this.props.res_model, "get_metadata", [
//                 this.props.selectedIds,
//             ])
//         )[0];
//         this.state.id = metadata.id;
//         this.state.xmlid = metadata.xmlid;
//         this.state.creator = formatMany2one(metadata.create_uid);
//         this.state.lastModifiedBy = formatMany2one(metadata.write_uid);
//         this.state.noupdate = metadata.noupdate;
//         this.state.create_date = formatDateTime(parseDateTime(metadata.create_date), { timezone: true });
//         this.state.write_date = formatDateTime(parseDateTime(metadata.write_date), { timezone: true });
//     }
// }
// GetMetadataDialog.template = "web.DebugMenu.GetMetadataDialog";
// GetMetadataDialog.components = { Dialog };
// GetMetadataDialog.title = _lt("View Metadata");
// class SetDefaultDialog extends Component {
//     setup() {
//         super.setup();
//         this.state = {
//             fieldToSet: "",
//             condition: "",
//             scope: "self",
//         };
//         this.dataWidgetState = this.getDataWidgetState();
//         this.defaultFields = this.getDefaultFields();
//         this.conditions = this.getConditions();
//     }

//     getDataWidgetState() {
//         const renderer = this.props.component.widget.renderer;
//         const state = renderer.state;
//         const fields = state.fields;
//         const fieldsInfo = state.fieldsInfo.form;
//         const fieldNamesInView = state.getFieldNames();
//         const fieldNamesOnlyOnView = ["message_attachment_count"];
//         const fieldsValues = state.data;
//         const modifierDatas = {};
//         fieldNamesInView.forEach((fieldName) => {
//             modifierDatas[fieldName] = renderer.allModifiersData.find((modifierdata) => {
//                 return modifierdata.node.attrs.name === fieldName;
//             });
//         });
//         return {
//             fields,
//             fieldsInfo,
//             fieldNamesInView,
//             fieldNamesOnlyOnView,
//             fieldsValues,
//             modifierDatas,
//             stateId: state.id,
//         };
//     }

//     getDefaultFields() {
//         const {
//             fields,
//             fieldsInfo,
//             fieldNamesInView,
//             fieldNamesOnlyOnView,
//             fieldsValues,
//             modifierDatas,
//             stateId,
//         } = this.dataWidgetState;
//         return fieldNamesInView
//             .filter((fieldName) => !fieldNamesOnlyOnView.includes(fieldName))
//             .map((fieldName) => {
//                 const modifierData = modifierDatas[fieldName];
//                 let invisibleOrReadOnly;
//                 if (modifierData) {
//                     const evaluatedModifiers = modifierData.evaluatedModifiers[stateId];
//                     invisibleOrReadOnly =
//                         evaluatedModifiers.invisible || evaluatedModifiers.readonly;
//                 }
//                 const fieldInfo = fields[fieldName];
//                 const valueDisplayed = this.display(fieldInfo, fieldsValues[fieldName]);
//                 const value = valueDisplayed[0];
//                 const displayed = valueDisplayed[1];
//                 // ignore fields which are empty, invisible, readonly, o2m
//                 // or m2m
//                 if (
//                     !value ||
//                     invisibleOrReadOnly ||
//                     fieldInfo.type === "one2many" ||
//                     fieldInfo.type === "many2many" ||
//                     fieldInfo.type === "binary" ||
//                     fieldsInfo[fieldName].options.isPassword ||
//                     fieldInfo.depends === undefined ||
//                     fieldInfo.depends.length !== 0
//                 ) {
//                     return false;
//                 }
//                 return {
//                     name: fieldName,
//                     string: fieldInfo.string,
//                     value: value,
//                     displayed: displayed,
//                 };
//             })
//             .filter((val) => val)
//             .sort((field) => field.string);
//     }

//     getConditions() {
//         const { fields, fieldNamesInView, fieldsValues } = this.dataWidgetState;
//         return fieldNamesInView
//             .filter((fieldName) => {
//                 const fieldInfo = fields[fieldName];
//                 return fieldInfo.change_default;
//             })
//             .map((fieldName) => {
//                 const fieldInfo = fields[fieldName];
//                 const valueDisplayed = this.display(fieldInfo, fieldsValues[fieldName]);
//                 const value = valueDisplayed[0];
//                 const displayed = valueDisplayed[1];
//                 return {
//                     name: fieldName,
//                     string: fieldInfo.string,
//                     value: value,
//                     displayed: displayed,
//                 };
//             });
//     }

//     display(fieldInfo, value) {
//         let displayed = value;
//         if (value && fieldInfo.type === "many2one") {
//             displayed = value.data.display_name;
//             value = value.data.id;
//         } else if (value && fieldInfo.type === "selection") {
//             displayed = fieldInfo.selection.find((option) => {
//                 return option[0] === value;
//             })[1];
//         }
//         return [value, displayed];
//     }

//     async saveDefault() {
//         if (!this.state.fieldToSet) {
//             // TODO $defaults.parent().addClass('o_form_invalid');
//             // It doesn't work in web.
//             // Good solution: Create a FormView
//             return;
//         }
//         const fieldToSet = this.defaultFields.find((field) => {
//             return field.name === this.state.fieldToSet;
//         }).value;
//         await this.env.services.orm.call("ir.default", "set", [
//             this.props.res_model,
//             this.state.fieldToSet,
//             fieldToSet,
//             this.state.scope === "self",
//             true,
//             this.state.condition || false,
//         ]);
//         this.props.close();
//     }
// }
// SetDefaultDialog.template = "web.DebugMenu.SetDefaultDialog";
// SetDefaultDialog.components = { Dialog };
// SetDefaultDialog.title = _lt("Set Default");

// // Form view items

// function setDefaults({ action, component, env }) {
//     return {
//         type: "item",
//         description: env._t("Set Defaults"),
//         callback: () => {
//             env.services.dialog.add(SetDefaultDialog, {
//                 res_model: action.res_model,
//                 component,
//             });
//         },
//         sequence: 310,
//     };
// }

// function viewMetadata({ action, component, env }) {
//     const selectedIds = component.widget.getSelectedIds();
//     if (selectedIds.length !== 1) {
//         return null;
//     }
//     return {
//         type: "item",
//         description: env._t("View Metadata"),
//         callback: () => {
//             env.services.dialog.add(GetMetadataDialog, {
//                 res_model: action.res_model,
//                 selectedIds,
//             });
//         },
//         sequence: 320,
//     };
// }

function manageAttachments({ action, component, env }) {
    const resId = component.model.root.resId;
    if (!resId) {
        return null; // No record
    }
    const description = env._t("Manage Attachments");
    return {
        type: "item",
        description,
        callback: () => {
            env.services.action.doAction({
                res_model: "ir.attachment",
                name: description,
                views: [
                    [false, "list"],
                    [false, "form"],
                ],
                type: "ir.actions.act_window",
                domain: [
                    ["res_model", "=", component.props.resModel],
                    ["res_id", "=", resId],
                ],
                context: {
                    default_res_model: component.props.resModel,
                    default_res_id: resId,
                },
            });
        },
        sequence: 330,
    };
}

debugRegistry
    .category("view")
    .add("viewSeparator", viewSeparator)
    .add("fieldsViewGet", fieldsViewGet)
    .add("editView", editView)
    .add("editSearchView", editSearchView);

debugRegistry
    .category("form")
    //     .add("setDefaults", setDefaults)
    //     .add("viewMetadata", viewMetadata)
    .add("manageAttachments", manageAttachments);
