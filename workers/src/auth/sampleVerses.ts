export const verseSets = {
  default: [
    { reference: 'John 3:16', text: 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.' },
    { reference: 'Philippians 4:13', text: 'I can do all things through Christ who strengthens me.' },
    { reference: 'Jeremiah 29:11', text: 'For I know the plans I have for you," declares the LORD, "plans to prosper you and not to harm you, plans to give you hope and a future.' }
  ],
  childrens_verses: [
    { reference: 'Genesis 1:1', text: 'In the beginning God created the heavens and the earth.' },
    { reference: 'Psalm 119:105', text: 'Your word is a lamp for my feet, a light on my path.' },
    { reference: 'Proverbs 3:5', text: 'Trust in the LORD with all your heart and lean not on your own understanding.' }
  ],
  // You can add more sets here in the future
};

// This helper function gets the correct verse set, defaulting if the key is invalid
export function getVerseSet(key: string | undefined | null) {
  // A bit of type-checking to make sure the key is valid
  if (key && Object.prototype.hasOwnProperty.call(verseSets, key)) {
    return verseSets[key as keyof typeof verseSets];
  }
  return verseSets.default;
}
