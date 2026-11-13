# APPS Retro

Escritorio de los años 80 en el navegador. Al hacer clic en el computador, se enciende, muestra el logo SM, la cámara se acerca al monitor y arranca **SM-DOS**. Desde la consola se pueden ejecutar los juegos guardados en `C:\JUEGOS`.

Necesita un servidor con PHP (por ejemplo MAMP) para el inicio de sesión y el ranking: abre `http://localhost:8888/juego_80s/` (o el puerto que use tu MAMP). Si se abre `index.html` directamente como archivo, el escritorio funciona, pero no se puede iniciar sesión para jugar.

## Cómo se usa

1. Abre el proyecto desde MAMP (`http://localhost:8888/juego_80s/`).
2. Haz clic en el computador.
3. Espera a que arranque SM-DOS. Al terminar, la consola muestra el contenido de `C:\JUEGOS`.
4. Escribe el nombre de un juego y pulsa Enter.
5. La primera vez tras encender el PC se pide el correo. Si no está registrado, aparece **USUARIO NO REGISTRADO** y la cámara se aleja del PC.

## Usuarios y ranking

- **Usuarios registrados:** `data/usuarios.real.json`. Para dar de alta a alguien, añade una línea `{ "correo": "...", "nombre": "..." }`. El nombre es lo que aparece en el ranking.
- **Ranking:** `data/ranking.real.json` guarda el mejor puntaje de cada usuario en cada juego. Se actualiza solo y no se borra al reiniciar: los datos de todos los usuarios se acumulan. Para reiniciar el ranking, deja el archivo con `{}`.
- Se guarda el puntaje al terminar cada partida y al cerrar el juego, con `ESC` o porque se acaba el tiempo. Solo se escribe si supera el mejor puntaje anterior del usuario.
- Antes de cada juego se muestra la tabla de mejores puntajes, al estilo arcade (`ENTER` la salta). El comando `RANKING` de la consola muestra las tablas de todos los juegos.
- **Clasificación general (premio único):** como cada juego da puntajes muy distintos, en cada juego el mejor puntaje vale 1.000 y los demás reciben la parte proporcional (`puntaje / mejor × 1.000`). Se suman los tres juegos, con un máximo de 3.000, así que gana el jugador más completo. Si hay empate, gana quien consiguió antes su último puntaje.
- **Concurso:** en `data/concurso.json` se ponen el nombre y las fechas, por ejemplo `{ "nombre": "Copa SM", "desde": "2026-11-16", "hasta": "2026-11-30" }`. Antes de `desde`, todo cuenta como práctica. Desde ese día solo cuentan las partidas del concurso: los puntajes anteriores no se muestran y se reemplazan con la primera partida. Después de `hasta`, el ranking se congela y no se guardan más puntajes. Con `null` en las dos fechas, cuentan todos los puntajes. Las fechas usan la hora de Chile (`America/Santiago` en `api/ranking.php`).
- **Resultados del concurso (oculto):** `cd..`, `cd resultados` y `print "resultados"`. Se piden usuario y contraseña (`data/admin.json`; en modo simulación no se piden; el usuario no distingue mayúsculas) y se muestra la clasificación general completa al estilo BASIC, con cursor de bloque. Los puestos se revelan desde el último hasta el primero, con pausas más largas al llegar al 3.º y al 2.º y un momento de suspenso antes del campeón, que aparece con una copa y una fanfarria. Las flechas, RePág/AvPág e Inicio/Fin recorren la tabla; ESC vuelve a SM-DOS. Escribir `resultados` como si fuera un programa da `?Syntax error`, y `print resultados` sin comillas da ` 0`, como en GW-BASIC.
- **Final (`salir`):** después de ver los resultados, al escribir `salir` (o `salir()` / `function salir`) en `C:\RESULTADOS` aparece "Muchas gracias por participar / Hasta el próximo año" con una melodía. Luego la cámara vuelve al escritorio, el PC se apaga, la lámpara se apaga y todo funde a negro; la música de la radio, si sonaba, se apaga poco a poco. Para empezar de nuevo hay que recargar la página. Si se escribe `salir` antes de ver los resultados, responde `?Illegal function call`.
- **Cambiar la contraseña de resultados:** genera el hash con `php -r 'echo password_hash("nueva-clave", PASSWORD_DEFAULT);'` y pégalo en el campo `clave` de `data/admin.json` (dentro de `administradores`). El nombre está en el campo `usuario`. Puede haber varios administradores.
- **Simulación (`data/admin.json`):** dos interruptores independientes.
  - `"usuariosReales"`: con `true`, el servidor comprueba el correo en `data/usuarios.real.json`. Con `false` (hosting sin PHP, como Vercel), solo pueden jugar los correos de `usuariosSimulacion` del mismo archivo (si la lista está vacía, sirve cualquier correo).
  - `"rankingReal"`: con `true`, se usa `data/ranking.real.json`. Con `false`, el ranking y la clasificación general muestran jugadores de ejemplo (de `assets/js/simulacion.js`) más los puntajes del visitante, que se guardan solo en su navegador, y `print "resultados"` muestra la clasificación simulada sin pedir usuario ni contraseña.
  - Combinaciones: **prueba de acceso** `true` / `false` (usuarios reales, ranking de ejemplo); **producción** `true` / `true`; **Vercel** `false` / `false`. La pantalla de acceso muestra `RANKING DE PRUEBA` o `MODO SIMULACIÓN` cuando algo está simulado.
  - **Subir a Vercel:** pon los dos interruptores en `false` antes de publicar. `.vercelignore` evita que se suban `api/` y los archivos con correos y puntajes reales, pero `data/admin.json` sí se publica (Vercel no aplica `data/.htaccess`), incluido el hash de la contraseña. Si te preocupa, en la copia de Vercel puedes dejar `"administradores": []`.
