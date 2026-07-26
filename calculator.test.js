'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

function loadCalculator() {
  const elements = new Map();
  class FakeElement {
    constructor(id = '') {
      this.id = id;
      this.dataset = {};
      this.hidden = false;
      this.children = [];
      this.listeners = {};
      this.textContent = '';
    }
    addEventListener(type, listener) { this.listeners[type] = listener; }
    append(...children) { this.children.push(...children); }
    closest(selector) { return selector === `#${this.id}` ? this : null; }
  }
  const documentListeners = {};
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new FakeElement(id));
      return elements.get(id);
    },
    createElement() { return new FakeElement(); },
    addEventListener(type, listener) { documentListeners[type] = listener; },
  };
  const storage = new Map();
  const context = vm.createContext({
    document,
    window: {
      localStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
      },
    },
    console,
  });
  vm.runInContext(readFileSync('script.js', 'utf8'), context);
  return {
    evaluate(source) { return vm.runInContext(source, context); },
    keydown(key, inHistory = false) {
      documentListeners.keydown({
        key,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        preventDefault() {},
        target: { closest: (selector) => inHistory && selector === '#historial' ? {} : null },
      });
    },
  };
}

test('conserva la precisión interna al encadenar resultados formateados', () => {
  const calculator = loadCalculator();
  calculator.evaluate("inputDigit('1'); chooseOperator('/'); inputDigit('3'); chooseOperator('*'); inputDigit('3'); equals();");
  assert.equal(calculator.evaluate('Number(state.current)'), 1);
});

test('backspace no convierte el resultado u operador recién elegido en un operando accidental', () => {
  const calculator = loadCalculator();
  calculator.evaluate("inputDigit('8'); chooseOperator('+'); backspace();");
  assert.equal(calculator.evaluate('state.overwrite'), true);
  assert.equal(calculator.evaluate('state.current'), '8');
});

test('los atajos siguen activos dentro del historial salvo las teclas de activación', () => {
  const calculator = loadCalculator();
  calculator.keydown('7', true);
  assert.equal(calculator.evaluate('state.current'), '7');

  calculator.evaluate("chooseOperator('+'); inputDigit('2');");
  calculator.keydown('Enter', true);
  assert.equal(calculator.evaluate('state.operator'), '+');
});

test('la región desplazable del historial puede recibir foco de teclado', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.match(html, /id="historial-lista"[^>]*tabindex="0"/);
});
