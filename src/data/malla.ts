import type { PillarId } from '@/route/types';

// Malla 2026 de Ingeniería Civil Telemática (USM), transcrita de la imagen oficial publicada en usm.cl.
// Las descripciones son orientativas, para que se entienda de qué trata cada ramo.

export type MallaArea = 'comunicacion' | 'sociales' | 'basicas' | 'ingenieria' | 'especialidad' | 'electivos' | 'sello';

export interface MallaAreaInfo {
  label: string;
  short: string;
  color: string;
  tint: string;
  ink: string;
}

// Colores de la malla oficial.
export const mallaAreas: Record<MallaArea, MallaAreaInfo> = {
  comunicacion: { label: 'Comunicación y Humanidades', short: 'Comunicación', color: '#E9B92F', tint: '#FBF1D3', ink: '#6B5216' },
  sociales: { label: 'Ciencias Sociales y Económicas', short: 'Sociales', color: '#4FAF6E', tint: '#E1F3E7', ink: '#1F5E35' },
  basicas: { label: 'Ciencias Básicas', short: 'Básicas', color: '#D9534F', tint: '#FBE4E3', ink: '#8A2522' },
  ingenieria: { label: 'Ciencias de la Ingeniería', short: 'Ingeniería', color: '#EE8B3A', tint: '#FDEBDC', ink: '#83400B' },
  especialidad: { label: 'Especialidad', short: 'Especialidad', color: '#2F86C8', tint: '#DFEEF9', ink: '#164A72' },
  electivos: { label: 'Electivos', short: 'Electivos', color: '#8E5CC9', tint: '#EEE5F8', ink: '#4D2A78' },
  sello: { label: 'Competencias Transversales Sello', short: 'Sello USM', color: '#E2739F', tint: '#FBE5EE', ink: '#7D2549' },
};

export const mallaAreaOrder: MallaArea[] = ['especialidad', 'ingenieria', 'basicas', 'sello', 'comunicacion', 'sociales', 'electivos'];

export interface Semester {
  number: number;
  roman: string;
  year: number;
}

export const semesters: Semester[] = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'].map((roman, index) => ({
  number: index + 1,
  roman,
  year: Math.floor(index / 2) + 1,
}));

export interface Cycle {
  id: string;
  label: string;
  until: number;
  summary: string;
}

// Los ciclos se acumulan: cada uno parte en el primer semestre.
export const cycles: Cycle[] = [
  { id: 'basico', label: 'Ciclo básico', until: 2, summary: 'Matemáticas, física y programación para todas las ingenierías.' },
  { id: 'bachillerato', label: 'Bachillerato', until: 4, summary: 'Primeros ramos de redes y electrónica digital.' },
  { id: 'licenciatura', label: 'Licenciatura', until: 8, summary: 'El núcleo de la especialidad: redes, software, comunicaciones y datos.' },
  { id: 'titulo', label: 'Título profesional', until: 10, summary: 'Electivos de especialización y la memoria de título.' },
];

export function cycleEnding(semester: number): Cycle | undefined {
  return cycles.find((cycle) => cycle.until === semester);
}

export interface Course {
  id: string;
  name: string;
  semester: number;
  area: MallaArea;
  pillar?: PillarId;
  kind?: 'practica' | 'memoria' | 'electivo';
  description: string;
}

const C = (semester: number, area: MallaArea, name: string, description: string, extra: Partial<Course> = {}): Course => ({
  id: '',
  name,
  semester,
  area,
  description,
  ...extra,
});

