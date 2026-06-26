import styled from '@emotion/styled';
import { action } from '@storybook/addon-actions';
import { MoreVertMenuItem } from '../types';

export const Container = styled.div`
  height: calc(100vh - 40px);
  width: calc(100vw - 40px);
  height: 100svh;
  width: 100svw;
`;

export const PreviewContainer = styled.div`
  height: 250px;
  width: 250px;
`;

export const componentMenu: MoreVertMenuItem[] = [
  {
    label: 'Go to source',
    callback: (...args: [string, string?]) =>
      action('Go to source menu item clicked')(...args),
  },
  {
    label: 'Observe',
    callback: (...args: [string, string?]) =>
      action('Observe menu item clicked')(...args),
  },
];

export const handleComponentDoubleClick = (componentId: string) => {
  action('component double clicked')(componentId);
};
