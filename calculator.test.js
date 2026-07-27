'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

/** `closest` acepta listas de selectores; aquí solo hacen falta ids. */
function coincide(selector, id) {
  return selector.split(',').some((parte) => parte.trim() === id);
}

function loadCalculator(storage = new Map(), { sinAlmacenamiento = false } = {}) {
  const elements = new Map();
  class FakeElement {
    constructor(id = '') {
      this.id = id;
      this.dataset = {};
      this.attributes = {};
      this.hidden = false;
      this.children = [];
      this.listeners = {};
      this.textContent = '';
    }
    addEventListener(type, listener) { this.listeners[type] = listener; }
    append(...children) { this.children.push(...children); }
    setAttribute(name, value) { this.attributes[name] = value; }
    closest(selector) { return coincide(selector, `#${this.id}`) ? this : null; }
  }
  const documentListeners = {};
  const document = {
    documentElement: new FakeElement(),
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new FakeElement(id));
      return elements.get(id);
    },
    createElement() { return new FakeElement(); },
    addEventListener(type, listener) { documentListeners[type] = listener; },
  };
  const window = {};
  if (sinAlmacenamiento) {
    // Safari sobre file:// lanza al leer la propiedad, no solo al usarla.
    Object.defineProperty(window, 'localStorage', {
      get() { throw new Error('SecurityError'); },
    });
  } else {
    window.localStorage = {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    };
  }
  const context = vm.createContext({ document, window, console });
  vm.runInContext(readFileSync('script.js', 'utf8'), context);
  return {
    evaluate(source) { return vm.runInContext(source, context); },
    elemento(id) { return elements.get(id); },
    raiz() { return document.documentElement; },
    /** `enfoque` es el selector del contenedor con el foco, o null para el body. */
    keydown(key, enfoque = null) {
      documentListeners.keydown({
        key,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        preventDefault() {},
        target: { closest: (selector) => enfoque && coincide(selector, enfoque) ? {} : null },
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
  calculator.keydown('7', '#historial');
  assert.equal(calculator.evaluate('state.current'), '7');

  calculator.evaluate("chooseOperator('+'); inputDigit('2');");
  calculator.keydown('Enter', '#historial');
  assert.equal(calculator.evaluate('state.operator'), '+');
});

test('la región desplazable del historial puede recibir foco de teclado', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.match(html, /id="historial-lista"[^>]*tabindex="0"/);
});

test('el botón alterna la visibilidad del panel y sincroniza aria-expanded', () => {
  const calculator = loadCalculator();
  const panel = calculator.elemento('historial');
  const boton = calculator.elemento('historial-toggle');

  assert.equal(panel.hidden, false);
  assert.equal(boton.attributes['aria-expanded'], 'true');

  boton.listeners.click();
  assert.equal(panel.hidden, true);
  assert.equal(boton.attributes['aria-expanded'], 'false');

  boton.listeners.click();
  assert.equal(panel.hidden, false);
  assert.equal(boton.attributes['aria-expanded'], 'true');
});

test('Enter con el foco en el botón del panel no evalúa la operación pendiente', () => {
  const calculator = loadCalculator();
  calculator.evaluate("inputDigit('2'); chooseOperator('+'); inputDigit('3');");
  calculator.keydown('Enter', '#historial-toggle');
  assert.equal(calculator.evaluate('state.operator'), '+');
  assert.equal(calculator.evaluate('state.current'), '3');
});

test('el estado del panel sobrevive a una recarga', () => {
  const storage = new Map();
  const primera = loadCalculator(storage);
  primera.elemento('historial-toggle').listeners.click();

  const segunda = loadCalculator(storage);
  assert.equal(segunda.elemento('historial').hidden, true);
  assert.equal(segunda.elemento('historial-toggle').attributes['aria-expanded'], 'false');
});

test('el tema elegido se aplica a la raíz del documento', () => {
  const calculator = loadCalculator();
  assert.equal(calculator.raiz().attributes['data-tema'], 'grafito');

  const selector = calculator.elemento('tema');
  selector.value = 'cian';
  selector.listeners.change();
  assert.equal(calculator.raiz().attributes['data-tema'], 'cian');
});

test('cambiar de tema no altera el estado de la calculadora ni el historial', () => {
  const calculator = loadCalculator();
  calculator.evaluate("inputDigit('2'); chooseOperator('+'); inputDigit('3'); equals();");
  const antes = calculator.evaluate('JSON.stringify([state, historial])');

  const selector = calculator.elemento('tema');
  selector.value = 'rosa';
  selector.listeners.change();

  assert.equal(calculator.evaluate('JSON.stringify([state, historial])'), antes);
});

test('el tema sobrevive a una recarga', () => {
  const storage = new Map();
  const primera = loadCalculator(storage);
  primera.elemento('tema').value = 'ambar';
  primera.elemento('tema').listeners.change();

  const segunda = loadCalculator(storage);
  assert.equal(segunda.raiz().attributes['data-tema'], 'ambar');
  assert.equal(segunda.elemento('tema').value, 'ambar');
});

test('un tema guardado desconocido cae al tema por defecto', () => {
  const calculator = loadCalculator(new Map([['calculadora:tema:v1', 'fucsia-neón']]));
  assert.equal(calculator.raiz().attributes['data-tema'], 'grafito');
});

test('sin almacenamiento el tema se aplica en memoria sin propagar excepciones', () => {
  const calculator = loadCalculator(new Map(), { sinAlmacenamiento: true });
  assert.equal(calculator.raiz().attributes['data-tema'], 'grafito');

  const selector = calculator.elemento('tema');
  selector.value = 'verde';
  assert.doesNotThrow(() => selector.listeners.change());
  assert.equal(calculator.raiz().attributes['data-tema'], 'verde');
});

test('las teclas con el foco en el selector de tema no tocan la calculadora', () => {
  const calculator = loadCalculator();
  calculator.evaluate("inputDigit('2'); chooseOperator('+'); inputDigit('3');");

  for (const tecla of ['Enter', ' ', '7']) calculator.keydown(tecla, '#tema');

  assert.equal(calculator.evaluate('state.operator'), '+');
  assert.equal(calculator.evaluate('state.current'), '3');
});

test('el selector ofrece exactamente los 8 temas etiquetados', () => {
  const html = readFileSync('index.html', 'utf8');
  const selector = html.slice(html.indexOf('<select'), html.indexOf('</select>'));

  assert.equal(selector.match(/<option value=/g).length, 8);
  assert.match(html, /<label[^>]*for="tema"/);
});

test('el historial se renderiza fuera de la tarjeta de la calculadora', () => {
  const html = readFileSync('index.html', 'utf8');
  const calculadora = html.slice(html.indexOf('<main'), html.indexOf('</main>'));

  assert.equal(calculadora.includes('id="historial"'), false);
  assert.match(html, /id="historial-toggle"[^>]*aria-controls="historial"/);
});
