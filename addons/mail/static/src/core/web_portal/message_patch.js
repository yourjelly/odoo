import { patch } from "@web/core/utils/patch";
import { Message } from "@mail/core/common/message";
import { onWillUnmount } from "@odoo/owl";

patch(Message.prototype, {
    setup() {
        super.setup(...arguments);
        this.state.lastReadMoreIndex = 0;
        this.state.isReadMoreByIndex = new Map();
        onWillUnmount(() => {
            this.messageBody.el?.querySelector(".o-mail-read-more-less")?.remove();
        });
    },

    /**
     * @override
     * @param {HTMLElement} element
     */
    prepareMessageBody(element) {
        const read_more_less = element.querySelector(".o-mail-read-more-less");
        if (read_more_less) {
            read_more_less.remove();
        }
        this.insertReadMoreLess(element);
    },

    /**
     * Modifies the message to add the 'read more/read less' functionality
     * All element nodes with 'data-o-mail-quote' attribute are concerned.
     * All text nodes after a ``#stopSpelling`` element are concerned.
     * Those text nodes need to be wrapped in a span (toggle functionality).
     * All consecutive elements are joined in one 'read more/read less'.
     *
     * FIXME This method should be rewritten (task-2308951)
     *
     * @param {HTMLElement} element
     */
    insertReadMoreLess(element) {
        function getPreviousSiblings(elem) {
            const siblings = [];
            let sibling = elem.previousElementSibling;
            while (sibling) {
                siblings.push(sibling);
                sibling = sibling.previousElementSibling;
            }
            return siblings;
        }
        const groups = [];
        let readMoreNodes;

        // nodeType 1: element_node
        // nodeType 3: text_node
        const children = [...element.childNodes].filter(
            (content) =>
                content.nodeType === 1 || (content.nodeType === 3 && content.nodeValue.trim())
        );

        for (const child of children) {
            // Hide Text nodes if "stopSpelling"
            const previousSiblingElements = getPreviousSiblings(child).filter((node) => {
                const idValue = node.getAttribute("id");
                return idValue && idValue.includes("stopSpelling");
            });
            if (child.nodeType === 3 && previousSiblingElements.length > 0) {
                // Convert Text nodes to Element nodes
                const newChild = document.createElement("span");
                newChild.textContent = child.textContent;
                newChild.setAttribute("data-o-mail-quote", "1");
                child.parentNode.replaceChild(newChild, child);
            }

            // Create array for each 'read more' with nodes to toggle
            if (
                (child.nodeType === 1 && child.getAttribute("data-o-mail-quote")) ||
                (child.nodeName === "BR" &&
                    child.previousElementSibling &&
                    child.previousElementSibling.nodeType === 1 &&
                    child.previousElementSibling.getAttribute("data-o-mail-quote"))
            ) {
                if (!readMoreNodes) {
                    readMoreNodes = [];
                    groups.push(readMoreNodes);
                }
                child.style.display = "none";
                readMoreNodes.push(child);
            } else {
                readMoreNodes = undefined;
                this.insertReadMoreLess(child);
            }
        }

        for (const group of groups) {
            const index = this.state.lastReadMoreIndex++;
            // Insert link just before the first node
            const readMoreLess = document.createElement("a");
            readMoreLess.classList.add(["o-mail-read-more-less", "d-block"]);
            readMoreLess.setAttribute("href", "#");
            readMoreLess.textContent = "Read More";
            group[0].parentNode.insertBefore(readMoreLess, group[0]);

            // Toggle All next nodes
            if (!this.state.isReadMoreByIndex.has(index)) {
                this.state.isReadMoreByIndex.set(index, true);
            }
            const updateFromState = () => {
                const isReadMore = this.state.isReadMoreByIndex.get(index);
                for (const child of group) {
                    child.style.display = isReadMore ? "block" : "none";
                }
                readMoreLess.textContent = isReadMore ? "Read More" : "Read Less";
            };
            readMoreLess.addEventListener("click", (ev) => {
                ev.preventDefault();
                this.state.isReadMoreByIndex.set(index, !this.state.isReadMoreByIndex.get(index));
                updateFromState();
            });
            updateFromState();
        }
    },
});
