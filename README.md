# Calculadora

Calculadora web con las cuatro operaciones básicas (suma, resta, multiplicación y división) y un modo científico conmutable, escrita en HTML, CSS y JavaScript vanilla. Sin dependencias, sin build step y sin gestor de paquetes.

## Cómo abrirla

Doble clic en `index.html`. La app funciona directamente sobre `file://` — usa un `<script defer>` clásico, no ES modules, precisamente para no depender de un servidor.

Opcionalmente, sirviéndola de forma estática:

```sh
python3 -m http.server 8000
# http://localhost:8000
```

## Archivos

| Archivo | Contenido |
|---|---|
| `index.html` | Estructura: calculadora (display, selector de tema, teclado y bloque científico) y panel lateral de historial. |
| `styles.css` | Layout en grid, los 8 temas de color, foco visible, responsive. |
| `script.js` | Máquina de estado, cálculo, funciones científicas, formateo, historial, tema, modo y eventos. |

## Atajos de teclado

| Tecla | Acción |
|---|---|
| `0`–`9` | Dígitos |
| `.` o `,` | Separador decimal |
| `+` `-` `*` (o `x`) `/` | Operadores |
| `^` | Potencia — **solo con el modo científico activo** |
| `Enter` o `=` | Calcular |
| `Backspace` | Borrar el último carácter |
| `Escape` o `C` | Limpiar todo |

## Semántica fijada

Las calculadoras reales no se comportan igual entre sí en los casos límite. Estas son las decisiones de este MVP:

- **Encadenado**: pulsar un operador con una operación pendiente evalúa la anterior. `2 + 3 + 4 =` da `9`, y el display ya muestra `5` al pulsar el segundo `+`.
- **`=` repetido**: no repite la última operación. `2 + 3 = =` se queda en `5`.
- **Operador pulsado dos veces**: el segundo sustituye al primero. `8 + / 2 =` da `4`.
- **División por cero**: el display muestra `Error` y la calculadora queda bloqueada hasta pulsar `C` (`Escape`), que la devuelve a `0`.
- **Decimal**: un solo punto por operando; el segundo `.` se ignora.
- **Backspace**: sobre un único dígito (o sobre un signo negativo residual) deja `0`. Después de elegir un operador o mostrar un resultado no altera ese valor; el siguiente dígito inicia un operando nuevo.

## Modo científico

El botón «Científica» de la cabecera despliega un bloque de 11 teclas al final del teclado. El modo básico no cambia: las teclas de arriba conservan orden, etiquetas y semántica, y con el modo apagado el bloque sale del layout y del orden de tabulación.

| Tecla | Qué hace |
|---|---|
| `√` `x²` `1/x` | Raíz cuadrada, cuadrado e inverso |
| `ln` `log` | Logaritmo natural y decimal |
| `sin` `cos` `tan` | Trigonométricas, **en grados** |
| `xʸ` | Potencia. Es un operador binario como `+`: `2 xʸ 10 =` da `1024` |
| `π` `e` | Constantes; sustituyen el operando en pantalla |

- **Aplicación inmediata**: todas menos `xʸ` son unarias y actúan sobre el número que se está viendo, sin esperar a `=`. `9 √` deja `3` en el display, y el dígito siguiente empieza un operando nuevo: `9 √ 5` deja `5`. No hay paréntesis ni precedencia — el motor sigue modelando una sola operación binaria pendiente.
- **El resultado sigue siendo un operando**: `9 + 3 √ =` da `10.7320508076`, y `2 + π +` encadena en lugar de sustituir el operador.
- **Errores de dominio**: `√` de un negativo, `ln 0`, `log 0`, `1/0` y `tan 90` muestran `Error` y bloquean la calculadora hasta `C` (`Escape`), igual que la división por cero. `tan 90°` es un error deliberado: la tangente se calcula como `sin/cos`, así que la singularidad se comporta como un `1/0` en vez de devolver el número enorme del punto flotante.
- **Grados, sin conmutador RAD/DEG**: `sin 180` da `0` exacto (se redondea a cero por debajo de `1e-12`, para no mostrar el `1.224647e-16` del punto flotante). En cambio `sin 3.14` da `0.0548`, porque 3.14 se interpreta como grados, no como radianes.
- **Persistencia**: la elección se guarda en `localStorage` bajo la clave `calculadora:modo:v1`. Cualquier otro valor —desconocido o corrupto— arranca en modo básico; sin almacenamiento disponible, el modo funciona en memoria durante la sesión.
- **Atajos**: solo `^`, y únicamente con el modo activo. Las letras candidatas (`s`, `c`, `l`) chocan con `C` = limpiar.
- **Destello al cargar**: como con el tema, `script.js` va con `defer`, así que el modo guardado entra tras el primer pintado. Aquí cambia el alto de la tarjeta, no solo el color.

## Historial

En un panel a la derecha de la calculadora hay una lista con las operaciones ya evaluadas, la más reciente arriba. En pantallas de menos de 720 px el panel se apila debajo.

