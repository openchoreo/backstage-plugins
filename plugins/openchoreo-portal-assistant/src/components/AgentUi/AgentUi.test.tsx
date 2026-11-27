import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { AgentUi } from './AgentUi';
import { AGENT_UI_CATALOG_ID } from './catalog';

const button = (id: string, label: string, userMessage: string) => [
  {
    id,
    component: 'Button',
    child: `${id}_label`,
    action: { event: { name: `pick_${id}`, userMessage } },
  },
  { id: `${id}_label`, component: 'Text', text: label },
];

// What the agent sends with a check edit question (src/agent/a2ui.py).
const question = (surfaceId = 'edit-question-1') => [
  {
    version: '1.0',
    createSurface: {
      surfaceId,
      catalogId: AGENT_UI_CATALOG_ID,
      components: [
        { id: 'root', component: 'Row', children: ['yes', 'no'] },
        ...button('yes', 'Yes, change it', 'yes'),
        ...button('no', 'No', 'no'),
      ],
    },
  },
];

describe('AgentUi', () => {
  it('shows the answer buttons the agent sent', async () => {
    render(<AgentUi messages={question()} onAction={jest.fn()} />);

    expect(
      await screen.findByRole('button', { name: 'Yes, change it' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument();
  });

  it.each([
    ['Yes, change it', 'yes'],
    ['No', 'no'],
  ])('sends "%s" as the message %s', async (label, sent) => {
    const onAction = jest.fn();
    render(<AgentUi messages={question()} onAction={onAction} />);

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: label }));
    });

    await waitFor(() =>
      expect(onAction).toHaveBeenCalledWith(
        sent,
        expect.objectContaining({ name: expect.any(String) }),
      ),
    );
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("sends a button's event name and context as the message's action", async () => {
    const onAction = jest.fn();
    const [message] = question();
    const withContext = [
      {
        ...message,
        createSurface: {
          ...message.createSurface,
          components: [
            { id: 'root', component: 'Row', children: ['two'] },
            {
              id: 'two',
              component: 'Button',
              child: 'two_label',
              action: {
                event: {
                  name: 'pick_proposal',
                  userMessage: '2',
                  context: { choice: 2 },
                },
              },
            },
            { id: 'two_label', component: 'Text', text: 'Option 2' },
          ],
        },
      },
    ];
    render(<AgentUi messages={withContext} onAction={onAction} />);

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Option 2' }));
    });

    await waitFor(() =>
      expect(onAction).toHaveBeenCalledWith('2', {
        name: 'pick_proposal',
        context: { choice: 2 },
      }),
    );
  });

  it('can not be answered when disabled', async () => {
    const onAction = jest.fn();
    render(<AgentUi messages={question()} disabled onAction={onAction} />);

    const yes = await screen.findByRole('button', { name: 'Yes, change it' });
    expect(yes).toBeDisabled();
    await act(async () => {
      fireEvent.click(yes);
    });
    expect(onAction).not.toHaveBeenCalled();
  });

  it('shows nothing for messages A2UI rejects', () => {
    // No catalogId: A2UI can't tell which components to use.
    const [message] = question();
    const broken = [
      {
        ...message,
        createSurface: { ...message.createSurface, catalogId: undefined },
      },
    ];

    const { container } = render(
      <AgentUi messages={broken} onAction={jest.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
