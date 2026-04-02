import type { FileVar } from '@openchoreo/backstage-plugin-common';
import {
  mergeFileVarsWithStatus,
  getBaseFileVarsForContainer,
  formatFileVarValue,
  getFileVarContentPreview,
} from './fileVarUtils';

describe('mergeFileVarsWithStatus', () => {
  it('returns all as inherited when no overrides', () => {
    const base: FileVar[] = [
      { key: 'config.yaml', mountPath: '/etc/app', value: 'port: 8080' },
    ];
    const result = mergeFileVarsWithStatus(base, []);

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('inherited');
    expect(result[0].fileVar).toBe(base[0]);
  });

  it('marks overridden files with baseValue and actualIndex', () => {
    const base: FileVar[] = [
      { key: 'config.yaml', mountPath: '/etc/app', value: 'port: 8080' },
    ];
    const override: FileVar[] = [
      { key: 'config.yaml', mountPath: '/etc/app', value: 'port: 3000' },
    ];
    const result = mergeFileVarsWithStatus(base, override);

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('overridden');
    expect(result[0].fileVar.value).toBe('port: 3000');
    expect(result[0].baseValue?.value).toBe('port: 8080');
    expect(result[0].actualIndex).toBe(0);
  });

  it('marks new files in override', () => {
    const result = mergeFileVarsWithStatus(
      [],
      [{ key: 'new.txt', mountPath: '/tmp', value: 'data' }],
    );

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('new');
    expect(result[0].actualIndex).toBe(0);
  });

  it('handles mixed statuses', () => {
    const base: FileVar[] = [
      { key: 'keep.txt', mountPath: '/a', value: 'keep' },
      { key: 'change.txt', mountPath: '/b', value: 'old' },
    ];
    const override: FileVar[] = [
      { key: 'change.txt', mountPath: '/b', value: 'new' },
      { key: 'add.txt', mountPath: '/c', value: 'added' },
    ];
    const result = mergeFileVarsWithStatus(base, override);

    expect(result).toHaveLength(3);
    expect(result[0].status).toBe('inherited');
    expect(result[1].status).toBe('overridden');
    expect(result[2].status).toBe('new');
  });

  it('returns empty for both empty', () => {
    expect(mergeFileVarsWithStatus([], [])).toEqual([]);
  });
});

describe('getBaseFileVarsForContainer', () => {
  it('returns files from workload container', () => {
    const workload = {
      container: { files: [{ key: 'f.txt', mountPath: '/x', value: 'y' }] },
    } as any;
    expect(getBaseFileVarsForContainer(workload)).toEqual([
      { key: 'f.txt', mountPath: '/x', value: 'y' },
    ]);
  });

  it('returns empty array for null workload', () => {
    expect(getBaseFileVarsForContainer(null)).toEqual([]);
  });

  it('returns empty array when container has no files', () => {
    expect(getBaseFileVarsForContainer({ container: {} } as any)).toEqual([]);
  });
});

describe('formatFileVarValue', () => {
  it('formats secret references', () => {
    const f: FileVar = {
      key: 'cert.pem',
      mountPath: '/certs',
      valueFrom: { secretKeyRef: { name: 'tls-certs', key: 'cert' } },
    };
    expect(formatFileVarValue(f)).toBe('Secret: tls-certs/cert');
  });

  it('shows content preview for plain values', () => {
    const f: FileVar = {
      key: 'config.yaml',
      mountPath: '/etc',
      value: 'line1\nline2\nline3',
    };
    expect(formatFileVarValue(f)).toBe('line1...');
  });

  it('returns empty string for empty value', () => {
    expect(formatFileVarValue({ key: 'f', mountPath: '/x', value: '' })).toBe(
      '',
    );
  });

  it('returns empty string for undefined value', () => {
    expect(formatFileVarValue({ key: 'f', mountPath: '/x' })).toBe('');
  });
});

describe('getFileVarContentPreview', () => {
  it('returns full content if within maxLines', () => {
    expect(getFileVarContentPreview('one line')).toBe('one line');
    expect(getFileVarContentPreview('line1\nline2', 2)).toBe('line1\nline2');
  });

  it('truncates and adds ellipsis when exceeding maxLines', () => {
    expect(getFileVarContentPreview('a\nb\nc\nd', 2)).toBe('a\nb...');
  });

  it('handles single maxLine', () => {
    expect(getFileVarContentPreview('a\nb\nc', 1)).toBe('a...');
  });
});
