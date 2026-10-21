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

test('el botón alterna la visibilidad del bloque científico y sincroniza aria-pressed', () => {
  const calculator = loadCalculator();
  const bloque = calculator.elemento('teclado-cientifico');
  const boton = calculator.elemento('modo-toggle');

  assert.equal(bloque.hidden, true);
  assert.equal(boton.attributes['aria-pressed'], 'false');

  boton.listeners.click();
  assert.equal(bloque.hidden, false);
  assert.equal(boton.attributes['aria-pressed'], 'true');

  boton.listeners.click();
  assert.equal(bloque.hidden, true);
  assert.equal(boton.attributes['aria-pressed'], 'false');
});

test('el modo científico sobrevive a una recarga', () => {
  const storage = new Map();
  const primera = loadCalculator(storage);
  primera.elemento('modo-toggle').listeners.click();

  const segunda = loadCalculator(storage);
  assert.equal(segunda.elemento('teclado-cientifico').hidden, false);
  assert.equal(segunda.elemento('modo-toggle').attributes['aria-pressed'], 'true');
});

test('un modo guardado desconocido cae al modo básico', () => {
  const calculator = loadCalculator(new Map([['calculadora:modo:v1', 'astrofísica']]));
  assert.equal(calculator.elemento('teclado-cientifico').hidden, true);
  assert.equal(calculator.elemento('modo-toggle').attributes['aria-pressed'], 'false');
});

test('sin almacenamiento el modo se aplica en memoria sin propagar excepciones', () => {
  const calculator = loadCalculator(new Map(), { sinAlmacenamiento: true });
  assert.equal(calculator.elemento('teclado-cientifico').hidden, true);

  const boton = calculator.elemento('modo-toggle');
  assert.doesNotThrow(() => boton.listeners.click());
  assert.equal(calculator.elemento('teclado-cientifico').hidden, false);
});

test('conmutar el modo no altera el estado de la calculadora ni el historial', () => {
  const calculator = loadCalculator();
  calculator.evaluate("inputDigit('2'); chooseOperator('+'); inputDigit('3'); equals();");
  const antes = calculator.evaluate('JSON.stringify([state, historial])');

  calculator.elemento('modo-toggle').listeners.click();

  assert.equal(calculator.evaluate('JSON.stringify([state, historial])'), antes);
});

test('una función unaria se aplica al operando mostrado y el dígito siguiente inicia otro', () => {
  const calculator = loadCalculator();
  calculator.evaluate("inputDigit('9'); aplicarFuncion('raiz');");
  assert.equal(calculator.evaluate('Number(state.current)'), 3);

  calculator.evaluate("inputDigit('5');");
  assert.equal(calculator.evaluate('state.current'), '5');
});

test('el resultado de una función unaria sí es un operando para el = pendiente', () => {
  const calculator = loadCalculator();
  calculator.evaluate("inputDigit('9'); chooseOperator('+'); inputDigit('3'); aplicarFuncion('raiz'); equals();");
  assert.equal(calculator.evaluate('formatNumber(Number(state.current))'), '10.7320508076');

  // Una constante tampoco deja la operación en espera: el operador encadena.
  calculator.evaluate("clear(); inputDigit('2'); chooseOperator('+'); inputConstante('pi'); chooseOperator('+');");
  assert.equal(calculator.evaluate('state.operator'), '+');
  assert.equal(calculator.evaluate('formatNumber(Number(state.current))'), '5.14159265359');
});

test('los errores de dominio bloquean la calculadora hasta clear()', () => {
  const calculator = loadCalculator();

  for (const entrada of [
    "inputDigit('0'); chooseOperator('-'); inputDigit('9'); equals(); aplicarFuncion('raiz');",
    "aplicarFuncion('ln');",
    "aplicarFuncion('log');",
    "aplicarFuncion('inverso');",
    "inputDigit('9'); inputDigit('0'); aplicarFuncion('tan');",
  ]) {
    calculator.evaluate(`clear(); ${entrada}`);
    assert.equal(calculator.evaluate('state.error'), true, entrada);
    calculator.evaluate("inputDigit('7');");
    assert.equal(calculator.evaluate('state.current'), '0', entrada);
  }

  calculator.evaluate('clear();');
  assert.equal(calculator.evaluate('state.error'), false);
});

