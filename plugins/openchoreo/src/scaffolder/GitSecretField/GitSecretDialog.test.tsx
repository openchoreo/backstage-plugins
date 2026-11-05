import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GitSecretDialog } from './GitSecretDialog';

const renderDialog = (onSubmit = jest.fn().mockResolvedValue(undefined)) => {
  const onClose = jest.fn();
  render(<GitSecretDialog open onClose={onClose} onSubmit={onSubmit} />);
  return { onSubmit, onClose };
};

// These TextFields don't pass an explicit `id`, so MUI v4 never wires the
// `<label>`'s `htmlFor` to the input's `id` — `getByLabelText` can't
// associate them. Walk from the label text to its FormControl instead.
function getFieldByLabel(label: string): HTMLElement {
  const labelEl = Array.from(document.querySelectorAll('label')).find(el =>
    el.textContent?.includes(label),
  );
  if (!labelEl) {
    throw new Error(`Could not find a label containing: ${label}`);
  }
  const field = labelEl
    .closest('.MuiFormControl-root')
    ?.querySelector('input, textarea');
  if (!field) {
    throw new Error(`Could not find an input/textarea for label: ${label}`);
  }
  return field as HTMLElement;
}

function queryFieldByLabel(label: string): HTMLElement | null {
  const labelEl = Array.from(document.querySelectorAll('label')).find(el =>
    el.textContent?.includes(label),
  );
  return (
    (labelEl
      ?.closest('.MuiFormControl-root')
      ?.querySelector('input, textarea') as HTMLElement | null) ?? null
  );
}

describe('GitSecretDialog', () => {
  it('shows the GitHub App radio option alongside Basic Auth and SSH', () => {
    renderDialog();

    expect(screen.getByLabelText('Basic Authentication')).toBeInTheDocument();
    expect(screen.getByLabelText('SSH Authentication')).toBeInTheDocument();
    expect(screen.getByLabelText('GitHub App')).toBeInTheDocument();
  });

  it('shows App ID, Installation ID, and Private Key fields when GitHub App is selected', async () => {
    renderDialog();

    await userEvent.click(screen.getByLabelText('GitHub App'));

    expect(getFieldByLabel('App ID')).toBeInTheDocument();
    expect(getFieldByLabel('Installation ID')).toBeInTheDocument();
    expect(getFieldByLabel('Private Key')).toBeInTheDocument();
    expect(queryFieldByLabel('Password or Token')).toBeNull();
    expect(queryFieldByLabel('SSH Private Key')).toBeNull();
  });

  it('disables Create until App ID, Installation ID, and Private Key are all filled', async () => {
    renderDialog();

    await userEvent.type(getFieldByLabel('Secret Name'), 'app-secret');
    await userEvent.click(screen.getByLabelText('GitHub App'));

    const createButton = screen.getByRole('button', { name: 'Create' });
    expect(createButton).toBeDisabled();

    await userEvent.type(getFieldByLabel('App ID'), '123456');
    expect(createButton).toBeDisabled();

    await userEvent.type(getFieldByLabel('Installation ID'), '987654');
    expect(createButton).toBeDisabled();

    await userEvent.type(
      getFieldByLabel('Private Key'),
      '-----BEGIN RSA PRIVATE KEY-----',
    );
    expect(createButton).toBeEnabled();
  });

  it('submits the GitHub App credentials in the trailing onSubmit parameters', async () => {
    const { onSubmit } = renderDialog();

    await userEvent.type(getFieldByLabel('Secret Name'), 'app-secret');
    await userEvent.click(screen.getByLabelText('GitHub App'));
    await userEvent.type(getFieldByLabel('App ID'), '123456');
    await userEvent.type(getFieldByLabel('Installation ID'), '987654');
    await userEvent.type(
      getFieldByLabel('Private Key'),
      '-----BEGIN RSA PRIVATE KEY-----',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(onSubmit).toHaveBeenCalledWith(
      'app-secret',
      'github-app',
      '',
      undefined,
      undefined,
      '123456',
      '987654',
      '-----BEGIN RSA PRIVATE KEY-----',
    );
  });
});
