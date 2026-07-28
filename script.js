'use strict';

const MAX_DIGITS = 12;
const SIMBOLO = { '+': '+', '-': '−', '*': '×', '/': '÷', '^': '^' };
const HISTORIAL_CLAVE = 'calculadora:historial:v1';
const PANEL_CLAVE = 'calculadora:panel:v1';
const TEMA_CLAVE = 'calculadora:tema:v1';
const MODO_CLAVE = 'calculadora:modo:v1';
const MAX_HISTORIAL = 20;
const TEMAS = ['grafito', 'negro', 'blanco', 'cian', 'rosa', 'violeta', 'verde', 'ambar'];
const TEMA_POR_DEFECTO = 'grafito';

const state = {
  current: '0',     // operando en edición (string, para controlar el '.')
  previous: null,   // operando acumulado (number)
  operator: null,   // '+' | '-' | '*' | '/'
  overwrite: false, // el próximo dígito reemplaza current
  // Se eligió operador o '=' y todavía no hay operando nuevo. Coincide con
  // `overwrite` en todos los flujos de teclado, pero no en un resultado
  // recién calculado que sí cuenta como operando.
  esperandoOperando: false,
  error: false,     // solo clear() recupera
};

const elResultado = document.getElementById('resultado');
const elExpresion = document.getElementById('expresion');
const elHistorialLista = document.getElementById('historial-lista');
const elHistorialVacio = document.getElementById('historial-vacio');
const elHistorial = document.getElementById('historial');
const elHistorialToggle = document.getElementById('historial-toggle');
const elTema = document.getElementById('tema');
const elModoToggle = document.getElementById('modo-toggle');
const elTecladoCientifico = document.getElementById('teclado-cientifico');

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
function anotar(expresion, r) {
  historial.unshift({ expresion, resultado: formatNumber(r), ts: Date.now() });
  if (historial.length > MAX_HISTORIAL) historial.length = MAX_HISTORIAL;
  guardarHistorial();
}

function registrarOperacion(a, op, b, r) {
  anotar(`${formatNumber(a)} ${SIMBOLO[op]} ${formatNumber(b)}`, r);
}

function registrarFuncion(nombre, x, r) {
  anotar(FUNCIONES[nombre].etiqueta(formatNumber(x)), r);
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

// --- Modo científico ------------------------------------------------------
// Solo muestra u oculta teclas: no toca `state` ni `historial`. Cualquier
// valor guardado que no sea 'cientifico' cae al modo básico.

let modoCientifico = false;

function leerModo() {
  try {
    return almacen()?.getItem(MODO_CLAVE) === 'cientifico';
  } catch {
    return false; // valor corrupto o almacenamiento bloqueado
  }
}

function guardarModo(cientifico) {
  try {
    almacen()?.setItem(MODO_CLAVE, cientifico ? 'cientifico' : 'basico');
  } catch {
    // Igual que el tema: sin almacenamiento el modo dura la sesión.
  }
}

function aplicarModo(cientifico) {
  modoCientifico = cientifico;
  elTecladoCientifico.hidden = !cientifico;
  elModoToggle.setAttribute('aria-pressed', String(cientifico));
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
    case '^': r = Math.pow(a, b); break;
    default: return null;
  }
  return Number.isFinite(r) ? r : null;
}

// --- Funciones científicas ------------------------------------------------
// Unarias: se aplican de inmediato sobre el operando en pantalla, así que la
// máquina de estado sigue modelando solo operaciones binarias. Ninguna lleva
// guarda de dominio: √(-9) da NaN, ln(0) da -Infinity y 1/0 da Infinity, y
// aplicarFuncion() los convierte en Error con la misma prueba que compute().

const EPSILON_TRIG = 1e-12;

const radianes = (g) => (g * Math.PI) / 180;
/** Sin esto sin(180°) mostraría 1.224647e-16 en vez de 0. */
const limpiar = (x) => (Math.abs(x) < EPSILON_TRIG ? 0 : x);
const seno = (g) => limpiar(Math.sin(radianes(g)));
const coseno = (g) => limpiar(Math.cos(radianes(g)));

