import { Group, Node, newId } from "./filter";
import { dropdownMap, DropdownOption, inputOptions, Rule, RuleType } from "./rules";

// "Simple mode": a flat list of rules, edited through form fields and an osu! style text query.

export enum InputType {
  TEXT = "text",
  MIN_MAX = "minmax",
  SLIDER = "slider",
  DROPDOWN = "dropdown",
  SWITCH = "switch",
}

interface InputItemBase {
  key: string;
  label: string;
}

export type TInputItemText = InputItemBase & { type: InputType.TEXT; placeholder?: string };

export interface DropdownValue {
  not: boolean;
  option: DropdownOption;
}

export type TInputItemDropdown = InputItemBase & {
  type: InputType.DROPDOWN;
  options: DropdownOption[];
  /** Selecting this option means "don't filter". */
  empty: string;
  warning?: string;
};

export type TInputItemMinMax = InputItemBase & { type: InputType.MIN_MAX; step: number; unit?: string };

export type TInputItemSlider = InputItemBase & { type: InputType.SLIDER; min: number; max: number; step: number };

export type TInputItemSwitch = InputItemBase & { type: InputType.SWITCH };

export type TInputItem = TInputItemText | TInputItemDropdown | TInputItemMinMax | TInputItemSlider | TInputItemSwitch;

/** Values as the form fields see them. `null` means "not set". */
export type MinMax = [number | null, number | null];
export type ItemValue = string | DropdownValue | MinMax | boolean | undefined;

export interface Section {
  title: string;
  items: TInputItem[];
}

/** Maps text query keys to database fields. */
export const keyMap = new Map<string, string>([
  ["status", "Approved"],
  ["approved", "Approved"],
  ["archetype", "Archetype"],
  ["title", "Title"],
  ["artist", "Artist"],
  ["creator", "Creator"],
  ["mapper", "Creator"],
  ["version", "Version"],
  ["diff", "Version"],
  ["bpm", "Bpm"],
  ["hp", "Hp"],
  ["od", "Od"],
  ["ar", "Ar"],
  ["cs", "Cs"],
  ["keys", "Cs"],
  ["mode", "Mode"],
  ["stars", "Stars"],
  ["star", "Stars"],
  ["sr", "Stars"],
  ["combo", "MaxCombo"],
  ["maxcombo", "MaxCombo"],
  ["length", "HitLength"],
  ["drain", "HitLength"],
  ["hitlength", "HitLength"],
  ["source", "Source"],
  ["tags", "Tags"],
  ["genre", "Genre"],
  ["language", "Language"],
  ["favourites", "FavouriteCount"],
  ["favorites", "FavouriteCount"],
  ["favouritecount", "FavouriteCount"],
  ["plays", "PlayCount"],
  ["playcount", "PlayCount"],
  ["passes", "PassCount"],
  ["passcount", "PassCount"],
  ["special", "Special"],
]);

/** Short names used in the text query, for fields and values. */
const fieldAliases: Record<string, string> = {
  Approved: "status",
  Creator: "creator",
  HitLength: "length",
  MaxCombo: "combo",
  FavouriteCount: "favourites",
  PlayCount: "plays",
  PassCount: "passes",
};

const valueAliases: Record<string, string> = {
  "osu!": "o",
  Taiko: "t",
  "Catch the Beat": "c",
  "osu!mania": "m",
  ranked: "r",
  loved: "l",
  Unranked: "u",
  HasLeaderboard: "leaderboard",
  "video game": "game",
  "hip hop": "hiphop",
};

const aliasToValue: Record<string, string> = Object.fromEntries(
  Object.entries(valueAliases).map(([value, alias]) => [alias, value]),
);

const specialValues = ["Farm", "Stream", "RankedMapper"];

export const getType = (field: string): RuleType => inputOptions.find((option) => option.value === field)?.type ?? RuleType.TEXT;

const isTextField = (field: string) => getType(field) === RuleType.TEXT;

type Side = "min" | "max" | "eq";

const sideOf = (operator: string): Side => {
  if (operator === ">" || operator === ">=") return "min";
  if (operator === "<" || operator === "<=") return "max";
  return "eq";
};

