import { ArrowDownToLine, RotateCw } from "lucide-react";
import React, { useState } from "react";
import { UpdateInfo } from "../../models/ipc";
import { useUpdate } from "../hooks/useUpdate";
import { Button } from "./ui/Button";
import { Callout } from "./ui/Misc";
import { Spinner } from "./ui/Progress";

const named = (update: UpdateInfo) => (update.version ? `Version ${update.version}` : "A new version");

const RestartButton = ({ size = "sm" }: { size?: "sm" | "md" }) => {
  const [restarting, setRestarting] = useState(false);
  return (
    <Button
      variant="primary"
      size={size}
      icon={RotateCw}
      loading={restarting}
      onClick={() => {
        setRestarting(true);
        window.electron.installUpdate();
      }}
    >
      Restart to update
    </Button>
  );
};

/** The full notice, for the settings page. */
export const UpdateCallout = ({ className }: { className?: string }) => {
  const update = useUpdate();
  if (!update) return null;

  if (update.state === "downloading") {
    return (
      <Callout tone="info" className={className} title={`${named(update)} is downloading`}>
        It installs by itself when it&apos;s done, you can keep using the app.
      </Callout>
    );
  }

  if (update.state === "ready") {
    return (
      <Callout tone="success" className={className} title={`${named(update)} is ready`} action={<RestartButton />}>
        Restart now, or it&apos;s used the next time you open the app. Downloads carry on after restarting.
      </Callout>
    );
  }

  return (
    <Callout
      tone="info"
      className={className}
      title={`${named(update)} is available`}
      action={
        <Button variant="primary" size="sm" icon={ArrowDownToLine} onClick={() => window.electron.openExternal(update.url)}>
          Download
        </Button>
      }
    >
      Install it over this version, your settings stay.
    </Callout>
  );
};

/** A compact version for the sidebar. */
export const UpdatePill = () => {
  const update = useUpdate();
  if (!update) return null;

  if (update.state === "downloading") {
    return (
      <div className="flex animate-fade-in items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-xs text-fg-muted">
        <Spinner size={13} />
        Downloading update{update.version ? ` ${update.version}` : ""}
      </div>
    );
  }

  if (update.state === "ready") {
    return (
      <div className="flex animate-fade-in flex-col gap-2 rounded-xl border border-success/30 bg-success/[0.07] p-3">
        <span className="text-xs font-medium text-fg">Update{update.version ? ` ${update.version}` : ""} is ready</span>
        <RestartButton />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => window.electron.openExternal(update.url)}
      className="flex animate-fade-in items-center gap-2 rounded-xl border border-accent/30 bg-accent/[0.07] px-3 py-2.5 text-left text-xs font-medium text-fg transition-colors hover:bg-accent/[0.12]"
    >
      <ArrowDownToLine size={14} className="text-accent" />
      {named(update)} is available
    </button>
  );
};
