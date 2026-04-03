import { render, screen } from '@testing-library/react';
import { WorkflowDetailsRenderer } from './WorkflowDetailsRenderer';

// ---- Tests ----

describe('WorkflowDetailsRenderer', () => {
  it('renders "Not specified" for null data', () => {
    render(<WorkflowDetailsRenderer data={null} />);

    expect(screen.getByText('Not specified')).toBeInTheDocument();
  });

  it('renders "Not specified" for undefined data', () => {
    render(<WorkflowDetailsRenderer data={undefined} />);

    expect(screen.getByText('Not specified')).toBeInTheDocument();
  });

  it('renders "Not specified" for empty string', () => {
    render(<WorkflowDetailsRenderer data="" />);

    expect(screen.getByText('Not specified')).toBeInTheDocument();
  });

  it('renders string value as text', () => {
    render(<WorkflowDetailsRenderer data="hello world" />);

    expect(screen.getByText('hello world')).toBeInTheDocument();
  });

  it('renders number value as text', () => {
    render(<WorkflowDetailsRenderer data={42} />);

    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders boolean value as text', () => {
    render(<WorkflowDetailsRenderer data />);

    expect(screen.getByText('true')).toBeInTheDocument();
  });

  it('renders URL as a link', () => {
    render(<WorkflowDetailsRenderer data="https://example.com" />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders path values as code', () => {
    render(<WorkflowDetailsRenderer data="/usr/local/bin" />);

    expect(screen.getByText('/usr/local/bin')).toBeInTheDocument();
    expect(screen.getByText('/usr/local/bin').tagName).toBe('CODE');
  });

  it('renders "Empty list" for empty array', () => {
    render(<WorkflowDetailsRenderer data={[]} />);

    expect(screen.getByText('Empty list')).toBeInTheDocument();
  });

  it('renders primitive array inline', () => {
    render(<WorkflowDetailsRenderer data={['a', 'b', 'c']} />);

    expect(screen.getByText('[ "a", "b", "c" ]')).toBeInTheDocument();
  });

  it('renders "Empty object" for empty object', () => {
    render(<WorkflowDetailsRenderer data={{}} />);

    expect(screen.getByText('Empty object')).toBeInTheDocument();
  });

  it('renders object keys in title case', () => {
    render(<WorkflowDetailsRenderer data={{ myProperty: 'value' }} />);

    expect(screen.getByText('My Property:')).toBeInTheDocument();
    expect(screen.getByText('value')).toBeInTheDocument();
  });

  it('renders name/value array as compact table', () => {
    const data = [
      { name: 'FOO', value: 'bar' },
      { name: 'BAZ', value: 'qux' },
    ];

    render(<WorkflowDetailsRenderer data={data} />);

    expect(screen.getByText('FOO')).toBeInTheDocument();
    expect(screen.getByText('bar')).toBeInTheDocument();
    expect(screen.getByText('BAZ')).toBeInTheDocument();
    expect(screen.getByText('qux')).toBeInTheDocument();
  });

  it('renders nested objects with section titles at top level', () => {
    render(
      <WorkflowDetailsRenderer
        data={{
          buildConfig: {
            image: 'node:18',
          },
        }}
      />,
    );

    expect(screen.getByText('Build Config')).toBeInTheDocument();
    expect(screen.getByText('node:18')).toBeInTheDocument();
  });
});
