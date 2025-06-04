export type ProgressStatus = 'not_started' | 'in_progress' | 'mastered';

export interface Verse {
  reference: string;
  text: string;
  status: ProgressStatus;
  lastReviewed: string;
  translation: string;
} 