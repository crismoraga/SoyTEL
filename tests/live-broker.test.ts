import WebSocket from 'ws';
import { brokerUrls } from '@/realtime/config';
import { HostController, probeBroker } from '@/route/host';
import { MqttRouteLink } from '@/route/link';
import { MemberController } from '@/route/member';

// Prueba contra los brokers públicos reales. Se ejecuta solo con LIVE_MQTT=1 (necesita Internet).
// Es una comprobación mínima (una ruta con código al azar, un participante, una acción): no es una
// campaña de fallos ni usa datos de nadie.
const live = process.env.LIVE_MQTT === '1' ? describe : describe.skip;

async function waitFor(check: () => boolean, timeoutMs: number, what: string) {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > timeoutMs) throw new Error(`timeout: ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return Date.now() - started;
}

live('route over public MQTT brokers', () => {
  beforeAll(() => {
    (globalThis as { WebSocket?: unknown }).WebSocket = WebSocket;
  });

  it.each(brokerUrls.map((url, index) => [url, index]))('connects, subscribes and echoes through %s', async (url) => {
    expect(await probeBroker(String(url), 12_000)).toBe(true);
  }, 30_000);

  it.each(brokerUrls.map((url, index) => [url, index]))('joins and syncs through %s', async (url, index) => {
    const urls = [String(url)];
    const host = HostController.createWithLink(new MqttRouteLink(0, urls, { idPrefix: 'stt' }), { quizQuestions: 1 }, { store: null, locks: null });
    const member = new MemberController({ store: null });
    try {
      await host.start();
      await waitFor(() => host.getView().link === 'online', 15_000, 'stand en línea');
      const joinedAt = Date.now();
      await member.join({ code: host.code, alias: 'Prueba', avatar: 0, fingerprint: host.fingerprint, link: new MqttRouteLink(0, urls, { idPrefix: 'stm' }) });
      await waitFor(() => member.getView().status === 'joined' && Boolean(member.getView().me), 20_000, 'unión');
      const joinMs = Date.now() - joinedAt;
      host.dispatch({ type: 'start' });
      await waitFor(() => member.getView().snapshot?.phase === 'checkin', 10_000, 'inicio');
      const sentAt = Date.now();
      member.checkin('b215');
      const ackMs = await waitFor(() => member.getView().outbox['checkin:b215']?.state === 'accepted' || member.getView().snapshot?.phase === 'play', 10_000, 'confirmación');
      await waitFor(() => member.getView().snapshot?.phase === 'play', 10_000, 'juego');
      console.info(`[broker público ${index}: ${url}] unión ${joinMs} ms · confirmación ${ackMs} ms · acción→todos ${Date.now() - sentAt} ms`);
    } finally {
      member.reset();
      host.stop(false);
    }
  }, 90_000);
});
