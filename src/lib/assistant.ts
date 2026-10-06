import type { Listing } from "@/types";
import { listings as demoListings } from "@/lib/demo-data";
import { formatCurrency, formatQuantity } from "@/lib/utils";

/**
 * AgriLink assistant — 100% local and rule-based.
 * No API keys, no network calls: every reply is generated on-device from
 * the live marketplace listings below. It answers a small set of topics
 * directly (greetings, prices, stock, delivery, orders, payments, selling);
 * anything else falls back to the market admin contact plus the most
 * relevant seller from the marketplace.
 */

export const ADMIN_CONTACT = {
  name: "AgriLink Market Admin",
  role: "Marketplace operations",
  phone: "+91-40-4890-1234",
  email: "support@agrilink.demo",
  hours: "Mon–Sat · 9am–6pm IST",
} as const;

export type AssistantBlock =
  | { kind: "text"; text: string }
  | { kind: "admin" }
  | { kind: "seller"; listingId: string };

export interface AssistantReply {
  blocks: AssistantBlock[];
}

const text = (text: string): AssistantBlock => ({ kind: "text", text });

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

/** Canonical crop token -> aliases buyers might type. */
const CROP_ALIASES: Record<string, string[]> = {
  tomato: ["tomato", "tomatoes", "tamatar"],
  onion: ["onion", "onions", "pyaaz", "kanda"],
  potato: ["potato", "potatoes", "aloo"],
  cabbage: ["cabbage", "patta", "gobhi"],
  cauliflower: ["cauliflower", "phool"],
  chilli: ["chilli", "chillies", "chili", "mirchi", "mirch", "teja", "sannam"],
  okra: ["okra", "bhindi", "bhendi", "ladyfinger"],
  brinjal: ["brinjal", "eggplant", "baingan", "vankaya"],
  carrot: ["carrot", "carrots", "gajar"],
  drumstick: ["drumstick", "moringa", "munagakaya"],
  mango: ["mango", "mangoes", "aam"],
  banana: ["banana", "bananas", "arati"],
  grapes: ["grapes", "grape", "draksha"],
  papaya: ["papaya", "boppayi"],
  guava: ["guava", "jama"],
  orange: ["orange", "oranges", "santra", "mandarin"],
  pomegranate: ["pomegranate", "anar", "danimma"],
  paddy: ["paddy", "rice", "basmati", "dhaan", "vari"],
  wheat: ["wheat", "gehu", "godhuma"],
  maize: ["maize", "corn", "makka", "mokka"],
  millet: ["millet", "bajra", "sajja"],
  tur: ["tur", "arhar", "red gram", "kandipappu"],
  urad: ["urad", "black gram", "minapappu"],
  moong: ["moong", "green gram", "pesara"],
  turmeric: ["turmeric", "haldi", "pasupu"],
  coriander: ["coriander", "dhaniya", "dhaniyalu"],
};

function matchedCrop(query: string, listings: Listing[]): Listing[] {
  // Single-word aliases match whole words only ("rice" must not fire
  // inside "price", "aam" must not fire inside "name").
  const tokens = new Set(
    query
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean),
  );
  const q = ` ${query.toLowerCase()} `;
  const hits = new Set<string>();
  for (const [crop, aliases] of Object.entries(CROP_ALIASES)) {
    if (
      aliases.some((a) => (a.includes(" ") ? q.includes(a) : tokens.has(a)))
    ) {
      hits.add(crop);
    }
  }
  if (hits.size === 0) {
    for (const l of listings) {
      for (const w of words(`${l.variety} ${l.category}`)) {
        if (q.includes(w)) {
          const canon =
            Object.keys(CROP_ALIASES).find((c) =>
              CROP_ALIASES[c].some((a) => w.includes(a) || a.includes(w)),
            ) ?? w;
          hits.add(canon);
        }
      }
    }
  }
  if (hits.size === 0) return [];
  const pool = [...hits].join(" ");
  return listings.filter((l) => {
    const hayWords = new Set(words(`${l.variety} ${l.category}`));
    const hay = `${l.variety} ${l.category}`.toLowerCase();
    // Short tokens match whole words only ("tur" must not fire on "Guntur").
    return pool
      .split(" ")
      .some(
        (token) =>
          hayWords.has(token) || (token.length > 4 && hay.includes(token)),
      );
  });
}

