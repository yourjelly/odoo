import { Component, onWillRender, useRef } from "@odoo/owl";
import { tourDebuggerPlayer } from "./tour_debugger_player";
import { useBus, useService } from "@web/core/utils/hooks";
import { queryFirst } from "@odoo/hoot-dom";

export class TourDebugger extends Component {
    static template = "web_tour.TourDebugger";
    static props = {
        tour: { type: Object },
    };
    setup() {
        this.player = tourDebuggerPlayer;
        this.tour_service = useService("tour_service");
        this.container = useRef("container");
        useBus(this.player.bus, "TOUR_DEBUGGER_RENDER", () => {
            this.render();
        });
        onWillRender(this.onWillRender);
        tourDebuggerPlayer.waitFor("REPLAY").then(() => {
            this.tour_service.startTour();
        });
    }

    onWillRender() {
        const element = queryFirst(".running-step");
        if (element) {
            this.container.el.scrollTop = element.offsetTop;
        }
    }
}
