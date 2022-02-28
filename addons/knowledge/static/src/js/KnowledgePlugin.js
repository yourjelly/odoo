/** @odoo-module */

export class KnowledgePlugin {
    cleanForSave(editable) {
        for (const node of editable.querySelectorAll('.o_knowledge_toolbar_anchor')) {
            while (node.firstChild) {
                node.removeChild(node.lastChild);
            }
        }
    }
}
