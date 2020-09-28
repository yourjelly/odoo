import { Component } from "@odoo/owl";
import { OdooEnv } from "./env";
import { Registry } from "./core/registry";

// add here each service type to have better typing for useService
import type { rpcService } from "./services/rpc";
import type { menusService } from "./services/menus";

export interface Services {
  rpc: ReturnType<typeof rpcService["deploy"]>;
  menus: ReturnType<typeof menusService["deploy"]>;
  [key: string]: any;
}

export interface Service {
  name: string;
  dependencies?: string[];
  deploy: (env: OdooEnv) => any;
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
  const services = env.services;
  const toBeDeployed = new Set(registry.getAll());
  let service: Service | null = null;

  while ((service = findNext())) {
    toBeDeployed.delete(service);
    const value = service.deploy(env);
    services[service.name] = value;
  }
  if (toBeDeployed.size) {
    throw new Error("Some services could not be deployed");
  }

  function findNext(): Service | null {
    for (let s of toBeDeployed) {
      if (s.dependencies) {
        if (s.dependencies.every((d) => d in services)) {
          return s;
        }
      } else {
        return s;
      }
    }
    return null;
  }
}