test('la potencia es un operador binario más', () => {
  const calculator = loadCalculator();
  calculator.evaluate("inputDigit('2'); chooseOperator('^'); inputDigit('1'); inputDigit('0'); equals();");
  assert.equal(calculator.evaluate('Number(state.current)'), 1024);
});

test('las trigonométricas trabajan en grados y sin ruido IEEE-754', () => {
  const calculator = loadCalculator();
  calculator.evaluate("inputDigit('1'); inputDigit('8'); inputDigit('0'); aplicarFuncion('sin');");
  assert.equal(calculator.evaluate('Number(state.current)'), 0);

  calculator.evaluate("clear(); inputDigit('6'); inputDigit('0'); aplicarFuncion('cos');");
  assert.equal(calculator.evaluate('formatNumber(Number(state.current))'), '0.5');
});

test('Enter y Espacio con el foco en el botón de modo no evalúan la operación pendiente', () => {
  const calculator = loadCalculator();
  calculator.evaluate("inputDigit('2'); chooseOperator('+'); inputDigit('3');");

  for (const tecla of ['Enter', ' ']) calculator.keydown(tecla, '#modo-toggle');

  assert.equal(calculator.evaluate('state.operator'), '+');
  assert.equal(calculator.evaluate('state.current'), '3');
});

test('el bloque científico arranca oculto y el botón lo declara con aria-controls', () => {
  const html = readFileSync('index.html', 'utf8');

  assert.match(html, /id="teclado-cientifico"[^>]*hidden/);
  assert.match(html, /id="modo-toggle"[^>]*aria-pressed="false"/);
  assert.match(html, /id="modo-toggle"[^>]*aria-controls="teclado-cientifico"/);
});

test('el teclado básico conserva sus 20 teclas por delante del bloque científico', () => {
  const html = readFileSync('index.html', 'utf8');
  const teclado = html.slice(html.indexOf('id="teclado"'), html.indexOf('</main>'));
  const basico = teclado.slice(0, teclado.indexOf('id="teclado-cientifico"'));
  const cientifico = teclado.slice(teclado.indexOf('id="teclado-cientifico"'));

  // 20 botones en las 20 celdas de la rejilla de 4 columnas.
  assert.equal(basico.match(/<button/g).length, 20);
  assert.equal(cientifico.match(/<button/g).length, 11);
});

test('el historial se renderiza fuera de la tarjeta de la calculadora', () => {
  const html = readFileSync('index.html', 'utf8');
  const calculadora = html.slice(html.indexOf('<main'), html.indexOf('</main>'));

  assert.equal(calculadora.includes('id="historial"'), false);
  assert.match(html, /id="historial-toggle"[^>]*aria-controls="historial"/);
});

test('el porcentaje con + o − pendiente es un porcentaje del operando acumulado', () => {
  const calculator = loadCalculator();
  calculator.evaluate("inputDigit('2'); inputDigit('0'); inputDigit('0'); chooseOperator('+'); inputDigit('1'); inputDigit('0'); porcentaje();");
  assert.equal(calculator.evaluate('Number(state.current)'), 20);

  calculator.evaluate('equals();');
  assert.equal(calculator.evaluate('Number(state.current)'), 220);
  // El % es entrada, no evaluación: solo el = deja una entrada.
  assert.equal(calculator.evaluate('JSON.stringify(historial.map((e) => e.expresion))'), '["200 + 20"]');

  calculator.evaluate("clear(); inputDigit('2'); inputDigit('0'); inputDigit('0'); chooseOperator('-'); inputDigit('5'); porcentaje(); equals();");
  assert.equal(calculator.evaluate('Number(state.current)'), 190);
});

