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
