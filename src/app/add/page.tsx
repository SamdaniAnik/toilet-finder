import type { Metadata } from "next";
import AddToiletFlow from "@/components/add/AddToiletFlow";

export const metadata: Metadata = { title: "Add a toilet · Toilet Finder" };

export default function AddPage() {
  return <AddToiletFlow />;
}
