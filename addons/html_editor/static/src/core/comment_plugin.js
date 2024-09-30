import { isProtected } from "@html_editor/utils/dom_info";
import { Plugin } from "../plugin";
import { descendants } from "../utils/dom_traversal";

export class CommentPlugin extends Plugin {
    static name = "comment";
    resources = {
        normalize_listeners: this.removeComment.bind(this),
    };

    removeComment(node) {
        for (const el of [node, ...descendants(node)]) {
            if (el.nodeType === Node.COMMENT_NODE && !isProtected(el)) {
                el.remove();
                return;
            }
        }
    }
}
