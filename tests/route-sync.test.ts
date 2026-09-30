import { pillarIds } from '@/route/content';
import { HostController } from '@/route/host';
import { LocalBus, LocalRouteLink } from '@/route/link';
import { MemberController } from '@/route/member';
import { getRouteQuestion } from '@/route/quizBank';

// Anfitrión y participantes reales (cifrado incluido) conectados por el bus local.
describe('route sync over the local bus', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps host and members in sync through the full route', async () => {
    const bus = new LocalBus();
    const host = HostController.createWithLink(new LocalRouteLink(bus), { quizQuestions: 3 }, { solo: true });
    await host.start();
    const ana = new MemberController();
    const beto = new MemberController();
    await ana.join({ code: host.code, alias: 'Ana', avatar: 1, link: new LocalRouteLink(bus) });
    await beto.join({ code: host.code, alias: 'Beto', avatar: 2, link: new LocalRouteLink(bus) });
    await jest.advanceTimersByTimeAsync(1500);

    expect(ana.getView().status).toBe('joined');
    expect(beto.getView().status).toBe('joined');
    expect(host.getView().snapshot.players.map((player) => player.alias).sort()).toEqual(['Ana', 'Beto']);

    host.dispatch({ type: 'start' });
    await jest.advanceTimersByTimeAsync(600);
    expect(ana.getView().snapshot?.phase).toBe('checkin');

    ana.checkin('b215');
    await jest.advanceTimersByTimeAsync(600);
    expect(ana.getView().me?.checkedIn).toBe(true);
    expect(beto.getView().snapshot?.phase).toBe('checkin');
    beto.checkin('b215');
    await jest.advanceTimersByTimeAsync(600);
    expect(beto.getView().snapshot?.phase).toBe('play');

    ana.submitScore('red-b215', 800, 0.8);
    beto.submitScore('red-b215', 650, 0.7);
    await jest.advanceTimersByTimeAsync(600);
    expect(ana.getView().snapshot?.phase).toBe('results');
    expect(ana.getView().me?.games['red-b215']).toBe(800);
    expect(ana.getView().pending).toEqual([]);

    await jest.advanceTimersByTimeAsync(15_000);
    expect(ana.getView().snapshot?.stop).toBe('b213');
    ana.checkin('b213');
    beto.checkin('b213');
    await jest.advanceTimersByTimeAsync(600);
    expect(ana.getView().snapshot?.phase).toBe('projects');

    pillarIds.forEach((game) => {
      ana.submitScore(game, 700, 0.8);
      beto.submitScore(game, 600, 0.6);
    });
    await jest.advanceTimersByTimeAsync(600);
    expect(beto.getView().snapshot?.stop).toBe('hall');
    ana.checkin('hall');
    beto.checkin('hall');
    await jest.advanceTimersByTimeAsync(600);
    expect(ana.getView().snapshot?.phase).toBe('quiz');

    for (let index = 0; index < 3; index += 1) {
      await jest.advanceTimersByTimeAsync(6000);
      const quiz = ana.getView().snapshot!.quiz!;
      expect(quiz.index).toBe(index);
      expect(quiz.step).toBe('question');
      const answer = getRouteQuestion(quiz.question.id)!.answer;
      beto.answer(index, answer);
      await jest.advanceTimersByTimeAsync(300);
      ana.answer(index, answer);
      await jest.advanceTimersByTimeAsync(600);
      const reveal = ana.getView().snapshot!.quiz!.reveal!;
      expect(reveal.correct).toBe(answer);
      expect(reveal.gains[beto.getView().me!.id].rank).toBe(1);
      await jest.advanceTimersByTimeAsync(9000);
    }

    expect(ana.getView().snapshot?.phase).toBe('podium');
    const podium = ana.getView().snapshot!.players;
    expect(podium[0].alias).toBe('Ana');
    expect(podium[0].total).toBeGreaterThan(podium[1].total);

    await ana.leave(false);
    await beto.leave(false);
    host.stop();
  }, 60_000);

  it('solo mode starts the route by itself', async () => {
    const member = new MemberController();
    member.startSolo({ alias: 'Explorador', avatar: 3 });
    await jest.advanceTimersByTimeAsync(1500);
    const view = member.getView();
    expect(view.solo).toBe(true);
    expect(view.status).toBe('joined');
    expect(view.snapshot?.phase).toBe('checkin');
    expect(view.snapshot?.stop).toBe('b215');
    await member.leave(false);
  });

  it('rejects members after the podium', async () => {
    const bus = new LocalBus();
    const host = HostController.createWithLink(new LocalRouteLink(bus), {}, { solo: true });
    await host.start();
    const first = new MemberController();
    await first.join({ code: host.code, alias: 'Ana', avatar: 1, link: new LocalRouteLink(bus) });
    await jest.advanceTimersByTimeAsync(1000);
    host.dispatch({ type: 'start' });
    host.dispatch({ type: 'finish' });
    const late = new MemberController();
    await late.join({ code: host.code, alias: 'Tarde', avatar: 2, link: new LocalRouteLink(bus) });
    await jest.advanceTimersByTimeAsync(1500);
    expect(late.getView().status).toBe('rejected');
    expect(late.getView().rejection).toBe('finished');
    await first.leave(false);
    await late.leave(false);
    host.stop();
  });
});
