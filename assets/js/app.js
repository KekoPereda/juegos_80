// ---------- Tiempos (milisegundos) ----------
const ESPERA_LOGO = 2000;   // tras encender, hasta que empieza a aparecer el logo
const TIEMPO_LOGO = 2500;   // logo en pantalla (con su fundido) antes de acercar la cámara
const DURACION_ZOOM = 2000; // debe coincidir con la transición de .escena en el CSS
const VELOCIDAD_TECLEO = 110;

const escena = document.querySelector(".escena");
const computador = document.querySelector(".computador");
const pantalla = document.querySelector(".pantalla");
const salida = document.querySelector(".terminal .salida");
const linea = document.querySelector(".terminal .linea");
const terminal = document.querySelector(".terminal");

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

// ---------- Encendido ----------

computador.addEventListener("click", async () => {
    if (escena.classList.contains("encendido")) return;
    escena.classList.add("encendido");
    SonidoPC.encender();

    await esperar(ESPERA_LOGO);
    escena.classList.add("con-logo");

    // Con el logo ya visible, la cámara se acerca al monitor y después arranca SM-DOS
    await esperar(TIEMPO_LOGO);
    hacerZoom();
    await esperar(DURACION_ZOOM + 500);
    escena.classList.add("dos");
    await arrancarSMDOS();
});

async function arrancarSMDOS() {
    await esperar(800);
    imprimir("SM-BIOS (C) 1986 SM Systems\n\n");

    for (let k = 0; k <= 640; k += 32) {
        linea.textContent = `Memoria: ${k}K`;
        await esperar(45);
    }
    linea.textContent = "";
    imprimir("Memoria: 640K OK\n\n");
    SonidoPC.pitido();
    await esperar(600);

    imprimir("Iniciando SM-DOS...\n\n");
    SonidoPC.accesos(1100);
    await esperar(1200);
    imprimir("HIMEM: memoria extendida...");
    SonidoPC.accesos(700);
    await esperar(900);
    imprimir("hecho.\n\n");
    await esperar(500);

    imprimir("SM-DOS Versión 3.20\n(C) Copyright SM 1981-1986.\n\n");
    imprimir(promptActual());
    await esperar(800);
    await teclear("cd juegos");
    await esperar(600);
    await teclear("dir");

    listo = true;
}

// ---------- Zoom al monitor ----------

function hacerZoom() {
    escena.classList.add("zoom");
    ajustarZoom();
}

// Escala la escena para que la pantalla ocupe casi toda la ventana
// y la centra, dejando ver un poco del marco del monitor
function ajustarZoom() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Medidas sin transformar (offset* ignora transform)
    const escenaX = (vw - escena.offsetWidth) / 2;
    const escenaY = (vh - escena.offsetHeight) / 2;
    const px = pantalla.offsetLeft + pantalla.offsetWidth / 2;
    const py = pantalla.offsetTop + pantalla.offsetHeight / 2;

    const escala = Math.min(vw / pantalla.offsetWidth, vh / pantalla.offsetHeight) * 0.9;
    const tx = vw / 2 - (escenaX + px);
    const ty = vh / 2 - (escenaY + py);

    escena.style.transformOrigin = `${px}px ${py}px`;
    escena.style.transform = `translate(-50%, -50%) translate(${tx}px, ${ty}px) scale(${escala})`;
}

window.addEventListener("resize", () => {
    if (!escena.classList.contains("zoom")) return;
    escena.style.transition = "none";
    ajustarZoom();
    escena.offsetWidth; // aplica sin animación
    escena.style.transition = "";
});

// ---------- Terminal ----------

let listo = false; // el teclado se activa al terminar la introducción
let enPrograma = false; // hay un juego en marcha dentro del monitor
let directorio = "C:\\";

function imprimir(texto) {
    salida.textContent += texto;
    terminal.scrollTop = terminal.scrollHeight;
}

function promptActual() {
    return `${directorio}>`;
}

async function teclear(texto) {
    for (const letra of texto) {
        linea.textContent += letra;
        await esperar(VELOCIDAD_TECLEO);
    }
    await esperar(300);
    enviar();
}

