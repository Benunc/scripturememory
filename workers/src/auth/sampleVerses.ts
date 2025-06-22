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
  gpc_youth: [
    { reference: 'Deuteronomy 29:29', text: 'The secret things belong to the LORD our God, but the things that are revealed belong to us and to our children forever, that we may do all the words of this law.' },
    { reference: 'Proverbs 1:7', text: 'The fear of the LORD is the beginning of knowledge, but fools despise wisdom and instruction.' },
    { reference: 'Psalm 119:105', text: 'Your word is a lamp for my feet, a light on my path.' },
    { reference: 'Proverbs 3:5', text: 'Trust in the LORD with all your heart and lean not on your own understanding.' },
    { reference: 'Colossians 3:23', text: 'Whatever you do, work heartily, as for the Lord and not for men,' },
    { reference: 'Romans 12:1', text: 'Therefore, I urge you, brothers and sisters, in view of God\'s mercy, to offer your bodies as a living sacrifice, holy and pleasing to God—this is your true and proper worship.' }
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
