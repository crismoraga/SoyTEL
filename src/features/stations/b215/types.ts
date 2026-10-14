import type { ComponentType } from 'react';
import type { DeviceKind } from '@/components/graphics/DeviceArt';
import type { IconName } from '@/graphics/icons';

// Una ronda del circuito de la sala B215: un juego corto y muy claro que enseña cómo funciona un equipo
// o una idea de redes (router, switch, firewall, DNS, Wi-Fi…). El circuito elige algunas rondas al azar,
// explica cada una antes de jugarla, lleva el tiempo y suma el puntaje.
export interface RoundProps {
  // Semilla de esta partida: define el tablero concreto (cada jugador tiene la suya).
  seed: number;
  // Dificultad: 0 fácil, 1 normal, 2 desafío. En la ruta en vivo es 1.
  level: number;
  // Ritmo elegido (1 = normal; mayor = más lento). El circuito ya lo aplica al tiempo de la ronda.
  pace: number;
  // Pasa a true cuando se acaba el tiempo de la ronda: la ronda debe llamar a onDone de inmediato con
  // lo logrado hasta ahí.
  timeUp: boolean;
  // Se llama una sola vez, al terminar (por completar, por error o por tiempo).
  onDone: (result: RoundResult) => void;
}

export interface RoundResult {
  // 0 a 1: qué tan bien le fue.
  score: number;
  // 0 a 1: aciertos sobre intentos.
  accuracy: number;
  // Resumen corto para el resultado ("4 de 5 paquetes bien entregados").
  detail: string;
}

// Qué lado de la carrera muestra la ronda: el circuito mezcla redes, hardware/telecomunicaciones y
// software para que se vea que Telemática es todo eso.
export type B215Track = 'redes' | 'hardware' | 'telecom' | 'software';

export interface B215Round {
  id: string;
  // Lado de la carrera (por defecto, redes).
  track?: B215Track;
  // Nombre de la ronda ("Ruta del paquete").
  title: string;
  // Equipo o idea que enseña ("Switch", "Router", "Firewall", "DNS", "Wi-Fi", "Cableado").
  device: string;
  icon: IconName;
  // Dibujo del equipo para la tarjeta que explica la ronda.
  art: DeviceKind;
  // Qué hay que hacer, en una frase.
  goal: string;
  // Cómo funciona, en dos frases cortas (se muestran antes de jugar, con un dibujo).
  explain: [string, string];
  // La idea que queda (se muestra al terminar la ronda).
  learned: string;
  // Duración en ritmo normal, en segundos (entre 25 y 45).
  seconds: number;
  Component: ComponentType<RoundProps>;
}
