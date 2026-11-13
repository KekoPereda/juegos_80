// Modo simulación: sin servidor (por ejemplo en Vercel, donde no hay PHP).
// Se activa con "simulacion": true en data/admin.json. En este modo:
//   - el inicio de sesión acepta cualquier correo válido,
//   - el ranking y la clasificación general usan jugadores de ejemplo (no los datos reales),
//   - los puntajes del visitante se guardan solo en su navegador (localStorage),
//   - PRINT "resultados" muestra la clasificación simulada sin pedir usuario ni contraseña.
// La simulación imita las respuestas de api/ranking.php, así que el resto del código no cambia.

const CLAVE_SIMULACION = "smdos-simulacion-puntajes";
const JUEGOS_SIMULACION = ["INVASION", "BLOQUES", "RATON"];
const PUNTOS_GENERAL_SIM = 1000;
const TOP_SIM = 10;

// Jugadores de ejemplo: [nombre, { JUEGO: [puntos, fecha] }]
const JUGADORES_SIMULADOS = [
    ["ANA SOTO", { INVASION: [4047, "2026-11-12 22:38:00"], BLOQUES: [3320, "2026-11-11 09:31:00"] }],
    ["LUIS ROJAS", { INVASION: [3503, "2026-11-10 10:36:00"], BLOQUES: [1340, "2026-11-12 06:09:00"], RATON: [2350, "2026-11-13 07:04:00"] }],
    ["PEDRO VERA", { INVASION: [2897, "2026-11-11 15:27:00"], BLOQUES: [1736, "2026-11-13 08:41:00"], RATON: [2570, "2026-11-12 02:08:00"] }],
    ["TOMAS PAZ", { INVASION: [4500, "2026-11-10 18:01:00"], BLOQUES: [1736, "2026-11-10 12:56:00"], RATON: [3616, "2026-11-12 17:36:00"] }],
    ["CLARA RUIZ", { INVASION: [3823, "2026-11-11 22:09:00"], BLOQUES: [1530, "2026-11-11 23:49:00"], RATON: [2109, "2026-11-12 11:28:00"] }],
    ["DIEGO MORA", { INVASION: [4126, "2026-11-10 14:54:00"] }],
    ["ELENA CRUZ", { INVASION: [4105, "2026-11-11 06:29:00"], BLOQUES: [2583, "2026-11-10 23:41:00"], RATON: [4761, "2026-11-10 14:02:00"] }],
    ["FELIPE OLEA", { INVASION: [2882, "2026-11-11 16:11:00"], BLOQUES: [1698, "2026-11-11 02:27:00"], RATON: [1692, "2026-11-11 01:45:00"] }],
    ["CAMILA NUÑEZ", { INVASION: [5399, "2026-11-11 02:14:00"], BLOQUES: [3472, "2026-11-13 04:10:00"], RATON: [3463, "2026-11-11 18:54:00"] }],
    ["JAVIER TORO", { INVASION: [4185, "2026-11-13 06:15:00"], BLOQUES: [4181, "2026-11-13 04:27:00"] }],
    ["PAULA REYES", { INVASION: [5122, "2026-11-11 17:57:00"], RATON: [5284, "2026-11-11 08:20:00"] }],
    ["MATIAS SILVA", { INVASION: [4036, "2026-11-12 00:08:00"], BLOQUES: [2390, "2026-11-11 04:16:00"], RATON: [2539, "2026-11-12 22:42:00"] }],
    ["VALENTINA ROSS", { INVASION: [5748, "2026-11-11 03:42:00"], BLOQUES: [3382, "2026-11-11 02:10:00"], RATON: [6118, "2026-11-12 15:18:00"] }],
    ["IGNACIO FUENTES", { INVASION: [4655, "2026-11-12 06:02:00"], BLOQUES: [2577, "2026-11-12 03:00:00"] }],
    ["CATALINA VIDAL", { INVASION: [1535, "2026-11-11 05:47:00"], BLOQUES: [579, "2026-11-12 18:56:00"] }],
    ["BENJAMIN ARAYA", { INVASION: [1382, "2026-11-10 20:39:00"], BLOQUES: [789, "2026-11-12 02:56:00"], RATON: [1259, "2026-11-11 18:12:00"] }],
    ["FERNANDA LEIVA", { INVASION: [3073, "2026-11-10 18:57:00"], BLOQUES: [1900, "2026-11-10 14:38:00"], RATON: [2800, "2026-11-13 02:28:00"] }],
    ["SOFIA LARA", { BLOQUES: [1704, "2026-11-12 10:41:00"], RATON: [3169, "2026-11-12 02:57:00"] }],
];

// ---------- ¿Está activo? (se comprueba una sola vez) ----------
// 1. data/admin.json: en Vercel se sirve como archivo estático. En MAMP, data/.htaccess lo bloquea.
// 2. api/ranking.php: en MAMP informa si admin.json tiene la simulación activada.

let promesaSimulacion = null;

function esSimulacion() {
    promesaSimulacion ??= (async () => {
        try {
            const r = await fetch("data/admin.json", { cache: "no-store" });
            if (r.ok && (await r.json())?.simulacion === true) return true;
        } catch (e) { /* bloqueado o sin servidor */ }
        try {
            const r = await fetch(API_RANKING, { cache: "no-store" });
            return (await r.json())?.simulacion === true;
        } catch (e) {
            return false;
        }
    })();
    return promesaSimulacion;
}
esSimulacion(); // se comprueba al cargar la página para que luego responda al instante