- **Mostrar u ocultar**: el botón «Historial», junto al título de la calculadora, alterna el panel. Al ocultarlo la calculadora vuelve a quedar centrada y el panel sale del orden de tabulación. El estado se guarda en `localStorage` bajo la clave `calculadora:panel:v1`; sin almacenamiento disponible el panel arranca visible.
- **Qué se registra**: cada evaluación efectiva, tanto al pulsar `=` como al encadenar. Coherente con la semántica de arriba, `2 + 3 + 4 =` deja **dos** entradas: `5 + 4 = 9` y `2 + 3 = 5`. También las funciones unarias del modo científico, con su propia forma: `√(9) = 3`, `9² = 81`, `1/4 = 0.25`. No se registran los cálculos que terminan en `Error`, ni el `=` repetido, ni el operador que sustituye a otro, ni las constantes `π` y `e` (son entrada, no evaluación).
- **Tope**: 20 entradas. La 21 desplaza a la más antigua.
- **Persistencia**: se guarda en `localStorage` bajo la clave `calculadora:historial:v1`, así que sobrevive a recargas y a cerrar el navegador. Un valor corrupto o de otra versión se ignora y el historial arranca vacío.
- **Limpiar**: el botón «Limpiar historial» vacía la lista y el almacenamiento. No hay atajo de teclado para él: `C` y `Escape` ya están tomados por limpiar la calculadora.
- **Privacidad**: las operaciones quedan en claro en el navegador de quien usa la app. No salen del equipo, pero son legibles desde DevTools.

## Temas

El selector de la cabecera, junto a los botones «Científica» e «Historial», cambia la paleta de toda la interfaz. Es un cambio puramente visual: no altera el cálculo, el historial ni los atajos.

| Tema | |
|---|---|
| **Grafito** | El de siempre, y el que se usa por defecto. |
| **Negro** | Contraste máximo, acento blanco. |
| **Blanco** | El único claro; lleva su propia sombra, más suave. |
| **Cian**, **Rosa**, **Violeta**, **Verde**, **Ámbar** | Oscuros con acento de color. |

- **Persistencia**: la elección se guarda en `localStorage` bajo la clave `calculadora:tema:v1`. Un valor desconocido o corrupto se ignora y se arranca en Grafito.
- **Sobre `file://`**: sin almacenamiento disponible (ver más abajo) el tema funciona **en memoria durante la sesión** y al recargar se vuelve a Grafito.
- **Destello al cargar**: `script.js` va con `defer`, así que el primer pintado usa Grafito y el tema guardado entra inmediatamente después. Se acepta a cambio de mantener un único script diferido, sin JavaScript bloqueante en el `<head>`.
- **Sin atajo de teclado**: como en «Limpiar historial», las teclas candidatas ya están tomadas. Con el foco en el selector los atajos de la calculadora quedan desactivados por completo, porque en un `<select>` los dígitos sirven para buscar entre las opciones.
- **Contraste**: en los 8 temas todo par de texto sobre su fondo llega a 4.5:1 (WCAG AA) y el contorno de foco a 3:1. La única excepción, heredada del diseño original, es la etiqueta de las teclas de acción (`AC`, `⌫`) en Grafito **mientras el puntero está encima**: 4.41:1.

## Limitaciones conocidas

- **Precisión**: se usa el punto flotante nativo IEEE-754. Los cálculos encadenados conservan el valor interno completo y el display redondea a 12 cifras significativas; aun así aplican las limitaciones habituales del punto flotante binario.
- **Longitud de entrada**: máximo 12 dígitos por operando.
- **Notación exponencial**: los resultados con valor absoluto ≥ 10¹² o < 10⁻⁹ se muestran en notación exponencial.
- **Tests**: `node --test calculator.test.js` cubre precisión encadenada, Backspace, navegación/atajos del historial, el panel conmutable (visibilidad, `aria-expanded`, persistencia), el selector de temas (aplicación, aislamiento del estado, persistencia, valor desconocido, ausencia de almacenamiento, teclado) y el modo científico (conmutador y `aria-pressed`, persistencia, valor desconocido, ausencia de almacenamiento, aislamiento del estado, semántica de las unarias, errores de dominio, potencia y grados). Ni el posicionamiento del panel, ni los colores, ni la rejilla del bloque científico tienen test: la comprobación visual sigue siendo manual.
- **Persistencia sobre `file://`**: abriendo `index.html` por doble clic, Safari bloquea `localStorage` (`SecurityError`) y Firefox es inconsistente; Chrome suele funcionar. Cuando el almacenamiento no está disponible, el historial, el tema y el modo científico funcionan **en memoria durante la sesión** y se pierden al recargar — la calculadora sigue funcionando igual. Para persistencia garantizada, sirve la app con `python3 -m http.server 8000`.
- **Historial**: solo lectura. No se puede reutilizar una entrada con clic, ni borrarlas de una en una, ni exportarlas.
- **Temas**: los 8 son fijos. No hay modo automático claro/oscuro (`prefers-color-scheme`), ni transición al cambiar de paleta, ni colores personalizables.
- **Modo científico**: sin paréntesis ni precedencia de operadores, sin conmutador RAD/DEG, sin hiperbólicas ni factorial, y sin arcoseno/arcocoseno/arcotangente.
- **Fuera de alcance**: porcentaje, cambio de signo y memoria (`M+`, `MR`).
