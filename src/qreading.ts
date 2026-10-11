// Reading Forest: generators over word lists (rhymes, opposites, plurals…) plus
// hand-written reading-comprehension passages and grammar questions.

import { F, G, one, sample, type Item, type Rng } from "./qkit.ts";

const up = (w: string) => w.toUpperCase();
/** One word from a group, plus wrong words drawn from every other group. */
function fromGroups(r: Rng, groups: string[][]) {
  const g = one(r, groups);
  const others = groups.filter((x) => x !== g).flat();
  return { g, others };
}

const RHYMES = [
  ["cat", "hat", "bat", "mat", "sat"], ["dog", "log", "frog", "fog"], ["cake", "lake", "bake", "snake"],
  ["fish", "dish", "wish"], ["sun", "run", "fun", "bun"], ["bee", "tree", "see", "knee"],
  ["night", "light", "kite", "bright"], ["play", "day", "say", "stay"], ["bed", "red", "sled", "bread"],
  ["moon", "spoon", "soon", "noon"], ["ring", "sing", "king", "wing"], ["boat", "coat", "goat", "float"],
  ["bear", "chair", "hair", "pear"], ["mouse", "house", "blouse"], ["ball", "tall", "wall", "fall"],
];
const SYNONYMS = [
  ["big", "large", "huge"], ["small", "tiny", "little"], ["happy", "glad", "cheerful"], ["sad", "unhappy", "gloomy"],
  ["fast", "quick", "speedy"], ["begin", "start"], ["shut", "close"], ["shout", "yell"], ["smart", "clever"],
  ["angry", "mad"], ["scared", "afraid"], ["tired", "sleepy"], ["pretty", "beautiful"], ["easy", "simple"],
  ["loud", "noisy"], ["laugh", "giggle"], ["gift", "present"], ["cold", "chilly"], ["wet", "damp"], ["quiet", "silent"],
];
const ANTONYMS = [
  ["hot", "cold"], ["up", "down"], ["big", "small"], ["happy", "sad"], ["fast", "slow"], ["open", "closed"],
  ["wet", "dry"], ["day", "night"], ["full", "empty"], ["loud", "quiet"], ["early", "late"],
  ["old", "young"], ["push", "pull"], ["win", "lose"], // no tall/short or hard/soft: "small" and "quiet" would be half-right ["before", "after"], ["above", "below"],
  ["float", "sink"], ["give", "take"], ["laugh", "cry"], ["asleep", "awake"],
];
const CONTRACTIONS: [string, string][] = [
  ["do not", "don't"], ["cannot", "can't"], ["is not", "isn't"], ["I am", "I'm"], ["it is", "it's"],
  ["you are", "you're"], ["we will", "we'll"], ["they have", "they've"], ["she is", "she's"], ["let us", "let's"],
  ["would not", "wouldn't"], ["I have", "I've"], ["was not", "wasn't"], ["they are", "they're"],
];
const COMPOUNDS = ["sunflower", "rainbow", "football", "cupcake", "starfish", "snowman", "butterfly", "pancake", "backpack", "toothbrush", "firefly", "bedroom", "playground", "goldfish"];
const NOT_COMPOUNDS = ["happy", "garden", "pencil", "yellow", "river", "kitten", "basket", "planet", "carrot", "window", "purple", "music"];
const PLURALS_2: [string, string, string, string][] = [
  ["box", "boxes", "boxs", "boxen"], ["dish", "dishes", "dishs", "dishies"], ["bus", "buses", "buss", "busies"],
  ["fox", "foxes", "foxs", "foxies"], ["bench", "benches", "benchs", "benchies"], ["glass", "glasses", "glasss", "glassies"],
  ["cat", "cats", "cates", "caties"], ["bird", "birds", "birdes", "birdies"], ["lunch", "lunches", "lunchs", "lunchies"],
];
const PLURALS_3: [string, string, string, string][] = [
  ["mouse", "mice", "mouses", "mices"], ["child", "children", "childs", "childrens"], ["tooth", "teeth", "tooths", "teeths"],
  ["foot", "feet", "foots", "feets"], ["goose", "geese", "gooses", "geeses"], ["man", "men", "mans", "mens"],
  ["leaf", "leaves", "leafs", "leafes"], ["wolf", "wolves", "wolfs", "wolfes"], ["knife", "knives", "knifes", "knive"],
  ["baby", "babies", "babys", "babyes"], ["puppy", "puppies", "puppys", "puppyes"], ["story", "stories", "storys", "storyes"],
  ["sheep", "sheep", "sheeps", "sheepes"], ["deer", "deer", "deers", "deeres"], ["person", "people", "persons", "peoples"],
];
const PAST: [string, string][] = [
  ["run", "ran"], ["eat", "ate"], ["go", "went"], ["see", "saw"], ["swim", "swam"], ["sing", "sang"], ["write", "wrote"],
  ["take", "took"], ["sit", "sat"], ["catch", "caught"], ["think", "thought"], ["buy", "bought"], ["fly", "flew"],
  ["sleep", "slept"], ["drink", "drank"], ["make", "made"], ["give", "gave"], ["find", "found"],
];
const SYLLABLES: [string, number][] = [
  ["cat", 1], ["kitten", 2], ["butterfly", 3], ["banana", 3], ["dog", 1], ["rabbit", 2], ["elephant", 3],
  ["caterpillar", 4], ["alligator", 4], ["apple", 2], ["tomato", 3], ["pumpkin", 2], ["sun", 1], ["umbrella", 3], ["watermelon", 4],
];
const SPELL: [number, string, string, string][] = [
  [2, "because", "becuase", "becuz"], [2, "friend", "freind", "frend"], [2, "said", "sed", "siad"], [2, "people", "peple", "poeple"],
  [2, "again", "agen", "agian"], [2, "school", "skool", "shcool"], [2, "house", "hous", "howse"], [2, "little", "littel", "litle"],
  [3, "beautiful", "beatiful", "beautifull"], [3, "different", "diffrent", "diferent"], [3, "favorite", "favrite", "favorit"],
  [3, "animal", "animle", "aminal"], [3, "together", "togather", "togehter"], [3, "answer", "anser", "answr"], [3, "believe", "beleive", "belive"],
  [4, "necessary", "neccessary", "necesary"], [4, "separate", "seperate", "separete"], [4, "receive", "recieve", "receeve"],
  [4, "library", "libary", "liberry"], [4, "February", "Febuary", "Febraury"], [4, "calendar", "calender", "calandar"], [4, "definitely", "definately", "definitly"],
];
const ANIMALS = ["ant", "bear", "cat", "deer", "eagle", "fox", "goat", "horse", "iguana", "jaguar", "koala", "lion", "mouse", "newt", "owl", "panda", "rabbit", "snake", "tiger", "wolf", "yak", "zebra"];
const SAME_LETTER = [["cat", "cow", "crab", "cub"], ["bat", "bear", "bee", "bird"], ["seal", "sheep", "skunk", "snail"], ["panda", "parrot", "pig", "puppy"], ["mole", "moose", "mouse", "mule"]];
const PREFIX: Record<string, [string, string[]]> = {
  un: ["not {}", ["happy", "kind", "safe", "tidy", "fair"]],
  re: ["{} again", ["read", "build", "fill", "tell", "write", "paint"]],
  pre: ["{} before", ["heat", "pay", "view"]],
  dis: ["not {}", ["like", "agree", "honest"]],
};
const SUFFIX: Record<string, [string, string[]]> = {
  ful: ["full of {}", ["help", "care", "joy", "hope", "color"]],
  less: ["without {}", ["fear", "care", "home", "hope", "sleep"]],
};
const ADJ = ["fluffy", "sleepy", "tiny", "happy", "orange", "silly", "brave"];
const NOUN = ["cat", "kitten", "dog", "bird", "frog", "puppy", "mouse"];
const VERB = ["naps", "jumps", "runs", "sings", "eats", "hops", "plays"];
const ADVERB = ["quickly", "slowly", "quietly", "happily", "loudly"];