/** Best seller for free-text queries: most word overlap with the listing. */
function relatedSeller(query: string, listings: Listing[]): Listing | null {
  const q = new Set(words(query));
  if (q.size === 0) return null;
  let best: Listing | null = null;
  let bestScore = 0;
  for (const l of listings) {
    const hay = new Set(words(`${l.variety} ${l.category} ${l.farmer} ${l.village}`));
    let score = 0;
    for (const w of q) if (hay.has(w)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = l;
    }
  }
  return bestScore > 0 ? best : null;
}

const cheapestFirst = (ls: Listing[]) =>
  [...ls].sort((a, b) => a.price - b.price);

// Longest phrases first so "Red Gram" wins over "Red".
const LEADING_WORDS =
  "Thompson Seedless|Allahabad Safeda|Nagpur Mandarin|Banganapalli|Guntur Sannam|Guntur Teja|Sona Masoori|Pearl Millet|Black Gram|Red Gram|Green Moong Dal|Jyoti Red|Red Lady|Hybrid|Desi|Tender|Purple|Nantes|Green|Snowball|Bhagwa|Red|Yelakki|Yellow|Salem|Lokwan";

const cropLabel = (ls: Listing[]) => {
  if (ls.length === 0) return "produce";
  const short = ls[0].variety
    .replace(new RegExp(`^(${LEADING_WORDS})\\b\\s*`), "")
    .trim();
  return !short || short.startsWith("(") ? ls[0].variety : short;
};

const OUT_OF_SCOPE =
  "I can directly answer questions about crop prices, stock availability, delivery charges, order tracking, payments, and how to sell. For anything else, please contact a human:";