const flatRules = (group: Group) => group.children.filter((child) => child.rule) as (Node & { rule: Rule })[];

const fieldOf = (item: TInputItem) => (item.type === InputType.SWITCH ? "Special" : keyMap.get(item.key.toLowerCase()) ?? item.key);

const rulesFor = (group: Group, item: TInputItem) => {
  const field = fieldOf(item);
  return flatRules(group)
    .map((child) => child.rule)
    .filter((rule) => rule.field === field && (item.type !== InputType.SWITCH || rule.value === item.key));
};

export const getValue = (group: Group, item: TInputItem): ItemValue => {
  const rules = rulesFor(group, item);

  switch (item.type) {
    case InputType.SLIDER:
    case InputType.MIN_MAX: {
      let min: number | null = null;
      let max: number | null = null;
      for (const rule of rules) {
        const value = parseFloat(rule.value);
        if (Number.isNaN(value)) continue;
        if (rule.operator === ">") min = value + item.step;
        else if (rule.operator === ">=") min = value;
        else if (rule.operator === "<") max = value - item.step;
        else if (rule.operator === "<=") max = value;
        else if (rule.operator === "=") return [value, value];
      }
      if (item.type === InputType.SLIDER) return [min ?? item.min, max ?? item.max];
      return [min, max];
    }
    case InputType.TEXT:
      return rules[0]?.value ?? "";
    case InputType.DROPDOWN: {
      const rule = rules[0];
      const option = rule && item.options.find((candidate) => candidate.value === rule.value);
      if (!rule || !option) return { not: false, option: item.options.find((o) => o.value === item.empty) ?? item.options[0] };
      return { not: rule.operator === "!=", option };
    }
    case InputType.SWITCH:
      return rules.length ? rules[0].operator === "=" : undefined;
  }
};

/** Replaces the rules of `field` on the given side with a new rule. */
const withRule = (group: Group, field: string, operator: string, value: string, specialValue?: string): Group => {
  const side = sideOf(operator);
  const children = group.children.filter((child) => {
    const rule = child.rule;
    if (!rule || rule.field !== field) return true;
    if (field === "Special") return rule.value !== specialValue;
    return side !== "eq" && sideOf(rule.operator) !== "eq" && sideOf(rule.operator) !== side;
  });
  children.push({ id: newId(), rule: { field, operator, value, type: getType(field) } });
  return { ...group, children };
};

const withoutRules = (group: Group, field: string, side?: Side, specialValue?: string): Group => ({
  ...group,
  children: group.children.filter((child) => {
    const rule = child.rule;
    if (!rule || rule.field !== field) return true;
    if (specialValue !== undefined) return rule.value !== specialValue;
    return side !== undefined && sideOf(rule.operator) !== side;
  }),
});

const trimNumber = (value: number) => String(Math.round(value * 1000) / 1000);

export const setValue = (group: Group, item: TInputItem, value: ItemValue): Group => {
  const field = fieldOf(item);

  switch (item.type) {
    case InputType.SLIDER:
    case InputType.MIN_MAX: {
      const [min, max] = value as MinMax;
      const isDefaultMin = min === null || (item.type === InputType.SLIDER && min <= item.min);
      const isDefaultMax = max === null || (item.type === InputType.SLIDER && max >= item.max);
      // An exact match rule would stay behind otherwise
      let next = withoutRules(group, field, "eq");
      next = isDefaultMin ? withoutRules(next, field, "min") : withRule(next, field, ">=", trimNumber(min));
      next = isDefaultMax ? withoutRules(next, field, "max") : withRule(next, field, "<=", trimNumber(max));
      return next;
    }
    case InputType.TEXT: {
      const text = (value as string).trim();
      return text ? withRule(group, field, "like", text) : withoutRules(group, field);
    }
    case InputType.DROPDOWN: {
      const { option, not } = value as DropdownValue;
      if (option.value === item.empty && !not) return withoutRules(group, field);
      return withRule(group, field, not ? "!=" : "=", option.value);
    }
    case InputType.SWITCH: {
      if (value === undefined) return withoutRules(group, "Special", undefined, item.key);
      return withRule(group, "Special", value ? "=" : "!=", item.key, item.key);
    }
  }
};

