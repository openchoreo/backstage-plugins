import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClusterRole, UserTypeConfig } from '../../hooks';
import { SubjectStep } from './SubjectStep';
import { WizardState } from './types';

// ---- Mocks ----

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  NotificationBanner: ({ message }: any) => (
    <div data-testid="notification-banner">{message}</div>
  ),
}));

// ---- Fixtures ----

const userTypes: UserTypeConfig[] = [
  {
    type: 'user',
    displayName: 'User',
    authMechanisms: [
      {
        entitlement: { claim: 'sub', displayName: 'Subject' },
      },
    ],
  },
  {
    type: 'service_account',
    displayName: 'Service Account',
    authMechanisms: [
      {
        entitlement: { claim: 'service.id', displayName: 'Service ID' },
      },
    ],
  },
] as unknown as UserTypeConfig[];

const availableRoles: ClusterRole[] = [];

function baseState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    subjectType: 'user',
    entitlementValue: '',
    roleMappings: [],
    effect: 'allow',
    name: '',
    ...overrides,
  };
}

function renderStep(
  state: WizardState,
  onChange: (updates: Partial<WizardState>) => void,
) {
  return render(
    <SubjectStep
      state={state}
      onChange={onChange}
      availableRoles={availableRoles}
      userTypes={userTypes}
    />,
  );
}

// ---- Tests ----

describe('SubjectStep', () => {
  it('renders the subject type cards from userTypes', () => {
    renderStep(baseState(), jest.fn());

    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('Service Account')).toBeInTheDocument();
  });

  it('describes the user type', () => {
    renderStep(baseState(), jest.fn());

    expect(
      screen.getByText(/Human users authenticated via identity provider/i),
    ).toBeInTheDocument();
  });

  it('describes the service_account type', () => {
    renderStep(baseState(), jest.fn());

    expect(
      screen.getByText(/Service accounts, bots, and automated processes/i),
    ).toBeInTheDocument();
  });

  it('shows the selected user type identifier label', () => {
    renderStep(baseState({ subjectType: 'user' }), jest.fn());

    expect(screen.getByText('User Identifier')).toBeInTheDocument();
  });

  it('shows the JWT claim hint for the selected user type', () => {
    renderStep(baseState({ subjectType: 'user' }), jest.fn());

    expect(screen.getByText(/JWT claim:/i)).toBeInTheDocument();
    expect(screen.getByText('sub')).toBeInTheDocument();
  });

  it('calls onChange when picking a different subject type', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    renderStep(baseState(), onChange);

    await user.click(screen.getByText('Service Account'));

    expect(onChange).toHaveBeenCalledWith({ subjectType: 'service_account' });
  });

  it('calls onChange when the identifier input changes', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    renderStep(baseState(), onChange);

    await user.type(screen.getByRole('textbox'), 'a');

    expect(onChange).toHaveBeenLastCalledWith({ entitlementValue: 'a' });
  });

  it('renders the summary banner when both type and value are set', () => {
    renderStep(
      baseState({ subjectType: 'user', entitlementValue: 'platform-team' }),
      jest.fn(),
    );

    expect(screen.getByTestId('notification-banner')).toBeInTheDocument();
    expect(screen.getByText(/platform-team/)).toBeInTheDocument();
  });

  it('hides the summary banner when entitlement value is empty', () => {
    renderStep(baseState({ subjectType: 'user' }), jest.fn());

    expect(screen.queryByTestId('notification-banner')).not.toBeInTheDocument();
  });
});