export function answerQuery(
  raw: string,
  listings: Listing[] = demoListings,
): AssistantReply {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { blocks: [text("Please type a question first — for example, “Paddy prices”.")] };
  }
  // Strip a leading greeting so "hi, price of tomato?" still matches price.
  const query = trimmed
    .replace(/^(hi+|hello|hey|namaste|namaskar|good\s?(morning|afternoon|evening)|yo)\b[,.!\s]*/i, "")
    .trim();
  const greeted = query.length !== trimmed.trim().length;
  const q = query.toLowerCase();
  if (!query) {
    return {
      blocks: [
        text(
          "Namaste! I’m the AgriLink assistant. Ask me about crop prices, stock, delivery charges, tracking an order, payments, or how to sell your produce.",
        ),
      ],
    };
  }

  const has = (...patterns: RegExp[]) => patterns.some((p) => p.test(q));
  const prefix = greeted ? "Namaste! " : "";

  if (has(/\b(thank|thanks|dhanyavad|shukriya)\b/)) {
    return { blocks: [text(`${prefix}You’re welcome! Happy trading on AgriLink.`)] };
  }

  if (has(/\btrack|\border status|where.*order|my order|delivery status|dispatch status/)) {
    return {
      blocks: [
        text(
          `${prefix}Every order moves through: Placed → Confirmed by farmer → Harvest & pack → Handed to transporter → In transit → Delivered. Open your order from the Orders page to see its live stage and collection window. If a stage looks stuck for more than a day, contact the admin below.`,
        ),
        { kind: "admin" },
      ],
    };
  }

  if (has(/\b(pay|payment|upi|card|cod|cash|refund|gateway)\b/)) {
    return {
      blocks: [
        text(
          `${prefix}This demo checkout supports UPI (any yourname@upi ID), Card, and Cash on Delivery — no real money moves and nothing is stored. UPI/Card run a simulated payment; COD places the order with cash collected at delivery.`,
        ),
      ],
    };
  }

  if (has(/\b(deliver|delivery|shipping|shipment|transport|dispatch|courier|charge|fee)\b/)) {
    return {
      blocks: [
        text(
          `${prefix}Delivery is platform-coordinated and capped between ₹50 and ₹200 per order, based on farm distance and load weight. The exact estimate shows on every listing and in your cart before you pay. Slots are Tomorrow 9–12 or Tomorrow 2–5.`,
        ),
      ],
    };
  }

  if (has(/\b(ai match|opportunit|net profit|who.*(buy|buyer)|match.*(buyer|farm)|coordination)\b/)) {
    return {
      blocks: [
        text(
          `${prefix}Open AI Match (/ai): describe produce or demand in plain language. The agent structures your profile, ranks multi-criteria matches, shows farmer net after logistics, and suggests a multi-stop route across top buyers.`,
        ),
      ],
    };
  }

  if (has(/\b(sell|selling|list|listing|publish|become.*seller|add.*(crop|produce|stock)|farmer.*(join|register))\b/)) {
    return {
      blocks: [
        text(
          `${prefix}Fastest path: open AI Match and type something like “200 kg Grade-A tomatoes near Warangal, want ₹28/kg this week” — then publish. Or use Sell produce → New listing for the full form.`,
        ),
      ],
    };
  }

  if (has(/\b(price|prices|cost|rate|rates|bhav|mandi|how much|worth|cheapest)\b/)) {
    const match = matchedCrop(query, listings);
    if (match.length > 0) {
      const top = cheapestFirst(match).slice(0, 3);
      const lines = top.map(
        (l, i) =>
          `${i + 1}. ${l.variety} — ${formatCurrency(l.price)}/${l.unit} from ${l.farmer} (${l.village}), ${formatQuantity(l.quantity, l.unit)} in stock`,
      );
      return {
        blocks: [
          text(
            `${prefix}${cropLabel(match)} starts at ${formatCurrency(top[0].price)}/${top[0].unit} right now:\n${lines.join("\n")}\nTap a seller card below for the best option.`,
          ),
          { kind: "seller", listingId: top[0].id },
        ],
      };
    }
    return {
      blocks: [
        text(
          `${prefix}Which crop’s price do you want? Try “Paddy prices”, “Tomato price”, “Onion rate”, or “Mango price” and I’ll pull live numbers from the market board.`,
        ),
      ],
    };
  }

  if (has(/\b(stock|available|availability|in stock|have|left|quantity|quantities)\b/)) {
    const match = matchedCrop(query, listings);
    if (match.length > 0) {
      const totalQty = match.reduce((s, l) => s + l.quantity, 0);
      const best = cheapestFirst(match)[0];
      return {
        blocks: [
          text(
            `${prefix}Yes — ${formatQuantity(totalQty, best.unit)} of ${cropLabel(match).toLowerCase()} is live across ${match.length} listing${match.length > 1 ? "s" : ""}. Best value: ${best.variety} at ${formatCurrency(best.price)}/${best.unit} from ${best.farmer} (${best.village}).`,
          ),
          { kind: "seller", listingId: best.id },
        ],
      };
    }
    return {
      blocks: [
        text(
          `${prefix}${listings.length} listings are live right now across Vegetables, Fruits, Grains, Pulses and Spices. Name a crop — e.g. “Is paddy in stock?” — and I’ll check quantities for you.`,
        ),
      ],
    };
  }

  if (has(/\b(contact|human|agent|call|phone|number|support|email|talk to|person|help)\b/)) {
    return {
      blocks: [
        text(
          `${prefix}I handle prices, stock, delivery, orders, payments and selling. For anything else, here’s the market admin — please contact them directly:`,
        ),
        { kind: "admin" },
      ],
    };
  }

  // Fallback: related seller when the query names one, else admin.
  const seller = relatedSeller(query, listings);
  if (seller) {
    return {
      blocks: [
        text(
          `${prefix}${OUT_OF_SCOPE}\nSince you asked about “${trimmed}”, this ${seller.category.toLowerCase()} seller looks most relevant — please contact them:`,
        ),
        { kind: "seller", listingId: seller.id },
        { kind: "admin" },
      ],
    };
  }
  return {
    blocks: [text(`${prefix}${OUT_OF_SCOPE}`), { kind: "admin" }],
  };
}