- `api/ranking.php` es el único que lee y escribe esos archivos; `data/.htaccess` impide descargarlos directamente.
- La carpeta `data/` necesita permiso de escritura para el usuario del servidor web.

### Comandos de SM-DOS

| Comando | Qué hace |
|---|---|
| `DIR` | Lista los archivos del directorio actual |
| `CD JUEGOS`, `CD..`, `CD\` | Cambia de directorio |
| `CLS` | Borra la pantalla |
| `VER` | Muestra la versión |
| `RANKING` | Clasificación general y mejores puntajes de cada juego (una tabla por página) |
| `GENERAL` | Clasificación general a pantalla completa, con el desglose por juego |
| `AYUDA` o `HELP` | Lista los comandos |
| `INVASION`, `BLOQUES`, `RATON` | Ejecuta el juego (desde `C:\JUEGOS`) |

## Juegos

Todos se ejecutan dentro del monitor. `ESC` vuelve a SM-DOS, `P` pausa y el récord de cada juego se guarda en el navegador.

### Tiempo de juego diario

Hay **10 minutos de juego al día** (ahora mismo **5 minutos, para pruebas**: cambia `TIEMPO_JUEGO` en `assets/js/app.js` a `10 * 60 * 1000`). La cuenta atrás empieza al abrir el primer juego, se ve arriba a la derecha mientras se juega (en rojo el último minuto, con un pitido de PC cuando quedan 10 segundos) y es la misma para todos los juegos: salir de uno y entrar en otro no la reinicia. Al llegar a 0, el juego se cierra, SM-DOS muestra un recuadro gris de error de tiempo agotado y el computador se apaga volviendo a la vista inicial del escritorio; después la lámpara parpadea y se apaga (`fondo0-apagado.png`) y sigue apagada el resto del día. Hasta el día siguiente, abrir un juego vuelve a mostrar ese error.

El tiempo se guarda en el navegador (`localStorage`, clave `smdos-tiempo-juego`), así que recargar la página no lo reinicia. Para probar, se puede borrar esa clave o cambiar `TIEMPO_JUEGO` en `assets/js/app.js`.

| Juego | Descripción | Controles |
|---|---|---|
| **INVASION.EXE** | Una flota alienígena baja en formación; destrúyela antes de que llegue al suelo. | `←` `→` mover · `ESPACIO` disparar |
| **BLOQUES.EXE** | Encaja las piezas que caen y completa líneas para borrarlas. | `←` `→` mover · `↑`/`X` girar · `Z` girar al revés · `↓` bajar · `ESPACIO` soltar |
| **RATON.EXE** | Un ratón come queso en un laberinto mientras cuatro gatos lo persiguen. El queso grande hace que los gatos huyan. | Flechas o `WASD` |

## Estructura

```
index.html                  Página principal
api/ranking.php             Inicio de sesión y ranking (lee y escribe data/*.json)
data/usuarios.real.json     Usuarios registrados
data/ranking.real.json      Mejor puntaje de cada usuario en cada juego
data/concurso.json          Fechas del concurso (opcional)
data/admin.json             Modo simulación y usuarios con acceso a C:\RESULTADOS (contraseña cifrada)
.vercelignore               Archivos que no se suben a Vercel (datos reales y PHP)
assets/
  audio/cancion.mp3         Canción de la radio (clic en la radio para reproducir o pausar)
  css/styles.css            Escena, pantalla CRT, consola y zoom
  img/fondo0.png            Imagen del escritorio
  img/et-figura.png         Silueta del póster de E.T. que sale volando al hacer clic
  img/et-luna*.png          La luna del póster sin la silueta (lámpara encendida y apagada)
  img/logo_ms_dos.png       Logo SM que aparece en el monitor al encender
  img/fondo0-apagado.png    El escritorio con la lámpara apagada (tras acabarse el tiempo)
  js/
    app.js                  Encendido, arranque de SM-DOS, zoom y comandos
    juegos.js               Lista de archivos de C:\JUEGOS
    simulacion.js           Modo simulación: jugadores de ejemplo y API sin servidor
    resultados.js           C:\RESULTADOS: PRINT "resultados", acceso y tabla al estilo BASIC
    poster-et.js            Clic en el póster de E.T.: la figura despega, cruza la habitación y vuelve
    sonido-pc.js            Sonido del PC: ventilador, disco duro y pitido de la BIOS (Web Audio)
    juegos/
      invasion.js
      bloques.js
      raton.js
```

El encendido y la consola se dibujan con código sobre `fondo0.png`; el logo es `logo_ms_dos.png`. Las demás imágenes de `assets/img/` (`fondo.png`, `fondo1.png` y los logos) no se usan; se guardaron como referencia.

## Añadir un juego

1. Crea `assets/js/juegos/mijuego.js` con un objeto global que tenga el método `iniciar(contenedor, alSalir)`:

   ```js
   window.MiJuego = (() => {
       // opciones.record: mejor puntaje del ranking · opciones.alPuntuar(puntos): guarda el puntaje
       function iniciar(contenedor, alSalir, opciones = {}) {
           const canvas = document.createElement("canvas");
           canvas.width = 320;
           canvas.height = 240;
           contenedor.append(canvas);
           // ... bucle del juego y teclado ...
           // Al terminar una partida: opciones.alPuntuar?.(puntos)
           // Al pulsar ESC: opciones.alPuntuar?.(puntos), quitar listeners, canvas.remove() y llamar a alSalir()
           return salir; // permite que SM-DOS cierre el juego cuando se acaba el tiempo
       }
       return { iniciar };
   })();
   ```

   El canvas de 320×240 se escala para ocupar la pantalla del monitor. Puedes copiar cualquiera de los juegos existentes como plantilla.

2. Cárgalo en `index.html` antes de `juegos.js`:

   ```html
   <script src="assets/js/juegos/mijuego.js"></script>
   ```

3. Añádelo a la lista de `assets/js/juegos.js`. El nombre puede tener hasta 8 caracteres:

   ```js
   { nombre: "MIJUEGO", ext: "EXE", tam: 20480, fecha: "10-11-86", programa: "MiJuego" },
   ```

   En lugar de `programa` puedes poner `url: "ruta/a/pagina.html"` para abrir el juego en otra página.

## Ajustes

- **Tiempos de la introducción:** las constantes al principio de `assets/js/app.js`. Si cambias `DURACION_ZOOM`, cambia también la `transition` de `.escena` en el CSS.
- **Posición de la pantalla sobre la imagen:** `.pantalla` (`left`, `top`, `width` y `height`) en `styles.css`.
- **Zona en la que se puede hacer clic:** `.computador` en `styles.css`.

## Limitaciones

- Para escribir en SM-DOS y jugar hace falta un teclado físico; en móviles y tabletas no aparece el teclado en pantalla.
