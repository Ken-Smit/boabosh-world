// Everything that can be owned: the shop catalog. Pure data (no three.js) so
// the rules in state.ts and the tests can use it. `style` + colours tell
// cat.ts / home.ts how to draw an item; the same builder draws many items.

export type Category =
  | "cats" | "hats" | "collars" | "glasses" | "backs" | "toys" | "food"
  | "beds" | "bowls" | "water" | "litter" | "walls" | "floors" | "rugs" | "decor";

export type ShopItem = {
  id: string;
  cat: Category;
  label: string;
  price: number;
  icon: string;
  style?: string;
  color?: number;
  color2?: number;
  /** Food: how many servings it adds. */
  amount?: number;
  /** Shown in a seasonal shop tab (still owned and usable all year). */
  season?: "halloween";
};

const item = (cat: Category, id: string, label: string, price: number, icon: string, style?: string, color?: number, color2?: number, amount?: number): ShopItem =>
  ({ id, cat, label, price, icon, style, color, color2, amount });
const spooky = (i: ShopItem): ShopItem => ({ ...i, season: "halloween" });

// ---------- cats -------------------------------------------------------------
// Coat colours for makeCat. Names are a preset list on purpose: no free-text
// names, so no child's real name ever reaches the server.
export type Coat = { fur: number; stripe: number; cream?: number; eyes?: number };
export const COATS: Record<string, Coat> = {
  caramel: { fur: 0xc28a52, stripe: 0x5b3519 },
  snow: { fur: 0xf2ede4, stripe: 0xe0d4c2, cream: 0xffffff, eyes: 0x6fb7e8 },
  pepper: { fur: 0x2a2a30, stripe: 0x18181c, cream: 0x3a3a42, eyes: 0xf2c53d },
  ginger: { fur: 0xe8964a, stripe: 0xa8521e },
  smokey: { fur: 0xa9adb3, stripe: 0x5a5e66, eyes: 0xe8b83c },
  calli: { fur: 0xf2e6d4, stripe: 0xd9822b, cream: 0xffffff },
  luna: { fur: 0xeadfcc, stripe: 0x6b4a36, eyes: 0x4aa3e0 },
  biscuit: { fur: 0xe9cfa0, stripe: 0xc9a06a, cream: 0xfff6e6 },
  blue: { fur: 0x8a96a8, stripe: 0x6a7688, cream: 0xb8c2d0, eyes: 0x8fcf4a },
};

export const CATS: (ShopItem & { name: string; coat: string })[] = [
  { ...item("cats", "cat-snow", "Mochi (snow white)", 400, "🤍"), name: "Mochi", coat: "snow" },
  { ...item("cats", "cat-pepper", "Pepper (black)", 400, "🖤"), name: "Pepper", coat: "pepper" },
  { ...item("cats", "cat-ginger", "Ginger (orange tabby)", 350, "🧡"), name: "Ginger", coat: "ginger" },
  { ...item("cats", "cat-smokey", "Smokey (grey tabby)", 350, "🩶"), name: "Smokey", coat: "smokey" },
  { ...item("cats", "cat-calli", "Calli (calico)", 500, "🎨"), name: "Calli", coat: "calli" },
  { ...item("cats", "cat-luna", "Luna (Siamese)", 600, "🌙"), name: "Luna", coat: "luna" },
  { ...item("cats", "cat-biscuit", "Biscuit (cream)", 450, "🍪"), name: "Biscuit", coat: "biscuit" },
  { ...item("cats", "cat-blue", "Sky (Russian blue)", 700, "💙"), name: "Sky", coat: "blue" },
];