// ---------- Puntajes del visitante (solo en su navegador) ----------
// { correo: { nombre, juegos: { JUEGO: { puntos, fecha } } } }

function leerPuntajesSim() {
    try {
        const datos = JSON.parse(localStorage.getItem(CLAVE_SIMULACION) || "{}");
        return datos && typeof datos === "object" ? datos : {};
    } catch (e) {
        return {};
    }
}

function guardarPuntajesSim(datos) {
    try {
        localStorage.setItem(CLAVE_SIMULACION, JSON.stringify(datos));
    } catch (e) { /* sin almacenamiento: los puntajes duran hasta recargar */ }
}

let puntajesSim = leerPuntajesSim();

function fechaAhora() {
    const d = new Date();
    const dos = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())} ` +
        `${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
}

// "erik.pereda@..." -> "ERIK PEREDA"
function nombreSimulado(correo) {
    return correo.split("@")[0].replace(/[._-]+/g, " ").trim().toUpperCase() || "JUGADOR";
}

// ---------- Tablas (mismo cálculo que api/ranking.php) ----------

function tablasSimuladas() {
    const tablas = {};
    for (const juego of JUEGOS_SIMULACION) {
        const filas = [];
        JUGADORES_SIMULADOS.forEach(([nombre, juegos], i) => {
            if (juegos[juego]) filas.push({ id: `sim${i}`, nombre, puntos: juegos[juego][0], fecha: juegos[juego][1] });
        });
        for (const [correo, j] of Object.entries(puntajesSim)) {
            const r = j.juegos?.[juego];
            if (r) filas.push({ id: correo, nombre: j.nombre, puntos: r.puntos, fecha: r.fecha });
        }
        filas.sort((a, b) => b.puntos - a.puntos || a.fecha.localeCompare(b.fecha));
        tablas[juego] = filas;
    }
    return tablas;
}

function generalSimulada(tablas) {
    const jugadores = new Map();
    for (const [juego, filas] of Object.entries(tablas)) {
        const mejor = filas[0]?.puntos ?? 0;
        if (mejor <= 0) continue;
        for (const f of filas) {
            if (!jugadores.has(f.id)) {
                jugadores.set(f.id, {
                    nombre: f.nombre, total: 0, fecha: "",
                    juegos: Object.fromEntries(JUEGOS_SIMULACION.map((j) => [j, 0])),
                });
            }
            const j = jugadores.get(f.id);
            const relativo = Math.round(f.puntos * PUNTOS_GENERAL_SIM / mejor);
            j.juegos[juego] = relativo;
            j.total += relativo;
            if (f.fecha > j.fecha) j.fecha = f.fecha;
        }
    }
    return [...jugadores.values()].sort((a, b) => b.total - a.total || a.fecha.localeCompare(b.fecha));
}

const sinId = (filas) => filas.map(({ id, ...resto }) => resto);

function datosSimulados() {
    const tablas = tablasSimuladas();
    const ranking = {};
    for (const [juego, filas] of Object.entries(tablas)) ranking[juego] = sinId(filas.slice(0, TOP_SIM));
    return {
        ranking,
        general: generalSimulada(tablas).slice(0, TOP_SIM),
        maximoGeneral: PUNTOS_GENERAL_SIM * JUEGOS_SIMULACION.length,
        concurso: { nombre: "SIMULACIÓN", desde: null, hasta: null, estado: "abierto" },
        simulacion: true,
    };
}

// ---------- Respuestas de la API simulada ----------

function apiSimulada(datos) {
    if (!datos) return { ok: true, ...datosSimulados() };

    const correo = String(datos.correo ?? "").trim().toLowerCase();
    switch (datos.accion) {
        case "login":
            return { ok: true, correo, nombre: puntajesSim[correo]?.nombre ?? nombreSimulado(correo), simulacion: true };

        case "puntaje": {
            const juego = String(datos.juego ?? "").toUpperCase();
            const puntos = datos.puntos;
            if (!correo || !JUEGOS_SIMULACION.includes(juego) || !Number.isInteger(puntos) || puntos < 0) {
                return { ok: false, error: "Puntaje no válido" };
            }
            puntajesSim = leerPuntajesSim(); // por si otra pestaña guardó algo
            const jugador = (puntajesSim[correo] ??= { nombre: nombreSimulado(correo), juegos: {} });
            const guardado = puntos > (jugador.juegos[juego]?.puntos ?? -1);
            if (guardado) {
                jugador.juegos[juego] = { puntos, fecha: fechaAhora() };
                guardarPuntajesSim(puntajesSim);
            }
            return { ok: true, guardado, ...datosSimulados() };
        }

        case "resultados": {
            // Sin contraseña: solo hay datos de ejemplo
            const { maximoGeneral, concurso } = datosSimulados();
            return {
                ok: true,
                resultados: generalSimulada(tablasSimuladas()),
                juegos: JUEGOS_SIMULACION,
                maximoGeneral,
                concurso,
                simulacion: true,
            };
        }

        default:
            return { ok: false, error: "Acción desconocida" };
    }
}