test('el porcentaje con × o ÷ pendiente, o sin operación, divide entre 100', () => {
  const calculator = loadCalculator();
  calculator.evaluate("inputDigit('2'); inputDigit('0'); inputDigit('0'); chooseOperator('*'); inputDigit('1'); inputDigit('0'); porcentaje();");
  assert.equal(calculator.evaluate('Number(state.current)'), 0.1);
  calculator.evaluate('equals();');
  assert.equal(calculator.evaluate('Number(state.current)'), 20);

  calculator.evaluate("clear(); inputDigit('5'); inputDigit('0'); porcentaje();");
  assert.equal(calculator.evaluate('Number(state.current)'), 0.5);
  // Un dígito después del % empieza otro operando.
  calculator.evaluate("inputDigit('7');");
  assert.equal(calculator.evaluate('state.current'), '7');
});

test('la tecla % aplica el porcentaje y el error lo bloquea', () => {
  const calculator = loadCalculator();
  calculator.keydown('5');
  calculator.keydown('%');
  assert.equal(calculator.evaluate('Number(state.current)'), 0.05);

  calculator.evaluate("clear(); inputDigit('1'); chooseOperator('/'); inputDigit('0'); equals(); porcentaje();");
  assert.equal(calculator.evaluate('state.error'), true);
  assert.equal(calculator.evaluate('state.current'), '0');
});

test('cambiar de signo alterna el operando en edición y se puede seguir escribiendo', () => {
  const calculator = loadCalculator();
  calculator.evaluate("inputDigit('1'); inputDigit('2'); cambiarSigno();");
  assert.equal(calculator.evaluate('state.current'), '-12');
  calculator.evaluate("inputDigit('3');");
  assert.equal(calculator.evaluate('state.current'), '-123');
  calculator.evaluate('cambiarSigno();');
  assert.equal(calculator.evaluate('state.current'), '123');

  // Sobre 0 no aparece un -0.
  calculator.evaluate('clear(); cambiarSigno();');
  assert.equal(calculator.evaluate('state.current'), '0');

  // Borrar hasta un -0 residual deja 0, no un -0 al que se le pegan dígitos.
  calculator.evaluate("clear(); inputDecimal(); inputDigit('5'); cambiarSigno(); backspace(); backspace();");
  calculator.evaluate("inputDigit('3');");
  assert.equal(calculator.evaluate('state.current'), '3');
});

test('cambiar de signo un resultado lo deja como operando', () => {
  const calculator = loadCalculator();
  calculator.evaluate("inputDigit('2'); chooseOperator('+'); inputDigit('3'); equals(); cambiarSigno(); chooseOperator('+'); inputDigit('1'); equals();");
  assert.equal(calculator.evaluate('Number(state.current)'), -4);

  // Con el operador recién elegido, niega el valor mostrado como operando nuevo.
  calculator.evaluate("clear(); inputDigit('8'); chooseOperator('+'); cambiarSigno(); equals();");
  assert.equal(calculator.evaluate('Number(state.current)'), 0);
});

test('tocar una entrada del historial la usa como operando sin duplicarla', () => {
  const calculator = loadCalculator();
  calculator.evaluate("inputDigit('7'); chooseOperator('+'); inputDigit('8'); equals(); clear(); inputDigit('2'); chooseOperator('+');");

  calculator.elemento('historial-lista').listeners.click({
    target: { closest: () => ({ dataset: { indice: '0' } }) },
  });
  assert.equal(calculator.elemento('resultado').textContent, '15');
  assert.equal(calculator.evaluate('historial.length'), 1);

  calculator.evaluate('equals();');
  assert.equal(calculator.evaluate('Number(state.current)'), 17);
});

test('cada entrada del historial es un botón y el contador refleja el tope', () => {
  const calculator = loadCalculator();
  assert.equal(calculator.elemento('historial-contador').textContent, '0 de 20');

  calculator.evaluate("inputDigit('2'); chooseOperator('+'); inputDigit('3'); equals(); render();");
  const [item] = calculator.elemento('historial-lista').children;
  const [boton] = item.children;
  assert.equal(boton.type, 'button');
  assert.equal(boton.dataset.indice, '0');
  assert.equal(calculator.elemento('historial-contador').textContent, '1 de 20');
});

test('el teclado básico ofrece % y ± y una pista de que acepta el teclado físico', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.match(html, /data-action="percent"/);
  assert.match(html, /data-action="sign"/);
  assert.match(html, /También podés usar el teclado/);
});
