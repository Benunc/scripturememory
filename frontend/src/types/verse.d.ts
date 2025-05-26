import { ProgressStatus } from '../utils/progress';

export interface Verse {
  reference: string;
  text: string;
  status: ProgressStatus;
  lastReviewed: string;
} 