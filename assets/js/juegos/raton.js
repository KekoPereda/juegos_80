// RATON.EXE — juego de laberinto para SM-DOS
// Un ratón come migas de queso mientras cuatro gatos lo persiguen.
// Se ejecuta dentro de la pantalla del monitor: Raton.iniciar(contenedor, alSalir)
window.Raton = (() => {
    const W = 320;
    const H = 240;
    const T = 9;   // tamaño de cada casilla en píxeles
    const OX = 47; // posición del laberinto en el canvas
    const OY = 22;

    // # pared · . miga · o queso grande · - puerta de la casa · G casa de los gatos · T túnel
    const MAPA = [
        "#########################",
        "#...........#...........#",
        "#o###.#####.#.#####.###o#",
        "#.###.#####.#.#####.###.#",
        "#.......................#",
        "#.###.#.#########.#.###.#",
        "#.....#.....#.....#.....#",
        "#####.#####.#.#####.#####",
        "#####.#...........#.#####",
        "#####.#.####-####.#.#####",
        "T.......#GGGGGGG#.......T",
        "#####.#.#GGGGGGG#.#.#####",
        "#####.#.#########.#.#####",
        "#####.#...........#.#####",
        "#####.#.#########.#.#####",
        "#...........#...........#",
        "#.###.#####.#.#####.###.#",
        "#o..#...............#..o#",
        "###.#.#.#########.#.#.###",
        "#.....#.....#.....#.....#",
        "#.#########.#.#########.#",
        "#.......................#",
        "#########################",
    ];
    const COLS = MAPA[0].length;
    const FILAS = MAPA.length;
    const FILA_TUNEL = 10;
    const SALIDA = { x: 12, y: 8 }; // casilla justo encima de la puerta
    const INICIO_RATON = { x: 12, y: 17 };

    const ARRIBA = { x: 0, y: -1 };
    const ABAJO = { x: 0, y: 1 };
    const IZQUIERDA = { x: -1, y: 0 };
    const DERECHA = { x: 1, y: 0 };
    const DIRECCIONES = [ARRIBA, IZQUIERDA, ABAJO, DERECHA];

    const COLORES = {
        texto: "#c8c8c8",
        titulo: "#ffff55",
        pared: "#6b3a1e",
        borde: "#d08040",
        puerta: "#ff88aa",
        miga: "#ffdd55",
        queso: "#ffcc00",
    };

    // ---------- Sprites (cada letra es un color) ----------

    const RATON = [
        [
            "......##..",
            ".....#pp#.",
            "..#######.",
            ".######e#p",
            "t#######..",
            ".t.#...#..",
        ],
        [
            "......##..",
            ".....#pp#.",
            "..#######.",
            ".######e#p",
            "t#######..",
            "t...#.#...",
        ],
    ];
    const COLORES_RATON = { "#": "#c8c8c8", p: "#ff88aa", e: "#000000", t: "#ff88aa" };

    const GATO = [
        [
            "#.....#",
            "##...##",
            "#######",
            "#e###e#",
            "###n###",
            ".#####.",
            "#.#.#.#",
        ],
        [
            "#.....#",
            "##...##",
            "#######",
            "#e###e#",
            "###n###",
            ".#####.",
            ".#.#.#.",
        ],
    ];

    const GATOS = [
        { nombre: "MICHI", color: "#ff5555", esquina: { x: 23, y: -2 }, descripcion: "te persigue" },
        { nombre: "GARRA", color: "#ff55ff", esquina: { x: 1, y: -2 }, descripcion: "se adelanta" },
        { nombre: "BIGOTE", color: "#55ffff", esquina: { x: 23, y: 24 }, descripcion: "va y viene" },
        { nombre: "PELUSA", color: "#ffaa00", esquina: { x: 1, y: 24 }, descripcion: "despistada" },
    ];

    // Alternancia entre dispersarse (cada gato a su esquina) y perseguir, en segundos
    const MODOS = [7, 20, 7, 20, 5, Infinity];

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
            return Number(localStorage.getItem("raton-record")) || 0;
        } catch {
            return 0;
        }
    }

    function guardarRecord(valor) {
        try {
            localStorage.setItem("raton-record", String(valor));
        } catch {
            /* sin almacenamiento */
        }
    }

    // ---------- Laberinto ----------

    function celda(x, y) {
        if (y < 0 || y >= FILAS) return "#";
        if (x < 0 || x >= COLS) return y === FILA_TUNEL ? " " : "#";
        return MAPA[y][x];
    }

    function libre(x, y) {
        const c = celda(x, y);
        return c !== "#" && c !== "-" && c !== "G";
    }

    const opuesta = (a, b) => a && b && a.x === -b.x && a.y === -b.y;
    const enCentro = (e) => Math.abs(e.x - Math.round(e.x)) < 1e-6 && Math.abs(e.y - Math.round(e.y)) < 1e-6;

    // Mueve una entidad por el laberinto; en cada centro de casilla llama a elegir()
    function avanzar(e, distancia, elegir) {
        let vueltas = 0;
        while (distancia > 1e-9 && vueltas++ < 10) {
            if (enCentro(e)) {
                e.x = Math.round(e.x);
                e.y = Math.round(e.y);
                elegir(e);
                if (!e.dir) return;
            }
            const horizontal = e.dir.x !== 0;
            const pos = horizontal ? e.x : e.y;
            const signo = horizontal ? e.dir.x : e.dir.y;
            const objetivo = signo > 0 ? Math.floor(pos + 1e-6) + 1 : Math.ceil(pos - 1e-6) - 1;
            const hasta = Math.abs(objetivo - pos);

            if (hasta > distancia) {
                if (horizontal) e.x += signo * distancia;
                else e.y += signo * distancia;
                return;
            }
            if (horizontal) e.x = objetivo;
            else e.y = objetivo;
            distancia -= hasta;

            // Túnel: sale por un lado y entra por el otro
            if (e.dir.x < 0 && e.x <= -1) e.x = COLS;
            else if (e.dir.x > 0 && e.x >= COLS) e.x = -1;
        }
    }

    // Movimiento en línea recta hacia un punto (para entrar y salir de la casa)
    function irHacia(e, destino, distancia) {
        const dx = destino.x - e.x;
        const dy = destino.y - e.y;
        if (Math.abs(dx) > 1e-6) {
            const paso = Math.min(Math.abs(dx), distancia);
            e.x += Math.sign(dx) * paso;
            distancia -= paso;
        }
        if (distancia > 0 && Math.abs(dy) > 1e-6) {
            const paso = Math.min(Math.abs(dy), distancia);
            e.y += Math.sign(dy) * paso;
        }
        return Math.abs(destino.x - e.x) < 1e-6 && Math.abs(destino.y - e.y) < 1e-6;
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

        let estado = "titulo"; // titulo | preparado | jugando | muriendo | nivelCompleto | pausa | fin
        let tiempoEstado = 0;
        let puntos = 0;
        let vidas = 3;
        let nivel = 1;
        let record = opciones.record ?? leerRecord();

        let comida, quedan, raton, gatos;
        let modo, tiempoModo, tiempoNivel, tiempoSusto, gatosComidos, animacion;
        let textosFlotantes = [];

        // ---------- Preparación ----------

        function nuevaPartida() {
            puntos = 0;
            vidas = 3;
            nivel = 1;
            prepararNivel();
        }

        function prepararNivel() {
            comida = MAPA.map((fila) => [...fila].map((c) => (c === "." ? 1 : c === "o" ? 2 : 0)));
            comida[INICIO_RATON.y][INICIO_RATON.x] = 0;
            quedan = comida.flat().filter(Boolean).length;
            colocarPersonajes();
        }

        function colocarPersonajes() {
            raton = { x: INICIO_RATON.x, y: INICIO_RATON.y, dir: IZQUIERDA, siguiente: IZQUIERDA, mira: -1 };
            const casas = [{ x: 12, y: 8 }, { x: 10, y: 10.5 }, { x: 12, y: 10.5 }, { x: 14, y: 10.5 }];
            gatos = GATOS.map((g, i) => ({
                ...g,
                indice: i,
                x: casas[i].x,
                y: casas[i].y,
                dir: IZQUIERDA,
                estado: i === 0 ? "normal" : "casa",
                salida: i * 3, // segundos hasta que sale de la casa
            }));
            modo = 0;
            tiempoModo = 0;
            tiempoNivel = 0;
            tiempoSusto = 0;
            animacion = 0;
            textosFlotantes = [];
            estado = "preparado";
            tiempoEstado = 2;
        }

        // ---------- Velocidades (casillas por segundo) ----------

        const velocidadRaton = () => Math.min(8, 6.5 + nivel * 0.2);
        const velocidadGato = () => Math.min(7.8, 5.8 + nivel * 0.25);
        const duracionSusto = () => Math.max(2, 7 - nivel);

        // ---------- Decisiones ----------

        function elegirRaton(e) {
            const tx = Math.round(e.x);
            const ty = Math.round(e.y);
            if (e.siguiente && libre(tx + e.siguiente.x, ty + e.siguiente.y)) {
                e.dir = e.siguiente;
            } else if (e.dir && !libre(tx + e.dir.x, ty + e.dir.y)) {
                e.dir = null;
            }
            if (e.dir && e.dir.x) e.mira = e.dir.x;
        }

        function objetivoGato(g) {
            if (g.estado === "ojos") return SALIDA;
            const rx = Math.round(raton.x);
            const ry = Math.round(raton.y);
            const persiguiendo = modo % 2 === 1;
            if (!persiguiendo) return g.esquina;

            switch (g.indice) {
                case 0:
                    return { x: rx, y: ry };
                case 1: {
                    const d = raton.dir || IZQUIERDA;
                    return { x: rx + d.x * 4, y: ry + d.y * 4 };
                }
                case 2:
                    return Math.hypot(g.x - rx, g.y - ry) > 8 ? { x: rx, y: ry } : g.esquina;
                default:
                    return null; // elige al azar en cada cruce
            }
        }

        function elegirGato(g) {
            const tx = Math.round(g.x);
            const ty = Math.round(g.y);
            let opciones = DIRECCIONES.filter((d) => !opuesta(d, g.dir) && libre(tx + d.x, ty + d.y));
            if (opciones.length === 0) opciones = DIRECCIONES.filter((d) => libre(tx + d.x, ty + d.y));
            if (opciones.length === 0) return;

            const objetivo = g.asustado ? null : objetivoGato(g);
            if (!objetivo) {
                g.dir = opciones[Math.floor(Math.random() * opciones.length)];
                return;
            }
            let mejor = opciones[0];
            let menor = Infinity;
            for (const d of opciones) {
                const dist = (tx + d.x - objetivo.x) ** 2 + (ty + d.y - objetivo.y) ** 2;
                if (dist < menor) {
                    menor = dist;
                    mejor = d;
                }
            }
            g.dir = mejor;
        }

        // ---------- Actualización ----------

        function actualizar(dt) {
            animacion += dt;
            textosFlotantes.forEach((t) => (t.vida -= dt));
            textosFlotantes = textosFlotantes.filter((t) => t.vida > 0);

            if (estado === "preparado" || estado === "muriendo" || estado === "nivelCompleto") {
                tiempoEstado -= dt;
                if (tiempoEstado > 0) return;
                if (estado === "preparado") {
                    estado = "jugando";
                } else if (estado === "muriendo") {
                    if (vidas > 0) colocarPersonajes();
                    else terminarPartida();
                } else {
                    nivel++;
                    prepararNivel();
                }
                return;
            }
            if (estado !== "jugando") return;

            tiempoNivel += dt;

            // Modo dispersión / persecución (se detiene mientras están asustados)
            if (tiempoSusto > 0) {
                tiempoSusto -= dt;
                if (tiempoSusto <= 0) gatos.forEach((g) => (g.asustado = false));
            } else {
                tiempoModo += dt;
                if (tiempoModo >= MODOS[modo]) {
                    tiempoModo = 0;
                    modo = Math.min(modo + 1, MODOS.length - 1);
                    gatos.forEach((g) => {
                        if (g.estado === "normal" && g.dir) g.dir = { x: -g.dir.x, y: -g.dir.y };
                    });
                }
            }

            // Ratón
            avanzar(raton, velocidadRaton() * dt, elegirRaton);
            comer();
            if (estado !== "jugando") return;

            // Gatos
            for (const g of gatos) {
                if (g.estado === "casa") {
                    g.y = 10.5 + Math.sin(animacion * 6 + g.indice) * 0.3;
                    if (tiempoNivel >= g.salida) g.estado = "saliendo";
                } else if (g.estado === "saliendo") {
                    // Primero se coloca frente a la puerta y luego sube hasta salir
                    if (Math.abs(g.x - SALIDA.x) > 1e-6) {
                        irHacia(g, { x: SALIDA.x, y: g.y }, 3 * dt);
                    } else if (irHacia(g, SALIDA, 3 * dt)) {
                        g.x = SALIDA.x;
                        g.y = SALIDA.y;
                        g.estado = "normal";
                        g.dir = Math.random() < 0.5 ? IZQUIERDA : DERECHA;
                    }
                } else if (g.estado === "entrando") {
                    if (irHacia(g, { x: 12, y: 10.5 }, 8 * dt)) {
                        g.estado = "saliendo";
                        g.asustado = false;
                    }
                } else {
                    let velocidad = velocidadGato();
                    if (g.estado === "ojos") velocidad = 14;
                    else if (g.asustado) velocidad = 3.5;
                    else if (Math.round(g.y) === FILA_TUNEL && (g.x < 5 || g.x > COLS - 6)) velocidad *= 0.5;

                    avanzar(g, velocidad * dt, elegirGato);

                    if (g.estado === "ojos" && Math.abs(g.x - SALIDA.x) < 0.1 && Math.abs(g.y - SALIDA.y) < 0.1) {
                        g.x = SALIDA.x;
                        g.y = SALIDA.y;
                        g.estado = "entrando";
                    }
                }
            }

            comprobarChoques();
        }

        function comer() {
            const tx = Math.round(raton.x);
            const ty = Math.round(raton.y);
            if (ty < 0 || ty >= FILAS || tx < 0 || tx >= COLS) return;
            const c = comida[ty][tx];
            if (!c) return;

            comida[ty][tx] = 0;
            quedan--;
            if (c === 1) {
                puntos += 10;
                sonar(quedan % 2 ? 520 : 600, 0.03, "square", 0.03);
            } else {
                puntos += 50;
                tiempoSusto = duracionSusto();
                gatosComidos = 0;
                gatos.forEach((g) => {
                    if (g.estado === "normal") {
                        g.asustado = true;
                        if (g.dir) g.dir = { x: -g.dir.x, y: -g.dir.y };
                    }
                });
                sonar(220, 0.3, "triangle", 0.08);
            }

            if (quedan === 0) {
                estado = "nivelCompleto";
                tiempoEstado = 2;
                sonar(880, 0.4, "triangle", 0.08);
            }
        }

        function comprobarChoques() {
            for (const g of gatos) {
                if (g.estado !== "normal") continue;
                if (Math.hypot(g.x - raton.x, g.y - raton.y) > 0.6) continue;

                if (g.asustado) {
                    gatosComidos++;
                    const premio = 200 * 2 ** (gatosComidos - 1);
                    puntos += premio;
                    g.estado = "ojos";
                    g.asustado = false;
                    textosFlotantes.push({ texto: String(premio), x: g.x, y: g.y, vida: 1 });
                    sonar(1200, 0.15, "square", 0.06);
                } else {
                    vidas--;
                    estado = "muriendo";
                    tiempoEstado = 1.8;
                    sonar(70, 0.9, "sawtooth", 0.08);
                    return;
                }
            }
        }

        function terminarPartida() {
            estado = "fin";
            opciones.alPuntuar?.(puntos);
            if (puntos > record) {
                record = puntos;
                guardarRecord(record);
            }
        }

        // ---------- Dibujo ----------

        function texto(t, x, y, color = COLORES.texto, alineacion = "left", tam = 8) {
            ctx.fillStyle = color;
            ctx.textAlign = alineacion;
            ctx.font = `bold ${tam}px "Courier New", monospace`;
            ctx.fillText(t, x, y);
        }

        // Dibuja un sprite centrado en (cx, cy); "espejo" lo voltea en horizontal
        function pintar(filas, colores, cx, cy, espejo = false, colorBase = null) {
            const alto = filas.length;
            const ancho = filas[0].length;
            const x0 = Math.round(cx - ancho / 2);
            const y0 = Math.round(cy - alto / 2);
            filas.forEach((fila, y) => {
                [...fila].forEach((c, x) => {
                    if (c === ".") return;
                    const color = c === "#" && colorBase ? colorBase : colores[c];
                    if (!color) return;
                    ctx.fillStyle = color;
                    ctx.fillRect(x0 + (espejo ? ancho - 1 - x : x), y0 + y, 1, 1);
                });
            });
        }

        const aPixel = (x, y) => [OX + x * T + T / 2, OY + y * T + T / 2];
        const cifra = (n) => String(n).padStart(6, "0");

        function dibujarLaberinto(destello) {
            for (let y = 0; y < FILAS; y++) {
                for (let x = 0; x < COLS; x++) {
                    const c = MAPA[y][x];
                    const px = OX + x * T;
                    const py = OY + y * T;
                    if (c === "#") {
                        ctx.fillStyle = destello ? "#ffffff" : COLORES.pared;
                        ctx.fillRect(px, py, T, T);
                        // Borde claro donde la pared toca un pasillo
                        ctx.fillStyle = destello ? "#ffffff" : COLORES.borde;
                        if (libre(x, y - 1) || celda(x, y - 1) === "G") ctx.fillRect(px, py, T, 1);
                        if (libre(x, y + 1) || celda(x, y + 1) === "G") ctx.fillRect(px, py + T - 1, T, 1);
                        if (libre(x - 1, y) || celda(x - 1, y) === "G") ctx.fillRect(px, py, 1, T);
                        if (libre(x + 1, y) || celda(x + 1, y) === "G") ctx.fillRect(px + T - 1, py, 1, T);
                    } else if (c === "-") {
                        ctx.fillStyle = COLORES.puerta;
                        ctx.fillRect(px, py + 4, T, 2);
                    }

                    const comidaAqui = comida[y][x];
                    if (comidaAqui === 1) {
                        ctx.fillStyle = COLORES.miga;
                        ctx.fillRect(px + 4, py + 4, 2, 2);
                    } else if (comidaAqui === 2 && Math.floor(animacion * 4) % 2 === 0) {
                        // Cuña de queso
                        ctx.fillStyle = COLORES.queso;
                        ctx.fillRect(px + 1, py + 5, 7, 3);
                        ctx.fillRect(px + 3, py + 3, 5, 2);
                        ctx.fillRect(px + 5, py + 1, 3, 2);
                        ctx.fillStyle = "#aa7700";
                        ctx.fillRect(px + 3, py + 6, 1, 1);
                        ctx.fillRect(px + 6, py + 4, 1, 1);
                    }
                }
            }
        }

        function dibujarGato(g) {
            const [cx, cy] = aPixel(g.x, g.y);
            const f = Math.floor(animacion * 8) % 2;
            if (g.estado === "ojos") {
                pintar(GATO[0], { e: "#ffffff" }, cx, cy);
                return;
            }
            if (g.asustado) {
                const parpadea = tiempoSusto < 2 && Math.floor(animacion * 8) % 2 === 0;
                pintar(GATO[f], { "#": parpadea ? "#ffffff" : "#3344cc", e: "#ffff55", n: "#ffff55" }, cx, cy);
                return;
            }
            pintar(GATO[f], { "#": g.color, e: "#ffffff", n: "#ff88aa" }, cx, cy);
        }

        function dibujar() {
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, W, H);

            texto(`PUNTOS ${cifra(puntos)}`, 6, 12);
            texto(`RECORD ${cifra(Math.max(record, puntos))}`, W / 2, 12, COLORES.texto, "center");
            texto(`NIVEL ${nivel}`, W - 6, 12, COLORES.texto, "right");

            if (estado === "titulo") {
                dibujarTitulo();
                return;
            }

            const destello = estado === "nivelCompleto" && Math.floor(animacion * 6) % 2 === 0;
            dibujarLaberinto(destello);

            // Recorta al laberinto para que el túnel oculte a quien lo cruza
            ctx.save();
            ctx.beginPath();
            ctx.rect(OX, OY, COLS * T, FILAS * T);
            ctx.clip();

            if (estado !== "nivelCompleto") gatos.forEach(dibujarGato);

            const [rx, ry] = aPixel(raton.x, raton.y);
            const visible = estado !== "muriendo" || Math.floor(animacion * 10) % 2 === 0;
            if (visible && !(estado === "fin")) {
                const f = raton.dir && estado === "jugando" ? Math.floor(animacion * 10) % 2 : 0;
                pintar(RATON[f], COLORES_RATON, rx, ry, raton.mira < 0);
            }
            ctx.restore();

            textosFlotantes.forEach((t) => {
                const [x, y] = aPixel(t.x, t.y);
                texto(t.texto, x, y - (1 - t.vida) * 8, "#55ffff", "center");
            });

            // Vidas en el panel izquierdo
            texto("VIDAS", 8, 40);
            for (let i = 0; i < vidas; i++) pintar(RATON[0], COLORES_RATON, 20, 52 + i * 12);

            if (estado === "preparado") {
                const [x, y] = aPixel(12, 13);
                texto("¡PREPARADO!", x, y + 3, COLORES.titulo, "center");
            } else if (estado === "pausa") {
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
            texto("R A T O N", W / 2, 46, COLORES.titulo, "center", 18);
            texto("Come todo el queso sin que te atrapen", W / 2, 64, COLORES.texto, "center");

            const f = Math.floor(performance.now() / 150) % 2;
            pintar(RATON[f], COLORES_RATON, 96, 84);
            texto("TU", 112, 87);

            GATOS.forEach((g, i) => {
                const y = 102 + i * 14;
                pintar(GATO[f], { "#": g.color, e: "#ffffff", n: "#ff88aa" }, 96, y);
                texto(`${g.nombre.padEnd(7)}${g.descripcion}`, 112, y + 3, g.color);
            });

            ctx.fillStyle = COLORES.queso;
            ctx.fillRect(92, 160, 7, 3);
            ctx.fillRect(94, 158, 5, 2);
            ctx.fillRect(96, 156, 3, 2);
            texto("Los gatos huyen y puedes atraparlos", 112, 163);

            texto("FLECHAS  mover    P  pausa    ESC  salir", W / 2, 190, COLORES.texto, "center");

            if (Math.floor(performance.now() / 333) % 2 === 0) {
                texto("PULSA ESPACIO PARA JUGAR", W / 2, 216, "#ffffff", "center", 10);
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

        const TECLAS_DIRECCION = {
            ArrowUp: ARRIBA, w: ARRIBA,
            ArrowDown: ABAJO, s: ABAJO,
            ArrowLeft: IZQUIERDA, a: IZQUIERDA,
            ArrowRight: DERECHA, d: DERECHA,
        };

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

            const dir = TECLAS_DIRECCION[tecla];
            if (dir && raton) {
                raton.siguiente = dir;
                // Darse la vuelta es inmediato, aunque esté entre dos casillas
                if (opuesta(dir, raton.dir)) {
                    raton.dir = dir;
                    if (dir.x) raton.mira = dir.x;
                }
            }
        }

        function salir() {
            activo = false;
            opciones.alPuntuar?.(puntos); // guarda la partida en curso (ESC o fin del tiempo)
            window.removeEventListener("keydown", alPulsar);
            canvas.remove();
            alSalir();
        }

        // Se activa en el siguiente ciclo para no recibir el Enter que lanzó el juego
        setTimeout(() => window.addEventListener("keydown", alPulsar), 0);

        requestAnimationFrame(bucle);

        // El sistema puede cerrar el juego (por ejemplo, al acabarse el tiempo)
        return salir;
    }

    return { iniciar };
})();
