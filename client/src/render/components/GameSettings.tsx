import clsx from "clsx";
import { Check, CircleCheck, CircleX, Monitor } from "lucide-react";
import React from "react";
import { AppSettings, GameClient } from "../../models/ipc";
import { useLibrary } from "../context/LibraryProvider";
import { useSettings } from "../context/SettingsProvider";
import { formatNumber } from "../util/format";
import { isWindows, lazerExecutableName } from "../util/platform";
import { PathField } from "./PathField";
import { Callout, Divider } from "./ui/Misc";
import { Spinner } from "./ui/Progress";
import { SettingRow, Toggle } from "./ui/Toggle";

const clients: { value: GameClient; name: string; description: string }[] = [
  { value: "stable", name: "osu!stable", description: "The classic client with a Songs folder" },
  { value: "lazer", name: "osu!lazer", description: "The new client, maps are imported into its database" },
];

export const ClientPicker = () => {
  const { settings, detected, update } = useSettings();
  if (!settings) return null;

  const select = (client: GameClient) => {
    const patch: Partial<AppSettings> = { client };
    // Fill in whatever we found so most people are done after one click
    if (client === "stable" && !settings.path && detected?.stable) patch.path = detected.stable;
    if (client === "lazer" && !settings.lazerPath && detected?.lazer) patch.lazerPath = detected.lazer;
    if (client === "lazer" && !settings.lazerExe && detected?.lazerExe) patch.lazerExe = detected.lazerExe;
    update(patch);
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {clients.map(({ value, name, description }) => {
        const selected = settings.client === value;
        const found = value === "stable" ? detected?.stable : detected?.lazer;
        return (
          <button
            key={value}
            type="button"
            onClick={() => select(value)}
            className={clsx(
              "relative flex flex-col items-start rounded-xl border p-4 text-left transition-all",
              selected
                ? "border-accent/60 bg-accent/[0.06] ring-1 ring-accent/40"
                : "border-line bg-surface-sunken/60 hover:border-fg-subtle/40 hover:bg-surface-sunken",
            )}
          >
            <div className="flex w-full items-center justify-between">
              <span className="text-[15px] font-semibold">{name}</span>
              <span
                className={clsx(
                  "flex h-5 w-5 items-center justify-center rounded-full border transition-colors",
                  selected ? "border-accent bg-accent text-white" : "border-fg-subtle/40",
                )}
              >
                {selected && <Check size={12} strokeWidth={3} />}
              </span>
            </div>
            <span className="mt-1 text-xs text-fg-subtle">{description}</span>
            <span className={clsx("mt-3 text-2xs font-medium", found ? "text-success" : "text-fg-subtle")}>
              {detected === null ? "Looking for it..." : found ? "Found on this computer" : "Not found automatically"}
            </span>
          </button>
        );
      })}
    </div>
  );
};

const LibraryState = () => {
  const { library, loading } = useLibrary();
  if (!library) return null;

  if (loading && !library.valid) {
    return (
      <div className="flex items-center gap-2 text-xs text-fg-subtle">
        <Spinner size={14} /> Checking...
      </div>
    );
  }

  return library.valid ? (
    <div className="flex items-center gap-2 text-xs text-success">
      <CircleCheck size={15} />
      Found {formatNumber(library.setCount)} beatmap sets
    </div>
  ) : (
    <div className="flex items-center gap-2 text-xs text-danger">
      <CircleX size={15} />
      {library.problem}
    </div>
  );
};

const StableSettings = ({ settings }: { settings: AppSettings }) => {
  const { detected, update } = useSettings();
  return (
    <>
      <SettingRow
        title="osu! folder"
        description={isWindows ? "The folder with osu!.exe and your Songs folder" : "The osu! folder inside your wine prefix, with osu!.exe and your Songs folder"}
      >
        <LibraryState />
      </SettingRow>
      <PathField
        value={settings.path}
        onChange={(path) => update({ path })}
        detected={detected?.stable}
        dialogTitle="Select your osu! folder"
        placeholder="Choose your osu! folder"
      />

      <Divider className="mt-4" />
      <SettingRow title="Custom Songs folder" description="Only if your Songs folder isn't inside the osu! folder">
        <Toggle checked={settings.altPathEnabled} onChange={(altPathEnabled) => update({ altPathEnabled })} />
      </SettingRow>
      {settings.altPathEnabled && (
        <PathField
          value={settings.altPath}
          onChange={(altPath) => update({ altPath })}
          dialogTitle="Select your Songs folder"
          placeholder="Choose your Songs folder"
        />
      )}

      <Divider className="mt-4" />
      <SettingRow
        title="Download to a temporary folder"
        description="osu! imports new maps one by one while it's open, which can lag the game. Downloads wait in a separate folder instead."
      >
        <Toggle checked={settings.temp} onChange={(temp) => update({ temp })} />
      </SettingRow>
      {settings.temp && (
        <div className="flex flex-col gap-1">
          <PathField
            value={settings.tempPath}
            onChange={(tempPath) => update({ tempPath })}
            dialogTitle="Select a temporary download folder"
            placeholder="bbd-temp next to your Songs folder"
          />
          <SettingRow title="Move into Songs when downloads finish" className="pb-0">
            <Toggle checked={settings.autoTemp} onChange={(autoTemp) => update({ autoTemp })} />
          </SettingRow>
        </div>
      )}
    </>
  );
};

const LazerSettings = ({ settings }: { settings: AppSettings }) => {
  const { detected, update } = useSettings();
  return (
    <>
      <SettingRow title="osu!lazer data folder" description="Where osu!lazer keeps client.realm and your files">
        <LibraryState />
      </SettingRow>
      <PathField
        value={settings.lazerPath}
        onChange={(lazerPath) => update({ lazerPath })}
        detected={detected?.lazer}
        dialogTitle="Select your osu!lazer data folder"
        placeholder="Choose your osu!lazer data folder"
      />

      <Divider className="mt-4" />
      <SettingRow
        title="osu!lazer executable"
        description="Used to hand downloaded maps to the game, and to start it for importing when it's closed"
      />
      <PathField
        value={settings.lazerExe}
        onChange={(lazerExe) => update({ lazerExe })}
        detected={detected?.lazerExe}
        kind="file"
        icon={Monitor}
        dialogTitle={`Select ${lazerExecutableName}`}
        placeholder="Optional"
      />

      <Divider className="mt-4" />
      <SettingRow
        title="Import automatically"
        description="While osu!lazer is open, downloaded maps are imported as soon as they finish. Otherwise they wait until the game is started."
      >
        <Toggle checked={settings.lazerAutoImport} onChange={(lazerAutoImport) => update({ lazerAutoImport })} />
      </SettingRow>

      <Callout tone="info" className="mt-2">
        Collections are written straight into osu!lazer's database, only while the game is closed and after saving a
        backup next to it (client.realm.bbd-backup).
      </Callout>
    </>
  );
};

export const GameSettings = () => {
  const { settings } = useSettings();
  if (!settings) return null;

  return (
    <div className="flex flex-col">
      <ClientPicker />
      <div className="mt-5 flex flex-col gap-1">
        {settings.client === "stable" ? <StableSettings settings={settings} /> : <LazerSettings settings={settings} />}
      </div>
    </div>
  );
};