// Text query, e.g. `status=r mode=o stars>=6.5 artist="camellia"`

const quote = (value: string) => (/[\s"]/.test(value) || value === "" ? `"${value.replace(/"/g, "")}"` : value);

const isDefaultRule = (rule: Rule) =>
  (getType(rule.field) === RuleType.SLIDER &&
    ((rule.operator === ">=" && parseFloat(rule.value) <= 0) || (rule.operator === "<=" && parseFloat(rule.value) >= 10))) ||
  (isTextField(rule.field) && rule.value.trim() === "");

export const treeToText = (group: Group) =>
  flatRules(group)
    .map(({ rule }) => rule)
    .filter((rule) => !isDefaultRule(rule))
    .map((rule) => {
      if (rule.field === "Special") return `${rule.value.toLowerCase()}${rule.operator === "!=" ? "=no" : "=yes"}`;
      const key = fieldAliases[rule.field] ?? rule.field.toLowerCase();
      const operator = rule.operator === "like" ? "=" : rule.operator === "not like" ? "!=" : rule.operator;
      const value = valueAliases[rule.value] ?? rule.value;
      return `${key}${operator}${quote(value.toLowerCase())}`;
    })
    .join(" ");

const TERM = /([a-z]+)(<=|>=|==|!=|=|<|>)("[^"]*"?|\S+)/gi;

export interface ParsedText {
  group: Group;
  unknown: string[];
}

const canonicalDropdownValue = (field: string, raw: string) => {
  const options = dropdownMap.get(getType(field)) ?? [];
  const value = aliasToValue[raw] ?? raw;
  return options.find((option) => option.value.toLowerCase() === value.toLowerCase())?.value;
};

/** Parses a text query into a flat group. Unknown terms are reported back instead of silently dropped. */
export const textToTree = (text: string): ParsedText => {
  let group: Group = { connector: { type: "AND", not: [] }, children: [] };
  const unknown: string[] = [];

  // Anything that isn't part of a term is unknown too
  const leftovers = text.replace(TERM, " ").trim();
  if (leftovers) unknown.push(...leftovers.split(/\s+/));

  for (const match of text.matchAll(TERM)) {
    const [term, rawKey, rawOperator, rawValue] = match;
    const key = rawKey.toLowerCase();
    const operator = rawOperator === "==" ? "=" : rawOperator;
    const value = rawValue.replace(/^"|"$/g, "");

    // Special tags, e.g. farm=yes / stream=no
    const special = specialValues.find((candidate) => candidate.toLowerCase() === key);
    if (special) {
      const on = !["no", "false", "0", "n"].includes(value.toLowerCase());
      group = withRule(group, "Special", operator === "!=" ? (on ? "!=" : "=") : on ? "=" : "!=", special, special);
      continue;
    }

    const field = keyMap.get(key);
    if (!field || field === "Special") {
      unknown.push(term);
      continue;
    }

    const type = getType(field);
    if (type === RuleType.TEXT) {
      if (operator !== "=" && operator !== "!=") {
        unknown.push(term);
        continue;
      }
      group = withRule(group, field, operator === "=" ? "like" : "not like", value);
    } else if (type === RuleType.NUMBER || type === RuleType.SLIDER) {
      if (Number.isNaN(parseFloat(value))) {
        unknown.push(term);
        continue;
      }
      group = withRule(group, field, operator, String(parseFloat(value)));
    } else {
      const canonical = canonicalDropdownValue(field, value);
      if (!canonical || (operator !== "=" && operator !== "!=")) {
        unknown.push(term);
        continue;
      }
      group = withRule(group, field, operator, canonical);
    }
  }

  return { group, unknown };
};

export const treeIsCompatibleWithSimpleMode = (group: Group) => {
  if (group.connector.type === "OR" || group.connector.not.length) return false;
  // Nested groups are fine as long as they just wrap rules joined with AND
  const compatible = (node: Node): boolean => {
    if (!node.group) return true;
    if (node.group.connector.not.length) return false;
    if (node.group.connector.type === "OR" && node.group.children.length > 1) return false;
    return node.group.children.every(compatible);
  };
  return group.children.every(compatible);
};

/** Flattens nested groups into a single AND group. Only lossless for compatible trees. */
export const convertTreeToSimpleMode = (group: Group): Group => {
  const children: Node[] = [];
  const collect = (node: Node) => {
    if (node.group) node.group.children.forEach(collect);
    else if (node.rule) children.push({ id: node.id, rule: { ...node.rule } });
  };
  group.children.forEach(collect);
  return { connector: { type: "AND", not: [] }, children };
};

const option = (type: RuleType, value: string) =>
  (dropdownMap.get(type) ?? []).find((candidate) => candidate.value === value) ?? { value, label: value };

export const aboveSection: Section = {
  title: "Above",
  items: [
    {
      type: InputType.DROPDOWN,
      key: "Mode",
      label: "Game mode",
      options: dropdownMap.get(RuleType.MODE) ?? [],
      empty: "any",
      warning: "All game modes",
    },
    {
      type: InputType.DROPDOWN,
      key: "Approved",
      label: "Status",
      options: dropdownMap.get(RuleType.STATUS) ?? [],
      empty: "any",
      warning: "Includes unranked maps",
    },
  ],
};

export const sections: Section[] = [
  {
    title: "Difficulty",
    items: [
      { type: InputType.MIN_MAX, key: "Stars", label: "Star rating", step: 0.01, unit: "★" },
      { type: InputType.MIN_MAX, key: "Bpm", label: "BPM", step: 0.01 },
      { type: InputType.SLIDER, key: "Cs", label: "Circle size", min: 0, max: 10, step: 0.1 },
      { type: InputType.SLIDER, key: "Ar", label: "Approach rate", min: 0, max: 10, step: 0.1 },
      { type: InputType.SLIDER, key: "Od", label: "Overall difficulty", min: 0, max: 10, step: 0.1 },
      { type: InputType.SLIDER, key: "Hp", label: "HP drain", min: 0, max: 10, step: 0.1 },
    ],
  },
  {
    title: "Beatmap",
    items: [
      { type: InputType.TEXT, key: "Artist", label: "Artist", placeholder: "Contains..." },
      { type: InputType.TEXT, key: "Title", label: "Title", placeholder: "Contains..." },
      { type: InputType.TEXT, key: "Creator", label: "Mapper", placeholder: "Contains..." },
      { type: InputType.MIN_MAX, key: "HitLength", label: "Drain length", step: 1, unit: "sec" },
      { type: InputType.MIN_MAX, key: "MaxCombo", label: "Max combo", step: 1 },
    ],
  },
  {
    title: "Metadata",
    items: [
      { type: InputType.DROPDOWN, key: "Genre", label: "Genre", options: dropdownMap.get(RuleType.GENRE) ?? [], empty: "any" },
      {
        type: InputType.DROPDOWN,
        key: "Language",
        label: "Language",
        options: dropdownMap.get(RuleType.LANGUAGE) ?? [],
        empty: "any",
      },
      { type: InputType.MIN_MAX, key: "FavouriteCount", label: "Favourites", step: 1 },
      { type: InputType.MIN_MAX, key: "PlayCount", label: "Play count", step: 1 },
      { type: InputType.MIN_MAX, key: "PassCount", label: "Pass count", step: 1 },
      { type: InputType.TEXT, key: "Source", label: "Source", placeholder: "Contains..." },
      { type: InputType.TEXT, key: "Tags", label: "Tags", placeholder: "Contains..." },
    ],
  },
  {
    title: "Special",
    items: [
      {
        type: InputType.DROPDOWN,
        key: "Archetype",
        label: "Tournament slot",
        options: [option(RuleType.TOURNAMENT, "None"), ...(dropdownMap.get(RuleType.TOURNAMENT) ?? []).filter((o) => o.value !== "None")],
        empty: "None",
      },
      { type: InputType.SWITCH, key: "Farm", label: "Farm maps" },
      { type: InputType.SWITCH, key: "Stream", label: "Stream maps" },
      { type: InputType.SWITCH, key: "RankedMapper", label: "By a ranked mapper" },
    ],
  },
];
