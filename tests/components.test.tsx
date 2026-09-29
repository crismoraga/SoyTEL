import { render, screen } from '@testing-library/react-native';
import { SignalSpinner, OrbitSpinner, DotsLoader } from '@/components/feedback/Loaders';
import { ProgressBar, ProgressRing } from '@/components/feedback/Progress';
import { Skeleton, SkeletonCard } from '@/components/feedback/Skeleton';
import { Illustration } from '@/components/graphics/Illustration';
import { Medallion } from '@/components/graphics/Medallion';
import { Telix } from '@/components/graphics/Telix';
import { OptionButton } from '@/components/Quiz';
import { TelButton } from '@/components/TelButton';
import { TelIcon } from '@/components/TelIcon';

describe('design system components', () => {
  it('renders icons with an accessible label', () => {
    render(<TelIcon name="wifi" accessibilityLabel="Wi-Fi" />);
    expect(screen.getByLabelText('Wi-Fi')).toBeTruthy();
  });

  it('renders buttons with their label and busy state', () => {
    render(<TelButton label="Comenzar" iconRight="arrowRight" onPress={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Comenzar' })).toBeTruthy();
    render(<TelButton label="Guardando" loading onPress={() => undefined} />);
    expect(screen.getAllByLabelText('Cargando').length).toBeGreaterThan(0);
  });

  it('renders Telix, medallions and illustrations', () => {
    render(
      <>
        <Telix expression="celebrate" pose="celebrate" />
        <Medallion glyph="trophy" tier="oro" state="progress" progress={0.4} />
        <Illustration name="campus" />
      </>,
    );
    expect(screen.getByLabelText('Telix, la mascota de SoyTEL')).toBeTruthy();
  });

  it('renders loaders, skeletons and progress', () => {
    render(
      <>
        <SignalSpinner />
        <OrbitSpinner />
        <DotsLoader />
        <Skeleton />
        <SkeletonCard />
        <ProgressBar progress={0.5} accessibilityLabel="Avance" />
        <ProgressRing progress={0.5} accessibilityLabel="Anillo" />
      </>,
    );
    expect(screen.getAllByRole('progressbar').length).toBeGreaterThanOrEqual(5);
  });

  it('renders quiz options with state', () => {
    render(<OptionButton letter="A" label="Router" state="correct" onPress={() => undefined} />);
    expect(screen.getByLabelText('A. Router')).toBeTruthy();
  });
});
