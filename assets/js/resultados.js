// Resultados del concurso al estilo BASIC, dentro de C:\RESULTADOS.
//   PRINT "resultados"  pide usuario y contraseña (data/admin.json) y muestra la clasificación
//                       general completa, revelándola desde el último lugar hasta el primero.
//   RESULTADOS          escrito como programa da "?Syntax error" (la pista es PRINT).
//   SALIR               (o SALIR(), FUNCTION SALIR) tras ver los resultados: despedida, vuelta
//                       al escritorio, la lámpara se apaga y todo funde a negro.
// Usa las variables y funciones globales de app.js (sesion, enPrograma, api, pitido, imprimir...).

const basicTexto = document.querySelector(".basic-texto");
const basicAyuda = document.querySelector(".basic-ayuda");

// Cursor rectangular de BASIC: un solo bloque que se mueve a la línea activa
const cursorBloque = document.createElement("span");
cursorBloque.className = "bloque";

let resultadosVistos = false; // SALIR solo funciona después de ver la tabla

const COPA = [
    " ._____. ",
    "(|  1  |)",
    " '.   .' ",
    "   ) (   ",
    "  [___]  ",
];

// ---------- PRINT en C:\RESULTADOS ----------

function ejecutarPrint(expresion) {
    // PRINT "texto"  (en BASIC la comilla final es opcional)
    if (expresion.startsWith('"')) {
        const texto = expresion.slice(1).replace(/".*$/, "");
        if (texto.trim().toUpperCase() === "RESULTADOS") {
            abrirResultados();
        } else {
            imprimir(texto + "\n\n");
        }
        return;
    }
    if (expresion === "") {
        imprimir("\n");
    } else if (/^-?\d+(\.\d+)?$/.test(expresion)) {
        const n = Number(expresion);
        imprimir(`${n < 0 ? "" : " "}${n} \n\n`);
    } else if (/^[a-z][a-z0-9.]*\$$/i.test(expresion)) {
        imprimir("\n\n"); // variable de texto sin asignar: cadena vacía
    } else if (/^[a-z][a-z0-9.]*$/i.test(expresion)) {
        imprimir(" 0 \n\n"); // variable numérica sin asignar: vale 0, como en GW-BASIC
    } else {
        imprimir("?Syntax error\n\n");
    }
}

// ---------- Pantalla BASIC ----------

function lineaBasic(texto = "", clase = "") {
    const div = document.createElement("div");
    div.className = `linea-basic ${clase}`.trim();
    div.textContent = texto;
    basicTexto.append(div);
    return div;
}

function ponerCursor(div) {
    div.append(cursorBloque);
}

async function escribirBasic(texto, clase = "", pausa = 120) {
    const div = lineaBasic(texto, clase);
    ponerCursor(div);
    verLinea(div);
    await esperar(pausa);
    return div;
}

// Desplaza la vista lo justo para que se vea la línea
function verLinea(div) {
    const arriba = div.offsetTop;
    const abajo = arriba + div.offsetHeight;
    if (arriba < basicTexto.scrollTop) {
        basicTexto.scrollTop = arriba;
    } else if (abajo > basicTexto.scrollTop + basicTexto.clientHeight) {
        basicTexto.scrollTop = abajo - basicTexto.clientHeight;
    }
}

function altoLinea() {
    return basicTexto.firstElementChild?.offsetHeight || 20;
}

// Lee una línea de texto con el cursor de bloque (ENTER acepta, ESC cancela → null)
function leerLinea(pregunta, oculto, miSesion) {
    return new Promise((resolver) => {
        const div = lineaBasic(pregunta);
        const valor = document.createTextNode("");
        div.append(valor);
        ponerCursor(div);
        verLinea(div);
        let texto = "";

        const terminar = (resultado) => {
            window.removeEventListener("keydown", alPulsar);
            resolver(resultado);
        };

        function alPulsar(e) {
            if (miSesion !== sesion) return terminar(null);
            if (e.metaKey || (e.ctrlKey && !e.altKey)) return; // Alt/AltGr sí: @, \, #...
            if (e.key === "Escape") return terminar(null);
            if (e.key === "Enter") {
                e.preventDefault();
                return terminar(texto);
            }
            if (e.key === "Backspace") {
                texto = texto.slice(0, -1);
            } else if (e.key.length === 1 && texto.length < 60) {
                texto += e.key;
            } else {
                return;
            }
            e.preventDefault();
            valor.textContent = oculto ? "*".repeat(texto.length) : texto;
        }

        setTimeout(() => window.addEventListener("keydown", alPulsar), 0);
    });
}

// Puntos suspensivos que van apareciendo mientras el disco trabaja
async function animarPuntos(div, ms) {
    const pasos = Math.floor(ms / 300);
    for (let i = 0; i < pasos; i++) {
        await esperar(300);
        div.insertBefore(document.createTextNode("."), cursorBloque);
    }
}

// ---------- Flujo principal ----------

async function abrirResultados() {
    enPrograma = true; // la consola de SM-DOS no recibe teclas mientras tanto
    const miSesion = sesion;
    const vigente = () => miSesion === sesion;

    basicTexto.replaceChildren();
    basicTexto.scrollTop = 0;
    basicAyuda.textContent = "ESC cancelar";
    basicAyuda.className = "basic-ayuda";
    escena.classList.add("basic");

    SonidoPC.accesos(1300);
    await escribirBasic("SM-BASIC Versión 1.0", "", 350);
    await escribirBasic("(C) Copyright SM 1986", "", 350);
    await escribirBasic("", "", 200);
    await escribirBasic("ACCESO RESTRINGIDO: RESULTADOS", "aviso", 400);
    if (!vigente()) return;

    const usuarioAdmin = await leerLinea("USUARIO? ", false, miSesion);
    if (usuarioAdmin === null || !vigente()) return cerrarResultados(miSesion);
    const clave = await leerLinea("CONTRASEÑA? ", true, miSesion);
    if (clave === null || !vigente()) return cerrarResultados(miSesion);

    basicAyuda.textContent = "";
    const verificando = await escribirBasic("Verificando", "", 0);
    SonidoPC.accesos(1500);
    let datos = null;
    try {
        [datos] = await Promise.all([
            api({ accion: "resultados", usuario: usuarioAdmin.trim(), clave }),
            animarPuntos(verificando, 1500),
        ]);
    } catch (error) { /* sin servidor */ }
    if (!vigente()) return;

    if (!datos?.ok) {
        // Mensajes de error al estilo de GW-BASIC
        await escribirBasic(datos ? "?Acceso denegado" : "?Device I/O error", "error", 300);
        pitido(400, 0.4);
        await escribirBasic("Ok", "", 2500);
        return cerrarResultados(miSesion);
    }

    await revelarResultados(datos, miSesion);
    if (!vigente()) return;
    resultadosVistos = true;
    await navegar(miSesion);
    cerrarResultados(miSesion);
}

function cerrarResultados(miSesion) {
    if (miSesion !== sesion) return; // el PC se apagó mientras tanto
    escena.classList.remove("basic");
    enPrograma = false;
    imprimir("\n" + promptActual());
}

// ---------- Tabla: se revela desde el último lugar hasta el primero ----------

function textoFila(fila, i, juegos) {
    const puesto = `${String(i + 1).padStart(2)}º`;
    const nombre = fila.nombre.slice(0, 16).padEnd(17);
    const porJuego = juegos.map((j) => String(fila.juegos[j] ?? 0).padStart(5)).join("");
    return `${puesto} ${nombre}${porJuego}${String(fila.total).padStart(6)}`;
}

function tituloConcurso() {
    if (concurso?.desde || concurso?.hasta) return textoConcurso();
    return concurso?.nombre || "CLASIFICACIÓN GENERAL";
}

async function revelarResultados(datos, miSesion) {
    const vigente = () => miSesion === sesion;
    const filas = datos.resultados;
    const juegos = datos.juegos;

    // CLS y carga de la tabla
    basicTexto.replaceChildren();
    basicTexto.scrollTop = 0;
    await escribirBasic('LOAD "TABLA.DAT"', "", 300);
    SonidoPC.accesos(1200);
    const cargando = await escribirBasic("Cargando", "", 0);
    await animarPuntos(cargando, 1200);
    if (!vigente()) return;

    basicTexto.replaceChildren();
    lineaBasic(`RESULTADOS · ${tituloConcurso()}`, "titulo");
    lineaBasic(`${filas.length} jugador(es) · máximo ${datos.maximoGeneral} puntos`, "tenue");

    if (!filas.length) {
        await escribirBasic("Sin registros", "", 300);
        await escribirBasic("Ok", "", 0);
        basicAyuda.textContent = "ESC salir";
        return;
    }

    // Copa del campeón: oculta hasta el final
    const campeon = filas[0];
    const ladoCopa = ["", "CAMPEÓN", campeon.nombre, `${campeon.total} PUNTOS`, ""];
    const lineasCopa = COPA.map((dibujo, i) => {
        const div = lineaBasic("", "copa oculta");
        const copa = document.createElement("span");
        copa.className = "copa-dibujo";
        copa.textContent = dibujo;
        const lado = document.createElement("span");
        lado.className = "copa-texto";
        lado.textContent = "   " + ladoCopa[i];
        div.append(copa, lado);
        return div;
    });
    lineaBasic("");

    const cabecera = "POS " + "JUGADOR".padEnd(17) + juegos.map((j) => j.slice(0, 3).padStart(5)).join("") + "TOTAL".padStart(6);
    lineaBasic(cabecera, "cabecera");
    lineaBasic("-".repeat(cabecera.length), "tenue");

    // Filas pendientes: solo se ve el puesto
    const lineasFila = filas.map((_, i) => lineaBasic(`${String(i + 1).padStart(2)}º  · · · · · · · ·`, "pendiente"));
    lineaBasic("");
    const lineaOk = lineaBasic("Ok", "oculta");

    // Se empieza mirando el final de la tabla
    basicTexto.style.scrollBehavior = "auto";
    basicTexto.scrollTop = basicTexto.scrollHeight;
    basicTexto.style.scrollBehavior = "";
    await esperar(900);

    const ritmo = Math.max(150, Math.min(450, 7000 / filas.length)); // más rápido si hay muchos jugadores

    for (let i = filas.length - 1; i >= 0; i--) {
        if (!vigente()) return;

        if (i === 0) {
            // Suspenso antes del primer lugar
            basicAyuda.textContent = "Y el primer lugar es...";
            basicAyuda.classList.add("suspenso");
            ponerCursor(lineasFila[0]);
            verLinea(lineasFila[0]);
            SonidoPC.accesos(3800);
            await esperar(4000);
            basicAyuda.classList.remove("suspenso");
            basicAyuda.textContent = "";
        } else {
            const pausa = i === 2 ? 1600 : i === 1 ? 2200 : ritmo;
            SonidoPC.accesos(Math.min(pausa, 700));
            await esperar(pausa);
        }
        if (!vigente()) return;

        const div = lineasFila[i];
        div.textContent = textoFila(filas[i], i, juegos);
        div.className = "linea-basic revelada" + (i === 0 ? " oro" : i < 3 ? " podio" : "");
        ponerCursor(div);
        verLinea(div);
        if (i === 2) pitido(523, 0.15);
        if (i === 1) pitido(659, 0.15);
    }

    // Campeón: aparece la copa, suena la fanfarria y la vista sube al principio
    lineasCopa.forEach((div) => div.classList.remove("oculta"));
    basicTexto.scrollTop = 0;
    fanfarria();
    await esperar(1200);

    lineaOk.classList.remove("oculta");
    ponerCursor(lineaOk);
    basicAyuda.textContent = "FLECHAS desplazar · ESC salir";
}

// Pequeña fanfarria con el altavoz del PC
async function fanfarria() {
    const notas = [[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.45]];
    for (const [frecuencia, duracion] of notas) {
        pitido(frecuencia, duracion);
        await esperar(duracion * 1000 + 30);
    }
}

// Flechas, RePág/AvPág, Inicio/Fin para moverse por la tabla; ESC para salir
function navegar(miSesion) {
    return new Promise((resolver) => {
        const alPulsar = (e) => {
            if (miSesion !== sesion) {
                window.removeEventListener("keydown", alPulsar);
                resolver();
                return;
            }
            const linea = altoLinea();
            const pagina = basicTexto.clientHeight - linea;
            switch (e.key) {
                case "ArrowDown": basicTexto.scrollTop += linea; break;
                case "ArrowUp": basicTexto.scrollTop -= linea; break;
                case "PageDown": case " ": basicTexto.scrollTop += pagina; break;
                case "PageUp": basicTexto.scrollTop -= pagina; break;
                case "Home": basicTexto.scrollTop = 0; break;
                case "End": basicTexto.scrollTop = basicTexto.scrollHeight; break;
                case "Escape":
                    window.removeEventListener("keydown", alPulsar);
                    resolver();
                    break;
                default:
                    return;
            }
            e.preventDefault();
        };
        setTimeout(() => window.addEventListener("keydown", alPulsar), 0);
    });
}

// ---------- SALIR: despedida y fin ----------

const despedida1 = document.querySelector(".despedida-1");
const despedida2 = document.querySelector(".despedida-2");
const telon = document.querySelector(".telon");

async function ejecutarSalir() {
    if (!resultadosVistos) {
        imprimir("?Illegal function call\nOk\n\n"); // error de GW-BASIC: aún no hay nada de lo que salir
        return;
    }
    enPrograma = true;
    listo = false;

    imprimir("Cerrando sesión...\n");
    SonidoPC.accesos(900);
    await esperar(1000);

    // Pantalla de despedida, escrita letra a letra
    despedida1.textContent = "";
    despedida2.textContent = "";
    escena.classList.add("despedida");
    await esperar(500);
    await teclearEn(despedida1, "Muchas gracias por participar");
    await esperar(500);
    await teclearEn(despedida2, "Hasta el próximo año");
    melodiaDespedida();
    await esperar(5000);

    // El monitor se apaga y la cámara vuelve al escritorio; la lámpara se apaga sola al llegar
    volverAlEscritorio();
    if (!cancion.paused) bajarVolumen(cancion, 6000);
    await esperar(DURACION_ZOOM + 500 + 1400 + 1500);

    // Fundido a negro de toda la escena
    document.body.classList.add("fin");
    telon.setAttribute("aria-hidden", "false");
}

async function teclearEn(elemento, texto) {
    elemento.append(cursorBloque);
    for (const letra of texto) {
        cursorBloque.before(letra);
        if (letra !== " ") SonidoPC.accesos(40);
        await esperar(70);
    }
}

async function melodiaDespedida() {
    const notas = [[784, 0.18], [659, 0.18], [523, 0.18], [587, 0.18], [659, 0.18], [523, 0.6]];
    for (const [frecuencia, duracion] of notas) {
        pitido(frecuencia, duracion);
        await esperar(duracion * 1000 + 40);
    }
}

function bajarVolumen(audioElemento, ms) {
    const inicial = audioElemento.volume;
    const inicio = performance.now();
    const paso = () => {
        const t = Math.min(1, (performance.now() - inicio) / ms);
        audioElemento.volume = inicial * (1 - t);
        if (t < 1) {
            requestAnimationFrame(paso);
        } else {
            audioElemento.pause();
            audioElemento.volume = inicial;
        }
    };
    requestAnimationFrame(paso);
}
