import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/test-utils';
import {
  GradientPageHeader,
  GradientPageHeaderTitle,
  GradientPageHeaderKindChip,
} from './GradientPageHeader';

describe('GradientPageHeader', () => {
  it('renders the title row and the breadcrumb slot', async () => {
    await renderInTestApp(
      <GradientPageHeader
        titleRow={
          <>
            <GradientPageHeaderTitle>Cost Insights</GradientPageHeaderTitle>
            <GradientPageHeaderKindChip label="project" />
          </>
        }
      >
        <div data-testid="breadcrumb" />
      </GradientPageHeader>,
    );

    expect(screen.getByText('Cost Insights')).toBeInTheDocument();
    expect(screen.getByText('project')).toBeInTheDocument();
    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
  });

  it('renders without a breadcrumb slot', async () => {
    await renderInTestApp(
      <GradientPageHeader
        titleRow={<GradientPageHeaderTitle>Title</GradientPageHeaderTitle>}
      />,
    );
    expect(screen.getByText('Title')).toBeInTheDocument();
  });
});
