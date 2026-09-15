import { getAuditColumnStyle } from './columns';
import { AUDIT_COLUMNS } from './types';

describe('getAuditColumnStyle', () => {
  it('lets every declared column shrink rather than overflow', () => {
    // Fifteen columns at a fixed width would overflow the virtualizer's own
    // scroll container and fight it; they narrow and truncate instead.
    for (const column of AUDIT_COLUMNS) {
      const { flex } = getAuditColumnStyle(column.id);
      if (column.id === 'action') continue;
      expect(String(flex)).toMatch(/^0 1 \d+px$/);
    }
  });

  it('gives the action column the remainder', () => {
    expect(getAuditColumnStyle('action')).toMatchObject({ flex: '1 1 0%' });
  });

  it('sizes the actions column to the copy button alone', () => {
    expect(getAuditColumnStyle('actions')).toMatchObject({ flex: '0 0 30px' });
  });

  it('returns a stable reference per column, so cells are not re-rendered', () => {
    expect(getAuditColumnStyle('time')).toBe(getAuditColumnStyle('time'));
  });

  it('keeps every column able to shrink below its content', () => {
    for (const column of AUDIT_COLUMNS) {
      expect(getAuditColumnStyle(column.id)).toMatchObject({ minWidth: 0 });
    }
  });
});
