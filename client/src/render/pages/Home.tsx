import { CirclePlay, Search } from "lucide-react";
import React from "react";
import { useNavigate } from "react-router-dom";
import { BasicStatus } from "../components/BasicStatus";
import { GameSettings } from "../components/GameSettings";
import { LibraryPanel, PendingNotices } from "../components/LibraryPanel";
import { FindMissingMaps } from "../components/MissingMaps";
import { SampleFilters } from "../components/SampleFilters";
import { Logo } from "../components/layout/Logo";
import { Button } from "../components/ui/Button";
import { Card, PageHeader } from "../components/ui/Card";
import { useLibrary } from "../context/LibraryProvider";

const videoUrl = "https://www.youtube.com/watch?v=_Nuz0TVF1IY";

const Welcome = () => (
  <div className="mx-auto flex max-w-2xl flex-col gap-6 pt-4">
    <div className="flex flex-col items-center text-center">
      <Logo size={56} />
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">Welcome to Batch Beatmap Downloader</h1>
      <p className="mt-2 max-w-md text-[13px] leading-6 text-fg-subtle">
        Download thousands of osu! beatmaps at once, straight into osu!stable or osu!lazer. First, tell us where your
        game is.
      </p>
    </div>
    <Card>
      <GameSettings />
    </Card>
    <div className="flex justify-center">
      <Button variant="ghost" icon={CirclePlay} onClick={() => window.electron.openExternal(videoUrl)}>
        Watch the 60 second guide
      </Button>
    </div>
  </div>
);

export const Home = () => {
  const { library } = useLibrary();
  const navigate = useNavigate();

  if (!library) return null;
  if (!library.valid) return <Welcome />;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Home"
        description="Find maps, fill the gaps in your collections and keep an eye on downloads"
        actions={
          <Button variant="primary" icon={Search} onClick={() => navigate("/search")}>
            Search beatmaps
          </Button>
        }
      />
      <PendingNotices />
      <LibraryPanel />
      <SampleFilters />
      <div className="grid grid-cols-[1fr_320px] items-start gap-5">
        <FindMissingMaps />
        <BasicStatus />
      </div>
    </div>
  );
};
