import { hooksNote } from './EnvironmentHooksNote';
import { deriveEnvironmentHooks } from '../hooks/hookModel';

const scan = { name: 'image-scan', hookRef: { name: 'trivy' } };

describe('hooksNote', () => {
  it('says nothing when no hooks are bound or all is well', () => {
    expect(hooksNote(undefined)).toBeNull();
    expect(
      hooksNote(
        deriveEnvironmentHooks(
          { preDeploy: [scan] },
          {
            preDeploy: [
              { name: 'image-scan', phase: 'Succeeded', workflowRunRef: 'r' },
            ],
          },
        ),
      ),
    ).toBeNull();
  });

  // The panel must say plainly that the release did NOT deploy when a
  // blocking hook failed, and that it DID when the failure was ignored.
  it('distinguishes a blocked release from an ignored failure', () => {
    const blocked = hooksNote(
      deriveEnvironmentHooks(
        { preDeploy: [scan] },
        {
          preDeploy: [
            {
              name: 'image-scan',
              phase: 'Failed',
              workflowRunRef: 'r',
              message: 'CVE found',
            },
          ],
        },
      ),
    );
    expect(blocked).toEqual({
      severity: 'error',
      text: 'Blocked by image-scan; the release was not deployed: CVE found',
    });

    const ignored = hooksNote(
      deriveEnvironmentHooks(
        { preDeploy: [{ ...scan, onFailure: 'Ignore' }] },
        {
          preDeploy: [
            { name: 'image-scan', phase: 'Failed', workflowRunRef: 'r' },
          ],
        },
      ),
    );
    expect(ignored?.severity).toBe('warning');
    expect(ignored?.text).toContain('so the release deployed anyway');
  });

  it('reports before-deploy hooks still running', () => {
    const note = hooksNote(
      deriveEnvironmentHooks(
        { preDeploy: [scan] },
        {
          preDeploy: [
            { name: 'image-scan', phase: 'Running', workflowRunRef: 'r' },
          ],
        },
      ),
    );
    expect(note?.severity).toBe('info');
    expect(note?.text).toContain('Waiting for before-deploy hooks: image-scan');
  });
});
