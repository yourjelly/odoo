import { Component } from "@odoo/owl";
import { OdooEnv, ServiceName, Services } from "./env";
// import type { Component } from "@odoo/owl";

/**
 * This file defines custom hooks used in Odoo, in addition to those already
 * defined in Owl.
 */

/**
 * The purpose of this hook is to TODO.
 */
export function useService<T extends ServiceName>(serviceName: T): Services[T] {
  // const component: Component = Component.current!;
  const component = Component.current as Component<any, OdooEnv>;
  const service = component.env.services[serviceName];
  if (!service) {
    throw new Error(`Service ${serviceName} is not available`);
  }
  return service;
  // TODO: somehow bind to component ?
  // -> might allow to prevent devs from using services by bypassing the hook
}
