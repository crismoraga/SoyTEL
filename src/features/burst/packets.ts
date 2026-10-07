// Reglas de los microjuegos de paquetes, separadas de la pantalla para poder comprobarlas.

// ——— Atrapa el paquete ———

export const PACKETS_NEEDED = 5;

// Decide, aparición por aparición, si el paquete viene infectado. Se reparte en tandas barajadas: de
// cuatro con un infectado o, en las rondas avanzadas, de cinco con dos. Así nunca hay una racha de mala
// suerte que deje la ronda sin los paquetes sanos necesarios: en diez apariciones hay al menos seis.
export function createPacketBag(level: number, random: () => number = Math.random): () => boolean {
  let bag: boolean[] = [];
  return () => {
    if (bag.length === 0) {
      const heavy = level >= 6 || (level >= 2 && random() < 0.25 + level * 0.1);
      bag = heavy ? [true, true, false, false, false] : [true, false, false, false];
      for (let index = bag.length - 1; index > 0; index -= 1) {
        const other = Math.floor(random() * (index + 1));
        [bag[index], bag[other]] = [bag[other], bag[index]];
      }
    }
    return bag.pop() as boolean;
  };
}

// ——— Congestión de red ———

// Envíos que pide la ronda: la meta que se anuncia, el contador y la condición de victoria salen de aquí.
export function packetRushTarget(level: number): number {
  return 12 + Math.min(Math.max(0, level), 3) * 2;
}
