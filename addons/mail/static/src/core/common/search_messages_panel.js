import { Component, onWillUpdateProps, useExternalListener, useState, useRef } from "@odoo/owl";
import { useAutofocus, useService } from "@web/core/utils/hooks";
import { useMessageSearch } from "@mail/core/common/message_search_hook";
import { browser } from "@web/core/browser/browser";
import { ActionPanel } from "@mail/discuss/core/common/action_panel";
import { MessageCardList } from "./message_card_list";
import { NavigableList } from "@mail/core/common/navigable_list";
import { markEventHandled } from "@web/core/utils/misc";
import { DateTimePicker } from "@web/core/datetime/datetime_picker";
import { _t } from "@web/core/l10n/translation";

const { DateTime } = luxon;

/**
 * @typedef {Object} Props
 * @property {import("@mail/core/common/thread_model").Thread} thread
 * @property {string} [className]
 * @property {funtion} [closeSearch]
 * @property {funtion} [onClickJump]
 * @extends {Component<Props, Env>}
 */
export class SearchMessagesPanel extends Component {
    static components = {
        MessageCardList,
        ActionPanel,
        NavigableList,
        DateTimePicker,
    };
    static props = ["thread", "className?", "closeSearch?", "onClickJump?"];
    static template = "mail.SearchMessagesPanel";

    typeOptions = [
        { id: "type_message", name: "Message", label: "message" },
        { id: "type_note", name: "Note", label: "note" },
        { id: "type_activity", name: "Activity", label: "activity" },
    ];

    activityOptions = [
        { id: "activity_type", name: "Type", label: "type" },
        { id: "activity_summary", name: "Summary", label: "summary" },
        { id: "activity_note", name: "Note", label: "activity" },
    ];

    discussOptions = [
        { id: "from", name: "From", label: "user" },
        { id: "mentions", name: "Mentions", label: "user" },
        { id: "before", name: "Before", label: "specific date" },
        { id: "during", name: "During", label: "specific date" },
        { id: "after", name: "After", label: "specific date" },
    ];

    chatterOptions = [
        { id: "type", name: "Type", label: "message, note, activity" },
        { id: "stage_change", name: "On Stage Change", label: "on stage changes" },
        { id: "activity", name: "Activity", label: "type, summary, note" },
    ];

    get partnersSuggestions() {
        const partners = this.suggestionService.searchSuggestions(
            { delimiter: "@", term: this.state.searchTerm },
            { thread: this.props.thread, sort: true }
        );
        return partners.suggestions.map((partner) => {
            return {
                id: this.state.selectedOption.id + "_partner",
                partner,
                optionTemplate: "mail.Composer.suggestionPartner",
            };
        });
    }

    setup() {
        super.setup();
        this.state = useState({
            searchTerm: "",
            searchedTerm: "",
            selectedOption: undefined,
            selectedParameter: "",
            optionSelectionComplete: false,
            showDatePicker: false,
            searchParams: {},
        });
        this.suggestionService = useService("mail.suggestion");
        this.suggestionService.fetchPartners("", this.props.thread);
        this.messageSearch = useMessageSearch(this.props.thread);
        useAutofocus("searchInput");
        this.ref = useRef("searchBox");
        useExternalListener(
            browser,
            "keydown",
            (ev) => {
                if (ev.key === "Escape") {
                    this.props.closeSearch?.();
                }
            },
            { capture: true }
        );
        onWillUpdateProps((nextProps) => {
            if (this.props.thread.notEq(nextProps.thread)) {
                this.env.searchMenu?.close();
            }
        });
        // in the chatter there are not channel members
        // this.props.thread.fetchChannelMembers();
    }

    get title() {
        return _t("Search messages");
    }

    get MESSAGES_FOUND() {
        if (this.messageSearch.messages.length === 0) {
            return false;
        }
        return _t("%s messages found", this.messageSearch.count);
    }

