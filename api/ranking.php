<?php
// API de usuarios y ranking de SM-DOS. Guarda los datos en ../data/*.json
//
//   GET  ranking.php                                  -> ranking de cada juego, clasificación general y concurso
//   POST ranking.php {accion:"login",   correo}       -> comprueba si el usuario está registrado
//   POST ranking.php {accion:"puntaje", correo, juego, puntos}
//                                                     -> guarda el puntaje si supera el mejor del usuario
//   POST ranking.php {accion:"resultados", usuario, clave}
//                                                     -> clasificación general completa (solo administradores)
//
// Usuarios registrados: data/usuarios.json  [{ "correo": "...", "nombre": "..." }]
// Ranking:              data/ranking.json   { "JUEGO": { "correo": { "puntos": 0, "fecha": "..." } } }
// Administradores:      data/admin.json     [{ "usuario": "...", "clave": "<hash de password_hash>" }]
// Concurso (opcional):  data/concurso.json  { "nombre": "...", "desde": "AAAA-MM-DD", "hasta": "AAAA-MM-DD" }
//
// Clasificación general: en cada juego el mejor puntaje vale 1.000 y los demás la parte
// proporcional; se suman los juegos (máximo 1.000 × número de juegos).

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// Zona horaria de las fechas guardadas y de los límites del concurso
date_default_timezone_set('America/Santiago');

const JUEGOS = ['INVASION', 'BLOQUES', 'RATON']; // al añadir un juego, añádelo también aquí
const PUNTOS_MAX = 99999999;
const PUNTOS_GENERAL = 1000; // lo que vale el mejor puntaje de cada juego en la clasificación general
const TOP = 10;

$dirDatos = __DIR__ . '/../data';
$archivoUsuarios = "$dirDatos/usuarios.json";
$archivoRanking = "$dirDatos/ranking.json";
$archivoConcurso = "$dirDatos/concurso.json";
$archivoAdmin = "$dirDatos/admin.json";

function responder(array $datos, int $codigo = 200): void
{
    http_response_code($codigo);
    echo json_encode($datos, JSON_UNESCAPED_UNICODE);
    exit;
}

function leerJson(string $archivo, $defecto)
{
    if (!is_file($archivo)) return $defecto;
    $datos = json_decode((string) file_get_contents($archivo), true);
    return is_array($datos) ? $datos : $defecto;
}

function buscarUsuario(string $correo, string $archivo): ?array
{
    foreach (leerJson($archivo, []) as $u) {
        if (isset($u['correo']) && mb_strtolower(trim($u['correo'])) === $correo) return $u;
    }
    return null;
}

function nombreDe(string $correo, array $usuarios): string
{
    foreach ($usuarios as $u) {
        if (mb_strtolower(trim($u['correo'] ?? '')) === $correo && !empty($u['nombre'])) {
            return mb_strtoupper($u['nombre']);
        }
    }
    return mb_strtoupper(explode('@', $correo)[0]);
}

// ---------- Concurso ----------
// Sin fechas: cuentan todos los puntajes.
// Con "desde": a partir de ese día solo cuentan las partidas jugadas desde entonces
//              (lo anterior queda como práctica y se reemplaza con el primer puntaje del concurso).
// Con "hasta": pasado ese día el ranking se congela y ya no se guardan puntajes.

function concurso(string $archivo): array
{
    $c = leerJson($archivo, []);
    $desde = !empty($c['desde']) ? $c['desde'] . ' 00:00:00' : null;
    $hasta = !empty($c['hasta']) ? $c['hasta'] . ' 23:59:59' : null;
    $ahora = date('Y-m-d H:i:s');

    $estado = 'abierto';
    if ($desde && $ahora < $desde) $estado = 'proximo';
    if ($hasta && $ahora > $hasta) $estado = 'cerrado';

    return [
        'nombre' => (string) ($c['nombre'] ?? ''),
        'desde' => $c['desde'] ?? null,
        'hasta' => $c['hasta'] ?? null,
        'estado' => $estado,
        // fecha mínima de un puntaje para que cuente (solo una vez empezado el concurso)
        'minimo' => ($desde && $estado !== 'proximo') ? $desde : null,
    ];
}

function cuenta(array $registro, array $concurso): bool
{
    return !$concurso['minimo'] || ($registro['fecha'] ?? '') >= $concurso['minimo'];
}

// ---------- Tablas ----------

// Ranking de cada juego (completo, ordenado) con el nombre de cada jugador
function tablasPorJuego(array $ranking, array $usuarios, array $concurso): array
{
    $salida = [];
    foreach (JUEGOS as $juego) {
        $filas = [];
        foreach ($ranking[$juego] ?? [] as $correo => $r) {
            if (!cuenta($r, $concurso)) continue;
            $filas[] = [
                'correo' => $correo,
                'nombre' => nombreDe($correo, $usuarios),
                'puntos' => (int) ($r['puntos'] ?? 0),
                'fecha' => $r['fecha'] ?? '',
            ];
        }
        usort($filas, fn($a, $b) => $b['puntos'] <=> $a['puntos'] ?: strcmp($a['fecha'], $b['fecha']));
        $salida[$juego] = $filas;
    }
    return $salida;
}

// Clasificación general: suma de los puntajes relativos de cada juego.
// Desempate: gana quien consiguió antes su último puntaje de la suma.
function tablaGeneral(array $tablas): array
{
    $jugadores = [];
    foreach ($tablas as $juego => $filas) {
        $mejor = $filas[0]['puntos'] ?? 0;
        if ($mejor <= 0) continue;
        foreach ($filas as $f) {
            $j = &$jugadores[$f['correo']];
            $j ??= ['nombre' => $f['nombre'], 'total' => 0, 'juegos' => array_fill_keys(JUEGOS, 0), 'fecha' => ''];
            $relativo = (int) round($f['puntos'] * PUNTOS_GENERAL / $mejor);
            $j['juegos'][$juego] = $relativo;
            $j['total'] += $relativo;
            $j['fecha'] = max($j['fecha'], $f['fecha']);
            unset($j);
        }
    }
    $filas = array_values($jugadores);
    usort($filas, fn($a, $b) => $b['total'] <=> $a['total'] ?: strcmp($a['fecha'], $b['fecha']));
    return $filas;
}