// ---------- clothes ------------------------------------------------------------
const HATS = [
  item("hats", "acorn-hat", "Acorn Hat", 80, "🌰", "acorn", 0x8a5a2b),
  item("hats", "bobble-hat", "Bobble Hat", 80, "🧶", "bobble", 0xc0392b, 0xfdf3e7),
  item("hats", "goggles", "Lab Goggles", 80, "🥽", "goggles", 0x7fd1e8),
  item("hats", "party-hat", "Party Hat", 60, "🥳", "cone", 0xff6bd6, 0xffe066),
  item("hats", "crown", "Royal Crown", 250, "👑", "crown", 0xf1c40f, 0xe74c3c),
  spooky(item("hats", "witch-hat", "Witch Hat", 120, "🧙", "witch", 0x4b2a6b, 0x9b59b6)),
  spooky(item("hats", "pumpkin-hat", "Pumpkin Hat", 90, "🎃", "pumpkin", 0xff7a1a, 0x3f8a3a)),
  item("hats", "wizard-hat", "Wizard Hat", 160, "🔮", "cone", 0x2e4a9e, 0xf1c40f),
  item("hats", "chef-hat", "Chef Hat", 90, "👨‍🍳", "chef", 0xffffff),
  item("hats", "top-hat", "Top Hat", 150, "🎩", "top", 0x222222, 0xc0392b),
  item("hats", "flower-crown", "Flower Crown", 80, "🌸", "flowers", 0xff8fab, 0x2ecc71),
  item("hats", "bow", "Big Bow", 40, "🎀", "bow", 0xff6b9a),
  item("hats", "beanie", "Cozy Beanie", 70, "🧢", "beanie", 0x3498db, 0xffffff),
  item("hats", "cowboy-hat", "Cowboy Hat", 130, "🤠", "cowboy", 0xa0703a),
  item("hats", "headphones", "Headphones", 140, "🎧", "phones", 0x333a44, 0xff6b6b),
  item("hats", "propeller", "Propeller Cap", 110, "🚁", "propeller", 0xe74c3c, 0xf1c40f),
  item("hats", "bunny-ears", "Bunny Ears", 90, "🐰", "bunny", 0xffffff, 0xffc0d0),
  item("hats", "santa-hat", "Holiday Hat", 100, "🎅", "bobble", 0xd62828, 0xffffff),
];
const COLLARS = [
  item("collars", "leaf-collar", "Leaf Collar", 60, "🍃", "band", 0x4c9a5a),
  item("collars", "bell-collar", "Bell Collar", 60, "🔔", "bell", 0xd4a017, 0xf1c40f),
  item("collars", "star-collar", "Star Collar", 60, "⭐", "band", 0x6c5ce7, 0xf1c40f),
  item("collars", "red-collar", "Red Collar", 30, "❤️", "band", 0xe74c3c),
  item("collars", "blue-collar", "Blue Collar", 30, "💙", "band", 0x3498db),
  item("collars", "pink-collar", "Pink Collar", 30, "💗", "band", 0xff8fab),
  item("collars", "gold-collar", "Gold Collar", 200, "✨", "band", 0xf1c40f, 0xffffff),
  item("collars", "bowtie", "Bow Tie", 60, "🎀", "bowtie", 0xc0392b),
  item("collars", "blue-bowtie", "Fancy Bow Tie", 70, "🦋", "bowtie", 0x2e4a9e),
  item("collars", "scarf", "Cozy Scarf", 80, "🧣", "scarf", 0xe67e22, 0xf6e7c1),
  item("collars", "bandana", "Bandana", 50, "🤠", "bandana", 0xd62828, 0xffffff),
  item("collars", "pearls", "Pearl Necklace", 150, "📿", "pearls", 0xfaf6ee),
  spooky(item("collars", "spooky-collar", "Candy Corn Collar", 50, "🍬", "band", 0xff9a3a, 0xffe066)),
  spooky(item("collars", "bat-bowtie", "Bat Bow Tie", 60, "🦇", "bowtie", 0x2a2233)),
];
const GLASSES = [
  item("glasses", "round-glasses", "Round Glasses", 50, "👓", "round", 0x5a3a1a),
  item("glasses", "sunglasses", "Cool Shades", 70, "🕶️", "shades", 0x111111),
  item("glasses", "star-glasses", "Star Glasses", 80, "🌟", "star", 0xff6bd6),
  item("glasses", "heart-glasses", "Heart Glasses", 80, "😍", "heart", 0xe74c3c),
  item("glasses", "monocle", "Monocle", 90, "🧐", "monocle", 0xd4a017),
  item("glasses", "nerd-glasses", "Smart Specs", 50, "🤓", "round", 0x222222),
];
const BACKS = [
  item("backs", "red-cape", "Hero Cape", 120, "🦸", "cape", 0xd62828, 0xf1c40f),
  item("backs", "purple-cape", "Royal Cape", 150, "🟣", "cape", 0x6c3483, 0xf1c40f),
  item("backs", "angel-wings", "Angel Wings", 250, "👼", "wings", 0xffffff, 0xf6e7c1),
  item("backs", "butterfly-wings", "Butterfly Wings", 200, "🦋", "wings", 0x7ec8ff, 0xff9ff3),
  spooky(item("backs", "bat-wings", "Bat Wings", 180, "🦇", "batwings", 0x3a2a4a)),
  spooky(item("backs", "vampire-cape", "Vampire Cape", 140, "🧛", "cape", 0x1a1a22, 0xc0392b)),
  item("backs", "backpack", "Explorer Backpack", 100, "🎒", "backpack", 0x2e86de, 0xf1c40f),
  item("backs", "shell", "Turtle Shell", 140, "🐢", "shell", 0x4c9a5a, 0x8a6a3a),
];

