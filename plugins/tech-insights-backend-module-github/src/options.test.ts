import { ConfigReader } from '@backstage/config';
import {
  DEFAULT_CODE_SCANNING_TOOLS,
  readCodeScanningOptions,
} from './options';

const read = (codeScanning?: object) =>
  readCodeScanningOptions(
    new ConfigReader({ techInsights: { github: { codeScanning } } }),
  );

const tool = (id: string, toolName = id) => ({ id, toolName, label: id });

describe('readCodeScanningOptions', () => {
  it('defaults to CodeQL and Trivy at version 1', () => {
    expect(read()).toEqual({
      schemaVersion: 1,
      tools: DEFAULT_CODE_SCANNING_TOOLS,
    });
  });

  it('reads configured scanners', () => {
    const tools = [tool('semgrep', 'Semgrep OSS')];
    expect(read({ schemaVersion: 3, tools })).toEqual({
      schemaVersion: 3,
      tools,
    });
  });

  it('needs a schemaVersion when scanners are configured', () => {
    expect(() => read({ tools: [tool('semgrep')] })).toThrow('schemaVersion');
  });

  it.each([0, -1, 1.5])('rejects schemaVersion %s', schemaVersion => {
    expect(() => read({ schemaVersion, tools: [tool('semgrep')] })).toThrow(
      'positive whole number',
    );
  });

  it('rejects an empty scanner list', () => {
    expect(() => read({ schemaVersion: 1, tools: [] })).toThrow(
      'at least one scanner',
    );
  });

  it.each(['Semgrep', '1scanner', 'my-scanner', 'my scanner'])(
    'rejects id %s, which would make a bad fact name',
    id => {
      expect(() => read({ schemaVersion: 1, tools: [tool(id)] })).toThrow(
        'part of fact names',
      );
    },
  );

  it('rejects a repeated id', () => {
    expect(() =>
      read({
        schemaVersion: 1,
        tools: [tool('trivy', 'Trivy'), tool('trivy', 'Other')],
      }),
    ).toThrow("id 'trivy' is listed more than once");
  });

  it('rejects tool names that differ only by case', () => {
    expect(() =>
      read({
        schemaVersion: 1,
        tools: [tool('one', 'Trivy'), tool('two', 'trivy')],
      }),
    ).toThrow("toolName 'trivy' is listed more than once");
  });
});
