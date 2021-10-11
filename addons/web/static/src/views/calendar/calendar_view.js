/** @odoo-module **/

import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { _lt } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { useEffect, useService } from "@web/core/utils/hooks";
import { ControlPanel } from "@web/search/control_panel/control_panel";
import { useModel } from "../helpers/model";
import { useSetupView } from "../helpers/view_hook";
import { Calendar } from "./renderer/calendar";
import { CalendarArchParser } from "./calendar_arch_parser";
import { CalendarDatePicker } from "./date_picker/calendar_date_picker";
import { CalendarFilterPanel } from "./filter_panel/calendar_filter_panel";
import { CalendarModel } from "./calendar_model";
import { CalendarQuickCreate } from "./quick_create/calendar_quick_create";
import { Layout } from "../layout";

////////////////////////////////////////////////////////////////////////////////
/** @todo: should be removed when the new view dialog API is ready           **/
////////////////////////////////////////////////////////////////////////////////
import { FormViewDialog } from "web.view_dialogs";
import { ComponentAdapter } from "web.OwlCompatibility";
class FormViewDialogAdapter extends ComponentAdapter {
    constructor(parent, props) {
        props.Component = FormViewDialog;
        super(parent, props);
        this.env = Component.env;
        this.dialog = null;
    }

    open() {
        this.dialog = new FormViewDialog(this, this.props);
        this.dialog.open();
    }
    close() {
        this.dialog.close();
    }
}

function useLegacyViewDialog() {
    const component = owl.hooks.useComponent();
    let dialog = null;
    const remove = () => {
        if (dialog) {
            dialog.close();
            dialog = null;
        }
    };
    const add = (props) => {
        dialog = new FormViewDialogAdapter(component, props);
        dialog.open();
        return remove;
    };
    owl.hooks.onWillUnmount(remove);
    return { add };
}
////////////////////////////////////////////////////////////////////////////////

const { Component } = owl;

const SCALE_LABELS = {
    day: _lt("Day"),
    week: _lt("Week"),
    month: _lt("Month"),
    year: _lt("Year"),
};

export class CalendarView extends Component {
    setup() {
        this.action = useService("action");
        this.title = useService("title");
        this.dialog = useService("dialog");

        let modelParams;
        if (this.props.state) {
            modelParams = this.props.state;
        } else {
            /** @type {typeof CalendarArchParser} */
            const ArchParser = this.constructor.ArchParser;
            const archParser = new ArchParser(this.props);
            const archData = archParser.parse();
            modelParams = {
                ...this.props,
                ...archData,
            };
        }

        const Model = this.constructor.Model;
        /** @type {CalendarModel} */
        this.model = useModel(Model, modelParams, { onUpdate: this.onModelUpdate });

        useSetupView({
            getLocalState: () => this.model.exportedState,
        });

        this.viewDialog = useLegacyViewDialog();

        const date = this.formatScaledDate();
        this.title.setParts({ view: date });
        this.env.config.displayName = `${this.title.getParts().action} (${date})`;

        console.log(this);
    }
    willUnmount() {
        this.title.setParts({ view: undefined });
    }

    get rendererProps() {
        return {
            model: this.model,
            createRecord: this.createRecord.bind(this),
            deleteRecord: this.deleteRecord.bind(this),
            editRecord: this.editRecord.bind(this),
        };
    }
    get datePickerProps() {
        return {
            model: this.model,
        };
    }
    get filterPanelProps() {
        return {
            model: this.model,
        };
    }

    get scaleLabels() {
        return SCALE_LABELS;
    }

    /**
     * @param {"previous" | "next" | "today"} move
     */
    async setDate(move) {
        let date = null;
        switch (move) {
            case "next":
                date = this.model.date.plus({ [`${this.model.scale}s`]: 1 });
                break;
            case "previous":
                date = this.model.date.minus({ [`${this.model.scale}s`]: 1 });
                break;
            case "today":
                date = luxon.DateTime.utc().startOf("day");
                break;
        }
        await this.model.load({ date });
    }
    /**
     * @param {Scales} scale
     */
    async setScale(scale) {
        for (const btn of this.el.querySelectorAll(".o-calendar-view--scale-button")) {
            btn.setAttribute("disabled", "1");
        }
        await this.model.load({ scale });
    }

