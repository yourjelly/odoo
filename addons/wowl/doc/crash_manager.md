# Crash Manager

## Overview

The `crash manager` is a component whose responsibility is to display a dialog
when an rpc error or a client error occurs. It is one of the webclient main
components (see [Main Components](main_components.md)).

## Channels

The crash manager receives errors throught two channels:

- it listens on `env.bus` the event `RPC_ERROR`;
- it listens on `window` the event `error`;

## RPC_ERROR event handling

When an event `RPC_ERROR` is triggerd on the bus, the crash manager processes the
`RPCError` in the following way:

- look if the error's `type` is `server`;

- if this is the case, the optional error's `name` indicates which dialog class
  (from the registry `errorDialogs`) should be used to display the error details.
  If the error is unnamed or no dialog class corresponds to its name, the class
  `ErrorDialog` is used by default.

- The dialog class is instantiated with one prop: the error itself.

This is how a `UserError`, `AccessError`... or a custom server error is handled.

## ERROR event handlling

When an event `error` is triggered on window, the crash manager processes the `ErrorEvent`
received in the following way:

- if some information on the file name where the error occurs, the error stack... is available
  an `ErrorDialog` is displayed showing that information.

- if such information is not available, an `ErrorDialog` is also displayed but with a generic message.

This is how client errors are treated.