// ---------- toys and food --------------------------------------------------------
// `style` picks the play animation: yarn (chase a rolling thing), feather, laser.
const TOYS = [
  item("toys", "yarn", "Ball of Yarn", 60, "🧶", "yarn", 0xe74c3c, 0xb03024),
  item("toys", "feather-wand", "Feather Wand", 80, "🪶", "feather", 0xff6b9a),
  item("toys", "laser-dot", "Laser Dot", 100, "🔴", "laser", 0xff2020),
  item("toys", "blue-yarn", "Blue Yarn", 60, "🔵", "yarn", 0x3498db, 0x1f6fb0),
  item("toys", "toy-mouse", "Toy Mouse", 70, "🐭", "mouse", 0xa0a4ab, 0xff9ab0),
  item("toys", "bouncy-ball", "Bouncy Ball", 50, "🟡", "ball", 0xf1c40f, 0xe74c3c),
  item("toys", "rainbow-wand", "Rainbow Wand", 120, "🌈", "feather", 0x9b59b6),
  item("toys", "butterfly-wand", "Butterfly Wand", 110, "🦋", "feather", 0x4ecdc4),
  item("toys", "green-laser", "Green Laser", 120, "🟢", "laser", 0x20ff60),
  spooky(item("toys", "pumpkin-ball", "Pumpkin Ball", 60, "🎃", "ball", 0xff7a1a, 0x3f8a3a)),
  spooky(item("toys", "ghost-wand", "Ghost Wand", 90, "👻", "feather", 0xffffff)),
];
const FOOD = [
  item("food", "fish-3", "Fish Snack ×3", 15, "🐟", undefined, undefined, undefined, 3),
  item("food", "fish-10", "Fish Feast ×10", 45, "🍣", undefined, undefined, undefined, 10),
  item("food", "tuna", "Tuna Can ×5", 25, "🥫", undefined, undefined, undefined, 5),
  item("food", "kibble", "Kibble Bag ×20", 80, "🛍️", undefined, undefined, undefined, 20),
];