export const courses: Course[] = [
  // I
  C(1, 'comunicacion', 'Comunicación Efectiva en Español / Inglés I', 'Comienza el eje de comunicación: según tu diagnóstico trabajas la expresión oral y escrita en español o partes la secuencia de inglés, clave para leer documentación técnica.'),
  C(1, 'sello', 'Educación Física I', 'Actividad física y deporte como parte de la formación integral USM: talleres a elección durante los primeros semestres.'),
  C(1, 'sello', 'Proyecto Inicial', 'Desde el primer semestre trabajas en equipo en un desafío de ingeniería real: idear, prototipar y presentar una solución.'),
  C(1, 'basicas', 'Introducción a la Física', 'Magnitudes, vectores y movimiento: las herramientas para describir fenómenos físicos que después usarás en electricidad, ondas y señales.'),
  C(1, 'basicas', 'Introducción al Cálculo', 'Funciones, límites y continuidad: el lenguaje matemático con que se modelan señales y sistemas.'),
  C(1, 'basicas', 'Álgebra y Geometría', 'Números complejos, polinomios, vectores y geometría analítica. Los complejos vuelven una y otra vez al analizar señales y circuitos.'),
  // II
  C(2, 'comunicacion', 'Comunicación Efectiva / Inglés II', 'Sigues el eje de comunicación: textos más complejos, presentaciones orales y avance en inglés.'),
  C(2, 'sello', 'Educación Física II', 'Segundo taller deportivo: hábitos de vida activa y trabajo en equipo.'),
  C(2, 'sello', 'Introducción a la Programación', 'Aprendes a programar desde cero: variables, condiciones, ciclos y funciones para resolver problemas con código.', { pillar: 'software' }),
  C(2, 'basicas', 'Física General Mecánica', 'Leyes de Newton, energía, momentum y rotación, con experiencias de laboratorio.'),
  C(2, 'basicas', 'Cálculo en una Variable', 'Derivadas e integrales: tasas de cambio, optimización y áreas. Aparecen en todo, desde filtros hasta algoritmos.'),
  C(2, 'basicas', 'Álgebra Lineal', 'Matrices, sistemas de ecuaciones y espacios vectoriales: la base de la computación gráfica, el análisis de datos y las comunicaciones.'),
  // III
  C(3, 'comunicacion', 'Análisis Crítico de Texto', 'Lees, analizas y argumentas: cómo evaluar fuentes y escribir con rigor.'),
  C(3, 'especialidad', 'Redes de Computadores', 'Tu primer ramo de la especialidad: cómo funciona Internet por dentro. Modelo de capas, Ethernet, IP, TCP/UDP, DNS y la web.', { pillar: 'redes' }),
  C(3, 'especialidad', 'Seminario de Programación', 'Programación con proyectos: estructuras de datos, buenas prácticas, trabajo en equipo y control de versiones.', { pillar: 'software' }),
  C(3, 'basicas', 'Electricidad y Magnetismo', 'Campos eléctricos y magnéticos, circuitos y ondas electromagnéticas: la física detrás de los cables, las antenas y la fibra.'),
  C(3, 'basicas', 'Cálculo en Varias Variables', 'Funciones de varias variables, derivadas parciales e integrales múltiples.'),
  C(3, 'basicas', 'Ecuaciones Diferenciales Elementales', 'Modelas sistemas que cambian en el tiempo, como circuitos y filtros, incluida la transformada de Laplace.'),
  // IV
  C(4, 'comunicacion', 'Comunicación Efectiva / Inglés III', 'Inglés para la vida académica y profesional: lectura técnica, escritura y conversación.'),
  C(4, 'especialidad', 'Electrónica Digital', 'Lógica binaria, compuertas y circuitos secuenciales: cómo se arma un computador a partir de bits.', { pillar: 'hardware' }),
  C(4, 'especialidad', 'Algorítmica y Complejidad', 'Diseñas algoritmos eficientes y mides su costo: ordenamiento, búsqueda, grafos y complejidad.', { pillar: 'software' }),
  C(4, 'especialidad', 'Laboratorio de Redes de Computadores', 'Manos a la obra con routers y switches: direccionamiento IP, VLAN, enrutamiento y captura de tráfico, como en la sala B215.', { pillar: 'redes' }),
  C(4, 'especialidad', 'Laboratorio de Electrónica Digital', 'Armas y pruebas circuitos digitales reales en protoboard y dispositivos programables.', { pillar: 'hardware' }),
  C(4, 'basicas', 'Calor y Ondas', 'Termodinámica, oscilaciones y ondas: la base física de cómo se propagan las señales.'),
  // V
  C(5, 'sello', 'Práctica en Acción Comunitaria', 'Aplicas lo aprendido en un proyecto con impacto social junto a una comunidad u organización.'),
  C(5, 'sociales', 'Administración y Sostenibilidad Organizacional', 'Cómo funcionan las organizaciones: gestión, estrategia y sostenibilidad.'),
  C(5, 'especialidad', 'Administración de Redes', 'Operas una red como en una empresa: servicios (DNS, DHCP, correo, web), monitoreo, respaldos y automatización.', { pillar: 'redes' }),
  C(5, 'especialidad', 'Sistemas Digitales y Estructura de Computadores', 'Por dentro de un computador: procesador, memoria, buses y programación de bajo nivel en microcontroladores.', { pillar: 'hardware' }),
  C(5, 'ingenieria', 'Bases de Datos', 'Diseñas y consultas bases de datos con SQL: modelo relacional, normalización y transacciones.', { pillar: 'datos' }),
  C(5, 'especialidad', 'Fundamentos de Transmisión de Señales', 'Señales en el tiempo y en la frecuencia (Fourier), espectro, ruido y medios de transmisión: cobre, radio y fibra óptica.', { pillar: 'teleco' }),
  // VI
  C(6, 'comunicacion', 'Comunicación Efectiva / Inglés IV', 'Cierre de la secuencia de inglés general: comunicación fluida en contextos profesionales.'),
  C(6, 'sociales', 'Ingeniería Económica', 'Evalúas proyectos: valor del dinero en el tiempo, indicadores como VAN y TIR, y costos de una solución tecnológica.'),
  C(6, 'ingenieria', 'Análisis y Diseño de Software', 'Antes de programar: requisitos, modelado, patrones de diseño y arquitectura de software.', { pillar: 'software' }),
  C(6, 'especialidad', 'Sistemas Operativos para la Infraestructura Telemática', 'Procesos, memoria, archivos y virtualización: lo que corre bajo servidores, nubes y contenedores.', { pillar: 'software' }),
  C(6, 'ingenieria', 'Estadística Computacional', 'Probabilidad y estadística con computador: simulación, inferencia y análisis de datos reales.', { pillar: 'datos' }),
  C(6, 'ingenieria', 'Principios de Comunicaciones', 'Modulación analógica y digital, ancho de banda, ruido y capacidad de canal: cómo viaja la información.', { pillar: 'teleco' }),
  C(6, 'sello', 'Práctica I', 'Primera práctica de dos meses en una empresa u organización, al terminar el tercer año.', { kind: 'practica' }),
  // VII
  C(7, 'comunicacion', 'Inglés Disciplinar', 'Inglés de la especialidad: leer estándares y artículos técnicos, presentar y redactar informes.'),
  C(7, 'especialidad', 'Disponibilidad y Rendimiento de Sistemas TIC', 'Mides y mejoras sistemas reales: alta disponibilidad, tolerancia a fallas, colas y pruebas de carga.', { pillar: 'redes' }),
  C(7, 'especialidad', 'Ingeniería de Software', 'Desarrollo profesional en equipo: metodologías ágiles, pruebas automáticas, integración continua y gestión de proyectos.', { pillar: 'software' }),
  C(7, 'especialidad', 'Laboratorio de Comunicaciones', 'Trabajas con señales reales: osciloscopio, analizador de espectro y radio definida por software.', { pillar: 'teleco' }),
  C(7, 'ingenieria', 'Optimización', 'Modelos para tomar la mejor decisión: programación lineal y entera aplicada a redes, rutas y recursos.', { pillar: 'datos' }),
  C(7, 'ingenieria', 'Ciencia de Datos', 'Limpieza, visualización y aprendizaje automático para sacar conclusiones de los datos.', { pillar: 'datos' }),
  // VIII
  C(8, 'electivos', 'Electivo', 'Un ramo a elección de otras áreas de la universidad.', { kind: 'electivo' }),
  C(8, 'sello', 'Pensamiento de Diseño en Ingeniería', 'Design thinking: entender a las personas, idear y prototipar soluciones centradas en el usuario.'),
  C(8, 'especialidad', 'Ingeniería en Ciberseguridad', 'Criptografía, seguridad de redes, análisis de vulnerabilidades y respuesta a incidentes (como el proyecto Shielded).', { pillar: 'software' }),
  C(8, 'especialidad', 'Planificación de Infraestructura Telemática', 'Diseñas la infraestructura de una organización completa: capacidad, topología, costos y crecimiento.', { pillar: 'redes' }),
  C(8, 'especialidad', 'Aplicaciones Web y Móviles', 'Construyes apps web y móviles conectadas a servicios en la nube, como esta misma app.', { pillar: 'software' }),
  C(8, 'especialidad', 'Procesamiento Digital de Imágenes', 'Filtros, segmentación y reconocimiento de imágenes: la base de la visión por computador (como el juego de Datos de la ruta).', { pillar: 'datos' }),
  C(8, 'sello', 'Práctica II', 'Segunda práctica de dos meses, ahora con tareas propias de ingeniería.', { kind: 'practica' }),
  // IX
  C(9, 'electivos', 'Electivo', 'Otro ramo a elección para ampliar tu formación.', { kind: 'electivo' }),
  C(9, 'sello', 'Gestión de la Innovación', 'Cómo convertir ideas tecnológicas en productos y servicios que la gente usa.'),
  C(9, 'especialidad', 'Electivo Disciplinar', 'Profundizas en una línea de la especialidad: inteligencia artificial, desarrollo de aplicaciones, ciberseguridad, redes inalámbricas, redes de sensores, redes ópticas o tecnologías cuánticas.', { kind: 'electivo' }),
  C(9, 'especialidad', 'Electivo Disciplinar', 'Segundo electivo de especialización: eliges otra línea o profundizas la misma.', { kind: 'electivo' }),
  C(9, 'especialidad', 'Electivo Disciplinar', 'Tercer electivo de especialización del semestre.', { kind: 'electivo' }),
  C(9, 'especialidad', 'Taller de Memoria I', 'Comienzas tu trabajo de título: defines el problema, investigas lo que existe y planificas tu solución.', { kind: 'memoria' }),
  // X
  C(10, 'especialidad', 'Electivo Disciplinar', 'Cuarto electivo de especialización.', { kind: 'electivo' }),
  C(10, 'sello', 'Gestión del Emprendimiento', 'Modelos de negocio, financiamiento y cómo lanzar un emprendimiento tecnológico.'),
  C(10, 'especialidad', 'Electivo Disciplinar', 'Quinto electivo de especialización.', { kind: 'electivo' }),
  C(10, 'especialidad', 'Electivo Disciplinar', 'Sexto electivo de especialización.', { kind: 'electivo' }),
  C(10, 'especialidad', 'Taller de Memoria II', 'Desarrollas y defiendes tu memoria: la solución completa a un problema real de ingeniería.', { kind: 'memoria' }),
].map((course, index) => ({ ...course, id: `s${course.semester}-${index + 1}` }));

export function coursesBySemester(semester: number): Course[] {
  return courses.filter((course) => course.semester === semester);
}

// Ramos de especialidad e ingeniería por pilar de Telemática (para mostrar que se ve de todo).
export function pillarCoverage(): Record<PillarId, number> {
  const coverage: Record<PillarId, number> = { datos: 0, software: 0, redes: 0, teleco: 0, hardware: 0 };
  courses.forEach((course) => {
    if (course.pillar) coverage[course.pillar] += 1;
  });
  return coverage;
}

export const MALLA_SPECIALIZATIONS = ['Inteligencia artificial', 'Desarrollo de aplicaciones', 'Ciberseguridad', 'Redes inalámbricas', 'Redes de sensores', 'Redes ópticas', 'Tecnologías cuánticas'];

export const MALLA_IMAGE_URL = 'https://usm.cl/wp-content/uploads/2026/08/INGENIERIA-CIVIL-TELEMATICA_2026.webp';