const FUNCIONES = {
  raiz: { aplicar: Math.sqrt, etiqueta: (x) => `√(${x})` },
  cuadrado: { aplicar: (x) => x * x, etiqueta: (x) => `${x}²` },
  inverso: { aplicar: (x) => 1 / x, etiqueta: (x) => `1/${x}` },
  ln: { aplicar: Math.log, etiqueta: (x) => `ln(${x})` },
  log: { aplicar: Math.log10, etiqueta: (x) => `log(${x})` },
  sin: { aplicar: seno, etiqueta: (x) => `sin(${x})` },
  cos: { aplicar: coseno, etiqueta: (x) => `cos(${x})` },
  // sin/cos y no Math.tan: así tan(90°) es 1/0 → Error, la singularidad real,
  // en vez del 1.633e16 que devuelve el punto flotante.
  tan: { aplicar: (g) => seno(g) / coseno(g), etiqueta: (x) => `tan(${x})` },
};

const CONSTANTES = { pi: Math.PI, e: Math.E };

function contarDigitos(s) {
  return s.replace(/[^0-9]/g, '').length;
}

function inputDigit(d) {
  if (state.error) return;
  if (state.overwrite || state.current === '0') {
    state.current = d;
    state.overwrite = false;
    state.esperandoOperando = false;
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
    state.esperandoOperando = false;
    return;
  }
  if (state.current.includes('.')) return;
  state.current += '.';
}

function chooseOperator(op) {
  if (state.error) return;
  // Operador pulsado dos veces seguidas: sustituye al anterior, no evalúa.
  if (state.operator !== null && state.esperandoOperando) {
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
  state.esperandoOperando = true;
}

function equals() {
  // '=' repetido (o sin operando nuevo) no repite la última operación.
  if (state.error || state.operator === null || state.esperandoOperando) return;
  const b = Number(state.current);
  const r = compute(state.previous, state.operator, b);
  if (r === null) return setError();
  registrarOperacion(state.previous, state.operator, b, r);
  state.current = String(r);
  state.previous = null;
  state.operator = null;
  state.overwrite = true;
  state.esperandoOperando = true;
}

/** El resultado no está en edición, pero sí es un operando: no espera otro. */
function aplicarFuncion(nombre) {
  if (state.error) return;
  const x = Number(state.current);
  const r = FUNCIONES[nombre].aplicar(x);
  if (!Number.isFinite(r)) return setError();
  registrarFuncion(nombre, x, r);
  state.current = String(r);
  state.overwrite = true;
  state.esperandoOperando = false;
}

/** Una constante es entrada, no evaluación: no se registra en el historial. */
function inputConstante(nombre) {
  if (state.error) return;
  state.current = String(CONSTANTES[nombre]);
  state.overwrite = true;
  state.esperandoOperando = false;
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
  state.esperandoOperando = false;
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
  // El bloque científico va dentro de #teclado, así que `closest` lo cubre
  // con este mismo listener.
  const { digit, op, action, fn, constante } = boton.dataset;
  if (digit !== undefined) inputDigit(digit);
  else if (op !== undefined) chooseOperator(op);
  else if (action !== undefined) ACCIONES[action]();
  else if (fn !== undefined) aplicarFuncion(fn);
  else if (constante !== undefined) inputConstante(constante);
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

elModoToggle.addEventListener('click', () => {
  const cientifico = elTecladoCientifico.hidden; // pasa a mostrarse
  aplicarModo(cientifico);
  guardarModo(cientifico);
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
  if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('#historial, #historial-toggle, #modo-toggle')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;

  if (k >= '0' && k <= '9') inputDigit(k);
  else if (k === '.' || k === ',') inputDecimal();
  else if (k === '+' || k === '-') chooseOperator(k);
  else if (k === '*' || k === 'x' || k === 'X') chooseOperator('*');
  else if (k === '/') { e.preventDefault(); chooseOperator('/'); } // evita el quick-find de Firefox
  // Único atajo del modo científico, y solo con el modo activo: el básico no
  // gana comportamiento oculto. Las letras (s, c, l) chocan con C = limpiar.
  else if (k === '^' && modoCientifico) chooseOperator('^');
  else if (k === 'Enter' || k === '=') { e.preventDefault(); equals(); }
  else if (k === 'Backspace') { e.preventDefault(); backspace(); }
  else if (k === 'Escape' || k === 'c' || k === 'C') clear();
  else return;

  render();
});

aplicarTema(leerTema());
aplicarPanel(leerPanelVisible());
aplicarModo(leerModo());
render();
