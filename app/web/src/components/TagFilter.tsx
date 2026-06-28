import { Tag } from "../api/tags";

interface Props {
  tags: Tag[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}

export default function TagFilter({ tags, selected, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(null)}
        className={`text-xs px-3 py-1 rounded-full font-medium border transition-colors ${
          selected === null
            ? "bg-gray-900 text-white border-gray-900"
            : "text-gray-600 border-gray-300 hover:border-gray-500"
        }`}
      >
        All
      </button>
      {tags.map((tag) => (
        <button
          key={tag.id}
          onClick={() => onSelect(selected === tag.id ? null : tag.id)}
          style={selected === tag.id ? { backgroundColor: tag.color, borderColor: tag.color, color: "#fff" } : { borderColor: tag.color, color: tag.color }}
          className="text-xs px-3 py-1 rounded-full font-medium border transition-colors"
        >
          {tag.name}
          {tag._count && <span className="ml-1 opacity-70">({tag._count.assets})</span>}
        </button>
      ))}
    </div>
  );
}
