// Test di render di Separator — verifica ruolo ARIA, orientamento e classi.
// Esercita anche l'helper cn() (merge classi) attraverso un componente reale.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Separator } from './separator';

describe('Separator', () => {
  it('di default e\' decorativo (role none) e orizzontale', () => {
    const { container } = render(<Separator />);
    const el = container.firstChild;
    expect(el).toHaveAttribute('role', 'none');
    expect(el).toHaveAttribute('aria-orientation', 'horizontal');
    expect(el).toHaveClass('h-px', 'w-full');
  });

  it('con decorative={false} espone il ruolo separator', () => {
    render(<Separator decorative={false} />);
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('in verticale cambia orientamento e classi', () => {
    const { container } = render(<Separator orientation="vertical" />);
    const el = container.firstChild;
    expect(el).toHaveAttribute('aria-orientation', 'vertical');
    expect(el).toHaveClass('h-full', 'w-px');
  });

  it('unisce le classi extra passate via className', () => {
    const { container } = render(<Separator className="my-4" />);
    expect(container.firstChild).toHaveClass('my-4', 'h-px');
  });
});
