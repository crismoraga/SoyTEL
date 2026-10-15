import { act, render, screen } from '@testing-library/react-native';
import { AchievementCelebration, shouldDefer } from '@/features/celebration/AchievementCelebration';
import { achievements } from '@/data/achievements';
import { emitAppEvent } from '@/lib/events';

const mockPath = { current: '/home' };
jest.mock('expo-router', () => ({ usePathname: () => mockPath.current, router: { push: jest.fn() } }));

describe('celebración de logros', () => {
  it('muestra la medalla y el mensaje al desbloquear un logro', () => {
    render(<AchievementCelebration />);
    act(() => emitAppEvent({ type: 'achievement', id: achievements[0].id }));
    expect(screen.getByText('¡Conseguiste un nuevo logro!')).toBeTruthy();
    expect(screen.getByText(achievements[0].title)).toBeTruthy();
  });

  it('muestra varios uno tras otro y resume los que pasan de tres', () => {
    render(<AchievementCelebration />);
    act(() => achievements.slice(0, 5).forEach((item) => emitAppEvent({ type: 'achievement', id: item.id })));
    expect(screen.getByText('1 de 3')).toBeTruthy();
    act(() => screen.getByText('Siguiente logro').props.onPress?.());
  });

  it('no interrumpe un juego de la ruta en vivo', () => {
    expect(shouldDefer('/ruta/juego')).toBe(true);
    expect(shouldDefer('/home')).toBe(false);
  });
});
