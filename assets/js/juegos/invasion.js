// INVASION.EXE — juego de naves para SM-DOS
// Se ejecuta dentro de la pantalla del monitor: Invasion.iniciar(contenedor, alSalir)
window.Invasion = (() => {
    const W = 320;
    const H = 240;
    const ESCALA = 2; // cada píxel de sprite ocupa 2x2

    const COLORES = {
        jugador: "#55ff55",
        bala: "#ffffff",
        balaEnemiga: "#ffff55",
        barrera: "#55ff55",
        suelo: "#55ff55",
        texto: "#c8c8c8",
        titulo: "#55ffff",
    };

    // ---------- Sprites ----------

    function crearSprite(filas) {
        const pixeles = [];
        filas.forEach((fila, y) => {
            [...fila].forEach((c, x) => {
                if (c === "#") pixeles.push([x, y]);
            });
        });
        return { pixeles, w: filas[0].length * ESCALA, h: filas.length * ESCALA };
    }

    const SPRITES = {
        ojo: [
            crearSprite(["..#####..", ".#######.", "##.###.##", "#########", ".#.#.#.#.", "#.......#", ".#.....#.", "........."]),
            crearSprite(["..#####..", ".#######.", "##.###.##", "#########", ".#.#.#.#.", ".#.....#.", "#.......#", "........."]),
        ],
        rombo: [
            crearSprite(["....#....", "...###...", "..#.#.#..", ".#######.", "##.###.##", ".#######.", "..#...#..", ".#.....#."]),
            crearSprite(["....#....", "...###...", "..#.#.#..", ".#######.", "##.###.##", ".#######.", "..#...#..", "..#...#.."]),
        ],
        escarabajo: [
            crearSprite([".#.....#.", "..#...#..", ".#######.", "#.#####.#", "#########", "..#####..", ".#.#.#.#.", "#.......#"]),
            crearSprite(["#.......#", ".#.....#.", ".#######.", "..#####..", "#########", "#.#####.#", ".#.#.#.#.", ".#.....#."]),
        ],
        jugador: crearSprite([
            "......#......",
            ".....###.....",
            "..#..###..#..",
            ".###########.",
            "#############",
            "##.##...##.##",
        ]),
    };

    const TIPOS = [
        { sprite: "escarabajo", puntos: 30, color: "#ff55ff" },
        { sprite: "rombo", puntos: 20, color: "#55ffff" },
        { sprite: "rombo", puntos: 20, color: "#55ffff" },
        { sprite: "ojo", puntos: 10, color: "#55ff55" },
        { sprite: "ojo", puntos: 10, color: "#55ff55" },
    ];

    const FORMA_BARRERA = [
        "...########...",
        "..##########..",
        ".############.",
        "##############",
        "##############",
        "####......####",
        "###........###",
    ];

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
            return Number(localStorage.getItem("invasion-record")) || 0;
        } catch {
            return 0;
        }
    }

    function guardarRecord(valor) {
        try {
            localStorage.setItem("invasion-record", String(valor));
        } catch {
            /* sin almacenamiento */
        }
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

        const teclas = new Set();
        let activo = true;
        let ultimoTiempo = performance.now();

        let estado = "titulo"; // titulo | jugando | golpeado | fin | pausa
        let puntos = 0;
        let vidas = 3;
        let nivel = 1;
        let record = opciones.record ?? leerRecord();

        let jugador, bala, balasEnemigas, enemigos, barreras, particulas;
        let direccion, tiempoPaso, tiempoDisparo, fotograma, tiempoGolpe;

        function nuevaPartida() {
            puntos = 0;
            vidas = 3;
            nivel = 1;
            crearBarreras();
            nuevaOleada();
            estado = "jugando";
        }

        function nuevaOleada() {
            jugador = { x: W / 2 - SPRITES.jugador.w / 2, y: 210 };
            bala = null;
            balasEnemigas = [];
            particulas = [];
            enemigos = [];
            direccion = 1;
            tiempoPaso = 0;
            tiempoDisparo = 0;
            fotograma = 0;

            const inicioY = 34 + Math.min((nivel - 1) * 6, 30);
            TIPOS.forEach((tipo, fila) => {
                for (let col = 0; col < 8; col++) {
                    enemigos.push({
                        x: 52 + col * 26,
                        y: inicioY + fila * 20,
                        ...tipo,
                    });
                }
            });
        }

        function crearBarreras() {
            barreras = [];
            const ancho = FORMA_BARRERA[0].length * 2;
            for (let i = 0; i < 4; i++) {
                const bx = Math.round(W * (i + 1) / 5 - ancho / 2);
                FORMA_BARRERA.forEach((fila, y) => {
                    [...fila].forEach((c, x) => {
                        if (c === "#") barreras.push({ x: bx + x * 2, y: 178 + y * 2, w: 2, h: 2 });
                    });
                });
            }
        }

        function explotar(x, y, color, cantidad = 12) {
            for (let i = 0; i < cantidad; i++) {
                const angulo = Math.random() * Math.PI * 2;
                const vel = 20 + Math.random() * 60;
                particulas.push({
                    x, y, color,
                    vx: Math.cos(angulo) * vel,
                    vy: Math.sin(angulo) * vel,
                    vida: 0.4 + Math.random() * 0.4,
                });
            }
        }

        const choca = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

        function golpearBarrera(proyectil) {
            const i = barreras.findIndex((b) => choca(proyectil, b));
            if (i === -1) return false;
            const centro = barreras[i];
            // Rompe la celda alcanzada y alguna vecina para que se vea el desgaste
            barreras = barreras.filter((b) =>
                !(Math.abs(b.x - centro.x) <= 2 && Math.abs(b.y - centro.y) <= 2 && (b === centro || Math.random() < 0.5))
            );
            return true;
        }

        // ---------- Actualización ----------

        function actualizar(dt) {
            particulas.forEach((p) => {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.vida -= dt;
            });
            particulas = particulas.filter((p) => p.vida > 0);

            if (estado === "golpeado") {
                tiempoGolpe -= dt;
                if (tiempoGolpe <= 0) {
                    if (vidas > 0) {
                        estado = "jugando";
                        jugador.x = W / 2 - SPRITES.jugador.w / 2;
                    } else {
                        terminarPartida();
                    }
                }
                return;
            }
            if (estado !== "jugando") return;

            // Jugador
            const izquierda = teclas.has("ArrowLeft") || teclas.has("a");
            const derecha = teclas.has("ArrowRight") || teclas.has("d");
            jugador.x += ((derecha ? 1 : 0) - (izquierda ? 1 : 0)) * 130 * dt;
            jugador.x = Math.max(6, Math.min(W - 6 - SPRITES.jugador.w, jugador.x));

            if (teclas.has(" ") && !bala) {
                bala = { x: jugador.x + SPRITES.jugador.w / 2 - 1, y: jugador.y - 4, w: 2, h: 6 };
                sonar(880, 0.08);
            }

            // Bala del jugador
            if (bala) {
                bala.y -= 280 * dt;
                if (bala.y < 14 || golpearBarrera(bala)) {
                    bala = null;
                } else {
                    const i = enemigos.findIndex((e) => choca(bala, { x: e.x, y: e.y, w: 18, h: 16 }));
                    if (i !== -1) {
                        const e = enemigos[i];
                        explotar(e.x + 9, e.y + 8, e.color);
                        enemigos.splice(i, 1);
                        puntos += e.puntos;
                        bala = null;
                        sonar(140, 0.15, "sawtooth", 0.06);
                    }
                }
            }

            // Formación: avanza a saltos, más rápido cuantos menos quedan
            const total = TIPOS.length * 8;
            const intervalo = Math.max(0.04, (0.05 + 0.6 * (enemigos.length / total)) / (1 + (nivel - 1) * 0.15));
            tiempoPaso += dt;
            if (tiempoPaso >= intervalo) {
                tiempoPaso = 0;
                fotograma = 1 - fotograma;
                sonar(fotograma ? 90 : 70, 0.06, "square", 0.04);

                const minX = Math.min(...enemigos.map((e) => e.x));
                const maxX = Math.max(...enemigos.map((e) => e.x + 18));
                if ((direccion > 0 && maxX + 4 > W - 6) || (direccion < 0 && minX - 4 < 6)) {
                    direccion *= -1;
                    enemigos.forEach((e) => (e.y += 8));
                } else {
                    enemigos.forEach((e) => (e.x += 4 * direccion));
                }

                // Los enemigos que tocan las barreras las destruyen
                enemigos.forEach((e) => {
                    const caja = { x: e.x, y: e.y, w: 18, h: 16 };
                    barreras = barreras.filter((b) => !choca(caja, b));
                });
            }

            // Disparos enemigos
            tiempoDisparo -= dt;
            if (tiempoDisparo <= 0 && enemigos.length && balasEnemigas.length < 2 + nivel) {
                tiempoDisparo = Math.max(0.35, 1.1 - nivel * 0.1) * (0.5 + Math.random());
                const columnas = new Map();
                enemigos.forEach((e) => {
                    const c = Math.round(e.x);
                    if (!columnas.has(c) || columnas.get(c).y < e.y) columnas.set(c, e);
                });
                const tiradores = [...columnas.values()];
                const t = tiradores[Math.floor(Math.random() * tiradores.length)];
                balasEnemigas.push({ x: t.x + 8, y: t.y + 16, w: 2, h: 6 });
            }

            const cajaJugador = { x: jugador.x, y: jugador.y + 2, w: SPRITES.jugador.w, h: SPRITES.jugador.h - 2 };
            balasEnemigas.forEach((b) => (b.y += (110 + nivel * 8) * dt));
            balasEnemigas = balasEnemigas.filter((b) => {
                if (b.y > 228 || golpearBarrera(b)) return false;
                if (bala && choca(b, bala)) {
                    bala = null;
                    return false;
                }
                if (choca(b, cajaJugador)) {
                    perderVida();
                    return false;
                }
                return true;
            });

            // ¿Han llegado abajo?
            if (enemigos.some((e) => e.y + 16 >= jugador.y)) {
                vidas = 0;
                perderVida();
            }

            // Oleada superada
            if (enemigos.length === 0) {
                nivel++;
                nuevaOleada();
                sonar(660, 0.2, "triangle", 0.08);
            }
        }

        function perderVida() {
            if (estado !== "jugando") return;
            vidas = Math.max(0, vidas - 1);
            explotar(jugador.x + SPRITES.jugador.w / 2, jugador.y + 6, COLORES.jugador, 30);
            sonar(60, 0.6, "sawtooth", 0.08);
            balasEnemigas = [];
            bala = null;
            estado = "golpeado";
            tiempoGolpe = 1.5;
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

        const cifra = (n) => String(n).padStart(5, "0");

        function dibujar() {
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, W, H);

            // Marcador
            texto(`PUNTOS ${cifra(puntos)}`, 6, 10);
            texto(`RECORD ${cifra(Math.max(record, puntos))}`, W / 2, 10, COLORES.texto, "center");
            texto(`NIVEL ${nivel}`, W - 6, 10, COLORES.texto, "right");

            if (estado === "titulo") {
                dibujarTitulo();
                return;
            }

            barreras.forEach((b) => {
                ctx.fillStyle = COLORES.barrera;
                ctx.fillRect(b.x, b.y, b.w, b.h);
            });

            enemigos.forEach((e) => pintar(SPRITES[e.sprite][fotograma], e.x, e.y, e.color));

            if (estado !== "golpeado" && estado !== "fin") {
                pintar(SPRITES.jugador, jugador.x, jugador.y, COLORES.jugador);
            }

            if (bala) {
                ctx.fillStyle = COLORES.bala;
                ctx.fillRect(bala.x, bala.y, bala.w, bala.h);
            }

            ctx.fillStyle = COLORES.balaEnemiga;
            balasEnemigas.forEach((b) => {
                // Proyectil en zigzag
                const z = Math.floor(b.y / 3) % 2;
                ctx.fillRect(b.x + z, b.y, 1, b.h);
                ctx.fillRect(b.x + 1 - z, b.y, 1, b.h);
            });

            particulas.forEach((p) => {
                ctx.fillStyle = p.color;
                ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
            });

            // Suelo y vidas
            ctx.fillStyle = COLORES.suelo;
            ctx.fillRect(0, 229, W, 1);
            for (let i = 0; i < vidas; i++) {
                pintarMini(8 + i * 18, 232);
            }

            if (estado === "pausa") {
                cartel("PAUSA", "P para continuar");
            } else if (estado === "fin") {
                cartel("FIN DE LA PARTIDA", "ESPACIO: jugar   ESC: salir");
            }
        }

        function pintar(sprite, x, y, color) {
            ctx.fillStyle = color;
            const bx = Math.round(x);
            const by = Math.round(y);
            for (const [px, py] of sprite.pixeles) {
                ctx.fillRect(bx + px * ESCALA, by + py * ESCALA, ESCALA, ESCALA);
            }
        }

        function pintarMini(x, y) {
            ctx.fillStyle = COLORES.jugador;
            for (const [px, py] of SPRITES.jugador.pixeles) ctx.fillRect(x + px, y + py, 1, 1);
        }

        function cartel(titulo, subtitulo) {
            ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
            ctx.fillRect(40, 92, W - 80, 52);
            ctx.strokeStyle = COLORES.titulo;
            ctx.strokeRect(40.5, 92.5, W - 81, 51);
            texto(titulo, W / 2, 114, COLORES.titulo, "center", 12);
            texto(subtitulo, W / 2, 132, COLORES.texto, "center");
        }

        function dibujarTitulo() {
            texto("I N V A S I O N", W / 2, 50, COLORES.titulo, "center", 18);

            const t = performance.now() / 500;
            const f = Math.floor(t) % 2;
            TIPOS.filter((_, i) => i % 2 === 0).forEach((tipo, i) => {
                const y = 80 + i * 24;
                pintar(SPRITES[tipo.sprite][f], W / 2 - 50, y, tipo.color);
                texto(`= ${tipo.puntos} PUNTOS`, W / 2 - 22, y + 12);
            });

            texto("<- ->  mover      ESPACIO  disparar", W / 2, 170, COLORES.texto, "center");
            texto("P  pausa          ESC  salir a SM-DOS", W / 2, 184, COLORES.texto, "center");

            if (Math.floor(t * 1.5) % 2 === 0) {
                texto("PULSA ESPACIO PARA JUGAR", W / 2, 214, "#ffffff", "center", 10);
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
            if (tecla === "p" && (estado === "jugando" || estado === "pausa")) {
                estado = estado === "pausa" ? "jugando" : "pausa";
                return;
            }
            if (tecla === " " && (estado === "titulo" || estado === "fin") && !e.repeat) {
                nuevaPartida();
                return;
            }
            teclas.add(tecla);
        }

        function alSoltar(e) {
            const tecla = e.key.length === 1 ? e.key.toLowerCase() : e.key;
            teclas.delete(tecla);
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

        crearBarreras();
        nuevaOleada();
        requestAnimationFrame(bucle);

        // El sistema puede cerrar el juego (por ejemplo, al acabarse el tiempo)
        return salir;
    }

    return { iniciar };
})();
