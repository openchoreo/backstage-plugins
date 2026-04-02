import { render, screen, fireEvent } from '@testing-library/react';
import { VerticalTabNav } from './VerticalTabNav';
import { TabItemData } from './VerticalTabItem';

const tabs: TabItemData[] = [
  { id: 'general', label: 'General' },
  { id: 'networking', label: 'Networking' },
  { id: 'scaling', label: 'Scaling' },
];

describe('VerticalTabNav', () => {
  it('renders tab labels', () => {
    render(
      <VerticalTabNav tabs={tabs} activeTabId="general" onChange={jest.fn()}>
        <div>Panel content</div>
      </VerticalTabNav>,
    );

    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Networking')).toBeInTheDocument();
    expect(screen.getByText('Scaling')).toBeInTheDocument();
  });

  it('calls onChange with tab id when a tab is clicked', () => {
    const onChange = jest.fn();
    render(
      <VerticalTabNav tabs={tabs} activeTabId="general" onChange={onChange}>
        <div>Panel content</div>
      </VerticalTabNav>,
    );

    fireEvent.click(screen.getByText('Networking'));
    expect(onChange).toHaveBeenCalledWith('networking');
  });

  it('marks active tab with aria-selected', () => {
    render(
      <VerticalTabNav tabs={tabs} activeTabId="networking" onChange={jest.fn()}>
        <div>Panel content</div>
      </VerticalTabNav>,
    );

    const allTabs = screen.getAllByRole('tab');
    const networkingTab = allTabs.find(t =>
      t.textContent?.includes('Networking'),
    );
    const generalTab = allTabs.find(t => t.textContent?.includes('General'));

    expect(networkingTab).toHaveAttribute('aria-selected', 'true');
    expect(generalTab).toHaveAttribute('aria-selected', 'false');
  });

  it('renders children in the content area', () => {
    render(
      <VerticalTabNav tabs={tabs} activeTabId="general" onChange={jest.fn()}>
        <div>Panel content here</div>
      </VerticalTabNav>,
    );

    expect(screen.getByText('Panel content here')).toBeInTheDocument();
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
  });
});
