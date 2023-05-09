/** @odoo-module */

import { useEffect, useState } from "@odoo/owl";

export function useScrollDirection(ref) {
    const scroll = useState({ down: false });
    useEffect(
        () => {
            const element = ref.el;
            const threshold = 60;
            let lastScrollY = element?.scrollTop;
            let ticking = false;

            const updateScrollDir = () => {
                const scrollY = element?.scrollTop;
                const amountScrolled = Math.abs(scrollY - lastScrollY);
                if (amountScrolled < threshold) {
                    ticking = false;
                    return;
                }
                scroll.down = scrollY > lastScrollY;
                lastScrollY = scrollY > 0 ? scrollY : 0;
                ticking = false;
            };

            const onScroll = () => {
                if (!ticking) {
                    // this makes the scrolling smooth
                    window.requestAnimationFrame(updateScrollDir);
                    ticking = true;
                }
            };
            element.addEventListener("scroll", onScroll);
            console.log("element", element);
            return () => element.removeEventListener("scroll", onScroll);
        },
        () => []
    );

    return scroll;
}
