// Póster de E.T.: al hacer clic, la figura de la bicicleta despega de la luna, cruza la
// habitación y sale volando; unos segundos después vuelve y se posa de nuevo en la luna.
//   assets/img/et-figura.png        la silueta recortada (con transparencia)
//   assets/img/et-luna.png          la luna sin la silueta (lámpara encendida)
//   assets/img/et-luna-apagado.png  la luna sin la silueta (lámpara apagada)
// Las posiciones son porcentajes de la escena (imagen de 1672x941), como el resto de zonas.

(() => {
    const escena = document.querySelector(".escena");
    const boton = document.querySelector(".poster-et");
    const figura = document.querySelector(".et-figura");

    const CASA = { x: 14.8923, y: 14.1339 }; // posición de la figura en la luna
    const ESPERA_VUELTA = 5000;              // tiempo fuera de la pantalla antes de volver

    let volando = false;

    // left/top en % de la escena; escala, giro y halo de luz de luna (para que se vea sobre fondos oscuros)
    const punto = (offset, x, y, escala, giro, halo, easing = "ease-in-out") => ({
        offset,
        left: `${x}%`,
        top: `${y}%`,
        transform: `scale(${escala}) rotate(${giro}deg)`,
        // Dos sombras finas forman un contorno claro y una tercera, más amplia, el resplandor
        filter: `drop-shadow(0 0 ${halo * 0.08}vw rgba(255, 240, 255, ${halo})) ` +
                `drop-shadow(0 0 ${halo * 0.08}vw rgba(255, 240, 255, ${halo})) ` +
                `drop-shadow(0 0 ${halo * 0.7}vw rgba(255, 200, 255, ${halo * 0.7}))`,
        easing,
    });

    // Despega, crece al cruzar la habitación (se acerca) y se aleja por arriba a la derecha
    const IDA = [
        punto(0, CASA.x, CASA.y, 1, 0, 0, "ease-in"),
        punto(0.15, CASA.x + 1.2, CASA.y - 4, 1.2, -8, 1),
        punto(0.4, 30, 7, 1.8, -10, 1),
        punto(0.65, 52, 5, 1.9, -5, 1),
        punto(0.85, 74, 1, 1.5, -8, 1),
        punto(1, 96, -18, 1.1, -14, 1),
    ];

    // Vuelve por la izquierda, pasando por la ventana, y se posa en la luna
    const VUELTA = [
        punto(0, -12, 24, 1.7, 6, 1, "ease-out"),
        punto(0.5, 3, 10, 1.5, -4, 1),
        punto(0.85, 12, 11.5, 1.1, 2, 1),
        punto(1, CASA.x, CASA.y, 1, 0, 0),
    ];

    boton.addEventListener("click", async () => {
        if (volando || escena.classList.contains("zoom")) return;
        volando = true;

        figura.style.left = `${CASA.x}%`;
        figura.style.top = `${CASA.y}%`;
        escena.classList.add("et-fuera"); // muestra el parche de luna vacía y la figura suelta

        silbido(380, 1250, 1.6);
        await figura.animate(IDA, { duration: 5200, fill: "forwards" }).finished;

        figura.style.visibility = "hidden";
        await new Promise((r) => setTimeout(r, ESPERA_VUELTA));
        figura.style.visibility = "";

        silbido(1100, 420, 1.4);
        await figura.animate(VUELTA, { duration: 4200, fill: "forwards" }).finished;

        escena.classList.remove("et-fuera"); // la figura vuelve a ser parte del póster
        figura.getAnimations().forEach((a) => a.cancel());
        volando = false;
    });

    // Silbido suave que sube (despegue) o baja (aterrizaje)
    function silbido(desde, hasta, duracion) {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const vol = ctx.createGain();
            osc.type = "sine";
            const t = ctx.currentTime;
            osc.frequency.setValueAtTime(desde, t);
            osc.frequency.exponentialRampToValueAtTime(hasta, t + duracion);
            vol.gain.setValueAtTime(0, t);
            vol.gain.linearRampToValueAtTime(0.05, t + 0.15);
            vol.gain.linearRampToValueAtTime(0, t + duracion);
            osc.connect(vol).connect(ctx.destination);
            osc.start(t);
            osc.stop(t + duracion);
            osc.onended = () => ctx.close();
        } catch (e) { /* sin audio */ }
    }
})();
