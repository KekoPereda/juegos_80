// Sonido de un PC antiguo sintetizado con Web Audio (sin archivos de audio):
// interruptor, ventilador, disco duro que se acelera y "rasca" al leer, y pitido de la BIOS.
//   SonidoPC.encender()        al pulsar el botón de encendido
//   SonidoPC.accesos(ms)       actividad del disco duro durante ms milisegundos
//   SonidoPC.pitido()          pitido corto del altavoz del PC (arranque correcto)
//   SonidoPC.apagar()          el disco se frena y se apaga el ventilador
window.SonidoPC = (() => {
    const VOLUMEN = 0.6;

    let ctx = null;
    let maestro = null;  // volumen general mientras el PC está encendido
    let fuentes = [];    // nodos continuos (ventilador, motor) que hay que parar al apagar
    let motor = null;    // osciladores del disco, para frenarlos al apagar
    let encendido = false;

    function contexto() {
        ctx ??= new (window.AudioContext || window.webkitAudioContext)();
        ctx.resume();
        return ctx;
    }

    // Búfer de ruido blanco reutilizable
    let ruidoBufer = null;
    function ruido() {
        if (!ruidoBufer) {
            ruidoBufer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
            const datos = ruidoBufer.getChannelData(0);
            for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;
        }
        const fuente = ctx.createBufferSource();
        fuente.buffer = ruidoBufer;
        return fuente;
    }

    function filtro(tipo, frecuencia, q = 1) {
        const f = ctx.createBiquadFilter();
        f.type = tipo;
        f.frequency.value = frecuencia;
        f.Q.value = q;
        return f;
    }

    function ganancia(valor) {
        const g = ctx.createGain();
        g.gain.value = valor;
        return g;
    }

    // Golpe seco del interruptor y del relé de la fuente de alimentación
    function interruptor(t) {
        const golpe = ctx.createOscillator();
        golpe.frequency.setValueAtTime(90, t);
        golpe.frequency.exponentialRampToValueAtTime(35, t + 0.15);
        const g = ganancia(0);
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        golpe.connect(g).connect(maestro);
        golpe.start(t);
        golpe.stop(t + 0.2);

        const chasquido = ruido();
        const gc = ganancia(0);
        gc.gain.setValueAtTime(0.4, t);
        gc.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        chasquido.connect(filtro("highpass", 1500)).connect(gc).connect(maestro);
        chasquido.start(t);
        chasquido.stop(t + 0.05);
    }

    // Ventilador de la fuente: ruido grave continuo con un zumbido de red eléctrica
    function ventilador(t) {
        const aire = ruido();
        aire.loop = true;
        const g = ganancia(0);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.09, t + 1.5);
        aire.connect(filtro("lowpass", 500, 0.7)).connect(g).connect(maestro);
        aire.start(t);

        const zumbido = ctx.createOscillator();
        zumbido.frequency.value = 100;
        const gz = ganancia(0);
        gz.gain.setValueAtTime(0, t);
        gz.gain.linearRampToValueAtTime(0.015, t + 1);
        zumbido.connect(gz).connect(maestro);
        zumbido.start(t);

        fuentes.push(aire, zumbido);
    }

    // Motor del disco duro: un zumbido grave y un silbido agudo que suben hasta su velocidad
    function discoDuro(t) {
        const ARRANQUE = 4.5;

        const giro = ctx.createOscillator();
        giro.type = "sawtooth";
        giro.frequency.setValueAtTime(8, t);
        giro.frequency.exponentialRampToValueAtTime(60, t + ARRANQUE);
        const gg = ganancia(0);
        gg.gain.setValueAtTime(0, t);
        gg.gain.linearRampToValueAtTime(0.05, t + 1);
        giro.connect(filtro("lowpass", 300)).connect(gg).connect(maestro);
        giro.start(t);

        const silbido = ctx.createOscillator();
        silbido.type = "sine";
        silbido.frequency.setValueAtTime(150, t);
        silbido.frequency.exponentialRampToValueAtTime(3600, t + ARRANQUE);
        const gs = ganancia(0);
        gs.gain.setValueAtTime(0, t);
        gs.gain.linearRampToValueAtTime(0.012, t + ARRANQUE);
        gs.gain.linearRampToValueAtTime(0.005, t + ARRANQUE + 2);
        silbido.connect(gs).connect(maestro);
        silbido.start(t);

        motor = { giro, silbido };
        fuentes.push(giro, silbido);

        // Al terminar de acelerar, el cabezal se calibra con unos cuantos golpes
        accesos(1200, t + ARRANQUE - 0.3);
    }

    // Un movimiento del cabezal: clic agudo con un pequeño golpe grave
    function cabezal(t, fuerza) {
        const clic = ruido();
        const g = ganancia(0);
        const dur = 0.006 + Math.random() * 0.012;
        g.gain.setValueAtTime(0.35 * fuerza, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        clic.connect(filtro("bandpass", 2200 + Math.random() * 2500, 1.5)).connect(g).connect(maestro);
        clic.start(t, Math.random() * 1.5);
        clic.stop(t + dur + 0.01);

        const golpe = ctx.createOscillator();
        golpe.frequency.value = 140 + Math.random() * 120;
        const gg = ganancia(0);
        gg.gain.setValueAtTime(0.12 * fuerza, t);
        gg.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
        golpe.connect(gg).connect(maestro);
        golpe.start(t);
        golpe.stop(t + 0.04);
    }

    // Actividad del disco: ráfagas de clics irregulares durante ms milisegundos
    function accesos(ms, inicio) {
        if (!encendido) return;
        let t = inicio ?? ctx.currentTime;
        const fin = t + ms / 1000;
        while (t < fin) {
            cabezal(t, 0.5 + Math.random() * 0.5);
            // A veces una pausa entre ráfagas, a veces clics muy seguidos
            t += Math.random() < 0.2 ? 0.08 + Math.random() * 0.15 : 0.02 + Math.random() * 0.05;
        }
    }

    function pitido() {
        if (!encendido) return;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        osc.type = "square";
        osc.frequency.value = 1000;
        const g = ganancia(0);
        g.gain.setValueAtTime(0.06, t);
        g.gain.setValueAtTime(0.06, t + 0.15);
        g.gain.linearRampToValueAtTime(0, t + 0.17);
        osc.connect(g).connect(maestro);
        osc.start(t);
        osc.stop(t + 0.2);
    }

    function encender() {
        if (encendido) return;
        try {
            contexto();
        } catch (e) {
            return; // navegador sin Web Audio
        }
        encendido = true;
        maestro = ganancia(VOLUMEN);
        maestro.connect(ctx.destination);

        const t = ctx.currentTime + 0.02;
        interruptor(t);
        ventilador(t + 0.1);
        discoDuro(t + 0.4);
    }

    function apagar() {
        if (!encendido) return;
        encendido = false;
        const t = ctx.currentTime;
        const FRENADO = 3;

        if (motor) {
            motor.giro.frequency.cancelScheduledValues(t);
            motor.giro.frequency.setValueAtTime(motor.giro.frequency.value, t);
            motor.giro.frequency.exponentialRampToValueAtTime(8, t + FRENADO);
            motor.silbido.frequency.cancelScheduledValues(t);
            motor.silbido.frequency.setValueAtTime(motor.silbido.frequency.value, t);
            motor.silbido.frequency.exponentialRampToValueAtTime(100, t + FRENADO);
        }

        const salida = maestro;
        salida.gain.setValueAtTime(salida.gain.value, t);
        salida.gain.linearRampToValueAtTime(0, t + FRENADO);

        const aParar = fuentes;
        fuentes = [];
        motor = null;
        setTimeout(() => {
            aParar.forEach((n) => n.stop());
            salida.disconnect();
        }, FRENADO * 1000 + 100);
    }

    return { encender, accesos, pitido, apagar };
})();