export const READING: Item[] = [
  // ---------------------------------------------------------------- grade 2
  G(2, "rhymes", (r) => {
    const { g, others } = fromGroups(r, RHYMES);
    const [w, ans] = sample(r, g, 2);
    return { q: `Which word rhymes with ${up(w!)}?`, answer: ans!, wrong: others };
  }),
  G(2, "opposites", (r) => {
    const [a, b] = sample(r, one(r, ANTONYMS), 2);
    return { q: `What is the opposite of ${up(a!)}?`, answer: b!, wrong: ANTONYMS.flat().filter((x) => x !== a && x !== b) };
  }),
  G(2, "synonyms", (r) => {
    const { g, others } = fromGroups(r, SYNONYMS);
    const [w, ans] = sample(r, g, 2);
    return { q: `Which word means almost the same as ${up(w!)}?`, answer: ans!, wrong: others };
  }),
  G(2, "plurals", (r) => {
    const [w, ans, ...wrong] = one(r, PLURALS_2);
    return { q: `More than one ${up(w)} is…`, answer: ans, wrong };
  }),
  G(2, "abc-order", (r) => {
    const ws = sample(r, ANIMALS, 4);
    return { q: "Which word comes first in ABC order?", answer: [...ws].sort()[0]!, wrong: ws };
  }),
  G(2, "contractions", (r) => {
    const [long, short] = one(r, CONTRACTIONS);
    return { q: `What is the short way to write "${long}"?`, answer: short, wrong: [short.replace("'", ""), ...CONTRACTIONS.map((c) => c[1])] };
  }),
  G(2, "compound-words", (r) => ({
    q: "Which word is a compound word (two words put together)?", answer: one(r, COMPOUNDS), wrong: NOT_COMPOUNDS,
  })),
  G(2, "syllables", (r) => {
    const [w, n] = one(r, SYLLABLES);
    return { q: `How many syllables (beats) are in ${up(w)}? Clap it out!`, answer: String(n), wrong: ["1", "2", "3", "4"] };
  }),
  G(2, "spelling", (r) => {
    const [, ans, ...wrong] = one(r, SPELL.filter((s) => s[0] === 2));
    return { q: "Which word is spelled correctly?", answer: ans, wrong };
  }),
  F(2, "short-vowels", "Which word has the same middle sound as C-A-T?", "map", "mop", "mice"),
  F(2, "sight-words", "Pick the word that means 'very happy'.", "joyful", "sleepy", "damp"),
  F(2, "capitals", "Which sentence is written correctly?", "My cat is named Boabosh.", "my cat is named boabosh.", "My cat is named boabosh", "my Cat Is named Boabosh."),
  F(2, "punctuation", "Which mark goes at the end of a question?", "?", ".", "!", ","),
  F(2, "comprehension", "The kitten hid under the porch when it thundered. Why did she hide?", "She was scared", "She was hungry", "She was dirty"),
  F(2, "comprehension", "Tom filled the bowl, then called the cat. What happened FIRST?", "He filled the bowl", "He called the cat", "The cat ate"),
  F(2, "comprehension", "Mia put on her boots and took her umbrella. What was the weather like?", "Rainy", "Sunny and hot", "Windy and dry"),
  F(2, "comprehension", "Boabosh yawned, curled up in the basket and closed both eyes. What is Boabosh doing?", "Going to sleep", "Eating lunch", "Chasing a mouse"),
  F(2, "comprehension", "Sam's ice cream dripped down the cone in the hot sun. Why did it drip?", "The sun melted it", "Sam dropped it", "It was frozen"),
  F(2, "comprehension", "The bird built a nest out of twigs and grass. What did the bird use?", "Twigs and grass", "Rocks and sand", "Paper and glue"),
  F(2, "comprehension", "Ana said, 'I'm so excited for my birthday party!' How does Ana feel?", "Excited", "Sad", "Angry"),
  F(2, "rhymes", "Which word rhymes with GHOST?", "toast", "goat", "gate"),
  F(2, "rhymes", "Which word rhymes with BAT?", "hat", "bit", "bag"),
  F(2, "comprehension", "Lily carved a smiley face into a big orange pumpkin and put a light inside. What did Lily make?", "A jack-o'-lantern", "A pie", "A snowman"),
  F(2, "nouns", "Which word is a NOUN (a person, place or thing)?", "garden", "run", "soft", "quickly"),
  F(2, "verbs", "Which word is a VERB (an action)?", "jump", "table", "green", "happy"),

  // ---------------------------------------------------------------- grade 3
  G(3, "plurals", (r) => {
    const [w, ans, ...wrong] = one(r, PLURALS_3);
    return { q: `More than one ${up(w)} is…`, answer: ans, wrong };
  }),
  G(3, "past-tense", (r) => {
    const [now, past] = one(r, PAST);
    return { q: `Yesterday, Boabosh ___ . Which word means ${up(now)} in the past?`, answer: past, wrong: [now, `${now}s`, `will ${now}`] };
  }),
  G(3, "synonyms", (r) => {
    const { g, others } = fromGroups(r, SYNONYMS);
    const [w, ans] = sample(r, g, 2);
    return { q: `Which word is a SYNONYM (means the same) of ${up(w!)}?`, answer: ans!, wrong: others };
  }),
  G(3, "abc-order", (r) => {
    const ws = sample(r, one(r, SAME_LETTER), 4);
    return { q: "These all start with the same letter. Which comes first in ABC order?", answer: [...ws].sort()[0]!, wrong: ws };
  }),
  G(3, "prefixes", (r) => {
    const pre = one(r, Object.keys(PREFIX)), [meaning, roots] = PREFIX[pre]!, root = one(r, roots);
    const others = Object.entries(PREFIX).filter(([p]) => PREFIX[p]![0] !== meaning).map(([, [m]]) => m.replace("{}", root));
    return { q: `What does ${up(pre + root)} mean?`, answer: meaning.replace("{}", root), wrong: [...others, `very ${root}`] };
  }),
  G(3, "suffixes", (r) => {
    const suf = one(r, Object.keys(SUFFIX)), [meaning, roots] = SUFFIX[suf]!, root = one(r, roots);
    const other = Object.entries(SUFFIX).find(([s]) => s !== suf)![1][0].replace("{}", root);
    return { q: `What does ${up(root + suf)} mean?`, answer: meaning.replace("{}", root), wrong: [other, `${root} again`, `a little ${root}`] };
  }),
  G(3, "parts-of-speech", (r) => {
    const a = one(r, ADJ), n = one(r, NOUN), v = one(r, VERB);
    const ask = one(r, [["NOUN (a thing)", n], ["VERB (an action)", v], ["ADJECTIVE (describes something)", a]] as const);
    return { q: `"The ${a} ${n} ${v}." Which word is the ${ask[0]}?`, answer: ask[1], wrong: [a, n, v] };
  }),
  G(3, "spelling", (r) => {
    const [, ans, ...wrong] = one(r, SPELL.filter((s) => s[0] === 3));
    return { q: "Which word is spelled correctly?", answer: ans, wrong };
  }),
  F(3, "sentence-types", "\"Where is my hat?\" What kind of sentence is this?", "A question", "A command", "An exclamation", "A statement"),
  F(3, "sentence-types", "\"Wow, that cat is huge!\" What kind of sentence is this?", "An exclamation", "A question", "A command", "A statement"),
  F(3, "sentence-types", "\"Please close the door.\" What kind of sentence is this?", "A command", "A question", "An exclamation", "A statement"),
  F(3, "homophones", "___ going to the park after lunch.", "They're", "There", "Their"),
  F(3, "homophones", "The cats licked ___ paws.", "their", "there", "they're"),
  F(3, "homophones", "Put the book over ___.", "there", "their", "they're"),
  F(3, "homophones", "I have ___ cats and one dog.", "two", "too", "to"),
  F(3, "homophones", "The wind ___ the leaves off the tree.", "blew", "blue"),
  F(3, "homophones", "My cat likes to ___ out the window.", "see", "sea"),
  F(3, "comprehension", "Lena practiced piano every day. At the concert, she played without a single mistake. Why did she play so well?", "She practiced a lot", "The piano was new", "She was lucky", "The song was short"),
  F(3, "comprehension", "The pond froze solid, so the children put on their skates. What season is it?", "Winter", "Summer", "Spring", "Fall"),
  F(3, "comprehension", "Max planted a seed, watered it, and waited. Two weeks later, a green sprout poked up. What happened LAST?", "A sprout poked up", "Max planted a seed", "Max watered it", "Max waited"),
  F(3, "comprehension", "Boabosh sniffed the new food, took one lick, and walked away. What does Boabosh think of the food?", "Boabosh doesn't like it", "Boabosh loves it", "Boabosh is very hungry", "Boabosh wants more"),
  F(3, "comprehension", "Owls hunt at night. Their big eyes help them see in the dark, and soft feathers let them fly silently. What is this mostly about?", "How owls are good night hunters", "What owls eat for breakfast", "Where owls build nests", "Why owls are loud"),
  F(3, "comprehension", "Jay's tower of blocks wobbled, then crashed to the floor. His little sister had bumped the table. What caused the crash?", "His sister bumped the table", "The blocks were too heavy", "Jay knocked it over", "The wind blew it"),
  F(3, "main-idea", "Bees carry pollen from flower to flower. This helps plants make seeds and fruit. What is the main idea?", "Bees help plants make seeds and fruit", "Bees are yellow and black", "Flowers smell nice", "Fruit is tasty"),
  F(3, "spelling", "Which word is spelled correctly?", "pumpkin", "punkin", "pumkin", "pumpken"),
  F(3, "comprehension", "Max wore a white sheet with two eye holes and floated down the hall saying 'Boooo!' What was Max dressed as?", "A ghost", "A pirate", "A cat", "A robot"),
  F(3, "vocabulary", "The old house looked SPOOKY in the moonlight. SPOOKY means…", "a little scary and strange", "bright and sunny", "brand new", "very noisy"),
  F(3, "vocabulary", "The giant cat tree was ENORMOUS. What does ENORMOUS mean?", "very big", "very old", "very soft", "very quiet"),
  F(3, "vocabulary", "Boabosh was CURIOUS about the box and peeked inside. CURIOUS means…", "wanting to know", "very sleepy", "a little angry", "scared"),

  // ---------------------------------------------------------------- grade 4
  G(4, "parts-of-speech", (r) => {
    const a = one(r, ADJ), n = one(r, NOUN), v = one(r, VERB), adv = one(r, ADVERB);
    const ask = one(r, [["ADVERB (tells how)", adv], ["ADJECTIVE", a], ["VERB", v], ["NOUN", n]] as const);
    return { q: `"The ${a} ${n} ${v} ${adv}." Which word is the ${ask[0]}?`, answer: ask[1], wrong: [a, n, v, adv] };
  }),
  G(4, "spelling", (r) => {
    const [, ans, ...wrong] = one(r, SPELL.filter((s) => s[0] === 4));
    return { q: "Which word is spelled correctly?", answer: ans, wrong };
  }),
  G(4, "prefixes", (r) => {
    const all = Object.entries(PREFIX).flatMap(([p, [m, rs]]) => rs.map((w) => [p + w, m.replace("{}", w)] as const));
    const [word, meaning] = one(r, all);
    return { q: `Which word means "${meaning}"?`, answer: word, wrong: all.filter(([, m]) => m !== meaning).map(([w]) => w) };
  }),
  F(4, "figurative-language", "\"It's raining cats and dogs!\" What does this mean?", "It's raining very hard", "Pets are falling from the sky", "It's a little sprinkle", "It's sunny"),
  F(4, "figurative-language", "\"Boabosh was as quiet as a mouse.\" This comparing phrase is called a…", "simile", "question", "rhyme", "command"),
  F(4, "figurative-language", "\"The wind whispered through the trees.\" The wind can't really whisper. This is called…", "personification", "a fact", "a plural", "a contraction"),
  F(4, "figurative-language", "\"Let the cat out of the bag\" means…", "tell a secret", "open a bag", "buy a cat", "go shopping"),
  F(4, "figurative-language", "\"I'm so hungry I could eat a horse!\" This big exaggeration is called…", "hyperbole", "a simile", "a fact", "a question"),
  F(4, "fact-opinion", "Which sentence is a FACT (can be proven)?", "Cats have whiskers.", "Cats are the best pets.", "Orange cats are the cutest.", "Cats are more fun than dogs."),
  F(4, "fact-opinion", "Which sentence is an OPINION (what someone thinks)?", "Chess is the most exciting game.", "Chess is played on a board with 64 squares.", "Each player starts with 16 pieces.", "A pawn can become a queen."),
  F(4, "point-of-view", "\"I grabbed my bag and ran to the bus.\" Who is telling this story?", "The character, using 'I' (first person)", "A narrator outside the story (third person)", "Nobody", "The bus"),
  F(4, "comprehension", "Desert foxes have huge ears. Their ears let extra body heat escape, which keeps them cool. Why do desert foxes have big ears?", "To help them stay cool", "To scare other animals", "To dig holes", "To keep warm at night"),
  F(4, "comprehension", "Rosa saved her allowance for ten weeks instead of buying candy. Finally she bought the telescope she wanted. What lesson does the story teach?", "Saving up helps you reach a goal", "Candy is bad for your teeth", "Telescopes are expensive toys", "Allowance should be spent quickly"),
  F(4, "comprehension", "The volcano had been quiet for 100 years. Then the ground began to shake and smoke rose from the top. What will MOST LIKELY happen next?", "The volcano may erupt", "It will start snowing", "The volcano will disappear", "Flowers will grow on top"),
  F(4, "comprehension", "Ben frowned at the puzzle, sighed, and pushed it away. Then he took a deep breath and tried again. Which word BEST describes Ben?", "determined", "lazy", "bored", "silly"),
  F(4, "main-idea", "Recycling turns old cans, bottles and paper into new things. It saves energy and keeps trash out of landfills. What is the main idea?", "Recycling helps the Earth", "Cans are made of metal", "Landfills are big", "Paper comes from trees"),
  F(4, "figurative-language", "\"The jack-o'-lantern grinned at us from the porch.\" A pumpkin can't really grin. This is…", "personification", "a simile", "a fact", "a question"),
  F(4, "comprehension", "Everyone screamed when the door creaked open, then laughed when they saw it was only the cat. How did their feelings change?", "From scared to happy", "From happy to sad", "From bored to angry", "They didn't change"),
  F(4, "vocabulary", "The ANCIENT castle was over 900 years old. ANCIENT means…", "very old", "very tall", "brand new", "very small"),
  F(4, "vocabulary", "After the long hike, the explorers were EXHAUSTED. EXHAUSTED means…", "very tired", "very excited", "very hungry", "lost"),
  F(4, "vocabulary", "The kitten was TIMID and hid when visitors came. TIMID means…", "shy", "bold", "loud", "hungry"),
  F(4, "homophones", "The knight rode his horse through the dark ___.", "night", "knight"),
  F(4, "homophones", "Boabosh ate the ___ cake!", "whole", "hole"),
  F(4, "grammar", "Which sentence is correct?", "Boabosh and I played chess.", "Me and Boabosh played chess.", "Boabosh and me played chess.", "I and Boabosh plays chess."),
];
