import { Component, onPatched, useExternalListener, useRef } from "@odoo/owl";

export class SuggestionList extends Component {
    static template = "mail.SuggestionList";
    static props = {
        document: { validate: (doc) => doc.constructor.name === "HTMLDocument" },
        close: Function,
        state: Object,
        activateSuggestion: Function,
        applySuggestion: Function,
    };

    setup() {
        const ref = useRef("root");

        onPatched(() => {
            const activeCommand = ref.el.querySelector(".o-mail-Suggestion.active");
            if (activeCommand) {
                activeCommand.scrollIntoView({ block: "nearest", inline: "nearest" });
            }
        });

        this.mouseSelectionActive = false;
        useExternalListener(this.props.document, "mousemove", () => {
            this.mouseSelectionActive = true;
        });
    }

    get suggestions() {
        console.log(this.props.state.suggestions);
        return this.props.state.suggestions;
    }

    get currentIndex() {
        return this.props.state.currentIndex;
    }

    get showCategories() {
        return this.props.state.showCategories;
    }

    onScroll() {
        this.mouseSelectionActive = false;
    }

    onMouseEnter(index) {
        if (this.mouseSelectionActive) {
            this.props.activateSuggestion(index);
        }
    }
}
