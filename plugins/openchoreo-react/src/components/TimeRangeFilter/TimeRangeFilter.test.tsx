import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimeRangeFilter, TimeRangeFilterProps } from './TimeRangeFilter';
import { TIME_RANGE_OPTIONS } from './types';

function renderFilter(overrides: Partial<TimeRangeFilterProps> = {}) {
  const onChange = jest.fn();
  const props: TimeRangeFilterProps = {
    value: '1h',
    onChange,
    ...overrides,
  };
  return {
    ...render(<TimeRangeFilter {...props} />),
    onChange,
  };
}

const getTrigger = () =>
  screen.getByRole('textbox', { name: 'Time Range' }) as HTMLInputElement;

describe('TimeRangeFilter', () => {
  describe('trigger label', () => {
    it('shows the matching preset label for a known value', () => {
      renderFilter({ value: '1h' });
      expect(getTrigger().value).toBe('Last 1 hour');
    });

    it('shows formatted custom range when value=custom and times provided', () => {
      renderFilter({
        value: 'custom',
        customStartTime: '2025-06-14T08:00:00.000Z',
        customEndTime: '2025-06-15T11:30:00.000Z',
      });
      // Formatting depends on locale, but the dash separator is fixed.
      expect(getTrigger().value).toContain(' – ');
    });

    it('shows "Custom range" fallback when value=custom but times missing', () => {
      renderFilter({ value: 'custom' });
      expect(getTrigger().value).toBe('Custom range');
    });

    it('shows empty label for an unknown preset', () => {
      renderFilter({ value: 'totally-unknown' });
      expect(getTrigger().value).toBe('');
    });
  });

  describe('opening the dropdown', () => {
    it('opens the popover and lists every preset', async () => {
      const user = userEvent.setup();
      renderFilter();

      await user.click(getTrigger());

      for (const option of TIME_RANGE_OPTIONS) {
        expect(screen.getByText(option.label)).toBeInTheDocument();
      }
    });

    it('hides the custom option when allowCustomRange=false', async () => {
      const user = userEvent.setup();
      renderFilter({ allowCustomRange: false });

      await user.click(getTrigger());

      expect(screen.queryByText('Custom range')).not.toBeInTheDocument();
      expect(screen.getByText('Last 1 hour')).toBeInTheDocument();
    });

    it('does not open when disabled', async () => {
      const user = userEvent.setup();
      renderFilter({ disabled: true });

      await user.click(getTrigger());

      // The dropdown items would not appear.
      expect(screen.queryByText('Last 10 minutes')).not.toBeInTheDocument();
    });
  });

  describe('selecting a preset', () => {
    it('calls onChange with the preset and clears custom times', async () => {
      const user = userEvent.setup();
      const { onChange } = renderFilter({ value: '1h' });

      await user.click(getTrigger());
      await user.click(screen.getByText('Last 24 hours'));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({
        timeRange: '24h',
        customStartTime: undefined,
        customEndTime: undefined,
      });
    });

    it('opens the custom panel when "Custom range" is clicked without firing onChange', async () => {
      const user = userEvent.setup();
      const { onChange } = renderFilter({ value: '1h' });

      await user.click(getTrigger());
      await user.click(screen.getByText('Custom range'));

      expect(onChange).not.toHaveBeenCalled();
      expect(
        screen.getByText('Select date and time range'),
      ).toBeInTheDocument();
    });

    it('shows the custom panel immediately when opened with value=custom', async () => {
      const user = userEvent.setup();
      renderFilter({
        value: 'custom',
        customStartTime: '2025-06-14T08:00:00.000Z',
        customEndTime: '2025-06-15T11:30:00.000Z',
      });

      await user.click(getTrigger());

      expect(
        screen.getByText('Select date and time range'),
      ).toBeInTheDocument();
    });
  });

  describe('custom range panel', () => {
    it('applies a valid range and reports ISO start/end via onChange', async () => {
      const user = userEvent.setup();
      const { onChange } = renderFilter({
        value: 'custom',
        customStartTime: '2025-06-14T08:00:00.000Z',
        customEndTime: '2025-06-15T11:30:00.000Z',
      });

      await user.click(getTrigger());
      await user.click(screen.getByRole('button', { name: 'Apply' }));

      expect(onChange).toHaveBeenCalledTimes(1);
      const arg = onChange.mock.calls[0][0];
      expect(arg.timeRange).toBe('custom');
      expect(arg.customStartTime).toBe(
        new Date('2025-06-14T08:00:00.000Z').toISOString(),
      );
      expect(arg.customEndTime).toBe(
        new Date('2025-06-15T11:30:00.000Z').toISOString(),
      );
    });

    it('cancels without calling onChange', async () => {
      const user = userEvent.setup();
      const { onChange } = renderFilter({
        value: 'custom',
        customStartTime: '2025-06-14T08:00:00.000Z',
        customEndTime: '2025-06-15T11:30:00.000Z',
      });

      await user.click(getTrigger());
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onChange).not.toHaveBeenCalled();
    });

    it('shows error when end time is not after start time', async () => {
      const user = userEvent.setup();
      // Provide start == end so end is not strictly after start.
      const sameMoment = '2025-06-15T08:00:00.000Z';
      const { onChange } = renderFilter({
        value: 'custom',
        customStartTime: sameMoment,
        customEndTime: sameMoment,
      });

      await user.click(getTrigger());
      await user.click(screen.getByRole('button', { name: 'Apply' }));

      expect(
        screen.getByText('End time must be after start time.'),
      ).toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('re-syncs draft times when customStartTime/customEndTime props change', async () => {
      const user = userEvent.setup();
      const { rerender, onChange } = renderFilter({
        value: 'custom',
        customStartTime: '2025-06-14T08:00:00.000Z',
        customEndTime: '2025-06-15T11:30:00.000Z',
      });

      rerender(
        <TimeRangeFilter
          value="custom"
          customStartTime="2025-07-01T08:00:00.000Z"
          customEndTime="2025-07-02T08:00:00.000Z"
          onChange={onChange}
        />,
      );

      await user.click(getTrigger());
      await user.click(screen.getByRole('button', { name: 'Apply' }));

      const arg = onChange.mock.calls[0][0];
      expect(arg.customStartTime).toBe(
        new Date('2025-07-01T08:00:00.000Z').toISOString(),
      );
      expect(arg.customEndTime).toBe(
        new Date('2025-07-02T08:00:00.000Z').toISOString(),
      );
    });
  });
});
