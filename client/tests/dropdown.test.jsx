import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from '../src/components/Dropdown.jsx';

const OPTIONS = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
];

describe('Select dropdown', () => {
  it('opens a listbox, selects with the mouse, and closes again', async () => {
    const onChange = vi.fn();
    render(<Select aria-label="Fruit" value="apple" options={OPTIONS} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /fruit/i }));
    const list = await screen.findByRole('listbox');
    expect(within(list).getByRole('option', { name: 'Apple' })).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(within(list).getByRole('option', { name: 'Banana' }));
    expect(onChange).toHaveBeenCalledWith({ target: { value: 'banana' } });
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  });

  it('supports keyboard navigation and Escape', async () => {
    const onChange = vi.fn();
    render(<Select aria-label="Fruit" value="apple" options={OPTIONS} onChange={onChange} />);
    const trigger = screen.getByRole('button', { name: /fruit/i });

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith({ target: { value: 'banana' } });
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  });
});
