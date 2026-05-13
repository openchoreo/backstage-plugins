import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActionInfo } from '../../hooks';
import { ConditionsEditor } from './ConditionsEditor';
import { WizardCondition } from './types';

// ---- Fixtures ----

const actionCatalog: ActionInfo[] = [
  {
    name: 'releasebindings:create',
    conditions: [
      { key: 'resource.environment', description: 'Environment name' },
      { key: 'resource.project', description: 'Project name' },
    ],
  },
  {
    name: 'releasebindings:delete',
    conditions: [
      { key: 'resource.environment', description: 'Environment name' },
    ],
  },
  {
    name: 'releasebindings:view',
    conditions: [],
  },
] as unknown as ActionInfo[];

const roleActions = [
  'releasebindings:create',
  'releasebindings:delete',
  'releasebindings:view',
];

function makeCondition(
  overrides: Partial<WizardCondition> = {},
): WizardCondition {
  return {
    id: 'c1',
    actions: [],
    expression: '',
    confirmed: false,
    ...overrides,
  };
}

// ---- Tests ----

describe('ConditionsEditor', () => {
  describe('empty state', () => {
    it('renders the empty header with Add condition button', () => {
      render(
        <ConditionsEditor
          conditions={[]}
          roleActions={roleActions}
          actionCatalog={actionCatalog}
          onChange={jest.fn()}
        />,
      );

      expect(screen.getByText('Conditions')).toBeInTheDocument();
      expect(
        screen.getByText(/None — all granted actions apply unconditionally/),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /add condition/i }),
      ).toBeInTheDocument();
    });

    it('renders nothing when empty and hideHeader is true', () => {
      const { container } = render(
        <ConditionsEditor
          conditions={[]}
          roleActions={roleActions}
          actionCatalog={actionCatalog}
          onChange={jest.fn()}
          hideHeader
        />,
      );

      expect(container).toBeEmptyDOMElement();
    });

    it('disables Add condition when no role actions are provided', () => {
      render(
        <ConditionsEditor
          conditions={[]}
          roleActions={[]}
          actionCatalog={actionCatalog}
          onChange={jest.fn()}
        />,
      );

      expect(
        screen.getByRole('button', { name: /add condition/i }),
      ).toBeDisabled();
    });

    it('disables Add condition when no role actions support conditions', () => {
      render(
        <ConditionsEditor
          conditions={[]}
          roleActions={['releasebindings:view']}
          actionCatalog={actionCatalog}
          onChange={jest.fn()}
        />,
      );

      expect(
        screen.getByRole('button', { name: /add condition/i }),
      ).toBeDisabled();
    });

    it('calls onChange with a new condition when Add is clicked', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(
        <ConditionsEditor
          conditions={[]}
          roleActions={roleActions}
          actionCatalog={actionCatalog}
          onChange={onChange}
        />,
      );

      await user.click(screen.getByRole('button', { name: /add condition/i }));

      expect(onChange).toHaveBeenCalledTimes(1);
      const next = onChange.mock.calls[0][0];
      expect(next).toHaveLength(1);
      expect(next[0]).toMatchObject({
        actions: [],
        expression: '',
        confirmed: false,
      });
      expect(next[0].id).toBeDefined();
    });
  });

  describe('populated state', () => {
    it('shows the count in the header', () => {
      render(
        <ConditionsEditor
          conditions={[
            makeCondition({
              id: 'c1',
              actions: ['releasebindings:create'],
              expression: 'resource.environment == "prod"',
              confirmed: true,
            }),
            makeCondition({
              id: 'c2',
              actions: ['releasebindings:delete'],
              expression: 'resource.environment == "dev"',
              confirmed: true,
            }),
          ]}
          roleActions={roleActions}
          actionCatalog={actionCatalog}
          onChange={jest.fn()}
        />,
      );

      expect(screen.getByText('Conditions (2)')).toBeInTheDocument();
      expect(
        screen.getByText(/Multiple conditions are combined with OR/),
      ).toBeInTheDocument();
    });

    it('renders one row per confirmed condition', () => {
      render(
        <ConditionsEditor
          conditions={[
            makeCondition({
              id: 'c1',
              actions: ['releasebindings:create'],
              expression: 'resource.env == "prod"',
              confirmed: true,
            }),
          ]}
          roleActions={roleActions}
          actionCatalog={actionCatalog}
          onChange={jest.fn()}
        />,
      );

      expect(screen.getByText('#1')).toBeInTheDocument();
      expect(screen.getByText(/releasebindings:create/)).toBeInTheDocument();
    });

    it('calls onChange without the deleted row when Delete is clicked', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(
        <ConditionsEditor
          conditions={[
            makeCondition({
              id: 'c1',
              actions: ['releasebindings:create'],
              expression: 'resource.env == "prod"',
              confirmed: true,
            }),
          ]}
          roleActions={roleActions}
          actionCatalog={actionCatalog}
          onChange={onChange}
        />,
      );

      await user.click(screen.getByTitle('Delete'));

      expect(onChange).toHaveBeenCalledWith([]);
    });

    it('hides the OR hint when there is only one condition', () => {
      render(
        <ConditionsEditor
          conditions={[
            makeCondition({
              id: 'c1',
              actions: ['releasebindings:create'],
              expression: 'true',
              confirmed: true,
            }),
          ]}
          roleActions={roleActions}
          actionCatalog={actionCatalog}
          onChange={jest.fn()}
        />,
      );

      expect(
        screen.queryByText(/Multiple conditions are combined with OR/),
      ).not.toBeInTheDocument();
    });
  });

  describe('editing state', () => {
    it('shows the editing card for an unconfirmed condition', () => {
      render(
        <ConditionsEditor
          conditions={[
            makeCondition({
              id: 'c1',
              actions: [],
              expression: '',
              confirmed: false,
            }),
          ]}
          roleActions={roleActions}
          actionCatalog={actionCatalog}
          onChange={jest.fn()}
        />,
      );

      expect(screen.getByText('Condition #1')).toBeInTheDocument();
      expect(screen.getByText('Actions *')).toBeInTheDocument();
      expect(screen.getByText('Expression *')).toBeInTheDocument();
      expect(
        screen.getByText('Select at least one action'),
      ).toBeInTheDocument();
    });

    it('shows the expression-required error while editing an empty expression', () => {
      render(
        <ConditionsEditor
          conditions={[
            makeCondition({
              id: 'c1',
              actions: ['releasebindings:create'],
              expression: '',
              confirmed: false,
            }),
          ]}
          roleActions={roleActions}
          actionCatalog={actionCatalog}
          onChange={jest.fn()}
        />,
      );

      expect(screen.getByText('Expression is required')).toBeInTheDocument();
    });

    it('disables Confirm while errors exist', () => {
      render(
        <ConditionsEditor
          conditions={[
            makeCondition({
              id: 'c1',
              actions: [],
              expression: '',
              confirmed: false,
            }),
          ]}
          roleActions={roleActions}
          actionCatalog={actionCatalog}
          onChange={jest.fn()}
        />,
      );

      expect(screen.getByTitle('Confirm')).toBeDisabled();
    });

    it('enables Confirm when actions and expression are set', () => {
      render(
        <ConditionsEditor
          conditions={[
            makeCondition({
              id: 'c1',
              actions: ['releasebindings:create'],
              expression: 'resource.environment == "prod"',
              confirmed: false,
            }),
          ]}
          roleActions={roleActions}
          actionCatalog={actionCatalog}
          onChange={jest.fn()}
        />,
      );

      expect(screen.getByTitle('Confirm')).toBeEnabled();
    });

    it('marks the row as confirmed when Confirm is clicked', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(
        <ConditionsEditor
          conditions={[
            makeCondition({
              id: 'c1',
              actions: ['releasebindings:create'],
              expression: 'resource.environment == "prod"',
              confirmed: false,
            }),
          ]}
          roleActions={roleActions}
          actionCatalog={actionCatalog}
          onChange={onChange}
        />,
      );

      await user.click(screen.getByTitle('Confirm'));

      expect(onChange).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'c1', confirmed: true }),
      ]);
    });

    it('drops a brand new empty row when Cancel is clicked', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(
        <ConditionsEditor
          conditions={[
            makeCondition({
              id: 'c1',
              actions: [],
              expression: '',
              confirmed: false,
            }),
          ]}
          roleActions={roleActions}
          actionCatalog={actionCatalog}
          onChange={onChange}
        />,
      );

      await user.click(screen.getByTitle('Cancel'));

      expect(onChange).toHaveBeenCalledWith([]);
    });

    it('shows attribute chips for the intersection of selected actions', () => {
      render(
        <ConditionsEditor
          conditions={[
            makeCondition({
              id: 'c1',
              actions: ['releasebindings:create', 'releasebindings:delete'],
              expression: 'x',
              confirmed: false,
            }),
          ]}
          roleActions={roleActions}
          actionCatalog={actionCatalog}
          onChange={jest.fn()}
        />,
      );

      expect(
        screen.getByText('Available attributes (click to insert)'),
      ).toBeInTheDocument();
      // intersection: only resource.environment is supported by both
      expect(screen.getByText('resource.environment')).toBeInTheDocument();
      expect(screen.queryByText('resource.project')).not.toBeInTheDocument();
    });

    it('shows a no-shared-attributes error when actions have no overlap', () => {
      const noOverlapCatalog: ActionInfo[] = [
        {
          name: 'a:1',
          conditions: [{ key: 'attr.a', description: 'a' }],
        },
        {
          name: 'a:2',
          conditions: [{ key: 'attr.b', description: 'b' }],
        },
      ] as unknown as ActionInfo[];

      render(
        <ConditionsEditor
          conditions={[
            makeCondition({
              id: 'c1',
              actions: ['a:1', 'a:2'],
              expression: '',
              confirmed: false,
            }),
          ]}
          roleActions={['a:1', 'a:2']}
          actionCatalog={noOverlapCatalog}
          onChange={jest.fn()}
        />,
      );

      expect(
        screen.getByText('No attributes available for the selected action(s)'),
      ).toBeInTheDocument();
    });
  });

  describe('onEditingChange', () => {
    it('fires true when an unconfirmed row exists', () => {
      const onEditingChange = jest.fn();

      render(
        <ConditionsEditor
          conditions={[
            makeCondition({
              id: 'c1',
              actions: ['releasebindings:create'],
              expression: 'x',
              confirmed: false,
            }),
          ]}
          roleActions={roleActions}
          actionCatalog={actionCatalog}
          onChange={jest.fn()}
          onEditingChange={onEditingChange}
        />,
      );

      expect(onEditingChange).toHaveBeenLastCalledWith(true);
    });

    it('fires false when all rows are confirmed', () => {
      const onEditingChange = jest.fn();

      render(
        <ConditionsEditor
          conditions={[
            makeCondition({
              id: 'c1',
              actions: ['releasebindings:create'],
              expression: 'x',
              confirmed: true,
            }),
          ]}
          roleActions={roleActions}
          actionCatalog={actionCatalog}
          onChange={jest.fn()}
          onEditingChange={onEditingChange}
        />,
      );

      expect(onEditingChange).toHaveBeenLastCalledWith(false);
    });
  });

  describe('expand / edit', () => {
    it('switches a row to expanded view when the row is clicked', async () => {
      const user = userEvent.setup();

      render(
        <ConditionsEditor
          conditions={[
            makeCondition({
              id: 'c1',
              actions: ['releasebindings:create'],
              expression: 'resource.environment == "prod"',
              confirmed: true,
            }),
          ]}
          roleActions={roleActions}
          actionCatalog={actionCatalog}
          onChange={jest.fn()}
        />,
      );

      // Expand by clicking the toggle (role=button with aria-expanded)
      const collapsedToggle = screen.getByRole('button', { expanded: false });
      await user.click(collapsedToggle);

      expect(screen.getByText('Condition #1')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
      expect(screen.getByText('Expression')).toBeInTheDocument();
    });

    it('puts a confirmed row into edit mode when Edit is clicked', async () => {
      const user = userEvent.setup();

      render(
        <ConditionsEditor
          conditions={[
            makeCondition({
              id: 'c1',
              actions: ['releasebindings:create'],
              expression: 'resource.environment == "prod"',
              confirmed: true,
            }),
          ]}
          roleActions={roleActions}
          actionCatalog={actionCatalog}
          onChange={jest.fn()}
        />,
      );

      await user.click(screen.getByTitle('Edit'));

      expect(screen.getByTitle('Confirm')).toBeInTheDocument();
      expect(screen.getByTitle('Cancel')).toBeInTheDocument();
    });
  });
});
