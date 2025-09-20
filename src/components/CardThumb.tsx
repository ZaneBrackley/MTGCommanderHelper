export default function CardThumb({
  src, alt, href, fit = "contain",
}: { src?: string | null; alt: string; href?: string; fit?: "contain" | "cover";}) {
  const classFit = fit === "cover" ? "object-cover" : "object-contain";
  
  const img = (
    <img
      src={src || ""}
      alt={alt}
      loading="lazy"
      className={`w-full h-full inset-0 rounded-xl border border-neutral-800 bg-neutral-800 ${classFit}`}
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
    />
  );

  // If there is no src, show a grey placeholder
  if (!src) {
    return (
      <div className="w-full h-48 rounded-lg border border-neutral-800 bg-neutral-800 grid place-items-center text-neutral-500 text-xs">
        no image
      </div>
    );
  }

  return href ? (
    <a href={href} target="_blank" rel="noreferrer">{img}</a>
  ) : img;
}
