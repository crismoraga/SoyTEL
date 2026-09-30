import { brokerUrls } from '@/realtime/config';
import { HostController } from '@/route/host';
import { MqttRouteLink } from '@/route/link';
import { MemberController } from '@/route/member';

// Prueba contra los brokers públicos reales. Se ejecuta solo con LIVE_MQTT=1 (necesita Internet).
const live = process.env.LIVE_MQTT === '1' ? describe : describe.skip;

async function waitFor(check: () => boolean, timeoutMs: number) {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > timeoutMs) throw new Error('timeout');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

live('route over public MQTT brokers', () => {
  it.each(brokerUrls.map((url, index) => [url, index]))('joins and syncs through %s', async (_url, index) => {
    const host = HostController.createWithLink(new MqttRouteLink(`stt${Date.now().toString(36)}`, Number(index), false), { quizQuestions: 1 }, { solo: true });
    await host.start();
    await waitFor(() => host.getView().link === 'online', 15_000);
    const member = new MemberController();
    await member.join({ code: host.code, alias: 'Prueba', avatar: 0, link: new MqttRouteLink(`stm${Date.now().toString(36)}`, Number(index), false) });
    const joinedAt = Date.now();
    await waitFor(() => member.getView().status === 'joined' && Boolean(member.getView().snapshot), 20_000);
    const joinMs = Date.now() - joinedAt;
    host.dispatch({ type: 'start' });
    await waitFor(() => member.getView().snapshot?.phase === 'checkin', 10_000);
    const sentAt = Date.now();
    member.checkin('b215');
    await waitFor(() => member.getView().snapshot?.phase === 'play', 10_000);
    const roundTripMs = Date.now() - sentAt;
    console.log(`broker ${index}: unión ${joinMs} ms, acción ida y vuelta ${roundTripMs} ms`);
    await member.leave(false);
    host.stop();
  }, 60_000);
});
