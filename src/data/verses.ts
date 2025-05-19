export interface ScriptureVerse {
  id: string;
  reference: string;
  text: string;
  translation: string;
}

export const verses: ScriptureVerse[] = [
  {
    id: "1",
    reference: "John 3:16",
    text: "For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.",
    translation: "NIV"
  },
  {
    id: "2",
    reference: "Philippians 4:13",
    text: "I can do all things through Christ who strengthens me.",
    translation: "NKJV"
  },
  {
    id: "3",
    reference: "Jeremiah 29:11",
    text: "For I know the plans I have for you, declares the LORD, plans to prosper you and not to harm you, plans to give you hope and a future.",
    translation: "NIV"
  }
]; 