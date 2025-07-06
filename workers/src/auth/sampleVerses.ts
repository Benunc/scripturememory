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
  philippians_1_chapter_challenge: [
    { reference: 'Philippians 1', text: 'Paul and Timothy, servants of Christ Jesus, To all the saints in Christ Jesus who are at Philippi, with the overseers and deacons: Grace to you and peace from God our Father and the Lord Jesus Christ. I thank my God in all my remembrance of you, always in every prayer of mine for you all making my prayer with joy, because of your partnership in the gospel from the first day until now. And I am sure of this, that he who began a good work in you will bring it to completion at the day of Jesus Christ. It is right for me to feel this way about you all, because I hold you in my heart, for you are all partakers with me of grace, both in my imprisonment and in the defense and confirmation of the gospel. For God is my witness, how I yearn for you all with the affection of Christ Jesus. And it is my prayer that your love may abound more and more, with knowledge and all discernment, so that you may approve what is excellent, and so be pure and blameless for the day of Christ, filled with the fruit of righteousness that comes through Jesus Christ, to the glory and praise of God. I want you to know, brothers, that what has happened to me has really served to advance the gospel, so that it has become known throughout the whole imperial guard and to all the rest that my imprisonment is for Christ. And most of the brothers, having become confident in the Lord by my imprisonment, are much more bold to speak the word without fear. Some indeed preach Christ from envy and rivalry, but others from good will. The latter do it out of love, knowing that I am put here for the defense of the gospel. The former proclaim Christ out of selfish ambition, not sincerely but thinking to afflict me in my imprisonment. What then? Only that in every way, whether in pretense or in truth, Christ is proclaimed, and in that I rejoice. Yes, and I will rejoice, for I know that through your prayers and the help of the Spirit of Jesus Christ this will turn out for my deliverance, as it is my eager expectation and hope that I will not be at all ashamed, but that with full courage now as always Christ will be honored in my body, whether by life or by death. For to me to live is Christ, and to die is gain. If I am to live in the flesh, that means fruitful labor for me. Yet which I shall choose I cannot tell. I am hard pressed between the two. My desire is to depart and be with Christ, for that is far better. But to remain in the flesh is more necessary on your account. Convinced of this, I know that I will remain and continue with you all, for your progress and joy in the faith, so that in me you may have ample cause to glory in Christ Jesus, because of my coming to you again. Only let your manner of life be worthy of the gospel of Christ, so that whether I come and see you or am absent, I may hear of you that you are standing firm in one spirit, with one mind striving side by side for the faith of the gospel, and not frightened in anything by your opponents. This is a clear sign to them of their destruction, but of your salvation, and that from God. For it has been granted to you that for the sake of Christ you should not only believe in him but also suffer for his sake, engaged in the same conflict that you saw I had and now hear that I still have.' }
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
