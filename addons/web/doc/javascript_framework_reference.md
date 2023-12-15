<h1 align="center">The Odoo Javascript framework</h1>


A (mostly?) complete reference 

Last updated:  Dec 14, 2023

- [1. Introduction](#1-introduction)
- [2. Controllers](#2-controllers)
  - [2.1. Defining a controller](#21-defining-a-controller)
  - [2.2. call\_kw](#22-call_kw)
  - [2.3. `/web/dataset/call_kw/web_read`](#23-webdatasetcall_kwweb_read)
  - [2.4. web\_readgroup](#24-web_readgroup)
- [3. Managing Assets](#3-managing-assets)
  - [3.1. Bundles](#31-bundles)
  - [3.2. Static files](#32-static-files)
  - [3.3. css and scss files](#33-css-and-scss-files)
  - [3.4. xml files](#34-xml-files)
  - [3.5. javascript files](#35-javascript-files)
  - [3.6. ir.asset model](#36-irasset-model)
  - [3.7. Lazy loading a bundle](#37-lazy-loading-a-bundle)
  - [3.8. Module Loader](#38-module-loader)
- [4. Owl framework](#4-owl-framework)
  - [4.1. Owl templates](#41-owl-templates)
- [5. Foundations](#5-foundations)
  - [5.1. Session](#51-session)
  - [5.2. User](#52-user)
  - [5.3. authentication](#53-authentication)
  - [5.4. session\_info](#54-session_info)
  - [5.5. Localization](#55-localization)
  - [5.6. Network Requests](#56-network-requests)
    - [5.6.1. rpc function](#561-rpc-function)
    - [5.6.2. orm system](#562-orm-system)
    - [5.6.3. http service](#563-http-service)
    - [5.6.4. Network errors](#564-network-errors)
    - [5.6.5. Downloading a file](#565-downloading-a-file)
  - [5.7. Routing](#57-routing)
  - [5.8. Error handling](#58-error-handling)
  - [5.9. Javascript libraries](#59-javascript-libraries)
  - [5.10. Styling Odoo](#510-styling-odoo)
  - [5.11. Date handling](#511-date-handling)
  - [5.12. Debug mode](#512-debug-mode)
  - [5.13. Patching system](#513-patching-system)
  - [5.14. pyjs](#514-pyjs)
  - [5.15. Links and button](#515-links-and-button)
  - [5.16. Special attributes (tooltip)](#516-special-attributes-tooltip)
  - [5.17. Security](#517-security)
  - [5.18. Macros](#518-macros)
  - [5.19. Command palette](#519-command-palette)
  - [5.20. Notifications](#520-notifications)
  - [5.21. Dialogs and modals](#521-dialogs-and-modals)
  - [5.22. Popover](#522-popover)
  - [5.23. Overlays](#523-overlays)
- [6. Building Blocks](#6-building-blocks)
  - [6.1. Services](#61-services)
  - [6.2. Registries](#62-registries)
  - [6.3. Components](#63-components)
  - [6.4. Utility functions](#64-utility-functions)
- [7. Web client](#7-web-client)
  - [7.1. The environment (env)](#71-the-environment-env)
  - [7.2. ir.action model](#72-iraction-model)
  - [7.3. ir.action.act\_window model](#73-iractionact_window-model)
  - [7.4. menu items model](#74-menu-items-model)
  - [7.5. Actions](#75-actions)
  - [7.6. Systray items](#76-systray-items)
    - [7.6.1. Client actions](#761-client-actions)
    - [7.6.2. Window actions](#762-window-actions)
- [8. The Relational Model](#8-the-relational-model)
  - [8.1. Record component](#81-record-component)
- [9. Views](#9-views)
  - [9.1. ir.ui.view model](#91-iruiview-model)
- [10. Fields](#10-fields)
- [11. Test framework](#11-test-framework)
  - [11.1. Unit tests](#111-unit-tests)
  - [11.2. Tours](#112-tours)


# 1. Introduction

Odoo is a suite of applications built on top of a framework.  This document is an attempt at a complete reference to the frontend part of Odoo: the Odoo javascript framework.

Broadly speaking, the Odoo JS framework is a set of tools, technologies and techniques that can be used to build, extend and test the Odoo user interface. Among others, it includes:

- a set of controllers (`/web`, `/web/dataset/call_kw/`, ...)
- a bundling system
- a javascript component framework (Owl)
- a set of components, hooks, utility functions and more
- various libraries
- a testing framework

It handles all of the usual basic needs: assets, authentication, routing, translations (and localization), code-splitting, testing. The framework is designed to be very flexible. This is actually the main reason why Odoo needed to develop so many basic technologies: it was necessary to provide as much customization power as possible.

# 2. Controllers

## 2.1. Defining a controller
## 2.2. call_kw
## 2.3. `/web/dataset/call_kw/web_read`
## 2.4. web_readgroup

# 3. Managing Assets
## 3.1. Bundles
## 3.2. Static files
## 3.3. css and scss files
## 3.4. xml files
## 3.5. javascript files
## 3.6. ir.asset model
## 3.7. Lazy loading a bundle
## 3.8. Module Loader

# 4. Owl framework

## 4.1. Owl templates

scss/css
variables

# 5. Foundations

## 5.1. Session
## 5.2. User
## 5.3. authentication
## 5.4. session_info
## 5.5. Localization

explain how it works


## 5.6. Network Requests

### 5.6.1. rpc function
### 5.6.2. orm system

commands

### 5.6.3. http service
### 5.6.4. Network errors
### 5.6.5. Downloading a file

## 5.7. Routing
## 5.8. Error handling
## 5.9. Javascript libraries

## 5.10. Styling Odoo

## 5.11. Date handling
## 5.12. Debug mode

## 5.13. Patching system
## 5.14. pyjs
## 5.15. Links and button
## 5.16. Special attributes (tooltip)
## 5.17. Security
## 5.18. Macros


## 5.19. Command palette
## 5.20. Notifications
## 5.21. Dialogs and modals
## 5.22. Popover
## 5.23. Overlays

# 6. Building Blocks
## 6.1. Services


## 6.2. Registries

## 6.3. Components

## 6.4. Utility functions

# 7. Web client

## 7.1. The environment (env)

## 7.2. ir.action model
## 7.3. ir.action.act_window model
## 7.4. menu items model
## 7.5. Actions
## 7.6. Systray items

### 7.6.1. Client actions
Function actions

### 7.6.2. Window actions

# 8. The Relational Model

## 8.1. Record component


# 9. Views

## 9.1. ir.ui.view model

# 10. Fields

# 11. Test framework
## 11.1. Unit tests
## 11.2. Tours

