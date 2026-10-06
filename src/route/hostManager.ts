import { HostController } from './host';
import { listHostSummaries, loadHost, removeHost, type HostSummary } from './storage';
import type { RouteSettings } from './types';

// Rutas conducidas desde este dispositivo (modo stand). Pueden convivir varias, una por grupo.
class HostManager {
  private controllers = new Map<string, HostController>();
  // Aperturas en curso: dos pantallas que abren la misma ruta a la vez comparten un solo controlador.
  private opening = new Map<string, Promise<HostController | null>>();

  async create(settings: Partial<RouteSettings> = {}): Promise<HostController> {
    const controller = await HostController.create(settings);
    this.controllers.set(controller.code, controller);
    await controller.start();
    return controller;
  }

  open(code: string, force = false): Promise<HostController | null> {
    const existing = this.controllers.get(code);
    if (existing && !force) return Promise.resolve(existing);
    const pending = this.opening.get(code);
    if (pending) return force ? pending.then(() => this.open(code, true)) : pending;
    const opened = this.load(code, force).finally(() => this.opening.delete(code));
    this.opening.set(code, opened);
    return opened;
  }

  private async load(code: string, force: boolean): Promise<HostController | null> {
    const existing = this.controllers.get(code);
    if (existing) {
      // Tomar el control: la pantalla anterior se detiene (ya guardó lo confirmado) y se parte de lo guardado.
      existing.stop(false);
      this.controllers.delete(code);
    }
    const record = await loadHost(code);
    if (!record) return null;
    const controller = HostController.fromRecord(record);
    this.controllers.set(code, controller);
    await controller.start(force);
    return controller;
  }

  get(code: string): HostController | undefined {
    return this.controllers.get(code);
  }

  async list(): Promise<HostSummary[]> {
    return listHostSummaries();
  }

  async close(code: string): Promise<void> {
    this.controllers.get(code)?.stop(false);
    this.controllers.delete(code);
    await removeHost(code);
  }

  // Detiene todas las rutas sin guardarlas (antes de borrar los datos del dispositivo).
  stopAll(): void {
    this.controllers.forEach((controller) => controller.stop(false));
    this.controllers.clear();
  }

  nudgeAll(): void {
    this.controllers.forEach((controller) => controller.nudge());
  }
}

export const hostManager = new HostManager();