// ---------- home -------------------------------------------------------------------
const BEDS = [
  item("beds", "bed-basket", "Wicker Basket", 0, "🧺", "basket", 0xc8a06a, 0xf3e2c3),
  item("beds", "bed-cushion", "Big Cushion", 60, "🛋️", "cushion", 0x9b59b6, 0xd8b4f0),
  item("beds", "bed-donut", "Donut Bed", 90, "🍩", "donut", 0xff8fab, 0xfff0f5),
  item("beds", "bed-box", "Cardboard Box", 20, "📦", "box", 0xc8a06a),
  item("beds", "bed-cloud", "Cloud Bed", 180, "☁️", "cloud", 0xffffff, 0xcfe8ff),
  item("beds", "bed-canopy", "Princess Canopy", 260, "👸", "canopy", 0xff9ff3, 0xffffff),
  item("beds", "bed-castle", "Castle Bed", 320, "🏰", "castle", 0xb8c4cf, 0x6c5ce7),
  spooky(item("beds", "bed-pumpkin", "Pumpkin Bed", 120, "🎃", "donut", 0xff7a1a, 0xffe0b0)),
];
const BOWLS = [
  item("bowls", "bowl-blue", "Blue Bowl", 0, "🥣", "bowl", 0x3d7cc9),
  item("bowls", "bowl-pink", "Pink Bowl", 30, "🩷", "bowl", 0xff8fab),
  item("bowls", "bowl-gold", "Golden Bowl", 150, "🏆", "bowl", 0xf1c40f),
  item("bowls", "bowl-fish", "Fish Bowl", 70, "🐠", "fish", 0xff9f43),
  item("bowls", "bowl-stand", "Wooden Stand", 90, "🪵", "stand", 0xa0703a, 0xffffff),
  spooky(item("bowls", "bowl-cauldron", "Cauldron Bowl", 70, "🧪", "bowl", 0x2b2b33)),
];
const WATER = [
  item("water", "water-basic", "Water Bowl", 0, "💧", "bowl", 0x5ec8ff),
  item("water", "water-pink", "Pink Water Bowl", 30, "🌸", "bowl", 0xff8fab),
  item("water", "water-gold", "Golden Water Bowl", 150, "🌟", "bowl", 0xf1c40f),
  item("water", "water-fountain", "Water Fountain", 200, "⛲", "fountain", 0xeaf6ff, 0x4f86c6),
];
const LITTER = [
  item("litter", "litter-basic", "Litter Tray", 0, "🟫", "open", 0x7f8c99),
  item("litter", "litter-green", "Green Tray", 30, "🟩", "open", 0x4c9a5a),
  item("litter", "litter-hood", "Hooded Box", 90, "🏠", "hood", 0xff9f43),
  item("litter", "litter-cabinet", "Wooden Cabinet", 160, "🗄️", "cabinet", 0xa0703a),
  item("litter", "litter-dome", "Space Dome", 220, "🚀", "dome", 0xeaf0f6, 0x4f86c6),
];
const WALLS = [
  item("walls", "wall-cream", "Cream", 0, "🟨", "plain", 0xf6e7cf),
  item("walls", "wall-mint", "Mint Stripes", 50, "🌿", "stripes", 0xd6f0e0, 0xbfe3cf),
  item("walls", "wall-pink", "Pink Polka Dots", 50, "🎀", "dots", 0xffe0ea, 0xffffff),
  item("walls", "wall-stars", "Night Stars", 80, "🌌", "stars", 0x2e3a6b, 0xfff3a0),
  item("walls", "wall-wood", "Wood Panels", 70, "🪵", "planks", 0xc8945a, 0xa87444),
  item("walls", "wall-sunset", "Sunset", 90, "🌅", "gradient", 0xffb38a, 0xffe6a8),
  item("walls", "wall-fish", "Fish Pattern", 100, "🐟", "fish", 0xdff1ff, 0x5ec8ff),
  spooky(item("walls", "wall-spooky", "Spooky Night", 80, "🌙", "stars", 0x2e1f4a, 0xff9a3a)),
];
const FLOORS = [
  item("floors", "floor-wood", "Wood Floor", 0, "🟫", "planks", 0xb07a4a, 0x9a6a3e),
  item("floors", "floor-check", "Checker Tiles", 50, "🏁", "check", 0xf4f4f4, 0x9fb4c4),
  item("floors", "floor-carpet", "Blue Carpet", 60, "🟦", "plain", 0x6f9fd8),
  item("floors", "floor-pink", "Pink Carpet", 60, "🩷", "plain", 0xf7b6c8),
  item("floors", "floor-grass", "Indoor Grass", 90, "🌱", "grass", 0x7cc457, 0x5fa040),
  item("floors", "floor-marble", "Marble", 120, "⬜", "marble", 0xf2f0ec, 0xc9c4bc),
];
const RUGS = [
  item("rugs", "rug-none", "No Rug", 0, "⬛"),
  item("rugs", "rug-round", "Round Rug", 40, "⭕", "round", 0xff8fab, 0xffffff),
  item("rugs", "rug-rainbow", "Rainbow Rug", 90, "🌈", "rainbow"),
  item("rugs", "rug-paw", "Paw Print Rug", 70, "🐾", "paw", 0x9b59b6, 0xffffff),
  item("rugs", "rug-fish", "Fish Rug", 70, "🐟", "fishrug", 0x4f86c6, 0xffffff),
];
// Decor: each has a fixed spot in the room and is switched on or off.
const DECOR = [
  item("decor", "cat-tree", "Cat Tree", 200, "🌳", "cattree", 0xc8a06a, 0x9b59b6),
  item("decor", "plant", "House Plant", 40, "🪴", "plant", 0x4c9a5a),
  item("decor", "bookshelf", "Bookshelf", 120, "📚", "bookshelf", 0x8b5a2b),
  item("decor", "lamp", "Cozy Lamp", 60, "💡", "lamp", 0xfff0c8),
  item("decor", "portrait", "Boabosh Portrait", 150, "🖼️", "portrait"),
  item("decor", "aquarium", "Fish Tank", 180, "🐠", "aquarium"),
  item("decor", "scratcher", "Scratching Post", 0, "🪵", "scratcher", 0xd9c08a), // free: every home has one
  item("decor", "cushions", "Cushion Pile", 60, "🛋️", "cushions"),
  item("decor", "fairy-lights", "Fairy Lights", 90, "✨", "lights"),
  item("decor", "toy-chest", "Toy Chest", 80, "🧰", "chest", 0xc0392b),
  item("decor", "window-seat", "Window Perch", 110, "🪟", "perch", 0xf3e2c3),
  item("decor", "clock", "Wall Clock", 50, "🕰️", "clock"),
  item("decor", "sunflower", "Sunflowers", 50, "🌻", "sunflowers"),
  item("decor", "piano", "Toy Piano", 160, "🎹", "piano"),
  spooky(item("decor", "jack-o-lantern", "Giant Jack-o'-Lantern", 80, "🎃", "jackolantern")),
  spooky(item("decor", "cauldron", "Bubbling Cauldron", 100, "🧪", "cauldron")),
  spooky(item("decor", "bat-garland", "Bat Garland", 60, "🦇", "batgarland")),
];

