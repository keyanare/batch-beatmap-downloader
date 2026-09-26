import { FolderPlus, Plus, X } from "lucide-react";
import React from "react";
import { ConnectorDetails, Group, newId, Node } from "../../../../models/filter";
import { Rule, RuleType } from "../../../../models/rules";
import { Button } from "../../ui/Button";
import { Connector } from "./Connector";
import { FilterRule } from "./Rule";

interface QueryGroupProps {
  group: Group;
  depth?: number;
  onChange: (group: Group) => void;
  onRemove?: () => void;
}

const depthColors = ["#ff66ab", "#b86bff", "#38bdf8", "#34d399", "#fbbf24"];

const defaultRule = (): Node => ({
  id: newId(),
  rule: { type: RuleType.STATUS, value: "ranked", operator: "=", field: "Approved" },
});

const withNewIds = (node: Node): Node => ({
  id: newId(),
  rule: node.rule ? { ...node.rule } : undefined,
  group: node.group ? { connector: { ...node.group.connector, not: [] }, children: node.group.children.map(withNewIds) } : undefined,
});

export const QueryGroup = ({ group, depth = 0, onChange, onRemove }: QueryGroupProps) => {
  const updateChild = (id: string, update: { rule?: Rule; group?: Group }) =>
    onChange({
      ...group,
      children: group.children.map((child) => (child.id === id ? { ...child, ...update } : child)),
    });

  const updateConnector = (connector: ConnectorDetails) => onChange({ ...group, connector });

  const removeChild = (id: string) =>
    onChange({
      ...group,
      connector: { ...group.connector, not: group.connector.not.filter((existing) => existing !== id) },
      children: group.children.filter((child) => child.id !== id),
    });

  const addRule = () => {
    // Start from a copy of the last rule, that's usually what people want to tweak
    const last = [...group.children].reverse().find((child) => child.rule);
    onChange({ ...group, children: [...group.children, last ? withNewIds(last) : defaultRule()] });
  };

  const addGroup = () =>
    onChange({
      ...group,
      children: [
        ...group.children,
        { id: newId(), group: { connector: { type: "AND", not: [] }, children: [defaultRule()] } },
      ],
    });

  const color = depthColors[depth % depthColors.length];

  return (
    <div className="relative rounded-xl border border-line bg-surface-sunken/50 py-2 pl-4 pr-2">
      <div className="absolute bottom-2 left-0 top-2 w-[3px] rounded-full" style={{ backgroundColor: color }} />

      {onRemove && (
        <div className="absolute right-2 top-2">
          <Button variant="ghost" size="sm" icon={X} onClick={onRemove} title="Remove group" />
        </div>
      )}

      <div className="flex flex-col">
        {group.children.map((child, index) => (
          <div key={child.id}>
            {index > 0 && <Connector id={child.id} details={group.connector} update={updateConnector} />}
            {child.group ? (
              <div className="pr-1">
                <QueryGroup
                  group={child.group}
                  depth={depth + 1}
                  onChange={(next) => updateChild(child.id, { group: next })}
                  onRemove={() => removeChild(child.id)}
                />
              </div>
            ) : child.rule ? (
              <div className="group/rule flex items-center gap-2 rounded-lg py-1">
                <FilterRule rule={child.rule} onChange={(rule) => updateChild(child.id, { rule })} />
                {group.children.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={X}
                    onClick={() => removeChild(child.id)}
                    title="Remove rule"
                    className="opacity-0 transition-opacity focus:opacity-100 group-hover/rule:opacity-100"
                  />
                )}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-1">
        <Button variant="ghost" size="sm" icon={Plus} onClick={addRule}>
          Rule
        </Button>
        <Button variant="ghost" size="sm" icon={FolderPlus} onClick={addGroup}>
          Group
        </Button>
      </div>
    </div>
  );
};
