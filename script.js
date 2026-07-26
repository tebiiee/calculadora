'use strict';

const MAX_DIGITS = 12;
const SIMBOLO = { '+': '+', '-': '−', '*': '×', '/': '÷' };

const state = {
  current: '0',     // operando en edición (string, para controlar el '.')
  previous: null,   // operando acumulado (number)
  operator: null,   // '+' | '-' | '*' | '/'
  overwrite: false, // el próximo dígito reemplaza current
  error: false,     // solo clear() recupera
};

const elResultado = document.getElementById('resultado');
const elExpresion = document.getElementById('expresion');

/** Redondeo de presentación: mata el ruido IEEE-754 y evita desbordar el display. */
function formatNumber(n) {
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e12 || abs < 1e-9) return n.toExponential(6);
  return String(parseFloat(n.toPrecision(12)));
}

/** Devuelve null cuando el resultado no es representable (división por cero, overflow). */
function compute(a, op, b) {
  let r;
  switch (op) {
    case '+': r = a + b; break;
    case '-': r = a - b; break;
    case '*': r = a * b; break;
    case '/': r = b === 0 ? NaN : a / b; break;
    default: return null;
  }
  return Number.isFinite(r) ? r : null;
}

function contarDigitos(s) {
  return s.replace(/[^0-9]/g, '').length;
}

function inputDigit(d) {
  if (state.error) return;
  if (state.overwrite || state.current === '0') {
    state.current = d;
    state.overwrite = false;
    return;
  }
  if (contarDigitos(state.current) >= MAX_DIGITS) return;
  state.current += d;
}

function inputDecimal() {
  if (state.error) return;
  if (state.overwrite) {
    state.current = '0.';
    state.overwrite = false;
    return;
  }
  if (state.current.includes('.')) return;
  state.current += '.';
}

function chooseOperator(op) {
  if (state.error) return;
  // Operador pulsado dos veces seguidas: sustituye al anterior, no evalúa.
  if (state.operator !== null && state.overwrite) {
    state.operator = op;
    return;
  }
  // Encadenado: hay operación pendiente y un operando nuevo → evalúa primero.
  if (state.operator !== null) {
    const r = compute(state.previous, state.operator, Number(state.current));
    if (r === null) return setError();
    state.current = formatNumber(r);
  }
  state.previous = Number(state.current);
  state.operator = op;
  state.overwrite = true;
}

function equals() {
  // '=' repetido (o sin operando nuevo) no repite la última operación.
  if (state.error || state.operator === null || state.overwrite) return;
  const r = compute(state.previous, state.operator, Number(state.current));
  if (r === null) return setError();
  state.current = formatNumber(r);
  state.previous = null;
  state.operator = null;
  state.overwrite = true;
}

function backspace() {
  if (state.error) return;
  const recortado = state.current.slice(0, -1);
  state.current = recortado === '' || recortado === '-' ? '0' : recortado;
  state.overwrite = false;
}

function clear() {
  state.current = '0';
  state.previous = null;
  state.operator = null;
  state.overwrite = false;
  state.error = false;
}

function setError() {
  clear();
  state.error = true;
}

function render() {
  elResultado.textContent = state.error ? 'Error' : state.current;
  elExpresion.textContent = state.operator === null
    ? ''
    : `${formatNumber(state.previous)} ${SIMBOLO[state.operator]}`;
}

const ACCIONES = {
  equals,
  clear,
  backspace,
  decimal: inputDecimal,
};

document.getElementById('teclado').addEventListener('click', (e) => {
  const boton = e.target.closest('button');
  if (!boton) return;
  const { digit, op, action } = boton.dataset;
  if (digit !== undefined) inputDigit(digit);
  else if (op !== undefined) chooseOperator(op);
  else if (action !== undefined) ACCIONES[action]();
  render();
});

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;

  if (k >= '0' && k <= '9') inputDigit(k);
  else if (k === '.' || k === ',') inputDecimal();
  else if (k === '+' || k === '-') chooseOperator(k);
  else if (k === '*' || k === 'x' || k === 'X') chooseOperator('*');
  else if (k === '/') { e.preventDefault(); chooseOperator('/'); } // evita el quick-find de Firefox
  else if (k === 'Enter' || k === '=') { e.preventDefault(); equals(); }
  else if (k === 'Backspace') { e.preventDefault(); backspace(); }
  else if (k === 'Escape' || k === 'c' || k === 'C') clear();
  else return;

  render();
});

render();
