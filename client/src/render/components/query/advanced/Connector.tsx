import clsx from "clsx";
import React from "react";
import { ConnectorDetails } from "../../../../models/filter";

interface ConnectorProps {
  id: string;
  details: ConnectorDetails;
  update: (connector: ConnectorDetails) => void;
}

/** Sits between two children of a group: AND/OR for the whole group, and NOT for the child below. */
export const Connector = ({ id, details, update }: ConnectorProps) => {
  const isNot = details.not.includes(id);

  const toggleNot = () =>
    update({
      ...details,
      not: isNot ? details.not.filter((existing) => existing !== id) : [...details.not, id],
    });

  return (
    <div className="flex items-center gap-2 py-1.5 pl-2">
      <div className="inline-flex rounded-md border border-line bg-surface-sunken p-0.5">
        {["AND", "OR"].map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => update({ ...details, type })}
            className={clsx(
              "h-6 rounded px-2.5 text-2xs font-bold tracking-wide transition-colors",
              details.type === type ? "bg-accent text-white shadow-sm" : "text-fg-subtle hover:text-fg",
            )}
          >
            {type}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={toggleNot}
        className={clsx(
          "h-7 rounded-md border px-2.5 text-2xs font-bold tracking-wide transition-colors",
          isNot ? "border-danger/40 bg-danger/15 text-danger" : "border-line text-fg-subtle hover:text-fg",
        )}
      >
        NOT
      </button>
    </div>
  );
};