    getQuickCreateProps(record) {
        return {
            record,
            model: this.model,
            editRecord: this.editRecordInCreation.bind(this),
        };
    }

    createRecord(record) {
        if (this.model.hasQuickCreate) {
            let resolve;
            const def = new Promise((r) => {
                resolve = r;
            });

            this.dialog.add(
                this.constructor.components.QuickCreate,
                this.getQuickCreateProps(record),
                {
                    onClose() {
                        resolve();
                    },
                }
            );
            return def;
        } else {
            return this.editRecordInCreation(record);
        }
    }
    editRecord(record, context = {}) {
        let resolve = (v) => {};
        const def = new Promise((r) => {
            resolve = r;
        });
        if (this.model.hasEditDialog) {
            /** @todo: use view dialog API when ready */
            this.viewDialog.add({
                res_model: this.model.resModel,
                res_id: record.id || null,
                context,
                title: record.id
                    ? `${this.env._t("Open")}: ${record.title}`
                    : this.env._t("New Event"),
                view_id: this.model.formViewId,
                on_saved: () => {
                    this.model.load();
                },
                on_closed: () => {
                    resolve();
                },
            });
        } else {
            resolve();
            this.action.doAction({
                type: "ir.actions.act_window",
                res_model: this.model.resModel,
                res_id: record.id,
                views: [[this.model.formViewId, "form"]],
                target: "current",
                context,
            });
        }
        return def;
    }
    editRecordInCreation(record) {
        const context = this.model.makeContextDefaults(record);
        return this.editRecord(record, context);
    }
    deleteRecord(record) {
        this.dialog.add(ConfirmationDialog, {
            title: this.env._t("Confirmation"),
            body: this.env._t("Are you sure you want to delete this record ?"),
            confirm: () => {
                this.model.unlinkRecord(record.id);
            },
            cancel: () => {
                // `ConfirmationDialog` needs this prop to display the cancel
                // button but we do nothing on cancel.
            },
        });
    }

    formatScaledDate() {
        /** @type {Intl.DateTimeFormatOptions} */
        const formatOptions = { year: "numeric" };
        switch (this.model.scale) {
            case "day":
                Object.assign(formatOptions, { month: "long", day: "numeric" });
                break;
            case "week":
                Object.assign(formatOptions, { month: "short", day: "numeric" });
                break;
            case "month":
                Object.assign(formatOptions, { month: "long" });
                break;
        }

        const formatter = Intl.DateTimeFormat("en-US", formatOptions);
        let result = formatter.format(this.model.date.toJSDate());
        if (this.model.scale === "week") {
            const dateStartParts = formatter.formatToParts(this.model.rangeStart.toJSDate());
            const dateEndParts = formatter.formatToParts(
                this.model.rangeEnd.minus({ days: 1 }).toJSDate()
            );
            const indexOfDayPart = dateEndParts.findIndex((p) => p.type === "day");

            dateStartParts.splice(
                indexOfDayPart + 1,
                0,
                { type: "literal", value: " – " },
                dateEndParts[indexOfDayPart]
            );

            result = dateStartParts.map((p) => p.value).join("");
        }

        return result;
    }

    onModelUpdate() {
        const date = this.formatScaledDate();
        this.title.setParts({ view: date });
        this.env.config.displayName = `${this.title.getParts().action} (${date})`;
        for (const btn of this.el.querySelectorAll(".o-calendar-view--scale-button")) {
            btn.removeAttribute("disabled");
        }
        this.render();
    }
}
CalendarView.components = {
    Renderer: Calendar,
    DatePicker: CalendarDatePicker,
    FilterPanel: CalendarFilterPanel,
    QuickCreate: CalendarQuickCreate,
    Layout,
};
CalendarView.template = "web.CalendarView";
CalendarView.buttonTemplate = "web.CalendarView.controlButtons";

CalendarView.type = "calendar";
CalendarView.display_name = _lt("Calendar"); // should be `displayName` or just `name`
CalendarView.icon = "fa-calendar";
CalendarView.multiRecord = true;

CalendarView.searchMenuTypes = ["filter", "favorite"];
CalendarView.withSearchModel = true;

CalendarView.ArchParser = CalendarArchParser;
CalendarView.Model = CalendarModel;

registry.category("views").add("wowl_calendar", CalendarView);
