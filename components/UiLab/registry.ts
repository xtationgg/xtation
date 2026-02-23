import React from 'react';
import type { StageSize } from './Stage';

export interface UiLabPrototypeRenderProps {
  id: string;
  title: string;
  defaultStageSize: StageSize;
  assetsPath: string;
}

export interface UiLabPrototypeDefinition extends UiLabPrototypeRenderProps {
  component: React.LazyExoticComponent<React.ComponentType<UiLabPrototypeRenderProps>>;
}

export const uiLabRegistry: UiLabPrototypeDefinition[] = [
  {
    id: 'proto01',
    title: 'Proto01 Mission Composer',
    component: React.lazy(() => import('./prototypes/Proto01_MissionComposer')),
    defaultStageSize: { width: 1920, height: 1016 },
    assetsPath: '/ui-lab/proto01/',
  },
  {
    id: 'proto02',
    title: 'Proto02 Placeholder',
    component: React.lazy(() => import('./prototypes/Proto02_Placeholder')),
    defaultStageSize: { width: 1920, height: 1016 },
    assetsPath: '/ui-lab/proto02/',
  },
  {
    id: 'proto03',
    title: 'Proto03 Placeholder',
    component: React.lazy(() => import('./prototypes/Proto03_Placeholder')),
    defaultStageSize: { width: 1920, height: 1016 },
    assetsPath: '/ui-lab/proto03/',
  },
];

export default uiLabRegistry;
