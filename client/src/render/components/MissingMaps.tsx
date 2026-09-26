import { Download, Layers, SearchCheck } from "lucide-react";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { MissingMaps } from "../../models/ipc";
import { formatBytes, formatNumber, plural } from "../util/format";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

export const FindMissingMaps = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [missing, setMissing] = useState<MissingMaps | null>(null);

  const check = async () => {
    setLoading(true);
    setMissing(null);
    try {
      setMissing(await window.electron.findMissingMaps());
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const download = async () => {
    setStarting(true);
    try {
      if (await window.electron.downloadMissing()) navigate("/downloads");
      else setStarting(false);
    } catch (error) {
      toast.error((error as Error).message);
      setStarting(false);
    }
  };

  return (
    <Card
      title="Missing maps from your collections"
      description="Downloads maps that are in a collection but not in your library"
      icon={Layers}
      actions={
        <Button icon={SearchCheck} loading={loading} onClick={check}>
          Check collections
        </Button>
      }
    >
      {missing && (
        <div className="flex items-center justify-between gap-4 rounded-xl bg-surface-sunken px-4 py-3">
          <div className="text-[13px] leading-6">
            <div className="font-medium">
              {missing.ids.length
                ? `${plural(missing.ids.length, "beatmap set")} to download (${formatBytes(missing.totalSize)})`
                : "Nothing missing, your collections are complete"}
            </div>
            <div className="text-xs text-fg-subtle">
              Checked {formatNumber(missing.beatmaps)} beatmaps in {plural(missing.collections, "collection")}
              {missing.unavailable > 0 && `, ${formatNumber(missing.unavailable)} aren't on the server`}
            </div>
          </div>
          {missing.ids.length > 0 && (
            <Button variant="primary" icon={Download} loading={starting} onClick={download}>
              Download
            </Button>
          )}
        </div>
      )}
    </Card>
  );
};
