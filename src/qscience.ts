// Science Lab: fact-table generators (animal groups, habitats, matter…) plus
// hand-written questions, checked against grade 2–4 science standards.

import { F, G, one, type Item, type Rng } from "./qkit.ts";

const up = (w: string) => w.toUpperCase();
function fromGroups(r: Rng, groups: Record<string, string[]>) {
  const name = one(r, Object.keys(groups));
  return { name, item: one(r, groups[name]!), others: Object.entries(groups).filter(([k]) => k !== name).flatMap(([, v]) => v) };
}

const ANIMAL_GROUPS: Record<string, string[]> = {
  mammal: ["dog", "whale", "bat", "cat", "horse", "dolphin", "cow", "bear", "rabbit", "elephant"],
  bird: ["penguin", "eagle", "owl", "parrot", "robin", "ostrich", "duck"],
  fish: ["shark", "salmon", "goldfish", "tuna", "clownfish"],
  reptile: ["snake", "lizard", "turtle", "crocodile", "iguana"],
  amphibian: ["frog", "toad", "salamander", "newt"],
  insect: ["ant", "bee", "butterfly", "ladybug", "grasshopper", "beetle"],
};
const HABITATS: Record<string, string[]> = {
  "the desert": ["camel", "scorpion", "roadrunner", "rattlesnake"],
  "the ocean": ["octopus", "shark", "whale", "sea star", "jellyfish"],
  "an icy, freezing place": ["polar bear", "walrus", "arctic fox", "penguin"],
  "the rainforest": ["monkey", "toucan", "sloth", "jaguar"],
  "a pond": ["frog", "duck", "dragonfly", "tadpole"],
};
const DIET: Record<string, string[]> = {
  "herbivore (eats only plants)": ["cow", "rabbit", "deer", "horse", "giraffe", "koala"],
  "carnivore (eats meat)": ["lion", "tiger", "shark", "wolf", "eagle", "owl", "cat"],
  "omnivore (eats plants and meat)": ["bear", "pig", "raccoon", "human", "chicken"],
};
const MATTER: Record<string, string[]> = {
  solid: ["a rock", "an ice cube", "a book", "a spoon", "a pencil", "a chair"],
  liquid: ["milk", "juice", "water", "honey", "cooking oil"],
  gas: ["steam", "air", "the air inside a balloon"],
};
const LIVING = ["a tree", "a kitten", "a mushroom", "an ant", "a flower", "a fish", "grass", "a worm"];
const NONLIVING = ["a rock", "a toy car", "a cloud", "a spoon", "a pencil", "a sock", "a chair", "a coin"];
const BABIES: [string, string][] = [
  ["cat", "kitten"], ["dog", "puppy"], ["cow", "calf"], ["bear", "cub"], ["chicken", "chick"], ["horse", "foal"],
  ["kangaroo", "joey"], ["duck", "duckling"], ["frog", "tadpole"], ["sheep", "lamb"], ["goat", "kid"], ["swan", "cygnet"],
];
const SENSES: [string, string][] = [["see a rainbow", "sight"], ["hear a purr", "hearing"], ["smell cookies", "smell"], ["taste lemonade", "taste"], ["feel soft fur", "touch"]];
const ORGANS: [string, string][] = [
  ["pumps blood around your body", "heart"], ["helps you breathe air in and out", "lungs"], ["controls your thinking and your body", "brain"],
  ["breaks down the food you eat", "stomach"], ["holds your body up and protects your organs", "skeleton"],
];
const MACHINES: [string, string][] = [
  ["A ramp", "inclined plane"], ["A seesaw", "lever"], ["The rope and wheel that raise a flag", "pulley"],
  ["A doorknob", "wheel and axle"], ["An axe blade", "wedge"], ["A jar lid", "screw"],
];

const INVERTEBRATES = ["jellyfish", "octopus", "earthworm", "snail", "spider", "crab", "ant", "bee", "butterfly", "ladybug", "sea star"];
const VERTEBRATES = [...ANIMAL_GROUPS.mammal!, ...ANIMAL_GROUPS.bird!, ...ANIMAL_GROUPS.fish!, ...ANIMAL_GROUPS.reptile!, ...ANIMAL_GROUPS.amphibian!];
const CONDUCTORS = ["a copper wire", "an iron nail", "aluminum foil", "a steel spoon", "a metal key", "a metal paper clip"];
const INSULATORS = ["a rubber band", "a wooden ruler", "a plastic straw", "a glass marble", "a cotton sock", "a paper cup"];
const MAGNETIC = ["an iron nail", "a steel paper clip", "a steel screw", "an iron key ring"];
const NOT_MAGNETIC = ["a rubber band", "a wooden spoon", "a plastic cup", "a glass marble", "a paper towel", "an aluminum can", "a penny"];
const PLANETS = ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"];

