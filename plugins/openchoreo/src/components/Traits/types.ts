import { ComponentTrait } from '../../api/OpenChoreoClientApi';

export interface TraitWithState extends ComponentTrait {
  state: 'original' | 'added' | 'modified' | 'deleted';
  originalData?: ComponentTrait;
}

export interface PendingChanges {
  added: TraitWithState[];
  modified: Array<{ original: ComponentTrait; updated: ComponentTrait }>;
  deleted: TraitWithState[];
}
