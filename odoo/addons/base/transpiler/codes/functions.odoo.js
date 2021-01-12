odoo.define('@tests/functions', function (require) {
    'use strict';

  let __exports = {};

  const sayHello = __exports.sayHello = function sayHello() {
    console.log("Hello");
  };

  const sayHelloWorld = __exports.sayHelloWorld = function sayHelloWorld() {
    console.log("Hello world");
  };

  const sayAsyncHello = __exports.sayAsyncHello = async function sayAsyncHello() {
    console.log("Hello Async");
  };

  const sayHelloDefault = __exports.__default = function sayHelloDefault() {
    console.log("Hello Default");
  };

  return __exports;
});
