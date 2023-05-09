/** @odoo-module */

import { useEffect, useState } from "@odoo/owl";

// export function useTagDetection(ref, productGroup, searchIsFocused) {
export function useTagDetection(ref, productGroup, state) {
    const tag = useState({ name: "a" });

    // useEffect(
    //     () => {
    //         console.log("Salut");
    //     },
    //     () => []
    // );

    useEffect(
        (searchIsFocused) => {
            if (searchIsFocused) {
                return;
            }
            const OBSERVING_WINDOW_HEIGHT = 5;
            // const h = parseInt(ref.el.style.height) - OBSERVING_WINDOW_HEIGHT;
            const h = ref.el.offsetHeight - OBSERVING_WINDOW_HEIGHT;
            console.log("h", h);
            // const h = ref.el.style.height - OBSERVING_WINDOW_HEIGHT;
            // const h = ref.el.off - OBSERVING_WINDOW_HEIGHT;
            const observer = new IntersectionObserver(
                (entries) => {
                    const entry = entries.filter((entry) => entry.isIntersecting)?.[0];
                    if (entry) {
                        tag.name = entry.target.querySelector("h3").textContent;
                    }
                },
                {
                    root: ref.el,
                    rootMargin: `0px 0px -610px 0px`,
                    // rootMargin: `0px 0px -${h}px 0px`
                }
            );
            Object.keys(productGroup).forEach((tag) => {
                observer.observe(productGroup[tag]?.el);
            });
            return () => {
                observer.disconnect();
            };
        },
        () => [state.searchIsFocused]
    );

    return tag;
}

// this.privateState.selectedTag =
//     entry.target.querySelector("h3").textContent;
// // we scroll the tag list horizontally so that the selected tag is in the middle of the screen
// this.tagList?.el?.scroll({
//     top: 0,
//     left:
//         this.tagButtons[this.privateState.selectedTag].el.offsetLeft -
//         window.innerWidth / 2,
//     behavior: "smooth",
// });
