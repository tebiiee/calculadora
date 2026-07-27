'use strict';

const MAX_DIGITS = 12;
const SIMBOLO = { '+': '+', '-': '−', '*': '×', '/': '÷' };
const HISTORIAL_CLAVE = 'calculadora:historial:v1';
const PANEL_CLAVE = 'calculadora:panel:v1';
const TEMA_CLAVE = 'calculadora:tema:v1';
const MAX_HISTORIAL = 20;
const TEMAS = ['grafito', 'negro', 'blanco', 'cian', 'rosa', 'violeta', 'verde', 'ambar'];
const TEMA_POR_DEFECTO = 'grafito';

const state = {
  current: '0',     // operando en edición (string, para controlar el '.')
  previous: null,   // operando acumulado (number)
  operator: null,   // '+' | '-' | '*' | '/'
  overwrite: false, // el próximo dígito reemplaza current
  error: false,     // solo clear() recupera
};

const elResultado = document.getElementById('resultado');
const elExpresion = document.getElementById('expresion');
const elHistorialLista = document.getElementById('historial-lista');
const elHistorialVacio = document.getElementById('historial-vacio');
const elHistorial = document.getElementById('historial');
const elHistorialToggle = document.getElementById('historial-toggle');
const elTema = document.getElementById('tema');

// --- Historial ------------------------------------------------------------
// Sin localStorage utilizable (Safari sobre file://, modo privado sin cuota)
// el historial vive solo en memoria y la calculadora se comporta igual.

/** Safari lanza SecurityError al leer la propiedad, no solo al usarla. */
function almacen() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function leerHistorial() {
  try {
    const crudo = almacen()?.getItem(HISTORIAL_CLAVE);
    if (!crudo) return [];
    const datos = JSON.parse(crudo);
    if (!Array.isArray(datos)) return [];
    return datos
      .filter((e) => e && typeof e.expresion === 'string' && typeof e.resultado === 'string')
      .slice(0, MAX_HISTORIAL);
  } catch {
    return []; // valor corrupto o de otra versión: se arranca vacío, sin propagar
  }
}

function guardarHistorial() {
  try {
    almacen()?.setItem(HISTORIAL_CLAVE, JSON.stringify(historial));
  } catch {
    // Cuota agotada o almacenamiento bloqueado: se sigue con el historial en memoria.
  }
}

/** Se invoca solo tras una evaluación efectiva; más recientes primero. */
function registrarOperacion(a, op, b, r) {
  historial.unshift({
    expresion: `${formatNumber(a)} ${SIMBOLO[op]} ${formatNumber(b)}`,
    resultado: formatNumber(r),
    ts: Date.now(),
  });
  if (historial.length > MAX_HISTORIAL) historial.length = MAX_HISTORIAL;
  guardarHistorial();
}

function limpiarHistorial() {
  historial = [];
  guardarHistorial();
}

let historial = leerHistorial();

// --- Panel lateral --------------------------------------------------------
// Se oculta con la propiedad `hidden`: saca el panel del layout y del orden de
// tabulación de una vez, y deja la calculadora centrada sin CSS adicional.

function leerPanelVisible() {
  try {
    return almacen()?.getItem(PANEL_CLAVE) !== 'oculto'; // por defecto, visible
  } catch {
    return true;
  }
}

function guardarPanelVisible(visible) {
  try {
    almacen()?.setItem(PANEL_CLAVE, visible ? 'visible' : 'oculto');
  } catch {
    // Igual que el historial: sin almacenamiento el estado dura la sesión.
  }
}

function aplicarPanel(visible) {
  elHistorial.hidden = !visible;
  elHistorialToggle.setAttribute('aria-expanded', String(visible));
}

// --- Tema -----------------------------------------------------------------
// Puramente visual: nada de aquí toca `state`, `historial` ni `render()`.
// El tema por defecto no lleva bloque en el CSS, hereda `:root`.

function leerTema() {
  try {
    const guardado = almacen()?.getItem(TEMA_CLAVE);
    return TEMAS.includes(guardado) ? guardado : TEMA_POR_DEFECTO;
  } catch {
    return TEMA_POR_DEFECTO; // valor corrupto o almacenamiento bloqueado
  }
}

function guardarTema(tema) {
  try {
    almacen()?.setItem(TEMA_CLAVE, tema);
  } catch {
    // Igual que el historial: sin almacenamiento el tema dura la sesión.
  }
}

function aplicarTema(tema) {
  document.documentElement.setAttribute('data-tema', tema);
  elTema.value = tema;
}
// --------------------------------------------------------------------------

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
    const b = Number(state.current);
    const r = compute(state.previous, state.operator, b);
    if (r === null) return setError();
    registrarOperacion(state.previous, state.operator, b, r);
    // Conserva el valor IEEE-754 completo; el redondeo pertenece solo al display.
    state.current = String(r);
  }
  state.previous = Number(state.current);
  state.operator = op;
  state.overwrite = true;
}

function equals() {
  // '=' repetido (o sin operando nuevo) no repite la última operación.
  if (state.error || state.operator === null || state.overwrite) return;
  const b = Number(state.current);
  const r = compute(state.previous, state.operator, b);
  if (r === null) return setError();
  registrarOperacion(state.previous, state.operator, b, r);
  state.current = String(r);
  state.previous = null;
  state.operator = null;
  state.overwrite = true;
}

function backspace() {
  if (state.error) return;
  // Un resultado o un operador recién elegido no está en modo de edición.
  if (state.overwrite) return;
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
  elResultado.textContent = state.error
    ? 'Error'
    : state.overwrite ? formatNumber(Number(state.current)) : state.current;
  elExpresion.textContent = state.operator === null
    ? ''
    : `${formatNumber(state.previous)} ${SIMBOLO[state.operator]}`;
  renderHistorial();
}

/** Reconstrucción completa: 20 nodos como máximo, siempre con textContent. */
function renderHistorial() {
  elHistorialVacio.hidden = historial.length > 0;
  elHistorialLista.textContent = '';
  for (const entrada of historial) {
    const item = document.createElement('li');
    item.className = 'historial-item';

    const expresion = document.createElement('span');
    expresion.className = 'historial-expresion';
    expresion.textContent = entrada.expresion;

    const resultado = document.createElement('span');
    resultado.className = 'historial-resultado';
    resultado.textContent = `= ${entrada.resultado}`;

    item.append(expresion, resultado);
    elHistorialLista.append(item);
  }
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

// Listener propio: colgarlo de #teclado colisionaría con el mapa ACCIONES.
document.getElementById('limpiar-historial').addEventListener('click', () => {
  limpiarHistorial();
  render();
});

elHistorialToggle.addEventListener('click', () => {
  const visible = elHistorial.hidden; // pasa a mostrarse
  aplicarPanel(visible);
  guardarPanelVisible(visible);
});

elTema.addEventListener('change', () => {
  const tema = TEMAS.includes(elTema.value) ? elTema.value : TEMA_POR_DEFECTO;
  aplicarTema(tema);
  guardarTema(tema);
});

document.addEventListener('keydown', (e) => {
  // En un <select> los dígitos hacen typeahead, así que la guarda es total y no
  // solo de las teclas de activación.
  if (e.target.closest?.('#tema')) return;
  // Enter y espacio pertenecen al control enfocado; los demás atajos siguen activos.
  if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('#historial, #historial-toggle')) return;
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

aplicarTema(leerTema());
aplicarPanel(leerPanelVisible());
render();