export const CATALOG: ShopItem[] = [
  ...CATS, ...HATS, ...COLLARS, ...GLASSES, ...BACKS, ...TOYS, ...FOOD,
  ...BEDS, ...BOWLS, ...WATER, ...LITTER, ...WALLS, ...FLOORS, ...RUGS, ...DECOR,
];
export const BY_ID: Record<string, ShopItem> = Object.fromEntries(CATALOG.map((i) => [i.id, i]));

/** Free starter furniture everyone owns. */
export const STARTER = CATALOG.filter((i) => i.price === 0).map((i) => i.id);

/** Wearable slot for each clothing category. */
export const SLOT_OF: Partial<Record<Category, "hat" | "collar" | "glasses" | "back">> = {
  hats: "hat", collars: "collar", glasses: "glasses", backs: "back",
};
/** Home slot for each furniture category (decor is a list, not a slot). */
export const HOME_SLOT_OF: Partial<Record<Category, "bed" | "food" | "water" | "litter" | "wall" | "floor" | "rug">> = {
  beds: "bed", bowls: "food", water: "water", litter: "litter", walls: "wall", floors: "floor", rugs: "rug",
};

export const SHOP_TABS: { cat: Category; label: string }[] = [
  { cat: "food", label: "🐟 Food" },
  { cat: "toys", label: "🧶 Toys" },
  { cat: "hats", label: "🎩 Hats" },
  { cat: "collars", label: "🎀 Collars" },
  { cat: "glasses", label: "👓 Glasses" },
  { cat: "backs", label: "🦸 Capes & Wings" },
  { cat: "cats", label: "🐱 Cats" },
  { cat: "beds", label: "🛏️ Beds" },
  { cat: "bowls", label: "🥣 Food Bowls" },
  { cat: "water", label: "💧 Water Bowls" },
  { cat: "litter", label: "🚽 Litter Boxes" },
  { cat: "walls", label: "🖌️ Wallpaper" },
  { cat: "floors", label: "🟫 Floors" },
  { cat: "rugs", label: "🌀 Rugs" },
  { cat: "decor", label: "🪴 Decorations" },
];
