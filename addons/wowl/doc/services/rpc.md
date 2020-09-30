# RPC service

| Technical name | Dependencies |
| -------------- | ------------ |
| `rpc`          | `user`       |

## Overview

The RPC service is necessary to properly send a request to the server. The value
of the service is a function that takes a query and return a promise (which will
be resolved to the result of the query).

Here is the type of the query:

```ts
interface RPCRouteQuery {
  route: string;
  params?: { [key: string]: any };
}

interface RPCModelQuery {
  model: string;
  method: string;
  args?: any[];
  kwargs?: { [key: string]: any };
}

type RPCQuery = RPCRouteQuery | RPCModelQuery;
```

## Calling a controller

As the type of the query shows, there are actually two different ways to call
the `rpc` method. Either we call a route, or calling a method on a model. Here
is an example of calling a route:

```ts
const result = await this.rpc({ route: "/my/route", params: { some: "value" } });
```

## Calling a model

To call a model, we need to specify a model, a method, args and/or kwargs. For
example:

```ts
const result = await this.rpc({
  model: "res.partner",
  method: "read",
  args: [[123]],
});
```

## Error Handling

If an rpc fails, then:

- the promise representing the rpc is rejected, so the calling code will crash,
  unless it handles the situation
- an event `RPC_ERROR` is triggered on the main application bus. The event payload
  contains a description of the cause of the error:

  It can be a server error (the server code threw an exception). In that case
  the payload will be an object with the following keys:

  - `type = 'server'`
  - `message(string)`
  - `code(number)`
  - `data_message(string)`
  - `data_debug(string)` (this is the main debug information, with the call stack)

  Another possibility is a network error. In that case, the error description is
  simply an object `{type: 'network'}`.

## Notes

- If an rpc fails, then an event `RPC_ERROR` will be triggered on the main bus.

- user context is automatically added to every query. If the query defines
  explicitely a context, the user context will be expanded with the query
  context.

- if a query is initiated by a component, the `rpc` service will check if the
  component is destroyed when the query is completed. In that case, it will
  leave the query pending, so no additional code is executed.
