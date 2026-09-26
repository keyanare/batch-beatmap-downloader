import clsx from "clsx";
import { FolderOpen, LucideIcon, WandSparkles } from "lucide-react";
import React from "react";
import { Button } from "./ui/Button";

interface PathFieldProps {
  value: string;
  onChange: (path: string) => void;
  placeholder?: string;
  kind?: "folder" | "file";
  dialogTitle?: string;
  /** Offers to fill in a detected path when it differs from the current value. */
  detected?: string | null;
  icon?: LucideIcon;
  invalid?: boolean;
}

export const PathField = ({ value, onChange, placeholder, kind = "folder", dialogTitle, detected, icon: Icon = FolderOpen, invalid }: PathFieldProps) => {
  const browse = async () => {
    const result =
      kind === "folder"
        ? await window.electron.browseFolder(dialogTitle, value)
        : await window.electron.browseFile(dialogTitle, value);
    if (result) onChange(result);
  };

  return (
    <div className="flex w-full items-center gap-2">
      <button
        type="button"
        onClick={browse}
        title={value || undefined}
        className={clsx(
          "field flex min-w-0 flex-1 items-center gap-2 text-left",
          invalid && "border-danger/50 hover:border-danger/70",
        )}
      >
        <Icon size={15} className="shrink-0 text-fg-subtle" />
        <span className={clsx("truncate", !value && "text-fg-subtle")} dir={value ? "rtl" : undefined}>
          {/* rtl keeps the end of long paths visible; the bdi stops punctuation from jumping around */}
          <bdi>{value || placeholder || "Not set"}</bdi>
        </span>
      </button>
      {detected && detected !== value && (
        <Button variant="secondary" icon={WandSparkles} onClick={() => onChange(detected)} title={detected}>
          Use detected
        </Button>
      )}
      <Button variant="secondary" onClick={browse}>
        Browse
      </Button>
    </div>
  );
};