function enviar() {
    const comando = linea.textContent;
    linea.textContent = "";
    imprimir(comando + "\n");
    ejecutar(comando);
    if (!enPrograma) imprimir(promptActual());
}

document.addEventListener("keydown", (e) => {
    // Alt/Option (Mac) y AltGr (Windows, llega como Ctrl+Alt) sirven para escribir @, \, #...
    // Solo se ignoran los atajos de Cmd y de Ctrl
    if (!listo || enPrograma || e.metaKey || (e.ctrlKey && !e.altKey)) return;

    if (e.key === "Enter") {
        enviar();
    } else if (e.key === "Backspace") {
        linea.textContent = linea.textContent.slice(0, -1);
    } else if (e.key.length === 1 && linea.textContent.length < 60) {
        linea.textContent += e.key;
    } else {
        return;
    }
    e.preventDefault();
    terminal.scrollTop = terminal.scrollHeight;
});

// ---------- Comandos de SM-DOS ----------

const ARCHIVOS_RAIZ = [
    { nombre: "COMMAND", ext: "COM", tam: 54645, fecha: "10-11-86" },
    { nombre: "CONFIG", ext: "SYS", tam: 142, fecha: "10-11-86" },
    { nombre: "AUTOEXEC", ext: "BAT", tam: 98, fecha: "10-11-86" },
    { nombre: "JUEGOS", dir: true, fecha: "10-11-86" },
    { nombre: "RESULTADOS", dir: true, fecha: "13-11-86" },
];

// Contenido de C:\RESULTADOS: la tabla solo se abre con PRINT "resultados" (y usuario y contraseña)
const ARCHIVOS_RESULTADOS = [
    { nombre: "TABLA", ext: "DAT", tam: 2048, fecha: "13-11-86" },
];

const DIRECTORIOS = ["JUEGOS", "RESULTADOS"];

function ejecutar(comando) {
    const [orden = "", ...args] = comando.trim().split(/\s+/);
    const arg = args.join(" ").toUpperCase();

    // Dentro de C:\RESULTADOS la consola entiende PRINT (o ?) como en BASIC
    if (directorio === "C:\\RESULTADOS") {
        const ordenBasic = orden.toUpperCase();
        if (ordenBasic === "PRINT" || ordenBasic === "?" || /^(PRINT|\?)"/.test(ordenBasic)) {
            ejecutarPrint(comando.trim().replace(/^(print|\?)/i, "").trim());
            return;
        }
        // SALIR, SALIR(), FUNCTION SALIR: despedida final (después de ver los resultados)
        if (/^(FUNCTION\s+)?SALIR\s*(\(\s*\))?;?$/i.test(comando.trim())) {
            ejecutarSalir();
            return;
        }
        if (ordenBasic === "RESULTADOS") {
            // Escribirlo como si fuera un programa: error típico de BASIC (la pista es PRINT)
            SonidoPC.accesos(200);
            imprimir("Comando incorrecto\n?Syntax error\nOk\n\n");
            return;
        }
    }

    switch (orden.toUpperCase()) {
        case "":
            return;
        case "CLS":
            salida.textContent = "";
            return;
        case "VER":
            imprimir("\nSM-DOS Versión 3.20\n\n");
            return;
        case "AYUDA":
        case "HELP":
            imprimir(
                "\nCD [dir]  Cambia de directorio\n" +
                "CLS       Borra la pantalla\n" +
                "DIR       Muestra los archivos\n" +
                "VER       Versión de SM-DOS\n" +
                "RANKING   Mejores puntajes\n" +
                "GENERAL   Clasificación general\n" +
                "NOMBRE    Ejecuta un juego\n\n"
            );
            return;
        case "RANKING":
            mostrarRanking();
            return;
        case "GENERAL":
            mostrarGeneral();
            return;
        case "DIR":
            SonidoPC.accesos(350);
            listar();
            return;
        case "CD":
        case "CD..":
        case "CD\\":
            cambiarDirectorio(orden.length > 2 ? orden.slice(2) : arg);
            return;
    }

    if (!abrirJuego(orden.toUpperCase())) {
        imprimir("Comando o nombre de archivo incorrecto\n\n");
    }
}

