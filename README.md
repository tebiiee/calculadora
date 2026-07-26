# Calculadora

Calculadora web con las cuatro operaciones básicas (suma, resta, multiplicación y división), escrita en HTML, CSS y JavaScript vanilla. Sin dependencias, sin build step y sin gestor de paquetes.

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
| `index.html` | Estructura: display y teclado de botones. |
| `styles.css` | Layout en grid, tema oscuro, foco visible, responsive. |
| `script.js` | Máquina de estado, cálculo, formateo, historial y eventos. |

## Atajos de teclado

| Tecla | Acción |
|---|---|
| `0`–`9` | Dígitos |
| `.` o `,` | Separador decimal |
| `+` `-` `*` (o `x`) `/` | Operadores |
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

## Historial

Bajo el teclado hay una lista con las operaciones ya evaluadas, la más reciente arriba.

- **Qué se registra**: cada evaluación efectiva, tanto al pulsar `=` como al encadenar. Coherente con la semántica de arriba, `2 + 3 + 4 =` deja **dos** entradas: `5 + 4 = 9` y `2 + 3 = 5`. No se registran los cálculos que terminan en `Error`, ni el `=` repetido, ni el operador que sustituye a otro.
- **Tope**: 20 entradas. La 21 desplaza a la más antigua.
- **Persistencia**: se guarda en `localStorage` bajo la clave `calculadora:historial:v1`, así que sobrevive a recargas y a cerrar el navegador. Un valor corrupto o de otra versión se ignora y el historial arranca vacío.
- **Limpiar**: el botón «Limpiar historial» vacía la lista y el almacenamiento. No hay atajo de teclado para él: `C` y `Escape` ya están tomados por limpiar la calculadora.
- **Privacidad**: las operaciones quedan en claro en el navegador de quien usa la app. No salen del equipo, pero son legibles desde DevTools.

## Limitaciones conocidas

- **Precisión**: se usa el punto flotante nativo IEEE-754. Los cálculos encadenados conservan el valor interno completo y el display redondea a 12 cifras significativas; aun así aplican las limitaciones habituales del punto flotante binario.
- **Longitud de entrada**: máximo 12 dígitos por operando.
- **Notación exponencial**: los resultados con valor absoluto ≥ 10¹² o < 10⁻⁹ se muestran en notación exponencial.
- **Tests**: `node --test calculator.test.js` cubre precisión encadenada, Backspace y navegación/atajos del historial. La comprobación visual sigue siendo manual.
- **Persistencia sobre `file://`**: abriendo `index.html` por doble clic, Safari bloquea `localStorage` (`SecurityError`) y Firefox es inconsistente; Chrome suele funcionar. Cuando el almacenamiento no está disponible, el historial funciona **en memoria durante la sesión** y se pierde al recargar — la calculadora sigue funcionando igual. Para persistencia garantizada, sirve la app con `python3 -m http.server 8000`.
- **Historial**: solo lectura. No se puede reutilizar una entrada con clic, ni borrarlas de una en una, ni exportarlas.
- **Fuera de alcance**: funciones científicas, porcentaje, cambio de signo y memoria.
