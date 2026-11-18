"use client";

/** Optional contributor name. Blank = "Anonymous". */
export default function NameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-zinc-900">
        Your name <span className="font-normal text-zinc-500">(optional)</span>
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={60}
        placeholder="Leave blank to post as Anonymous"
        className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-base outline-none focus:border-blue-600"
      />
    </label>
  );
}
