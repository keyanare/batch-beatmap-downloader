import { ArrowRight, Heart, Music, Sparkles, Star, Wind, Wheat } from "lucide-react";
import React from "react";
import { useNavigate } from "react-router-dom";
import { allFarm, allLoved, allRanked7Star, allRankedOsu, allSotarks, allStream, Node } from "../../models/filter";
import { Card } from "./ui/Card";

interface Preset {
  name: string;
  description: string;
  tree: Node;
  icon: typeof Star;
  gradient: string;
}

const presets: Preset[] = [
  { name: "Ranked osu!", description: "Every ranked standard map", tree: allRankedOsu, icon: Star, gradient: "from-[#ff66ab] to-[#ff8a65]" },
  { name: "Loved", description: "Community favourites", tree: allLoved, icon: Heart, gradient: "from-[#f472b6] to-[#c084fc]" },
  { name: "7★ ranked", description: "For the brave", tree: allRanked7Star, icon: Sparkles, gradient: "from-[#fb923c] to-[#f43f5e]" },
  { name: "Streams", description: "Tagged stream maps", tree: allStream, icon: Wind, gradient: "from-[#38bdf8] to-[#818cf8]" },
  { name: "Farm", description: "Tagged farm maps", tree: allFarm, icon: Wheat, gradient: "from-[#34d399] to-[#22d3ee]" },
  { name: "Sotarks", description: "Ranked maps by Sotarks", tree: allSotarks, icon: Music, gradient: "from-[#a78bfa] to-[#6366f1]" },
];

export const SampleFilters = () => {
  const navigate = useNavigate();

  const load = (preset: Preset) => {
    localStorage.setItem("tree", JSON.stringify(preset.tree));
    navigate("/search");
  };

  return (
    <Card title="Start from a preset" description="Loads a filter you can tweak before searching" icon={Sparkles}>
      <div className="grid grid-cols-3 gap-3">
        {presets.map((preset) => {
          const Icon = preset.icon;
          return (
            <button
              key={preset.name}
              type="button"
              onClick={() => load(preset)}
              className="group relative flex items-center gap-3 overflow-hidden rounded-xl border border-line bg-surface-sunken p-3 text-left transition-all hover:-translate-y-0.5 hover:border-fg-subtle/40 hover:shadow-pop"
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm ${preset.gradient}`}
              >
                <Icon size={18} strokeWidth={2.2} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold">{preset.name}</div>
                <div className="truncate text-xs text-fg-subtle">{preset.description}</div>
              </div>
              <ArrowRight
                size={15}
                className="shrink-0 -translate-x-1 text-fg-subtle opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
              />
            </button>
          );
        })}
      </div>
    </Card>
  );
};
