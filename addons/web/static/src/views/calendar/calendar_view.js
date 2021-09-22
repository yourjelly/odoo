/** @odoo-module **/

import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { _lt } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { ControlPanel } from "@web/search/control_panel/control_panel";
import { useModel } from "../helpers/model";
import { useSetupView } from "../helpers/view_hook";
import { Calendar } from "./renderer/calendar";
import { CalendarArchParser } from "./calendar_arch_parser";
import { CalendarDatePicker } from "./date_picker/calendar_date_picker";
import { CalendarFilterPanel } from "./filter_panel/calendar_filter_panel";
import { CalendarModel } from "./calendar_model";
import { CalendarQuickCreate } from "./quick_create/calendar_quick_create";

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
            exportState: () => this.model.exportedState,
        });

        console.log(this);
    }
    /**
     * @override
     */
    async willStart() {
        this.updateTitle();
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

    get controlPanelProps() {
        const { breadcrumbs, viewSwitcherEntries } = this.props;
        return {
            breadcrumbs,
            displayName: `${this.props.info.displayName} (${this.title.getParts().view})`,
            viewSwitcherEntries,
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
            this.dialog.add(
                this.constructor.components.QuickCreate,
                this.getQuickCreateProps(record)
            );
        } else {
            this.editRecordInCreation(record);
        }
    }
    editRecord(record, context = {}) {
        this.action.doAction({
            type: "ir.actions.act_window",
            res_model: this.model.resModel,
            res_id: record.id,
            views: [[false, "form"]],
            target: "current",
            context,
        });
    }
    editRecordInCreation(record) {
        const context = this.model.makeContextDefaults(record);
        this.editRecord(record, context);
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

    updateTitle() {
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
        let title = formatter.format(this.model.date.toJSDate());
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

            title = dateStartParts.map((p) => p.value).join("");
        }

        this.title.setParts({ view: title });
    }

    onModelUpdate() {
        this.updateTitle();
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
    ControlPanel,
};
CalendarView.template = "web.CalendarView";

CalendarView.type = "calendar";
CalendarView.display_name = _lt("Calendar"); // should be `displayName` or just `name`
CalendarView.icon = "fa-calendar";
CalendarView.multiRecord = true;

CalendarView.searchMenuTypes = ["filter", "favorite"];
CalendarView.withSearchModel = true;

CalendarView.ArchParser = CalendarArchParser;
CalendarView.Model = CalendarModel;

registry.category("views").add("wowl_calendar", CalendarView);
