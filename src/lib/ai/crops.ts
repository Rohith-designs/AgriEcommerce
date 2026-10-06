/** Shared crop vocabulary for NL ingestion + matching. */

export type CropMeta = {
  key: string;
  variety: string;
  category: string;
  aliases: string[];
  suggestedPrice: number;
  unit: string;
  gradeDefault: string;
  shelfDays: number;
};

export const CROPS: CropMeta[] = [
  {
    key: "tomato",
    variety: "Hybrid Tomato",
    category: "Vegetables",
    aliases: ["tomato", "tomatoes", "tamatar"],
    suggestedPrice: 30,
    unit: "kg",
    gradeDefault: "Grade A",
    shelfDays: 5,
  },
  {
    key: "onion",
    variety: "Red Onion",
    category: "Vegetables",
    aliases: ["onion", "onions", "pyaaz", "kanda"],
    suggestedPrice: 26,
    unit: "kg",
    gradeDefault: "Grade A",
    shelfDays: 14,
  },
  {
    key: "potato",
    variety: "Jyoti Red Potato",
    category: "Vegetables",
    aliases: ["potato", "potatoes", "aloo"],
    suggestedPrice: 24,
    unit: "kg",
    gradeDefault: "Grade A",
    shelfDays: 21,
  },
  {
    key: "okra",
    variety: "Tender Okra",
    category: "Vegetables",
    aliases: ["okra", "bhindi", "bhendi", "ladyfinger"],
    suggestedPrice: 45,
    unit: "kg",
    gradeDefault: "Grade A",
    shelfDays: 4,
  },
  {
    key: "brinjal",
    variety: "Purple Brinjal",
    category: "Vegetables",
    aliases: ["brinjal", "eggplant", "baingan", "vankaya"],
    suggestedPrice: 36,
    unit: "kg",
    gradeDefault: "Grade A",
    shelfDays: 5,
  },
  {
    key: "carrot",
    variety: "Nantes Carrot",
    category: "Vegetables",
    aliases: ["carrot", "carrots", "gajar"],
    suggestedPrice: 40,
    unit: "kg",
    gradeDefault: "Grade A",
    shelfDays: 10,
  },
  {
    key: "cabbage",
    variety: "Green Cabbage",
    category: "Vegetables",
    aliases: ["cabbage", "patta", "gobhi"],
    suggestedPrice: 20,
    unit: "kg",
    gradeDefault: "Grade A",
    shelfDays: 8,
  },
  {
    key: "chilli",
    variety: "Guntur Sannam Chilli",
    category: "Spices",
    aliases: ["chilli", "chillies", "chili", "mirchi", "mirch", "teja", "sannam"],
    suggestedPrice: 160,
    unit: "kg",
    gradeDefault: "Grade A",
    shelfDays: 30,
  },
  {
    key: "mango",
    variety: "Banganapalli Mango",
    category: "Fruits",
    aliases: ["mango", "mangoes", "aam"],
    suggestedPrice: 88,
    unit: "kg",
    gradeDefault: "Grade 1",
    shelfDays: 7,
  },
  {
    key: "banana",
    variety: "Yelakki Banana",
    category: "Fruits",
    aliases: ["banana", "bananas", "arati"],
    suggestedPrice: 55,
    unit: "kg",
    gradeDefault: "Grade 1",
    shelfDays: 5,
  },
  {
    key: "paddy",
    variety: "Sona Masoori Paddy",
    category: "Grains",
    aliases: ["paddy", "rice", "basmati", "dhaan", "vari", "sona masoori"],
    suggestedPrice: 31,
    unit: "kg",
    gradeDefault: "Grade 1",
    shelfDays: 90,
  },
  {
    key: "wheat",
    variety: "Lokwan Wheat",
    category: "Grains",
    aliases: ["wheat", "gehu", "godhuma"],
    suggestedPrice: 27,
    unit: "kg",
    gradeDefault: "Grade 1",
    shelfDays: 120,
  },
  {
    key: "moong",
    variety: "Green Moong Dal",
    category: "Pulses",
    aliases: ["moong", "green gram", "pesara"],
    suggestedPrice: 110,
    unit: "kg",
    gradeDefault: "Grade 1",
    shelfDays: 90,
  },
  {
    key: "tur",
    variety: "Red Gram (Tur Dal)",
    category: "Pulses",
    aliases: ["tur", "arhar", "red gram", "toor", "kandipappu"],
    suggestedPrice: 125,
    unit: "kg",
    gradeDefault: "Grade 1",
    shelfDays: 90,
  },
  {
    key: "turmeric",
    variety: "Salem Turmeric Fingers",
    category: "Spices",
    aliases: ["turmeric", "haldi", "pasupu"],
    suggestedPrice: 140,
    unit: "kg",
    gradeDefault: "Grade A",
    shelfDays: 180,
  },
];

export function detectCrop(text: string): CropMeta | null {
  const q = ` ${text.toLowerCase()} `;
  const tokens = new Set(
    text
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean),
  );
  // Prefer longer multi-word aliases first.
  const ranked = [...CROPS].sort(
    (a, b) =>
      Math.max(...b.aliases.map((x) => x.length)) -
      Math.max(...a.aliases.map((x) => x.length)),
  );
  for (const crop of ranked) {
    if (
      crop.aliases.some((a) =>
        a.includes(" ") ? q.includes(a) : tokens.has(a),
      )
    ) {
      return crop;
    }
  }
  return null;
}

export function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
