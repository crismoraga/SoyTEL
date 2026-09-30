import type { QuizArea } from './types';

export interface RouteQuestion {
  id: string;
  area: QuizArea;
  prompt: string;
  options: [string, string, string, string];
  answer: 0 | 1 | 2 | 3;
  explanation: string;
}

// Banco de la trivia final del pasillo: todo lo visto en B215 y en los proyectos de B213.
export const routeQuestions: RouteQuestion[] = [
  // B215 · redes de computadores
  {
    id: 'r-router',
    area: 'redes',
    prompt: '¿Qué equipo conecta tu red local con Internet y decide por dónde viaja cada paquete?',
    options: ['Switch', 'Router', 'Repetidor', 'Hub'],
    answer: 1,
    explanation: 'El router une redes distintas y elige la mejor ruta para cada paquete.',
  },
  {
    id: 'r-switch',
    area: 'redes',
    prompt: '¿Qué equipo conecta por cable varios computadores de una misma red local?',
    options: ['Router', 'Switch', 'Antena', 'Servidor DNS'],
    answer: 1,
    explanation: 'El switch reenvía cada trama solo al puerto del equipo de destino dentro de la LAN.',
  },
  {
    id: 'r-ping',
    area: 'redes',
    prompt: '¿Qué comando usas para comprobar si otro equipo responde en la red?',
    options: ['ping', 'copy', 'format', 'exit'],
    answer: 0,
    explanation: 'ping envía un paquete ICMP y mide cuánto tarda la respuesta.',
  },
  {
    id: 'r-private-ip',
    area: 'redes',
    prompt: '¿Cuál es una dirección IP privada típica de una red de casa?',
    options: ['8.8.8.8', '192.168.1.20', '300.1.1.1', '1.1.1.1'],
    answer: 1,
    explanation: 'Las redes 192.168.x.x son privadas: no se enrutan directamente en Internet.',
  },
  {
    id: 'r-mask',
    area: 'redes',
    prompt: 'En la red 10.0.0.0/24, ¿qué significa el /24?',
    options: ['Que tiene 24 equipos', 'Que los primeros 24 bits identifican la red', 'Que va a 24 Mbps', 'Que usa el puerto 24'],
    answer: 1,
    explanation: 'La máscara /24 reserva 24 bits para la red y deja 8 bits para los equipos.',
  },
  {
    id: 'r-packet',
    area: 'redes',
    prompt: '¿Qué es un paquete en una red de computadores?',
    options: ['Un cable especial', 'Un trozo de información con origen y destino', 'Un programa antivirus', 'Una antena'],
    answer: 1,
    explanation: 'Los datos viajan divididos en paquetes que llevan dirección de origen y de destino.',
  },
  {
    id: 'r-default',
    area: 'redes',
    prompt: 'Si ninguna regla de la tabla de rutas coincide, el router envía el paquete por…',
    options: ['La ruta por defecto', 'Todas las interfaces', 'Ninguna: lo guarda', 'El puerto USB'],
    answer: 0,
    explanation: 'La ruta por defecto (0.0.0.0/0) suele apuntar hacia Internet.',
  },
  // B215 · telecomunicaciones inalámbricas
  {
    id: 't-channels',
    area: 'teleco',
    prompt: 'En Wi-Fi de 2,4 GHz, ¿qué trío de canales no se solapa?',
    options: ['1, 2 y 3', '1, 6 y 11', '5, 6 y 7', '2, 7 y 13'],
    answer: 1,
    explanation: 'Cada canal ocupa unos 22 MHz: 1, 6 y 11 quedan separados y no se interfieren.',
  },
  {
    id: 't-5ghz',
    area: 'teleco',
    prompt: 'Comparado con 2,4 GHz, el Wi-Fi de 5 GHz generalmente…',
    options: ['Llega más lejos', 'Es más rápido pero atraviesa peor las paredes', 'No sirve en celulares', 'Usa cables'],
    answer: 1,
    explanation: 'A mayor frecuencia hay más ancho de banda, pero la señal se atenúa más con obstáculos.',
  },
  // B213 · fibra óptica y láser
  {
    id: 't-tir',
    area: 'teleco',
    prompt: '¿Por qué la luz no se escapa de una fibra óptica?',
    options: ['Porque la fibra es un espejo', 'Por reflexión total interna', 'Porque la luz es lenta', 'Por el color de la cubierta'],
    answer: 1,
    explanation: 'El núcleo tiene mayor índice de refracción que el revestimiento: la luz rebota adentro.',
  },
  {
    id: 't-bit',
    area: 'teleco',
    prompt: 'Cuando el láser envía un pulso de luz encendido, normalmente representa…',
    options: ['Un bit 1', 'Un bit 0', 'Un archivo completo', 'El fin de la llamada'],
    answer: 0,
    explanation: 'En modulación on-off la luz encendida es un 1 y la apagada es un 0.',
  },
  {
    id: 't-fiber-advantage',
    area: 'teleco',
    prompt: '¿Qué ventaja tiene la fibra óptica sobre el cable de cobre?',
    options: ['Es más pesada', 'No le afecta la interferencia electromagnética', 'Solo funciona de día', 'Consume más energía'],
    answer: 1,
    explanation: 'La luz no se ve afectada por el ruido eléctrico y pierde muy poca potencia en kilómetros.',
  },
  {
    id: 't-speed',
    area: 'teleco',
    prompt: '¿A qué velocidad aproximada viaja la luz dentro de una fibra óptica?',
    options: ['300 km/h', '20.000 km/s', '200.000 km/s', '3.000.000 km/s'],
    answer: 2,
    explanation: 'En el vidrio la luz va a unos dos tercios de su velocidad en el vacío: ~200.000 km/s.',
  },
  {
    id: 't-byte',
    area: 'teleco',
    prompt: '¿Cuántos bits forman un byte, como cada letra que enviaste con el láser?',
    options: ['4', '8', '10', '16'],
    answer: 1,
    explanation: 'Un byte son 8 bits: cada carácter ASCII del mensaje viajó en 8 pulsos.',
  },
  // B213 · telefonía IP
  {
    id: 'v-sip',
    area: 'redes',
    prompt: 'En una llamada por IP, ¿qué protocolo inicia y termina la llamada?',
    options: ['SIP', 'HTML', 'USB', 'GPS'],
    answer: 0,
    explanation: 'SIP (Session Initiation Protocol) negocia, inicia y termina las sesiones de voz.',
  },
  {
    id: 'v-ringing',
    area: 'redes',
    prompt: '¿Qué respuesta SIP indica que el teléfono de destino está sonando?',
    options: ['200 OK', '180 Ringing', '404 Not Found', 'ACK'],
    answer: 1,
    explanation: '180 Ringing avisa que el otro teléfono timbra; 200 OK llega cuando contestan.',
  },
  {
    id: 'v-jitter',
    area: 'redes',
    prompt: 'Si los paquetes de voz llegan con retrasos variables y desordenados, eso se llama…',
    options: ['Jitter', 'Firewall', 'Bluetooth', 'Píxel'],
    answer: 0,
    explanation: 'El jitter es la variación del retardo; el jitter buffer lo compensa.',
  },
  {
    id: 'v-buffer',
    area: 'redes',
    prompt: '¿Qué hace el jitter buffer de un teléfono IP?',
    options: ['Sube el volumen', 'Ordena y espera un poco los paquetes antes de reproducirlos', 'Bloquea virus', 'Carga la batería'],
    answer: 1,
    explanation: 'Retiene los paquetes unos milisegundos para reproducir la voz en orden y sin cortes.',
  },
  // B213 · datos y machine learning
  {
    id: 'd-labels',
    area: 'datos',
    prompt: 'Para entrenar un modelo que distinga gatos de perros, primero necesitamos…',
    options: ['Imágenes etiquetadas', 'Un teclado nuevo', 'Más Wi-Fi', 'Una impresora'],
    answer: 0,
    explanation: 'El aprendizaje supervisado aprende de ejemplos con su respuesta correcta (etiqueta).',
  },
  {
    id: 'd-overfit',
    area: 'datos',
    prompt: 'Si el modelo memoriza el entrenamiento y falla con imágenes nuevas, hablamos de…',
    options: ['Sobreajuste', 'Encriptación', 'Latencia', 'Compresión'],
    answer: 0,
    explanation: 'El sobreajuste (overfitting) aparece al entrenar de más: por eso se detiene a tiempo.',
  },
  {
    id: 'd-pixel',
    area: 'datos',
    prompt: '¿Qué es un píxel?',
    options: ['Un tipo de cable', 'El punto más pequeño de una imagen digital', 'Una red social', 'Un virus'],
    answer: 1,
    explanation: 'Una imagen es una grilla de píxeles, cada uno con un valor de color o intensidad.',
  },
  {
    id: 'd-edges',
    area: 'datos',
    prompt: '¿Qué resalta un filtro de detección de bordes?',
    options: ['Los colores pastel', 'Los contornos de los objetos', 'El brillo de la pantalla', 'El peso del archivo'],
    answer: 1,
    explanation: 'Detecta cambios bruscos de intensidad: justo los contornos que ayudan a reconocer formas.',
  },
  {
    id: 'd-test',
    area: 'datos',
    prompt: '¿Para qué se guarda un conjunto de prueba al entrenar un modelo?',
    options: ['Para entrenar más rápido', 'Para medir cómo funciona con datos que nunca vio', 'Para borrar datos', 'Para ahorrar batería'],
    answer: 1,
    explanation: 'El conjunto de prueba estima la precisión real con ejemplos nuevos.',
  },
  // B213 · software y ciberseguridad (Shielded)
  {
    id: 's-phishing',
    area: 'software',
    prompt: 'SMS: «Tu cuenta será bloqueada, entra YA a bancosur-seguro.xyz». ¿Qué es?',
    options: ['Un aviso oficial', 'Un intento de phishing', 'Una actualización', 'Publicidad normal'],
    answer: 1,
    explanation: 'Urgencia + enlace con dominio raro: señales clásicas de phishing.',
  },
  {
    id: 's-password',
    area: 'software',
    prompt: '¿Cuál es la contraseña más segura?',
    options: ['123456', 'Juanito2008', 'Faro-Lluvia-27-Queso!', 'password'],
    answer: 2,
    explanation: 'Larga, con palabras sin relación, números y símbolos: difícil de adivinar.',
  },
  {
    id: 's-2fa',
    area: 'software',
    prompt: '¿Qué agrega la verificación en dos pasos (2FA)?',
    options: ['Un segundo factor además de la contraseña', 'Otra cuenta de correo', 'Más espacio', 'Un fondo de pantalla'],
    answer: 0,
    explanation: 'Aunque roben tu contraseña, sin el segundo factor no pueden entrar.',
  },
  {
    id: 's-wifi',
    area: 'software',
    prompt: 'En un Wi-Fi público y abierto, lo más seguro es…',
    options: ['Hacer transferencias bancarias', 'Evitar ingresar datos sensibles', 'Compartir tu contraseña', 'Desactivar el antivirus'],
    answer: 1,
    explanation: 'En redes abiertas otros pueden espiar el tráfico: usa datos móviles o una VPN.',
  },
  {
    id: 's-updates',
    area: 'software',
    prompt: '¿Por qué conviene actualizar las apps y el sistema?',
    options: ['Cambian los colores', 'Corrigen vulnerabilidades de seguridad', 'Gastan datos', 'No sirve de nada'],
    answer: 1,
    explanation: 'Las actualizaciones cierran fallas que los atacantes podrían aprovechar.',
  },
  // B213 · hardware
  {
    id: 'h-rpi',
    area: 'hardware',
    prompt: '¿Qué placa es un computador completo con Linux, ideal para una cámara con IA?',
    options: ['Arduino Uno', 'ESP32', 'Raspberry Pi', 'Protoboard'],
    answer: 2,
    explanation: 'La Raspberry Pi tiene procesador, memoria y sistema operativo como un PC pequeño.',
  },
  {
    id: 'h-esp32',
    area: 'hardware',
    prompt: '¿Qué tiene el ESP32 que lo hace ideal para proyectos IoT?',
    options: ['Pantalla táctil', 'Wi-Fi y Bluetooth integrados', 'Disco duro', 'Teclado'],
    answer: 1,
    explanation: 'El ESP32 es un microcontrolador con Wi-Fi y Bluetooth: perfecto para sensores conectados.',
  },
  {
    id: 'h-resistor',
    area: 'hardware',
    prompt: '¿Por qué se pone una resistencia en serie con un LED?',
    options: ['Para que cambie de color', 'Para limitar la corriente y no quemarlo', 'Para conectarlo a Wi-Fi', 'Para que suene'],
    answer: 1,
    explanation: 'Sin resistencia pasa demasiada corriente y el LED (o el pin) se daña.',
  },
  {
    id: 'h-digitalwrite',
    area: 'hardware',
    prompt: 'En Arduino, ¿qué hace digitalWrite(13, HIGH)?',
    options: ['Apaga la placa', 'Pone el pin 13 en alto y enciende el LED', 'Lee un sensor', 'Borra el programa'],
    answer: 1,
    explanation: 'HIGH entrega voltaje en el pin: el LED conectado se enciende.',
  },
  {
    id: 'h-arduino',
    area: 'hardware',
    prompt: 'Un Arduino Uno es principalmente…',
    options: ['Un microcontrolador', 'Un router', 'Un disco duro', 'Un sistema operativo'],
    answer: 0,
    explanation: 'Es una placa con microcontrolador que ejecuta un programa en bucle (loop).',
  },
  // Carrera
  {
    id: 'c-pillars',
    area: 'carrera',
    prompt: '¿Cuáles son los pilares de Telemática que viste en la sala B213?',
    options: ['Química, Física y Biología', 'Datos, Software, Redes, Telecomunicaciones y Hardware', 'Solo programación', 'Marketing y ventas'],
    answer: 1,
    explanation: 'Son los cinco pilares del templo de Didactic-Tel y de la carrera.',
  },
  {
    id: 'c-telematica',
    area: 'carrera',
    prompt: 'La palabra Telemática une…',
    options: ['Telecomunicaciones e informática', 'Medicina y deportes', 'Arte y cine', 'Mecánica y motores'],
    answer: 0,
    explanation: 'Telemática = telecomunicaciones + informática para diseñar sistemas conectados.',
  },
];

export function getRouteQuestion(id: string): RouteQuestion | undefined {
  return routeQuestions.find((question) => question.id === id);
}
