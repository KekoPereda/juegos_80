// BLOQUES.EXE — juego de piezas que caen para SM-DOS
// Se ejecuta dentro de la pantalla del monitor: Bloques.iniciar(contenedor, alSalir)
window.Bloques = (() => {
    const W = 320;
    const H = 240;
    const COLUMNAS = 10;
    const FILAS = 20;
    const CELDA = 10;
    const TABLERO_X = 110;
    const TABLERO_Y = 20;

    const COLORES = {
        texto: "#c8c8c8",
        titulo: "#55ffff",
        borde: "#55ff55",
        rejilla: "#101810",
    };

    // Piezas de 4 bloques: forma inicial (se rota por código) y color
    const PIEZAS = [
        { forma: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], color: "#55ffff" },
        { forma: [[1, 1], [1, 1]], color: "#ffff55" },
        { forma: [[0, 1, 0], [1, 1, 1], [0, 0, 0]], color: "#ff55ff" },
        { forma: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], color: "#55ff55" },
        { forma: [[1, 1, 0], [0, 1, 1], [0, 0, 0]], color: "#ff5555" },
        { forma: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], color: "#5555ff" },
        { forma: [[0, 0, 1], [1, 1, 1], [0, 0, 0]], color: "#ffaa00" },
    ];

    const PUNTOS_LINEAS = [0, 100, 300, 500, 800];

    // ---------- Sonido ----------

    let audio = null;
    function sonar(frecuencia, duracion, tipo = "square", volumen = 0.05) {
        try {
            audio ??= new (window.AudioContext || window.webkitAudioContext)();
            const osc = audio.createOscillator();
            const gan = audio.createGain();
            osc.type = tipo;
            osc.frequency.value = frecuencia;
            gan.gain.setValueAtTime(volumen, audio.currentTime);
            gan.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duracion);
            osc.connect(gan).connect(audio.destination);
            osc.start();
            osc.stop(audio.currentTime + duracion);
        } catch {
            /* sin sonido */
        }
    }

    // ---------- Récord ----------

    function leerRecord() {
        try {
            return Number(localStorage.getItem("bloques-record")) || 0;
        } catch {
            return 0;
        }
    }

    function guardarRecord(valor) {
        try {
            localStorage.setItem("bloques-record", String(valor));
        } catch {
            /* sin almacenamiento */
        }
    }

    // ---------- Utilidades de piezas ----------

    function rotar(forma, sentido) {
        const n = forma.length;
        return forma.map((fila, y) =>
            fila.map((_, x) => (sentido > 0 ? forma[n - 1 - x][y] : forma[x][n - 1 - y]))
        );
    }

    function celdas(pieza) {
        const lista = [];
        pieza.forma.forEach((fila, y) =>
            fila.forEach((v, x) => {
                if (v) lista.push([pieza.x + x, pieza.y + y]);
            })
        );
        return lista;
    }

    // ---------- Juego ----------

    // opciones.record: mejor puntaje del ranking (si no, el récord guardado en este navegador)
    // opciones.alPuntuar(puntos): avisa del puntaje al terminar una partida o al cerrar el juego
    function iniciar(contenedor, alSalir, opciones = {}) {
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        contenedor.append(canvas);
        const ctx = canvas.getContext("2d");

        let activo = true;
        let ultimoTiempo = performance.now();

        let estado = "titulo"; // titulo | jugando | limpiando | pausa | fin
        let tablero, pieza, siguiente, bolsa;
        let puntos = 0;
        let lineas = 0;
        let nivel = 1;
        let record = opciones.record ?? leerRecord();
        let tiempoCaida = 0;
        let filasLlenas = [];
        let tiempoLimpieza = 0;

        // Repetición de teclas mantenidas (izquierda, derecha, abajo)
        const repeticion = { tecla: null, espera: 0 };
        let bajando = false;

        function nuevaPartida() {
            tablero = Array.from({ length: FILAS }, () => Array(COLUMNAS).fill(null));
            puntos = 0;
            lineas = 0;
            nivel = 1;
            bolsa = [];
            siguiente = sacarPieza();
            nuevaPieza();
            estado = "jugando";
        }

        // Bolsa de las 7 piezas barajadas: reparto más justo
        function sacarPieza() {
            if (bolsa.length === 0) {
                bolsa = PIEZAS.map((_, i) => i);
                for (let i = bolsa.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [bolsa[i], bolsa[j]] = [bolsa[j], bolsa[i]];
                }
            }
            const tipo = PIEZAS[bolsa.pop()];
            return { forma: tipo.forma.map((f) => [...f]), color: tipo.color, x: 0, y: 0 };
        }

        function nuevaPieza() {
            pieza = siguiente;
            pieza.x = Math.floor((COLUMNAS - pieza.forma.length) / 2);
            pieza.y = pieza.forma.length === 4 ? -1 : 0;
            siguiente = sacarPieza();
            tiempoCaida = 0;
            if (!cabe(pieza)) terminarPartida();
        }

        function cabe(p) {
            return celdas(p).every(([x, y]) => x >= 0 && x < COLUMNAS && y < FILAS && (y < 0 || !tablero[y][x]));
        }

        function mover(dx, dy) {
            const prueba = { ...pieza, x: pieza.x + dx, y: pieza.y + dy };
            if (!cabe(prueba)) return false;
            pieza = prueba;
            return true;
        }

        function girar(sentido) {
            const forma = rotar(pieza.forma, sentido);
            // Si choca, prueba a desplazarla un poco a los lados o arriba
            for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]]) {
                const prueba = { ...pieza, forma, x: pieza.x + dx, y: pieza.y + dy };
                if (cabe(prueba)) {
                    pieza = prueba;
                    sonar(520, 0.04);
                    return;
                }
            }
        }

        function caerDelTodo() {
            let filas = 0;
            while (mover(0, 1)) filas++;
            puntos += filas * 2;
            fijar();
        }

        function fijar() {
            for (const [x, y] of celdas(pieza)) {
                if (y < 0) {
                    terminarPartida();
                    return;
                }
                tablero[y][x] = pieza.color;
            }
            sonar(160, 0.06, "triangle", 0.08);

            filasLlenas = tablero.map((fila, y) => (fila.every(Boolean) ? y : -1)).filter((y) => y >= 0);
            if (filasLlenas.length) {
                estado = "limpiando";
                tiempoLimpieza = 0.35;
                sonar(filasLlenas.length === 4 ? 1040 : 660, 0.25, "square", 0.07);
            } else {
                nuevaPieza();
            }
        }

        function limpiarFilas() {
            tablero = tablero.filter((_, y) => !filasLlenas.includes(y));
            while (tablero.length < FILAS) tablero.unshift(Array(COLUMNAS).fill(null));
            lineas += filasLlenas.length;
            puntos += PUNTOS_LINEAS[filasLlenas.length] * nivel;
            const nuevoNivel = 1 + Math.floor(lineas / 10);
            if (nuevoNivel > nivel) sonar(880, 0.3, "triangle", 0.08);
            nivel = nuevoNivel;
            filasLlenas = [];
            estado = "jugando";
            nuevaPieza();
        }

        function terminarPartida() {
            estado = "fin";
            opciones.alPuntuar?.(puntos);
            sonar(80, 0.7, "sawtooth", 0.08);
            if (puntos > record) {
                record = puntos;
                guardarRecord(record);
            }
        }

        function intervaloCaida() {
            return Math.max(0.05, 0.8 - (nivel - 1) * 0.07);
        }

        // ---------- Actualización ----------

        function actualizar(dt) {
            if (estado === "limpiando") {
                tiempoLimpieza -= dt;
                if (tiempoLimpieza <= 0) limpiarFilas();
                return;
            }
            if (estado !== "jugando") return;

            // Teclas mantenidas
            if (repeticion.tecla) {
                repeticion.espera -= dt;
                if (repeticion.espera <= 0) {
                    repeticion.espera = 0.05;
                    accionRepetible(repeticion.tecla);
                }
            }

            tiempoCaida += dt;
            const intervalo = bajando ? Math.min(0.04, intervaloCaida()) : intervaloCaida();
            if (tiempoCaida >= intervalo) {
                tiempoCaida = 0;
                if (mover(0, 1)) {
                    if (bajando) puntos += 1;
                } else {
                    fijar();
                }
            }
        }

        function accionRepetible(tecla) {
            if (tecla === "izquierda") mover(-1, 0);
            if (tecla === "derecha") mover(1, 0);
        }

        // ---------- Dibujo ----------

        function texto(t, x, y, color = COLORES.texto, alineacion = "left", tam = 8) {
            ctx.fillStyle = color;
            ctx.textAlign = alineacion;
            ctx.font = `bold ${tam}px "Courier New", monospace`;
            ctx.fillText(t, x, y);
        }

        function bloque(px, py, color, tam = CELDA) {
            ctx.fillStyle = color;
            ctx.fillRect(px, py, tam - 1, tam - 1);
            // Brillo arriba a la izquierda y sombra abajo para dar volumen
            ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
            ctx.fillRect(px, py, tam - 1, 1);
            ctx.fillRect(px, py, 1, tam - 1);
            ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
            ctx.fillRect(px, py + tam - 2, tam - 1, 1);
            ctx.fillRect(px + tam - 2, py, 1, tam - 1);
        }

        const cifra = (n, d = 6) => String(n).padStart(d, "0");

        function dibujar() {
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, W, H);

            if (estado === "titulo") {
                dibujarTitulo();
                return;
            }

            // Tablero
            ctx.fillStyle = COLORES.rejilla;
            for (let x = 1; x < COLUMNAS; x++) ctx.fillRect(TABLERO_X + x * CELDA - 1, TABLERO_Y, 1, FILAS * CELDA);
            for (let y = 1; y < FILAS; y++) ctx.fillRect(TABLERO_X, TABLERO_Y + y * CELDA - 1, COLUMNAS * CELDA, 1);
            ctx.strokeStyle = COLORES.borde;
            ctx.strokeRect(TABLERO_X - 2.5, TABLERO_Y - 2.5, COLUMNAS * CELDA + 4, FILAS * CELDA + 4);

            const parpadeo = Math.floor(performance.now() / 70) % 2 === 0;
            tablero.forEach((fila, y) =>
                fila.forEach((color, x) => {
                    if (!color) return;
                    const brillo = filasLlenas.includes(y) && parpadeo;
                    bloque(TABLERO_X + x * CELDA, TABLERO_Y + y * CELDA, brillo ? "#ffffff" : color);
                })
            );

            if (estado === "jugando" || estado === "pausa") {
                for (const [x, y] of celdas(pieza)) {
                    if (y >= 0) bloque(TABLERO_X + x * CELDA, TABLERO_Y + y * CELDA, pieza.color);
                }
            }

            // Panel izquierdo
            texto("BLOQUES", 52, 30, COLORES.titulo, "center", 12);
            texto("PUNTOS", 14, 60);
            texto(cifra(puntos), 14, 72, "#ffffff");
            texto("LINEAS", 14, 96);
            texto(cifra(lineas, 4), 14, 108, "#ffffff");
            texto("NIVEL", 14, 132);
            texto(String(nivel), 14, 144, "#ffffff");
            texto("RECORD", 14, 168);
            texto(cifra(Math.max(record, puntos)), 14, 180, "#ffffff");

            // Panel derecho: siguiente pieza
            texto("SIGUIENTE", 268, 30, COLORES.texto, "center");
            ctx.strokeStyle = COLORES.borde;
            ctx.strokeRect(238.5, 38.5, 60, 44);
            const n = siguiente.forma.length;
            const ox = 268 - (n * 8) / 2;
            const oy = 60 - (n * 8) / 2 + (n === 4 ? 4 : 0);
            siguiente.forma.forEach((fila, y) =>
                fila.forEach((v, x) => {
                    if (v) bloque(ox + x * 8, oy + y * 8, siguiente.color, 8);
                })
            );

            texto("<- ->  mover", 236, 116);
            texto("^      girar", 236, 130);
            texto("v      bajar", 236, 144);
            texto("ESP.   soltar", 236, 158);
            texto("P      pausa", 236, 172);
            texto("ESC    salir", 236, 186);

            if (estado === "pausa") {
                cartel("PAUSA", "P para continuar");
            } else if (estado === "fin") {
                cartel("FIN DE LA PARTIDA", "ESPACIO: jugar   ESC: salir");
            }
        }

        function cartel(titulo, subtitulo) {
            ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
            ctx.fillRect(40, 92, W - 80, 52);
            ctx.strokeStyle = COLORES.titulo;
            ctx.strokeRect(40.5, 92.5, W - 81, 51);
            texto(titulo, W / 2, 114, COLORES.titulo, "center", 12);
            texto(subtitulo, W / 2, 132, COLORES.texto, "center");
        }

        function dibujarTitulo() {
            // Bloques decorativos cayendo
            const t = performance.now() / 1000;
            PIEZAS.forEach((p, i) => {
                const x = 20 + i * 42;
                const y = ((t * 30 + i * 37) % 280) - 40;
                p.forma.forEach((fila, fy) =>
                    fila.forEach((v, fx) => {
                        if (v) bloque(x + fx * 8, y + fy * 8, p.color, 8);
                    })
                );
            });
            ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
            ctx.fillRect(30, 30, W - 60, 180);

            texto("B L O Q U E S", W / 2, 66, COLORES.titulo, "center", 18);
            texto("Completa lineas para borrarlas", W / 2, 92, COLORES.texto, "center");

            texto("<- ->  mover        ^  girar", W / 2, 124, COLORES.texto, "center");
            texto("v  bajar     ESPACIO  soltar", W / 2, 138, COLORES.texto, "center");
            texto("P  pausa     ESC  salir a SM-DOS", W / 2, 152, COLORES.texto, "center");

            if (Math.floor(t * 3) % 2 === 0) {
                texto("PULSA ESPACIO PARA JUGAR", W / 2, 190, "#ffffff", "center", 10);
            }
        }

        // ---------- Bucle y teclado ----------

        function bucle(ahora) {
            if (!activo) return;
            const dt = Math.max(0, Math.min(0.05, (ahora - ultimoTiempo) / 1000));
            ultimoTiempo = ahora;
            actualizar(dt);
            dibujar();
            requestAnimationFrame(bucle);
        }

        function alPulsar(e) {
            const tecla = e.key.length === 1 ? e.key.toLowerCase() : e.key;
            if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(tecla)) e.preventDefault();

            if (tecla === "Escape") {
                salir();
                return;
            }
            if (tecla === " " && (estado === "titulo" || estado === "fin")) {
                if (!e.repeat) nuevaPartida();
                return;
            }
            if (tecla === "p" && (estado === "jugando" || estado === "pausa")) {
                estado = estado === "pausa" ? "jugando" : "pausa";
                return;
            }
            if (estado !== "jugando" || e.repeat) return;

            if (tecla === "ArrowLeft" || tecla === "a") {
                mover(-1, 0);
                repeticion.tecla = "izquierda";
                repeticion.espera = 0.17;
            } else if (tecla === "ArrowRight" || tecla === "d") {
                mover(1, 0);
                repeticion.tecla = "derecha";
                repeticion.espera = 0.17;
            } else if (tecla === "ArrowUp" || tecla === "w" || tecla === "x") {
                girar(1);
            } else if (tecla === "z") {
                girar(-1);
            } else if (tecla === "ArrowDown" || tecla === "s") {
                bajando = true;
            } else if (tecla === " ") {
                caerDelTodo();
            }
        }

        function alSoltar(e) {
            const tecla = e.key.length === 1 ? e.key.toLowerCase() : e.key;
            if ((tecla === "ArrowLeft" || tecla === "a") && repeticion.tecla === "izquierda") repeticion.tecla = null;
            if ((tecla === "ArrowRight" || tecla === "d") && repeticion.tecla === "derecha") repeticion.tecla = null;
            if (tecla === "ArrowDown" || tecla === "s") bajando = false;
        }

        function salir() {
            activo = false;
            opciones.alPuntuar?.(puntos); // guarda la partida en curso (ESC o fin del tiempo)
            window.removeEventListener("keydown", alPulsar);
            window.removeEventListener("keyup", alSoltar);
            canvas.remove();
            alSalir();
        }

        // Se activa en el siguiente ciclo para no recibir el Enter que lanzó el juego
        setTimeout(() => {
            window.addEventListener("keydown", alPulsar);
            window.addEventListener("keyup", alSoltar);
        }, 0);

        requestAnimationFrame(bucle);

        // El sistema puede cerrar el juego (por ejemplo, al acabarse el tiempo)
        return salir;
    }

    return { iniciar };
})();
