// Silly display names for new users
// These encourage users to personalize their profiles

const SILLY_NAMES = [
  'Absentminded Astronaut',
  'Adventurous Avocado',
  'Ambitious Antelope',
  'Artistic Asparagus',
  'Bouncy Broccoli',
  'Brave Buffalo',
  'Bubbly Butterfly',
  'Calm Camel',
  'Careful Carrot',
  'Cheerful Cheetah',
  'Courageous Cow',
  'Curious Cactus',
  'Dancing Dolphin',
  'Daring Dragonfly',
  'Delightful Donkey',
  'Determined Duck',
  'Dramatic Dragon',
  'Dreamy Dandelion',
  'Eager Eagle',
  'Eccentric Elephant',
  'Enthusiastic Emu',
  'Excited Echidna',
  'Fancy Flamingo',
  'Fearless Ferret',
  'Friendly Fox',
  'Frisky Frog',
  'Fuzzy Ferret',
  'Gentle Giraffe',
  'Giggly Goat',
  'Glamorous Goose',
  'Gleeful Gazelle',
  'Graceful Grasshopper',
  'Happy Hedgehog',
  'Hasty Hamster',
  'Helpful Hippo',
  'Hopeful Hedgehog',
  'Humble Hummingbird',
  'Hungry Hedgehog',
  'Imaginative Iguana',
  'Inquisitive Ibex',
  'Inspired Impala',
  'Jolly Jellyfish',
  'Joyful Jaguar',
  'Jumping Jackal',
  'Kind Kangaroo',
  'Laughing Llama',
  'Lively Lemur',
  'Lovable Llama',
  'Lucky Leopard',
  'Magical Marmot',
  'Merry Meerkat',
  'Mischievous Monkey',
  'Mysterious Moose',
  'Nimble Newt',
  'Optimistic Otter',
  'Outgoing Owl',
  'Peaceful Penguin',
  'Perky Platypus',
  'Playful Panda',
  'Proud Peacock',
  'Quiet Quokka',
  'Quick Quail',
  'Radiant Raccoon',
  'Rambunctious Rabbit',
  'Relaxed Rhino',
  'Resilient Rooster',
  'Rowdy Raccoon',
  'Sassy Squirrel',
  'Silly Sloth',
  'Sleepy Snail',
  'Sneaky Snake',
  'Sparkly Sparrow',
  'Speedy Spider',
  'Spunky Seal',
  'Squiggly Squid',
  'Stubborn Stork',
  'Sunny Swan',
  'Surprised Shark',
  'Suspicious Skunk',
  'Sweet Sloth',
  'Terrific Turtle',
  'Thoughtful Tiger',
  'Tiny Toucan',
  'Tricky Trout',
  'Trusting Turkey',
  'Twinkly Toucan',
  'Unusual Unicorn',
  'Upbeat Urchin',
  'Vibrant Vulture',
  'Vivacious Vole',
  'Wacky Walrus',
  'Wandering Wolf',
  'Warmhearted Whale',
  'Wiggly Wombat',
  'Wild Wombat',
  'Wise Woodpecker',
  'Witty Weasel',
  'Wonderful Wolf',
  'Zany Zebra',
  'Zealous Zebra',
  'Zippy Zebra'
];

/**
 * Get a random silly display name that's not already in use
 */
export async function getRandomSillyName(db: D1Database): Promise<string> {
  // Get all currently used display names from group_members table
  const usedNames = await db.prepare(
    'SELECT display_name FROM group_members WHERE display_name IS NOT NULL AND display_name != ""'
  ).all<{ display_name: string }>();
  
  const usedNamesSet = new Set(usedNames.results?.map(r => r.display_name) || []);
  
  // Filter out used names
  const availableNames = SILLY_NAMES.filter(name => !usedNamesSet.has(name));
  
  if (availableNames.length === 0) {
    // If all names are used, generate a unique one with a number
    const baseName = SILLY_NAMES[Math.floor(Math.random() * SILLY_NAMES.length)];
    let counter = 1;
    let uniqueName = `${baseName} ${counter}`;
    
    while (usedNamesSet.has(uniqueName)) {
      counter++;
      uniqueName = `${baseName} ${counter}`;
    }
    
    return uniqueName;
  }
  
  // Return a random available name
  return availableNames[Math.floor(Math.random() * availableNames.length)];
}

/**
 * Check if a display name is one of our silly names
 */
export function isSillyName(displayName: string): boolean {
  return SILLY_NAMES.includes(displayName);
}

/**
 * Get all silly names (for testing/debugging)
 */
export function getAllSillyNames(): string[] {
  return [...SILLY_NAMES];
} 