function cambiarDirectorio(destino) {
    destino = destino.toUpperCase();
    if (destino === "") {
        imprimir(directorio + "\n\n");
        return;
    }
    if (destino === ".." || destino === "\\" || destino === "C:\\") {
        directorio = "C:\\";
        return;
    }
    // CD JUEGOS desde C:\, o con ruta completa (\JUEGOS, C:\JUEGOS) desde cualquier sitio
    const absoluto = destino.includes("\\");
    const nombre = destino.replace(/^C:/, "").replace(/^\\/, "");
    if (DIRECTORIOS.includes(nombre) && (absoluto || directorio === "C:\\")) {
        directorio = `C:\\${nombre}`;
    } else {
        imprimir("Directorio no válido\n\n");
    }
}

function listar() {
    const puntos = [{ nombre: ".", dir: true, fecha: "10-11-86" }, { nombre: "..", dir: true, fecha: "10-11-86" }];
    const entradas = {
        "C:\\JUEGOS": [...puntos, ...JUEGOS],
        "C:\\RESULTADOS": [...puntos, ...ARCHIVOS_RESULTADOS],
    }[directorio] ?? ARCHIVOS_RAIZ;

    let texto = `\n El volumen de la unidad C es SM-DOS\n Directorio de ${directorio}\n\n`;
    let archivos = 0;
    let bytes = 0;

    for (const e of entradas) {
        if (e.dir) {
            texto += `${e.nombre.padEnd(13)}<DIR>     ${e.fecha}\n`;
        } else {
            archivos++;
            bytes += e.tam;
            texto += `${e.nombre.padEnd(9)}${e.ext.padEnd(4)}${e.tam.toLocaleString("es-ES").padStart(9)} ${e.fecha}\n`;
        }
    }

    texto += `${String(archivos).padStart(9)} archivo(s) ${bytes.toLocaleString("es-ES").padStart(9)} bytes\n\n`;
    imprimir(texto);
}

function abrirJuego(nombre) {
    if (directorio !== "C:\\JUEGOS") return false;
    const juego = JUEGOS.find((j) => nombre === j.nombre || nombre === `${j.nombre}.${j.ext}`);
    if (!juego) return false;

    const programa = window[juego.programa];
    if (programa) {
        lanzarPrograma(programa, juego);
    } else if (juego.url) {
        imprimir(`Cargando ${juego.nombre}...\n`);
        listo = false;
        setTimeout(() => (window.location.href = juego.url), 1200);
    } else {
        imprimir("El juego todavía no está disponible\n\n");
    }
    return true;
}

// Ejecuta un juego dentro de la pantalla del monitor y vuelve al prompt al salir.
// La primera vez tras encender el PC pide el correo del jugador.
let detenerPrograma = null; // cierra el juego en marcha (lo usa el fin del tiempo)
let sesion = 0;             // cambia al apagar el PC: anula los pasos que estuvieran pendientes

async function lanzarPrograma(programa, juego) {
    if (tiempoRestante() <= 0) {
        tiempoAgotado();
        return;
    }
    enPrograma = true; // la consola no recibe teclas durante el login y la carga
    const miSesion = sesion;

    if (!usuario) {
        const resultado = await pedirLogin();
        if (miSesion !== sesion) return;

        if (resultado === "no-registrado") {
            volverAlEscritorio({ apagarLampara: false });
            return;
        }
        if (resultado !== "ok") {
            enPrograma = false;
            imprimir(resultado === "cancelado"
                ? "Inicio de sesión cancelado\n\n"
                : "No se puede conectar con el servidor de puntajes\n\n");
            imprimir(promptActual());
            return;
        }
    }

    await pantallaCarga(juego);
    if (miSesion !== sesion) return;
    if (tiempoRestante() <= 0) {
        tiempoAgotado();
        return;
    }

    iniciarTiempo();
    escena.classList.add("ejecutando");

    const contenedor = document.createElement("div");
    contenedor.className = "programa";
    pantalla.append(contenedor);

    let cortado = false;
    const salir = programa.iniciar(contenedor, () => {
        contenedor.remove();
        escena.classList.remove("ejecutando");
        enPrograma = false;
        detenerPrograma = null;
        if (!cortado) imprimir("\n" + promptActual());
    }, {
        record: mejorPuntaje(juego.nombre),
        alPuntuar: (puntos) => registrarPuntaje(juego.nombre, puntos),
    });

    detenerPrograma = () => {
        cortado = true;
        if (typeof salir === "function") {
            salir();
        } else {
            // Juegos que no devuelven su función de salida: se cierran como con ESC
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
            contenedor.remove();
        }
    };
}