// Respuesta pública: sin correos y solo los primeros puestos
function datosPublicos(array $ranking, string $archivoUsuarios, array $concurso): array
{
    $tablas = tablasPorJuego($ranking, leerJson($archivoUsuarios, []), $concurso);
    $sinCorreo = fn($filas) => array_map(function ($f) {
        unset($f['correo']);
        return $f;
    }, array_slice($filas, 0, TOP));

    $publico = [];
    foreach ($tablas as $juego => $filas) $publico[$juego] = $sinCorreo($filas);

    $info = $concurso;
    unset($info['minimo']);

    return [
        'ranking' => $publico,
        'general' => $sinCorreo(tablaGeneral($tablas)),
        'maximoGeneral' => PUNTOS_GENERAL * count(JUEGOS),
        'concurso' => $info,
    ];
}

$metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$concurso = concurso($archivoConcurso);

if ($metodo === 'GET') {
    responder(['ok' => true] + datosPublicos(leerJson($archivoRanking, []), $archivoUsuarios, $concurso));
}

if ($metodo !== 'POST') {
    responder(['ok' => false, 'error' => 'Método no permitido'], 405);
}

$entrada = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($entrada)) responder(['ok' => false, 'error' => 'Petición no válida'], 400);

$correo = mb_strtolower(trim((string) ($entrada['correo'] ?? '')));
$usuario = $correo !== '' ? buscarUsuario($correo, $archivoUsuarios) : null;

switch ($entrada['accion'] ?? '') {
    case 'login':
        if (!$usuario) responder(['ok' => false, 'error' => 'Usuario no registrado']);
        responder([
            'ok' => true,
            'correo' => $correo,
            'nombre' => nombreDe($correo, leerJson($archivoUsuarios, [])),
        ]);

    case 'puntaje':
        if (!$usuario) responder(['ok' => false, 'error' => 'Usuario no registrado'], 403);

        $juego = strtoupper((string) ($entrada['juego'] ?? ''));
        $puntos = $entrada['puntos'] ?? null;
        if (!in_array($juego, JUEGOS, true)) responder(['ok' => false, 'error' => 'Juego desconocido'], 400);
        if (!is_int($puntos) || $puntos < 0 || $puntos > PUNTOS_MAX) responder(['ok' => false, 'error' => 'Puntaje no válido'], 400);

        // Concurso terminado: el ranking queda congelado
        if ($concurso['estado'] === 'cerrado') {
            responder(['ok' => true, 'guardado' => false, 'cerrado' => true]
                + datosPublicos(leerJson($archivoRanking, []), $archivoUsuarios, $concurso));
        }

        // Bloqueo del archivo para que dos partidas que terminan a la vez no se pisen
        $f = fopen($archivoRanking, 'c+');
        if (!$f || !flock($f, LOCK_EX)) responder(['ok' => false, 'error' => 'No se puede guardar el ranking'], 500);

        $ranking = json_decode(stream_get_contents($f) ?: '{}', true);
        if (!is_array($ranking)) $ranking = [];

        // Un puntaje de antes del concurso no cuenta: se reemplaza por el nuevo
        $registro = $ranking[$juego][$correo] ?? null;
        $anterior = ($registro && cuenta($registro, $concurso)) ? (int) $registro['puntos'] : -1;
        $nuevoRecord = $puntos > $anterior;
        if ($nuevoRecord) {
            $ranking[$juego][$correo] = ['puntos' => $puntos, 'fecha' => date('Y-m-d H:i:s')];
            ftruncate($f, 0);
            rewind($f);
            fwrite($f, json_encode($ranking, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
            fflush($f);
        }
        flock($f, LOCK_UN);
        fclose($f);

        responder(['ok' => true, 'guardado' => $nuevoRecord] + datosPublicos($ranking, $archivoUsuarios, $concurso));

    case 'resultados':
        // El nombre de usuario no distingue mayúsculas: SuperAdmin = superadmin
        $nombreAdmin = mb_strtolower(trim((string) ($entrada['usuario'] ?? '')));
        $clave = (string) ($entrada['clave'] ?? '');
        $autorizado = false;
        foreach (leerJson($archivoAdmin, []) as $a) {
            if ($nombreAdmin !== '' && mb_strtolower(trim($a['usuario'] ?? '')) === $nombreAdmin && password_verify($clave, $a['clave'] ?? '')) {
                $autorizado = true;
            }
        }
        if (!$autorizado) {
            usleep(800000); // frena los intentos de adivinar la contraseña
            responder(['ok' => false, 'error' => 'Acceso denegado']);
        }

        $tablas = tablasPorJuego(leerJson($archivoRanking, []), leerJson($archivoUsuarios, []), $concurso);
        $resultados = array_map(function ($f) {
            unset($f['correo']);
            return $f;
        }, tablaGeneral($tablas));
        $info = $concurso;
        unset($info['minimo']);

        responder([
            'ok' => true,
            'resultados' => $resultados, // todos los jugadores, no solo los primeros
            'juegos' => JUEGOS,
            'maximoGeneral' => PUNTOS_GENERAL * count(JUEGOS),
            'concurso' => $info,
        ]);

    default:
        responder(['ok' => false, 'error' => 'Acción desconocida'], 400);
}
