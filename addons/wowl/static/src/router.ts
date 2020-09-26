import { EventBus } from "@odoo/owl/dist/types/core/event_bus";
import { OdooEnv } from "./env";

type Query = { [key: string]: string };

interface Route {
  pathName: string;
  hash: string;
  query: { [key: string]: string };
}

export class Router {
  bus: EventBus;
  current: Route;

  constructor(bus: EventBus) {
    this.bus = bus;
    this.current = this.parseRoute();

    window.addEventListener("hashchange", () => {
      this.current = this.parseRoute();
      this.bus.trigger("ROUTE_CHANGE");
      console.warn("router hash schange");
    });
  }

  parseRoute(): Route {
    return {
      pathName: location.pathname,
      hash: location.hash,
      query: this.getQuery(location.hash),
    };
  }

  private getQuery(hash: string): Query {
    return {};
  }

  navigate(query: Query) {
    const separator = this.current.pathName;
    const hash = Object.entries(query)
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    const url = location.origin + separator + (hash.length ? "#" + hash : "");
    if (url !== window.location.href) {
      window.history.pushState({}, hash, url);
    }
  }
}

export const routerService = {
  name: "router",
  start(env: OdooEnv): Router {
    return new Router((env as any).bus);
  },
};
