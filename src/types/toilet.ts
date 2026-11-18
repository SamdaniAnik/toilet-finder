export type Gender = "male" | "female" | "unisex" | "separate" | "accessible";
export type ToiletStatus = "open" | "closed" | "unknown";

/** Lightweight toilet shape used for map pins and lists. */
export type ToiletPin = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  gender: Gender;
  isPaid: boolean;
  priceBdt: number | null;
  status: ToiletStatus;
  statusUpdatedAt: string | null;
  avgRating: number;
  reviewCount: number;
  isVerified: boolean;
  coverPhotoUrl: string | null;
};

export type ToiletPhoto = { id: string; url: string; authorName: string | null; createdAt: string };

export type Review = {
  id: string;
  rating: number;
  cleanliness: number | null;
  safety: number | null;
  water: number | null;
  text: string | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
  isMine: boolean;
  helpfulCount: number;
  /** This visitor already marked it helpful. */
  votedHelpful: boolean;
};

export type Comment = {
  id: string;
  text: string;
  authorName: string | null;
  createdAt: string;
  isMine: boolean;
};

/** Everything the detail page shows. */
export type ToiletDetail = ToiletPin & {
  description: string | null;
  hasWater: boolean | null;
  hasSoap: boolean | null;
  babyChanging: boolean | null;
  confirmCount: number;
  authorName: string | null;
  createdAt: string;
  /** Reports matching the current status in the last 24 h. */
  recentStatusReports: number;
  /** The visitor added this toilet (can't confirm their own). */
  isMine: boolean;
  /** The visitor already confirmed it exists. */
  confirmedByMe: boolean;
  photos: ToiletPhoto[];
  reviews: Review[];
  comments: Comment[];
};

export type SearchResult = {
  toilets: { id: string; name: string; lat: number; lng: number; gender: Gender; isPaid: boolean }[];
  places: { name: string; detail: string; lat: number; lng: number; bbox: [number, number, number, number] | null }[];
};
