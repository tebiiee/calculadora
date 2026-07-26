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
| `script.js` | Máquina de estado, cálculo, formateo y eventos. |

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
- **Backspace**: sobre un único dígito (o sobre un signo negativo residual) deja `0`.

## Limitaciones conocidas

- **Precisión**: se usa el punto flotante nativo IEEE-754 con redondeo de presentación a 12 cifras significativas. Eso hace que `0.1 + 0.2` muestre `0.3` en lugar de `0.30000000000000004`, pero también implica que un resultado legítimo con más de 12 cifras significativas se redondea.
- **Longitud de entrada**: máximo 12 dígitos por operando.
- **Notación exponencial**: los resultados con valor absoluto ≥ 10¹² o < 10⁻⁹ se muestran en notación exponencial.
- **Sin tests automatizados**: el proyecto no tiene lint, tests ni typecheck configurados. La verificación de los criterios de aceptación es manual.
- **Fuera de alcance**: funciones científicas, porcentaje, cambio de signo, memoria, historial y persistencia.