// ---------- Usuarios y ranking (api/ranking.php guarda los datos en data/*.json) ----------

const API_RANKING = "api/ranking.php";
const TIEMPO_CARGA = 4500; // pantalla de carga con los mejores puntajes

let usuario = null;   // { correo, nombre } del jugador; se borra al apagar el PC
let ranking = {};     // { JUEGO: [{ nombre, puntos, fecha }] } ordenado de mayor a menor
let general = [];     // [{ nombre, total, juegos: { JUEGO: puntos relativos } }] ordenado
let maximoGeneral = 3000;
let concurso = null;  // { nombre, desde, hasta, estado: "abierto" | "proximo" | "cerrado" }
let enviados = {};    // mejor puntaje ya enviado en esta sesión, por juego

// En modo simulación (assets/js/simulacion.js) no se usa el servidor: responde la simulación
async function api(datos) {
    let json;
    if (await esSimulacion()) {
        json = apiSimulada(datos);
    } else {
        const respuesta = await fetch(API_RANKING, datos
            ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos), keepalive: true }
            : { cache: "no-store" });
        json = await respuesta.json();
    }
    if (json.ranking) ranking = json.ranking;
    if (json.general) general = json.general;
    if (json.maximoGeneral) maximoGeneral = json.maximoGeneral;
    if (json.concurso) concurso = json.concurso;
    return json;
}

function mejorPuntaje(juego) {
    return ranking[juego]?.[0]?.puntos; // undefined si no hay datos: el juego usa su récord local
}

function registrarPuntaje(juego, puntos) {
    if (!usuario || !(puntos > 0) || puntos <= (enviados[juego] ?? 0)) return;
    enviados[juego] = puntos;
    api({ accion: "puntaje", correo: usuario.correo, juego, puntos }).catch(() => {
        enviados[juego] = 0; // se reintentará con el próximo puntaje
    });
}

// ---- Ventana de inicio de sesión ----

const inputCorreo = document.querySelector(".login-correo");
const mensajeLogin = document.querySelector(".login-mensaje");

function pedirLogin() {
    return new Promise((resolver) => {
        inputCorreo.value = "";
        inputCorreo.disabled = false;
        mensajeLogin.textContent = "";
        mensajeLogin.className = "login-mensaje";
        escena.classList.add("login");
        setTimeout(() => inputCorreo.focus({ preventScroll: true }), 0);
        esSimulacion().then((simulacion) => {
            if (simulacion && !mensajeLogin.textContent) mensajeLogin.textContent = "MODO SIMULACIÓN: sirve cualquier correo";
        });

        const terminar = (resultado) => {
            inputCorreo.removeEventListener("keydown", alPulsar);
            inputCorreo.removeEventListener("blur", reenfocar);
            inputCorreo.blur();
            escena.classList.remove("login");
            resolver(resultado);
        };

        // La pantalla no recibe clics: si se pierde el foco, se recupera
        function reenfocar() {
            setTimeout(() => {
                if (escena.classList.contains("login") && !inputCorreo.disabled) inputCorreo.focus({ preventScroll: true });
            }, 0);
        }

        async function alPulsar(e) {
            e.stopPropagation();
            if (e.key === "Escape") {
                terminar("cancelado");
                return;
            }
            if (e.key !== "Enter") return;
            e.preventDefault();

            const correo = inputCorreo.value.trim().toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
                avisar("Correo no válido", true);
                pitido(400, 0.15);
                return;
            }

            inputCorreo.disabled = true;
            avisar("Verificando usuario...");
            SonidoPC.accesos(900);
            await esperar(900);

            try {
                const r = await api({ accion: "login", correo });
                if (r.ok) {
                    usuario = { correo, nombre: r.nombre };
                    enviados = {};
                    avisar(`Bienvenido, ${r.nombre}`);
                    await esperar(1500);
                    terminar("ok");
                } else {
                    avisar("USUARIO NO REGISTRADO", true);
                    pitido(400, 0.5);
                    await esperar(3000);
                    terminar("no-registrado");
                }
            } catch (error) {
                avisar("Sin conexión con el servidor", true);
                await esperar(2500);
                terminar("sin-servidor");
            }
        }

        function avisar(texto, esError = false) {
            mensajeLogin.textContent = texto;
            mensajeLogin.classList.toggle("error", esError);
        }

        inputCorreo.addEventListener("keydown", alPulsar);
        inputCorreo.addEventListener("blur", reenfocar);
    });
}

