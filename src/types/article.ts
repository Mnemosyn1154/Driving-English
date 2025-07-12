
export interface Sentence {
  id: string;
  text: string;
  translation: string;
  audioUrl?: string;
  order: number;
}

export interface Article {
  id: string;
  title: string;
  sentences: Sentence[];
}
