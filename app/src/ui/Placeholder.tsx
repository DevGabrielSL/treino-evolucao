export function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <div className="px-4 pb-32">
      <div className="panel p-6 text-center">
        <h1 className="font-display uppercase text-3xl sunset-text">{title}</h1>
        <p className="text-haze mt-2 text-sm">{text}</p>
      </div>
    </div>
  );
}
