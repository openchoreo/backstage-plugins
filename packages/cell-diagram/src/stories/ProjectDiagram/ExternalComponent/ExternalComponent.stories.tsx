import type { Meta, StoryObj } from '@storybook/react';
import { CellDiagram } from '../../../Diagram';
import { Container, PreviewContainer } from '../../utils';
import { model1 } from './data/model1';
import { model2 } from './data/model2';
import { model3 } from './data/model3';

const meta: Meta<typeof CellDiagram> = {
  title: 'Project Diagram/External Component',
  component: CellDiagram,
  decorators: [
    (Story, context) => {
      const StoryContainer = context.args.previewMode
        ? PreviewContainer
        : Container;
      return (
        <StoryContainer>
          <Story />
        </StoryContainer>
      );
    },
  ],
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const WithExternalComponents: Story = {
  args: {
    project: model1,
  },
};

export const WithExternalComponentAndOrgLevelConnections: Story = {
  args: {
    project: model2,
  },
};

export const WithExternalComponentAndOrgLevelConnections2: Story = {
  args: {
    project: model3,
  },
};