// ---- Pantalla de carga con los mejores puntajes, como en las máquinas arcade ----

const cargaEstado = document.querySelector(".carga-estado");
const cargaJuego = document.querySelector(".carga-juego");
const cargaTabla = document.querySelector(".carga-tabla");
const cargaJugador = document.querySelector(".carga-jugador");

const cargaTitulo = document.querySelector(".carga-titulo");

async function pantallaCarga(juego) {
    cargaEstado.textContent = `Cargando ${juego.nombre}.${juego.ext}...`;
    cargaTitulo.textContent = "MEJORES PUNTAJES";
    cargaJuego.textContent = juego.nombre;
    cargaTabla.replaceChildren();
    cargaJugador.textContent = `JUGADOR: ${usuario.nombre}`;
    escena.classList.add("cargando");

    // El disco trabaja mientras carga el juego y se lee el ranking
    SonidoPC.accesos(TIEMPO_CARGA - 800);
    try {
        await api();
    } catch (error) { /* sin servidor: se muestra la última tabla conocida */ }
    pintarTabla(ranking[juego.nombre] ?? []);
    if (concurso?.estado === "cerrado") cargaJugador.textContent += " · CONCURSO CERRADO";

    await Promise.race([esperar(TIEMPO_CARGA), esperarTecla(1000)]);
    escena.classList.remove("cargando");
}

// filas: [{ nombre, puntos, extras? }] ordenadas de mayor a menor.
// columnas: títulos de las columnas extra (desglose por juego en la clasificación general)
function pintarTabla(filas, columnas = []) {
    cargaTabla.classList.toggle("con-extras", columnas.length > 0);
    cargaTabla.style.setProperty("--extras", columnas.length);
    if (columnas.length && filas.length) {
        const li = document.createElement("li");
        li.className = "cabecera";
        for (const texto of ["", "JUGADOR", ...columnas, "TOTAL"]) {
            const span = document.createElement("span");
            span.textContent = texto;
            li.append(span);
        }
        cargaTabla.append(li);
    }
    if (!filas.length) {
        const li = document.createElement("li");
        li.className = "vacia";
        li.textContent = "SIN REGISTROS - ¡SÉ EL PRIMERO!";
        cargaTabla.append(li);
        return;
    }
    filas.forEach((fila, i) => {
        const li = document.createElement("li");
        if (fila.nombre === usuario?.nombre) li.classList.add("propia");
        const puesto = document.createElement("span");
        puesto.textContent = `${i + 1}º`.padStart(3);
        const nombre = document.createElement("span");
        nombre.textContent = fila.nombre;
        const extras = (fila.extras ?? []).map((valor) => {
            const span = document.createElement("span");
            span.textContent = valor;
            return span;
        });
        const puntos = document.createElement("span");
        puntos.textContent = fila.puntos.toLocaleString("es-ES");
        li.append(puesto, nombre, ...extras, puntos);
        cargaTabla.append(li);
    });
}

// Permite saltar la pantalla de carga con ENTER o ESPACIO pasado un momento
function esperarTecla(retraso) {
    return new Promise((resolver) => {
        setTimeout(() => {
            const alPulsar = (e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                window.removeEventListener("keydown", alPulsar);
                resolver();
            };
            window.addEventListener("keydown", alPulsar);
            setTimeout(() => window.removeEventListener("keydown", alPulsar), TIEMPO_CARGA);
        }, retraso);
    });
}

// ---- Comando GENERAL: clasificación general a pantalla completa, estilo arcade ----
// En cada juego el mejor puntaje vale 1.000 y los demás la parte proporcional; se suman los juegos.

