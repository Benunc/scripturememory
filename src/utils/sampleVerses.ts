import { ProgressStatus } from './progress';

export interface SampleVerse {
  reference: string;
  text: string;
  status: ProgressStatus;
}

export const sampleVerses: SampleVerse[] = [
  {
    reference: 'John 3:16',
    text: 'For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.',
    status: ProgressStatus.NotStarted
  },
  {
    reference: 'Philippians 4:13',
    text: 'I can do all things through him who strengthens me.',
    status: ProgressStatus.NotStarted
  },
  {
    reference: 'Jeremiah 29:11',
    text: 'For I know the plans I have for you, declares the Lord, plans for welfare and not for evil, to give you a future and a hope.',
    status: ProgressStatus.NotStarted
  },
  {
    reference: 'Romans 8:28',
    text: 'And we know that for those who love God all things work together for good, for those who are called according to his purpose.',
    status: ProgressStatus.NotStarted
  },
  {
    reference: 'Psalm 23:1-3',
    text: 'The Lord is my shepherd; I shall not want. He makes me lie down in green pastures. He leads me beside still waters. He restores my soul.',
    status: ProgressStatus.NotStarted
  },
  {
    reference: 'Proverbs 3:5-6',
    text: 'Trust in the Lord with all your heart, and do not lean on your own understanding. In all your ways acknowledge him, and he will make straight your paths.',
    status: ProgressStatus.NotStarted
  },
  {
    reference: 'Isaiah 40:31',
    text: 'But they who wait for the Lord shall renew their strength; they shall mount up with wings like eagles; they shall run and not be weary; they shall walk and not faint.',
    status: ProgressStatus.NotStarted
  },
  {
    reference: 'Matthew 11:28',
    text: 'Come to me, all who labor and are heavy laden, and I will give you rest.',
    status: ProgressStatus.NotStarted
  }
]; 