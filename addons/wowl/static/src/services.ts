import { Component } from "@odoo/owl";
import { OdooEnv } from "./env";
import { Registry } from "./registry";

import type { rpcService } from "./rpc";

export interface Services {
  rpc: ReturnType<typeof rpcService["start"]>;
  [key: string]: any;
}

export interface Service {
  name: string;
  dependencies?: string[];
  start: (env: OdooEnv) => any;
}

export function useService<T extends keyof Services>(serviceName: T): Services[T] {
  const component = Component.current as Component<any, OdooEnv>;
  const service = component.env.services[serviceName];
  if (!service) {
    throw new Error(`Service ${serviceName} is not available`);
  }
  return typeof service === "function" ? service.bind(component) : service;
}

export const serviceRegistry = new Registry<Service>();

export function deployServices(env: OdooEnv, registry: Registry<Service>) {
  for (let service of registry.getAll()) {
    env.services[service.name] = service.start?.(env);
  }
}