async function mostrarGeneral() {
    enPrograma = true;
    imprimir("Calculando clasificación...\n");
    SonidoPC.accesos(800);
    const miSesion = sesion;
    try {
        await api();
    } catch (error) {
        if (miSesion !== sesion) return;
        enPrograma = false;
        imprimir("No se puede conectar con el servidor de puntajes\n\n" + promptActual());
        return;
    }
    if (miSesion !== sesion) return;

    cargaEstado.textContent = textoConcurso();
    cargaTitulo.textContent = "CLASIFICACIÓN GENERAL";
    cargaJuego.textContent = `SUMA DE LOS ${JUEGOS.length} JUEGOS · MÁX. ${maximoGeneral.toLocaleString("es-ES")}`;
    cargaTabla.replaceChildren();
    pintarTabla(
        general.map((g) => ({ nombre: g.nombre, puntos: g.total, extras: JUEGOS.map((j) => g.juegos[j.nombre] ?? 0) })),
        JUEGOS.map((j) => j.nombre.slice(0, 3))
    );
    cargaJugador.textContent = "ENTER o ESC para volver";
    escena.classList.add("cargando");

    await new Promise((resolver) => {
        const alPulsar = (e) => {
            if (!["Enter", "Escape", " "].includes(e.key)) return;
            e.preventDefault();
            window.removeEventListener("keydown", alPulsar);
            resolver();
        };
        setTimeout(() => window.addEventListener("keydown", alPulsar), 0);
    });
    if (miSesion !== sesion) return;

    escena.classList.remove("cargando");
    enPrograma = false;
    imprimir(promptActual());
}

function textoConcurso() {
    if (!concurso || (!concurso.desde && !concurso.hasta)) return concurso?.nombre || "";
    const fecha = (f) => f.split("-").reverse().join("-");
    const periodo = `${concurso.desde ? fecha(concurso.desde) : "..."} al ${concurso.hasta ? fecha(concurso.hasta) : "..."}`;
    const estado = { proximo: " (próximamente)", cerrado: " (cerrado)" }[concurso.estado] ?? "";
    return `${concurso.nombre || "Concurso"}: ${periodo}${estado}`;
}

// ---- Comando RANKING de la consola: una tabla por página, como MORE de MS-DOS ----

async function mostrarRanking() {
    enPrograma = true; // bloquea la consola mientras se muestran las tablas
    imprimir("Leyendo ranking...\n");
    SonidoPC.accesos(600);
    const miSesion = sesion;
    try {
        await api();
    } catch (error) {
        if (miSesion !== sesion) return;
        enPrograma = false;
        imprimir("No se puede conectar con el servidor de puntajes\n\n" + promptActual());
        return;
    }
    if (miSesion !== sesion) return;

    const fila = (i, nombre, valor) =>
        `${String(i + 1).padStart(3)}. ${nombre.slice(0, 18).padEnd(19, ".")}${valor.toLocaleString("es-ES").padStart(10, ".")}\n`;

    const paginas = [];
    let textoGeneral = `\n *** GENERAL (máx. ${maximoGeneral.toLocaleString("es-ES")}) ***\n`;
    if (concurso && (concurso.desde || concurso.hasta)) textoGeneral = `\n ${textoConcurso()}` + textoGeneral;
    if (!general.length) textoGeneral += "  Sin registros\n";
    general.forEach((g, i) => (textoGeneral += fila(i, g.nombre, g.total)));
    paginas.push(textoGeneral + "  (desglose por juego: comando GENERAL)\n");

    for (const juego of JUEGOS) {
        let texto = `\n *** ${juego.nombre} ***\n`;
        const filas = ranking[juego.nombre] ?? [];
        if (!filas.length) texto += "  Sin registros\n";
        filas.forEach((f, i) => (texto += fila(i, f.nombre, f.puntos)));
        paginas.push(texto);
    }

    for (let i = 0; i < paginas.length; i++) {
        imprimir(paginas[i]);
        if (i < paginas.length - 1) {
            imprimir("\nPulse una tecla para continuar . . .");
            const tecla = await esperarCualquierTecla();
            if (miSesion !== sesion) return;
            imprimir("\n");
            if (tecla === "Escape") break;
        }
    }

    enPrograma = false;
    imprimir("\n" + promptActual());
}

