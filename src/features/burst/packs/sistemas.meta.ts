import type { MicroGameId } from '@/types/game';
import type { MicroGameInfo } from '../catalog';
import type { MicroGameGuide } from '../guides';

// Paquete de microjuegos · Sistemas: phishing, cifrado César, redundancia, procesos, códigos HTTP y depuración.
export const sistemasInfo: MicroGameInfo[] = [
  { id: 'phishing-mail', title: '¿Correo trampa?', instruction: 'Encuentra el remitente falso.', tip: 'Mira el dominio: una letra cambiada o un final raro es trampa.', durationSeconds: 12, icon: 'phishing', area: 'seguridad', mechanic: 'Detecta', course: 'Ingeniería en Ciberseguridad · 8.º semestre' },
  { id: 'caesar-shift', title: 'César rápido', instruction: 'Descifra el mensaje.', tip: 'Retrocede cada letra tantas posiciones como diga la pista.', durationSeconds: 12, icon: 'caesar', area: 'seguridad', mechanic: 'Descifra', course: 'Ingeniería en Ciberseguridad · 8.º semestre' },
  { id: 'redundancy', title: 'Que no se caiga', instruction: 'Elige el diseño que sigue funcionando.', tip: 'Lo que tiene repuesto (dos de algo) sobrevive a una falla.', durationSeconds: 12, icon: 'redundancy', area: 'software', mechanic: 'Elige', course: 'Disponibilidad y Rendimiento de Sistemas TIC · 7.º semestre' },
  { id: 'cpu-hog', title: 'Proceso glotón', instruction: 'Cierra el proceso que tiene lento el equipo.', tip: 'Busca el que usa casi toda la CPU, pero nunca cierres el sistema.', durationSeconds: 10, icon: 'gauge', area: 'software', mechanic: 'Elige', course: 'Sistemas Operativos para la Infraestructura Telemática · 6.º semestre' },
  { id: 'http-status', title: 'Código HTTP', instruction: '¿Qué código respondió el servidor?', tip: '404 no existe, 200 todo bien, 500 falló el servidor, 401 falta iniciar sesión.', durationSeconds: 12, icon: 'httpStatus', area: 'software', mechanic: 'Elige', course: 'Aplicaciones Web y Móviles · 8.º semestre' },
  { id: 'bug-hunt', title: 'Caza el bug', instruction: 'Encuentra la línea que no cumple la meta.', tip: 'Lee la meta y compárala línea por línea.', durationSeconds: 14, icon: 'bug', area: 'software', mechanic: 'Depura', course: 'Ingeniería de Software · 7.º semestre' },
];

export const sistemasGuides: Partial<Record<MicroGameId, MicroGameGuide>> = {
  'phishing-mail': { steps: ['Lee cada remitente.', 'Toca el que imita a uno real.'], learn: 'El phishing imita a quien conoces para robar tus datos: revisa siempre el dominio.' },
  'caesar-shift': { steps: ['Lee el mensaje cifrado y el desplazamiento.', 'Elige la palabra original.'], learn: 'El cifrado César corre cada letra unas posiciones: es el abuelo de la criptografía.' },
  'redundancy': { steps: ['Lee qué falló.', 'Elige el diseño con respaldo.'], learn: 'La redundancia (tener dos de lo importante) mantiene los servicios en pie cuando algo falla.' },
  'cpu-hog': { steps: ['Mira el uso de CPU de cada proceso.', 'Toca el que se come la CPU.'], learn: 'El sistema operativo reparte la CPU entre procesos; uno glotón frena a todos.' },
  'http-status': { steps: ['Lee lo que muestra el navegador.', 'Elige el código que corresponde.'], learn: 'Cada respuesta web trae un código: así el navegador sabe si todo salió bien.' },
  'bug-hunt': { steps: ['Lee la meta del programa.', 'Toca la línea que la contradice.'], learn: 'Depurar es encontrar la instrucción equivocada: lo hace todo programador, todos los días.' },
};