    get navigableListProps() {
        const props = {
            anchorRef: this.ref.el,
            position: "bottom-fit",
            placeholder: _t("Loading"),
            onSelect: (ev, option) => {
                this.select(option);
                markEventHandled(ev, "composer.selectSuggestion");
            },
            options: [],
        };
        if (this.state.optionSelectionComplete) {
            return props;
        }

        const options = [];
        let optionTemplate = "mail.SearchMessagesPanel.suggestionSearch";

        if (this.state.selectedOption) {
            switch (this.state.selectedOption.id) {
                case "type":
                    options.push(...this.typeOptions);
                    break;
                case "activity":
                    options.push(...this.activityOptions);
                    break;
                case "from":
                case "mentions":
                    options.push(...this.partnersSuggestions);
                    optionTemplate = "mail.Composer.suggestionPartner";
                    break;
            }
        } else {
            if (this.state.searchTerm) {
                options.push({
                    id: "for",
                    name: "Search for",
                    label: this.state.searchTerm,
                });
            }
            options.push(...this.discussOptions);
            if (this.env.inChatter) {
                options.push(...this.chatterOptions);
            }
        }
        return {
            ...props,
            optionTemplate,
            options,
        };
    }

    select(option) {
        if (!this.state.selectedOption && !["for", "stage_change"].includes(option.id)) {
            this.state.selectedOption = option;
            return;
        }
        switch (option.id) {
            case "for":
                this.state.selectedOption = option;
                break;
            case "stage_change":
                this.state.selectedOption = option;
                this.state.searchParams.stage_change = true;
                break;
            case "type_message":
                this.state.searchParams.subtype_id = 1;
                this.state.selectedParameter = option.name;
                break;
            case "type_note":
                this.state.searchParams.subtype_id = 2;
                this.state.selectedParameter = option.name;
                break;
            case "type_activity":
                this.state.searchParams.subtype_id = 3;
                this.state.selectedParameter = option.name;
                break;
            case "from_partner":
                this.state.searchParams.from_id = option.partner.id;
                this.state.selectedParameter = option.partner.name;
                break;
            case "mentions_partner":
                this.state.searchParams.mentions_id = option.partner.id;
                this.state.selectedParameter = option.partner.name;
                break;
            case "activity_type":
                this.state.searchParams.activity_type = "";
                this.state.selectedParameter = option.name;
                break;
            case "activity_summary":
                this.state.searchParams.activity_summary = "";
                this.state.selectedParameter = option.name;
                break;
            case "activity_note":
                this.state.searchParams.activity_note = "";
                this.state.selectedParameter = option.name;
                break;
        }
        this.state.optionSelectionComplete = true;
        this.search();
    }

    get showDatePicker() {
        return (
            ["before", "during", "after"].includes(this.state.selectedOption?.id) &&
            !this.state.optionSelectionComplete
        );
    }

    onFocus() {}

    onClick(ev) {
        this.render();
        markEventHandled(ev, "searchMessagesPanel.onClickInput");
    }

    onDateSelected(date) {
        switch (this.state.selectedOption.id) {
            case "before":
                this.state.searchParams["before"] = date;
                break;
            case "after":
                this.state.searchParams["after"] = date;
                break;
            case "during":
                this.state.searchParams["after"] = date;
                this.state.searchParams["before"] = date.plus({ days: 1 });
                break;
        }
        this.state.selectedParameter = date.toLocaleString(DateTime.DATE_MED);
        this.state.optionSelectionComplete = true;
        this.state.showDatePicker = false;
        this.search();
    }

    search() {
        this.messageSearch.searchTerm = this.state.searchTerm;
        this.messageSearch.searchParams = this.state.searchParams;
        this.messageSearch.search();
        this.state.searchedTerm = this.state.searchTerm;
    }

    clear() {
        this.state.searchTerm = "";
        this.state.searchedTerm = this.state.searchTerm;
        this.messageSearch.clear();
        this.props.closeSearch?.();
    }

    /** @param {KeyboardEvent} ev */
    onKeydownSearch(ev) {
        if (this.state.searchTerm == "" && ev.key === "Backspace") {
            if (
                !this.state.optionSelectionComplete ||
                ["for", "stage_change"].includes(this.state.selectedOption.id)
            ) {
                this.state.selectedOption = undefined;
                this.state.showDatePicker = false;
            }
            this.state.optionSelectionComplete = false;
            this.state.selectedParameter = "";
            this.state.searchParams = {};
            this.messageSearch.clear();
            return;
        }
        if (ev.key !== "Enter") {
            return;
        }
        if (!this.state.searchTerm && !Object.keys(this.state.searchParams)) {
            this.clear();
        } else {
            this.search();
        }
    }

    onLoadMoreVisible() {
        const before = this.messageSearch.messages
            ? Math.min(...this.messageSearch.messages.map((message) => message.id))
            : false;
        this.messageSearch.search(before);
    }
}
