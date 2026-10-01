import { HostController } from './host';
import { listHostSummaries, loadHost, removeHost, type HostSummary } from './storage';
import type { RouteSettings } from './types';

// Rutas conducidas desde este dispositivo (modo stand). Pueden convivir varias, una por grupo.
class HostManager {
  private controllers = new Map<string, HostController>();

  async create(settings: Partial<RouteSettings> = {}): Promise<HostController> {
    const controller = await HostController.create(settings);
    this.controllers.set(controller.code, controller);
    await controller.start();
    return controller;
  }

  async open(code: string, force = false): Promise<HostController | null> {
    const existing = this.controllers.get(code);
    if (existing) {
      if (force) {
        existing.stop();
        this.controllers.delete(code);
      } else {
        return existing;
      }
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
    this.controllers.get(code)?.stop();
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