export const SCIENCE: Item[] = [
  // ---------------------------------------------------------------- grade 2
  G(2, "animal-groups", (r) => {
    const { name, item, others } = fromGroups(r, ANIMAL_GROUPS);
    return { q: `Which animal is a ${up(name)}?`, answer: item, wrong: others };
  }),
  G(2, "habitats", (r) => {
    const { name, item, others } = fromGroups(r, HABITATS);
    return { q: `Which animal lives in ${name}?`, answer: item, wrong: others.filter((o) => !HABITATS[name]!.includes(o)) };
  }),
  G(2, "states-of-matter", (r) => {
    const { name, item } = fromGroups(r, MATTER);
    return { q: `${item[0]!.toUpperCase()}${item.slice(1)} is a…`, answer: name, wrong: Object.keys(MATTER) };
  }),
  G(2, "living-things", (r) => {
    const living = r() < 0.5;
    return living
      ? { q: "Which one is a LIVING thing?", answer: one(r, LIVING), wrong: NONLIVING }
      : { q: "Which one is NOT a living thing?", answer: one(r, NONLIVING), wrong: LIVING };
  }),
  G(2, "baby-animals", (r) => {
    const [adult, baby] = one(r, BABIES);
    return { q: `A baby ${adult} is called a…`, answer: baby, wrong: BABIES.map((b) => b[1]) };
  }),
  G(2, "senses", (r) => {
    const [act, sense] = one(r, SENSES);
    return { q: `Which sense do you use to ${act}?`, answer: sense, wrong: SENSES.map((s) => s[1]) };
  }),
  F(2, "animals", "How many legs does a spider have?", "8", "6", "4"),
  F(2, "plants", "A pumpkin grows on a…", "vine", "tall tree", "cactus"),
  F(2, "animals", "Bats are awake at night and sleep during the…", "day", "winter only", "rain"),
  F(2, "plants", "What do plants need to grow?", "Sunlight, water and air", "Candy and toys", "Darkness only"),
  F(2, "plants", "Which part of a plant soaks up water from the soil?", "The roots", "The flower", "The leaves"),
  F(2, "plants", "Bees visit which part of a plant to drink nectar?", "The flower", "The roots", "The stem"),
  F(2, "seasons", "Which season comes after winter?", "Spring", "Summer", "Fall"),
  F(2, "seasons", "In which season do many trees lose their leaves?", "Fall", "Spring", "Summer"),
  F(2, "weather", "Which tool measures how hot or cold it is?", "thermometer", "ruler", "scale"),
  F(2, "weather", "What do we call water that falls from clouds as drops?", "rain", "fog", "dew"),
  F(2, "space", "The Sun is a…", "star", "planet", "moon"),
  F(2, "magnets", "A magnet will stick to…", "an iron nail", "a wooden block", "a plastic spoon"),
  F(2, "forces", "Opening a drawer toward you is a…", "pull", "push", "jump"),
  F(2, "forces", "Kicking a ball away from you is a…", "push", "pull", "spin"),
  F(2, "sound", "Sound is made when something…", "vibrates (shakes back and forth)", "stays very still", "gets wet"),
  F(2, "light", "A shadow forms when something blocks…", "light", "sound", "air"),
  F(2, "states-of-matter", "What happens to a puddle on a hot day?", "It evaporates", "It freezes", "It gets bigger"),
  F(2, "states-of-matter", "When water gets very cold, it freezes into…", "ice", "steam", "sand"),
  F(2, "life-cycles", "A caterpillar grows up to become a…", "butterfly", "bee", "ladybug"),
  F(2, "animal-needs", "Every animal needs food, water, air and…", "shelter", "a bicycle", "a hat"),
  F(2, "animal-needs", "Cat whiskers help a cat…", "feel how wide a gap is", "taste food", "hear better"),
  F(2, "earth", "Most of Earth's surface is covered by…", "water", "sand", "ice cream"),
  F(2, "recycling", "Which of these can be recycled?", "a plastic bottle", "a sandwich", "a puddle"),

  // ---------------------------------------------------------------- grade 3
  G(3, "animal-groups", (r) => {
    const { name, item } = fromGroups(r, ANIMAL_GROUPS);
    return { q: `A ${up(item)} is a…`, answer: name, wrong: Object.keys(ANIMAL_GROUPS) };
  }),
  G(3, "food-chains", (r) => {
    const { name, item } = fromGroups(r, DIET);
    return { q: `What kind of eater is a ${up(item)}?`, answer: name, wrong: Object.keys(DIET) };
  }),
  G(3, "magnets", (r) => ({ q: "Which one will a magnet pick up?", answer: one(r, MAGNETIC), wrong: NOT_MAGNETIC })),
  G(3, "habitats", (r) => {
    const { name, item } = fromGroups(r, HABITATS);
    return { q: `Where does a ${up(item)} live?`, answer: name, wrong: Object.keys(HABITATS).filter((h) => !HABITATS[h]!.includes(item)) };
  }),
  F(3, "animals", "Animals that are awake at night and sleep in the day are called…", "nocturnal", "migrating", "hibernating", "camouflaged"),
  F(3, "animals", "A spider has 8 legs, so it is NOT an insect. A spider is an…", "arachnid", "amphibian", "insect", "reptile"),
  F(3, "animals", "Some bats find their way in the dark by making sounds and listening for echoes. This is called…", "echolocation", "photosynthesis", "hibernation", "evaporation"),
  F(3, "water-cycle", "When water vapor cools and forms clouds, it is called…", "condensation", "evaporation", "erosion", "melting"),
  F(3, "water-cycle", "Rain, snow, sleet and hail are all kinds of…", "precipitation", "evaporation", "condensation", "gravity"),
  F(3, "water-cycle", "When the Sun heats water and it turns into a gas, that is…", "evaporation", "condensation", "freezing", "precipitation"),
  F(3, "earth", "Wind and water slowly wearing away rock and soil is called…", "erosion", "melting", "growing", "freezing"),
  F(3, "fossils", "A fossil is…", "the remains or print of a living thing from long ago", "a kind of shiny rock", "a baby dinosaur", "a seashell from today"),
  F(3, "space", "Why do we have day and night?", "Earth spins around once a day", "The Sun turns off at night", "The Moon covers the Sun", "Clouds block the Sun"),
  F(3, "space", "How long does it take Earth to travel once around the Sun?", "One year", "One day", "One week", "One month"),
  F(3, "space", "The Moon shines because it…", "reflects light from the Sun", "makes its own light", "is on fire", "has light bulbs"),
  F(3, "space", "Which planet do we live on?", "Earth", "Mars", "Venus", "Jupiter"),
  F(3, "life-cycles", "What comes right after the egg in a butterfly's life cycle?", "caterpillar (larva)", "adult butterfly", "chrysalis (pupa)", "tadpole"),
  F(3, "life-cycles", "Inside what does a caterpillar change into a butterfly?", "a chrysalis", "a nest", "an egg", "a shell"),
  F(3, "traits", "Kittens often look like their parents because traits are…", "passed down from parents", "chosen by the kitten", "the same for every cat", "learned at school"),
  F(3, "adaptations", "A polar bear's thick fur and fat help it…", "stay warm", "swim faster in warm water", "climb trees", "see in the dark"),
  F(3, "adaptations", "An animal's color that helps it blend in with its home is called…", "camouflage", "migration", "hibernation", "a habitat"),
  F(3, "adaptations", "When some bears sleep deeply through the winter, it is called…", "hibernation", "migration", "camouflage", "evaporation"),
  F(3, "adaptations", "When birds fly south for the winter, it is called…", "migration", "hibernation", "erosion", "camouflage"),
  F(3, "forces", "A push or a pull is called a…", "force", "liquid", "habitat", "magnet"),
  F(3, "forces", "What pulls things down toward the ground?", "gravity", "friction", "magnetism", "wind"),
  F(3, "forces", "Rubbing your hands together makes them warm because of…", "friction", "gravity", "magnets", "light"),
  F(3, "magnets", "If you put the north ends of two magnets together, they…", "push apart", "pull together", "melt", "turn into one magnet"),
  F(3, "food-chains", "In a food chain, plants get their energy from…", "the Sun", "the soil only", "animals", "the Moon"),
  F(3, "food-chains", "An animal that hunts other animals for food is called a…", "predator", "prey", "producer", "plant"),
  F(3, "weather", "Which tool measures how much rain has fallen?", "rain gauge", "thermometer", "ruler", "compass"),
  F(3, "matter", "When an ice cube turns into water, it is…", "melting", "freezing", "evaporating", "condensing"),

  // ---------------------------------------------------------------- grade 4
  G(4, "body", (r) => {
    const [job, organ] = one(r, ORGANS);
    return { q: `Which part of your body ${job}?`, answer: organ, wrong: ORGANS.map((o) => o[1]) };
  }),
  G(4, "simple-machines", (r) => {
    const [thing, machine] = one(r, MACHINES);
    return { q: `${thing} is which simple machine?`, answer: machine, wrong: MACHINES.map((m) => m[1]) };
  }),
  G(4, "animals", (r) => r() < 0.5
    ? { q: "Which animal is an INVERTEBRATE (has no backbone)?", answer: one(r, INVERTEBRATES), wrong: VERTEBRATES }
    : { q: "Which animal is a VERTEBRATE (has a backbone)?", answer: one(r, VERTEBRATES), wrong: INVERTEBRATES }),
  G(4, "energy", (r) => r() < 0.5
    ? { q: "Which one is a CONDUCTOR (lets electricity flow through it)?", answer: one(r, CONDUCTORS), wrong: INSULATORS }
    : { q: "Which one is an INSULATOR (blocks electricity)?", answer: one(r, INSULATORS), wrong: CONDUCTORS }),
  G(4, "space", (r) => {
    const i = Math.floor(r() * 7);
    return { q: `Going out from the Sun, which planet comes right after ${PLANETS[i]}?`, answer: PLANETS[i + 1]!, wrong: PLANETS.filter((_, j) => j !== i + 1 && j !== i) };
  }),
  G(4, "food-chains", (r) => {
    const { name, item } = fromGroups(r, DIET);
    const word = name.split(" ")[0]!;
    return { q: `A ${up(item)} is a ${word}. What does that mean?`, answer: name.replace(/^\w+ \((.*)\)$/, "it $1"), wrong: Object.keys(DIET).filter((k) => k !== name).map((k) => k.replace(/^\w+ \((.*)\)$/, "it $1")).concat("it eats rocks") };
  }),
  F(4, "plants", "A pumpkin has seeds inside, so scientists call it a…", "fruit", "vegetable root", "leaf", "stem"),
  F(4, "space", "A full Moon looks round and bright because…", "we see its whole sunlit side", "it makes its own light", "it is closest to the Sun", "clouds polish it"),
  F(4, "plants", "Plants use sunlight, water and air to make their own food. This is called…", "photosynthesis", "evaporation", "hibernation", "erosion"),
  F(4, "plants", "Which gas do plants take in from the air to make food?", "carbon dioxide", "oxygen", "steam", "helium"),
  F(4, "plants", "Which gas do plants give off that animals need to breathe?", "oxygen", "carbon dioxide", "smoke", "steam"),
  F(4, "energy", "Which of these is a RENEWABLE energy source (it won't run out)?", "wind", "coal", "oil", "gasoline"),
  F(4, "energy", "A complete path that electricity flows around is called a…", "circuit", "magnet", "battery", "switch"),
  F(4, "energy", "Which material lets electricity flow through it easily?", "copper wire", "rubber", "wood", "plastic"),
  F(4, "energy", "A material that does NOT let electricity flow easily, like rubber, is an…", "insulator", "conductor", "orbit", "atom"),
  F(4, "light", "When light bounces off a mirror, the light is…", "reflected", "absorbed", "melted", "frozen"),
  F(4, "light", "A rainbow appears when sunlight is…", "bent and split into colors by raindrops", "painted on clouds", "reflected by the Moon", "made by the wind"),
  F(4, "sound", "A big, strong vibration makes a sound that is…", "louder", "quieter", "brighter", "colder"),
  F(4, "earth", "Rock that forms when hot melted lava cools down is…", "igneous rock", "sedimentary rock", "a fossil", "sand"),
  F(4, "earth", "The very center of the Earth is called the…", "core", "crust", "mantle", "surface"),
  F(4, "earth", "The thin outer layer of Earth that we live on is the…", "crust", "core", "mantle", "atmosphere"),
  F(4, "earth", "Rocks breaking into smaller pieces from rain, ice and wind is called…", "weathering", "photosynthesis", "condensation", "migration"),
  F(4, "space", "Which planet is closest to the Sun?", "Mercury", "Earth", "Neptune", "Mars"),
  F(4, "space", "Which is the biggest planet in our solar system?", "Jupiter", "Earth", "Mars", "Mercury"),
  F(4, "space", "Which planet is famous for its big, bright rings?", "Saturn", "Mars", "Venus", "Mercury"),
  F(4, "space", "Which planet is called the Red Planet?", "Mars", "Jupiter", "Neptune", "Saturn"),
  F(4, "space", "Why does the Moon seem to change shape each night?", "We see different amounts of its sunlit side", "It shrinks and grows", "Clouds cut pieces off", "Earth's shadow eats it"),
  F(4, "animals", "Animals that have a backbone are called…", "vertebrates", "invertebrates", "insects", "plants"),
  F(4, "ecosystems", "Mushrooms and worms that break down dead plants and animals are called…", "decomposers", "predators", "producers", "planets"),
  F(4, "ecosystems", "In a food chain, a plant is called a…", "producer", "consumer", "predator", "decomposer"),
  F(4, "body", "About how many bones does an adult human have?", "206", "12", "1,000", "50"),
  F(4, "matter", "Sand stirred into water, where you can still pick out the sand, is a…", "mixture", "gas", "planet", "fossil"),
];