function esperarCualquierTecla() {
    return new Promise((resolver) => {
        const alPulsar = (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey || ["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
            e.preventDefault();
            window.removeEventListener("keydown", alPulsar);
            resolver(e.key);
        };
        setTimeout(() => window.addEventListener("keydown", alPulsar), 0);
    });
}

// ---------- Tiempo de juego diario ----------
// El contador empieza al abrir el primer juego del día y sigue corriendo
// aunque se cambie de juego. Se guarda en el navegador, así que recargar
// la página no lo reinicia; al día siguiente vuelve a haber 10 minutos.

const TIEMPO_JUEGO = 5 * 60 * 1000; // PRUEBAS: 5 minutos (el valor final es 10 * 60 * 1000)
const CLAVE_TIEMPO = "smdos-tiempo-juego";
const AVISO_ULTIMO_MINUTO = 60 * 1000;
const AVISO_PITIDO = 10 * 1000; // pitido del altavoz del PC cuando quedan 10 segundos
const LECTURA_ERROR = 7000;      // tiempo para leer el error antes de responder
const ESPERA_APAGADO = 5000;     // tiempo con "Apagando el sistema..." en pantalla

const reloj = document.querySelector(".reloj");
const relojValor = document.querySelector(".reloj-valor");
let intervaloReloj = null;

function hoy() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// Devuelve el instante en que se acaba el tiempo de hoy, o null si aún no se ha jugado
function leerFin() {
    try {
        const datos = JSON.parse(localStorage.getItem(CLAVE_TIEMPO));
        if (datos && datos.fecha === hoy()) return datos.fin;
    } catch (e) { /* sin almacenamiento: el tiempo vive solo en memoria */ }
    return finEnMemoria && finEnMemoria.fecha === hoy() ? finEnMemoria.fin : null;
}

let finEnMemoria = null;

function guardarFin(fin) {
    finEnMemoria = { fecha: hoy(), fin };
    try {
        localStorage.setItem(CLAVE_TIEMPO, JSON.stringify(finEnMemoria));
    } catch (e) { /* ignorado */ }
}

function tiempoRestante() {
    const fin = leerFin();
    return fin === null ? TIEMPO_JUEGO : Math.max(0, fin - Date.now());
}

function iniciarTiempo() {
    if (leerFin() === null) guardarFin(Date.now() + TIEMPO_JUEGO);
    if (!intervaloReloj) intervaloReloj = setInterval(tic, 250);
    tic();
}

function tic() {
    const restante = tiempoRestante();
    const segundos = Math.ceil(restante / 1000);
    const mm = String(Math.floor(segundos / 60)).padStart(2, "0");
    const ss = String(segundos % 60).padStart(2, "0");
    relojValor.textContent = `${mm}:${ss}`;
    reloj.classList.toggle("urgente", restante <= AVISO_ULTIMO_MINUTO);

    if (restante <= 0) {
        tiempoAgotado();
    } else if (restante <= AVISO_PITIDO && !pitidoHecho) {
        pitidoHecho = true;
        pitido();
    }
}

let pitidoHecho = false;
let audio = null;

// Pitido monótono de onda cuadrada, como el altavoz interno de un PC con MS-DOS
function pitido(frecuencia = 750, duracion = 0.8) {
    try {
        audio ??= new (window.AudioContext || window.webkitAudioContext)();
        audio.resume();
        const osc = audio.createOscillator();
        const vol = audio.createGain();
        osc.type = "square";
        osc.frequency.value = frecuencia;
        const t = audio.currentTime;
        vol.gain.setValueAtTime(0.08, t);
        vol.gain.setValueAtTime(0.08, t + duracion - 0.02);
        vol.gain.linearRampToValueAtTime(0, t + duracion);
        osc.connect(vol).connect(audio.destination);
        osc.start(t);
        osc.stop(t + duracion);
    } catch (e) { /* sin audio */ }
}

let apagando = false;
const cajaError = document.querySelector(".error-dos");
const respuestaError = document.querySelector(".error-respuesta");
const finError = document.querySelector(".error-fin");
document.querySelector(".error-minutos").textContent = Math.round(TIEMPO_JUEGO / 60000);

async function tiempoAgotado() {
    if (apagando) return;
    apagando = true;
    sesion++; // anula un login o una carga que estuvieran en curso
    clearInterval(intervaloReloj);
    intervaloReloj = null;
    listo = false;

    if (detenerPrograma) detenerPrograma();
    escena.classList.remove("ejecutando", "login", "cargando", "basic", "despedida");
    enPrograma = false;

    // Pantalla de error de SM-DOS: recuadro gris con letras negras
    linea.textContent = "";
    salida.textContent = "";
    respuestaError.textContent = "";
    finError.textContent = "";
    await esperar(400);
    escena.classList.add("error");
    pitido(750, 0.4);

    await esperar(LECTURA_ERROR);
    respuestaError.textContent = "A";
    await esperar(1000);
    finError.textContent = "No se puede continuar.\nApagando el sistema...";
    await esperar(ESPERA_APAGADO);

    volverAlEscritorio();
}

// Apaga el monitor y aleja la cámara hasta la vista inicial del escritorio.
// También cierra la sesión del jugador.
function volverAlEscritorio({ apagarLampara: conLampara = true } = {}) {
    SonidoPC.apagar();
    sesion++;
    usuario = null;
    listo = false;
    enPrograma = false;
    escena.classList.remove("zoom");
    escena.style.transform = "";
    escena.classList.remove("encendido", "con-logo", "dos", "ejecutando", "error", "login", "cargando", "basic", "despedida");
    salida.textContent = "";
    linea.textContent = "";
    directorio = "C:\\";
    apagando = false;

    // Cuando la cámara ya ha vuelto: se quita el origen del zoom y se apaga la lámpara
    setTimeout(() => {
        if (!escena.classList.contains("zoom")) escena.style.transformOrigin = "";
        if (conLampara) apagarLampara();
    }, DURACION_ZOOM + 500);
}

// ---------- Lámpara ----------
// Se apaga (con parpadeo) al acabarse el tiempo y sigue apagada el resto del día

new Image().src = "assets/img/fondo0-apagado.png"; // precarga para que el cambio sea inmediato

function apagarLampara(conParpadeo = true) {
    escena.classList.toggle("parpadeo-lampara", conParpadeo);
    escena.classList.add("lampara-apagada");
}

function encenderLampara() {
    escena.classList.remove("lampara-apagada", "parpadeo-lampara");
    escena.classList.add("encendiendo-lampara");
    setTimeout(() => escena.classList.remove("encendiendo-lampara"), 700);
}

// Clic en la lámpara: interruptor de encendido y apagado
document.querySelector(".lampara").addEventListener("click", () => {
    clicInterruptor();
    if (escena.classList.contains("lampara-apagada")) {
        encenderLampara();
    } else {
        apagarLampara(false);
    }
});

function clicInterruptor() {
    try {
        audio ??= new (window.AudioContext || window.webkitAudioContext)();
        audio.resume();
        const osc = audio.createOscillator();
        const vol = audio.createGain();
        osc.type = "square";
        osc.frequency.value = 1800;
        const t = audio.currentTime;
        vol.gain.setValueAtTime(0.05, t);
        vol.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
        osc.connect(vol).connect(audio.destination);
        osc.start(t);
        osc.stop(t + 0.03);
    } catch (e) { /* sin audio */ }
}

if (tiempoRestante() <= 0) apagarLampara(false);

// ---------- Radio ----------
// Clic en la radio: reproduce o pausa la canción (sigue sonando aunque se entre al monitor)

const botonRadio = document.querySelector(".radio");
const cancion = document.querySelector(".cancion");
cancion.volume = 0.7;

botonRadio.addEventListener("click", () => {
    clicInterruptor();
    if (cancion.paused) {
        cancion.play().catch(() => { /* archivo no disponible o bloqueado */ });
    } else {
        cancion.pause();
    }
});

cancion.addEventListener("play", () => actualizarRadio(true));
cancion.addEventListener("pause", () => actualizarRadio(false));

function actualizarRadio(sonando) {
    escena.classList.toggle("radio-sonando", sonando);
    botonRadio.setAttribute("aria-pressed", String(sonando));
}
