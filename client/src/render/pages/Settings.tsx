import Slider from "rc-slider";
import { ArrowDownToLine, Download, Gamepad2, Info, Moon, Paintbrush, Sun } from "lucide-react";
import React, { useEffect, useState } from "react";
import { GameSettings } from "../components/GameSettings";
import { Button } from "../components/ui/Button";
import { Card, PageHeader } from "../components/ui/Card";
import { Callout, Divider } from "../components/ui/Misc";
import { Segmented } from "../components/ui/Segmented";
import { SettingRow } from "../components/ui/Toggle";
import { useSettings } from "../context/SettingsProvider";
import { UpdateInfo } from "../../models/ipc";

const MAX_PARALLEL = 16;

const ParallelDownloads = () => {
  const { settings, update } = useSettings();
  const [value, setValue] = useState(settings?.maxConcurrentDownloads ?? 3);

  useEffect(() => {
    if (settings) setValue(settings.maxConcurrentDownloads);
  }, [settings]);

  return (
    <SettingRow
      title="Parallel downloads"
      description="More can be faster on a good connection. Applies the next time a download starts or resumes."
    >
      <div className="flex w-64 items-center gap-4">
        <Slider
          min={1}
          max={MAX_PARALLEL}
          value={value}
          onChange={(next) => setValue(next as number)}
          onChangeComplete={(next) => update({ maxConcurrentDownloads: next as number })}
        />
        <span className="w-6 text-right text-[13px] font-semibold tabular-nums">{value}</span>
      </div>
    </SettingRow>
  );
};

export const SettingsPage = () => {
  const { settings, update } = useSettings();
  const [version, setVersion] = useState("");
  const [newVersion, setNewVersion] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    window.electron.getVersion().then(setVersion);
    window.electron.getAvailableUpdate().then(setNewVersion);
  }, []);

  if (!settings) return null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Settings" description="Changes are saved automatically" />

      <Card title="Game" description="Which osu! should the maps go to?" icon={Gamepad2}>
        <GameSettings />
      </Card>

      <Card title="Downloads" icon={Download}>
        <ParallelDownloads />
      </Card>

      <Card title="Appearance" icon={Paintbrush}>
        <SettingRow title="Theme">
          <Segmented
            value={settings.theme}
            onChange={(theme) => update({ theme })}
            options={[
              { value: "dark", label: "Dark", icon: Moon },
              { value: "light", label: "Light", icon: Sun },
            ]}
          />
        </SettingRow>
      </Card>

      <Card title="About" icon={Info}>
        {newVersion && (
          <Callout
            tone="info"
            className="mb-4"
            title={`Version ${newVersion.version} is available`}
            action={
              <Button variant="primary" size="sm" icon={ArrowDownToLine} onClick={() => window.electron.openExternal(newVersion.url)}>
                Download
              </Button>
            }
          >
            Install it over this version, your settings stay.
          </Callout>
        )}
        <div className="text-[13px] leading-6 text-fg-muted">
          Batch Beatmap Downloader v{version}, created by nzbasic, with osu!lazer support from keyanare&apos;s fork.
          Beatmaps are served from nzbasic&apos;s Batch Beatmap Downloader server, not from osu! itself.
        </div>
        <Divider className="my-4" />
        <div className="flex gap-2">
          <Button onClick={() => window.electron.openExternal("https://github.com/keyanare/batch-beatmap-downloader")}>
            GitHub
          </Button>
          <Button onClick={() => window.electron.openExternal("https://discord.gg/3nj6cKzynK")}>Discord</Button>
          <Button onClick={() => window.electron.openExternal("https://www.buymeacoffee.com/nzbasic")}>Support the project</Button>
        </div>
      </Card>
    </div>
  );
};
