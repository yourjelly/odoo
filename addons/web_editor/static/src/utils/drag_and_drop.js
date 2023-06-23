/** @odoo-module **/

import { makeDraggableHook } from "@web/core/utils/draggable_hook_builder";
import { pick } from "@web/core/utils/objects";

const useDraggableWithoutFollow = makeDraggableHook({
    name: "useSnippetDraggable",
    acceptedParams: { scrollingArea: [Object], getHelper: [Function] },
    onComputeParams({ ctx, params }) {
        ctx.followCursor = false;
        ctx.scrollEl = params.scrollingArea;
        ctx.getHelper = params.getHelper;
    },
    onWillStartDrag: ({ ctx }) => {
        if (ctx.scrollEl) {
            ctx.current.container = ctx.scrollEl;
        }
    },
    onDragStart: ({ ctx }) => pick(ctx.current, "element"),
    onDrag: ({ ctx }) => {
        ctx.current.element = ctx.getHelper();
        return pick(ctx.current, "element");
    },
    onDragEnd: ({ ctx }) => pick(ctx.current, "element"),
    onDrop: ({ ctx }) => pick(ctx.current, "element"),
    edgeScrolling: { enabled: true },
});

export function useDragAndDrop(params) {
    let dropzones;
    const dragState = {};
    const onDragStart = (args) => {
        if (typeof params.onDragStart === "function") {
            params.onDragStart(args);
        }
        if (typeof params.helper === "function") {
            params.helper(args);
        }

        let droppableArea = params.getDropArea();
        if (droppableArea instanceof $) {
            droppableArea = [...droppableArea];
        }
        if (!Array.isArray(droppableArea)) {
            droppableArea = [droppableArea];
        }
        dropzones = droppableArea
            // Convert JQuery to
            .map((el) => (el instanceof $ ? el[0] : el))
            .flatMap((el) => {
                return Array.from(el.querySelectorAll(".oe_drop_zone:not(.disabled)"));
            });
    };

    let currentDropzone;
    const onDrag = (args) => {
        if (typeof params.onDrag === "function") {
            params.onDrag(args, currentDropzone);
        }
        const helper = params.getHelper();
        if (helper) {
            helper.style.left = `${args.x}px`;
            helper.style.top = `${args.y}px`;
        }
        const dropzone = dropzones.find((el) => {
            const rect = el.getBoundingClientRect();
            return (
                rect.top <= args.y &&
                rect.bottom >= args.y &&
                rect.left <= args.x &&
                rect.right >= args.x &&
                el !== currentDropzone?.el
            );
        });
        // Update the dropzone if it's in grid mode.
        if (currentDropzone?.el && currentDropzone.el.classList.contains("oe_grid_zone")) {
            currentDropzone.rect = currentDropzone.el.getBoundingClientRect();
        }
        if (
            !dropzone &&
            currentDropzone &&
            currentDropzone.rect.top <= args.y &&
            currentDropzone.rect.bottom >= args.y &&
            currentDropzone.rect.left <= args.x &&
            currentDropzone.rect.right >= args.x
        ) {
            // If no new dropzone but old one is still valid, return early.
            return;
        }
        if (currentDropzone && dropzone !== currentDropzone.el) {
            if (typeof params.dropzoneOut === "function") {
                params.dropzoneOut(args, currentDropzone.el);
            }
            currentDropzone = undefined;
        }
        if (dropzone) {
            // Save rect information prior to calling the over function
            // to keep a consistent dropzone even if content was added.
            const rect = DOMRect.fromRect(dropzone.getBoundingClientRect());
            if (typeof params.dropzoneOver === "function") {
                params.dropzoneOver(args, dropzone);
            }
            currentDropzone = { el: dropzone, rect };
        }
    };

    const onDragEnd = (args) => {
        if (typeof params.onDragEnd === "function") {
            params.onDragEnd(args, currentDropzone?.el);
        }
        currentDropzone = undefined;
    };

    useDraggableWithoutFollow({
        ...params,
        onDragStart,
        onDrag,
        onDragEnd,
    });
}

// export class SnippetsDragAndDrop extends Component {
//     setup() {
//         useSnippetDraggable({
//             // This is pretty much forging the ref element given by a useRef
//             // which we can't use in this context (but once the editor is fully
//             // OWL, we should use useRef("snippetsArea").
//             ref: {el: this.props.snippetArea.ownerDocument.body},
//             elements: this.props.elements,
//             handle: this.props.handle,
//             onDragStart: this.onDragStart.bind(this),
//             onDrag: this.onDrag.bind(this),
//             onDragEnd: this.onDragEnd.bind(this),
//         });
//     }
//     onDragStart({ element, addClass, x, y }) {
//         this.helper = this.makeHelper(element);
//         this.dropzones = Array.from(this.props.getEditableArea().find('.oe_drop_zone'));
//         const registerDropzone = ($dropzones, {over, out}) => {
//             this.dropzones = Array.from($dropzones).map(dzEl => {
//                 const rect = dzEl.getBoundingClientRect();
//                 return {
//                     el: dzEl,
//                     top: rect.top,
//                     bottom: rect.bottom,
//                     left: rect.left,
//                     right: rect.right,
//                 };
//             });
//             this.over = over;
//             this.out = out;
//         };
//         this.props.onDragStart.call(element, registerDropzone);
//     }
//     onDrag({x, y}) {
//         this.helper.style.top = `${y}px`;
//         this.helper.style.left = `${x}px`;
//         const dropzone = this.dropzones.find(({top, bottom, left, right})=> {
//             return top <= y && bottom >= y && left <= x && right >= x;
//         });
//         if (
//             this.currentDropzone
//             && (dropzone !== this.currentDropzone)
//         ) {
//             console.log(this.currentDropzone);
//             this.out.call(this.currentDropzone.el);
//             this.currentDropzone = undefined;
//         }
//         if (dropzone) {
//             this.over.call(dropzone.el);
//             this.currentDropzone = dropzone;
//         }
//     }
//     onDragEnd({element}) {
//         // onDragEnd can be called even if dragStart has not been called yet.
//         if (this.helper) {
//             this.helper.remove();
//         }
//         if (this.currentDropzone) {
//             this.out.call(this.currentDropzone);
//             this.currentDropzone = undefined;
//         }
//         if (this.props.onDragStop) {
//             this.props.onDragStop.call(element);
//         }
//     }
//     /**
//      * Creates an element which will follow the mouse closely,
//      * as a helper to indicate which snippet is currently being dragged.
//      * @param snippetEl
//      * @returns {HTMLElement}
//      */
//     makeHelper(snippetEl) {
//         const dragSnip = snippetEl.cloneNode(true);
//         dragSnip.querySelectorAll(".o_delete_btn, .o_rename_btn").forEach(
//             el => el.remove()
//         );
//         dragSnip.classList.add("ui-draggable", "ui-draggable-dragging");
//         dragSnip.style.position = "fixed";
//         this.props.elRef.ownerDocument.body.append(dragSnip);
//         return dragSnip;
//     }
// }
// SnippetsDragAndDrop.template = xml``;
