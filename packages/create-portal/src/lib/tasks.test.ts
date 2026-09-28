import fs from 'fs-extra';
import os from 'node:os';
import { join as joinPath } from 'node:path';
import {
  checkAppExistsTask,
  checkPathExistsTask,
  listFilesRecursively,
  moveAppTask,
  templatingTask,
} from './tasks';

describe('scaffolding tasks', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(joinPath(os.tmpdir(), 'create-portal-tasks-'));
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await fs.rm(root, { recursive: true, force: true });
  });

  async function writeTemplate(files: Record<string, string>) {
    const templateDir = joinPath(root, 'template');
    for (const [file, contents] of Object.entries(files)) {
      await fs.outputFile(joinPath(templateDir, file), contents);
    }
    return templateDir;
  }

  describe('templatingTask', () => {
    it('renders .hbs files without the suffix and copies everything else', async () => {
      const templateDir = await writeTemplate({
        'package.json.hbs': '{"name":"{{name}}"}',
        'nested/plain.txt': '${{ parameters.keep }}',
        '.yarn/releases/yarn.cjs': '// yarn',
      });
      const out = joinPath(root, 'out');

      await templatingTask(templateDir, out, { name: 'acme' });

      expect(await fs.readJson(joinPath(out, 'package.json'))).toEqual({
        name: 'acme',
      });
      expect(await fs.pathExists(joinPath(out, 'package.json.hbs'))).toBe(
        false,
      );
      // eslint-disable-next-line no-template-curly-in-string
      expect(await fs.readFile(joinPath(out, 'nested/plain.txt'), 'utf8')).toBe(
        '${{ parameters.keep }}',
      );
      const mode = (await fs.stat(joinPath(out, '.yarn/releases/yarn.cjs')))
        .mode;
      expect(mode & 0o111).not.toBe(0);
    });

    it('fails on a template variable missing from the context', async () => {
      const templateDir = await writeTemplate({ 'README.md.hbs': '{{nope}}' });

      await expect(
        templatingTask(templateDir, joinPath(root, 'out'), {}),
      ).rejects.toThrow(/nope/);
    });

    it('reports an unreadable template directory', async () => {
      await expect(
        templatingTask(joinPath(root, 'missing'), joinPath(root, 'out'), {}),
      ).rejects.toThrow(/Failed to read template directory/);
    });
  });

  it('checkAppExistsTask refuses an existing directory', async () => {
    await fs.mkdirp(joinPath(root, 'taken'));

    await expect(checkAppExistsTask(root, 'taken')).rejects.toThrow(
      /already exists/,
    );
    await expect(checkAppExistsTask(root, 'free')).resolves.toBeUndefined();
  });

  it('checkPathExistsTask creates a missing directory but refuses a non-empty one', async () => {
    const fresh = joinPath(root, 'fresh');
    await checkPathExistsTask(fresh);
    expect(await fs.pathExists(fresh)).toBe(true);

    await fs.outputFile(joinPath(fresh, 'file.txt'), 'x');
    await expect(checkPathExistsTask(fresh)).rejects.toThrow(/must be empty/);
  });

  it('moveAppTask moves the rendered tree into place', async () => {
    const temp = joinPath(root, 'temp');
    await fs.outputFile(joinPath(temp, 'a/b.txt'), 'b');
    const destination = joinPath(root, 'final');

    await moveAppTask(temp, destination, 'final');

    expect(await listFilesRecursively(destination)).toEqual([
      joinPath(destination, 'a/b.txt'),
    ]);
    expect(await fs.pathExists(temp)).toBe(false);
  });
});
