import { Rule, RuleType } from "./rules";

export interface ConnectorDetails {
  type: string;
  not: string[]
}

export interface Group {
  connector: ConnectorDetails;
  children: Node[];
}

export interface Node {
  id: string;
  group?: Group;
  rule?: Rule;
}

export const newId = () => crypto.randomUUID();

const serverTypes: Record<RuleType, string> = {
  [RuleType.TEXT]: "Text",
  [RuleType.NUMBER]: "Numeric",
  [RuleType.STATUS]: "Text",
  [RuleType.GENRE]: "Text",
  [RuleType.LANGUAGE]: "Text",
  [RuleType.MODE]: "Text",
  [RuleType.DATE]: "Numeric",
  [RuleType.BOOLEAN]: "Numeric",
  [RuleType.TOURNAMENT]: "Text",
  [RuleType.SPECIAL]: "Numeric",
  [RuleType.SLIDER]: "Numeric",
};

// The server ignores the operator for these grouped statuses, so negate them by swapping values instead
const negatedStatus: Record<string, string> = {
  unranked: "HasLeaderboard",
  hasleaderboard: "Unranked",
};

const pruneEmptyGroups = (node: Node): Node | null => {
  if (!node.group) return node;
  const children = node.group.children.map(pruneEmptyGroups).filter((child): child is Node => child !== null);
  if (!children.length) return null;
  return { ...node, group: { ...node.group, children } };
};

/** Converts a filter tree into the shape the server's /filter endpoint expects. */
export const prepareQuery = (node: Node): Node => {
  const clone = pruneEmptyGroups(structuredClone(node));
  if (!clone) throw new Error("Add at least one rule to search");

  const visit = (current: Node) => {
    if (current.rule) {
      const rule = current.rule;
      rule.type = serverTypes[rule.type as RuleType] ?? rule.type;
      if (rule.field === "Approved" && rule.operator === "!=" && negatedStatus[rule.value.toLowerCase()]) {
        rule.value = negatedStatus[rule.value.toLowerCase()];
        rule.operator = "=";
      }
      // The server stores last update dates in seconds
      if (rule.field === "LastUpdate") rule.value = String(Math.floor(Number(rule.value) / 1000));
      // Special tags are separate boolean columns
      if (rule.field === "Special") {
        rule.field = rule.value;
        rule.value = "1";
      }
    }
    current.group?.children.forEach(visit);
  };
  visit(clone);
  return clone;
};

/** Whether a tree has any rules at all. */
export const hasRules = (node: Node): boolean =>
  Boolean(node.rule) || Boolean(node.group?.children.some(hasRules));

export const sampleTree: Node = {
  id: "root",
  group: {
    connector: {
      type: "AND",
      not: [],
    },
    children: [
      {
        id: "1",
        rule: {
          type: RuleType.STATUS,
          value: "ranked",
          operator: "=",
          field: "Approved",
        },
      },
      {
        id: "2",
        rule: {
          type: RuleType.MODE,
          value: "osu!",
          operator: "=",
          field: "Mode",
        },
      },
    ],
  },
};

export const allRankedOsu: Node = {
  id: "root",
  group: {
    connector: {
      type: "AND",
      not: [],
    },
    children: [
      {
        id: "1",
        rule: {
          type: RuleType.STATUS,
          value: "ranked",
          operator: "=",
          field: "Approved",
        },
      },
      {
        id: "2",
        rule: {
          type: RuleType.MODE,
          value: "osu!",
          operator: "=",
          field: "Mode",
        },
      },
    ],
  },
};

export const allLoved: Node = {
  id: "root",
  group: {
    connector: {
      type: "AND",
      not: [],
    },
    children: [
      {
        id: "1",
        rule: {
          type: RuleType.STATUS,
          value: "loved",
          operator: "=",
          field: "Approved",
        },
      },
    ],
  },
};

export const allFarm: Node = {
  id: "root",
  group: {
    connector: {
      type: "AND",
      not: [],
    },
    children: [
      {
        id: "1",
        rule: {
          type: RuleType.MODE,
          value: "osu!",
          operator: "=",
          field: "Mode",
        },
      },
      {
        id: "2",
        rule: {
          type: RuleType.SPECIAL,
          value: "Farm",
          operator: "=",
          field: "Special",
        },
      }
    ],
  },
}

export const allStream: Node = {
  id: "root",
  group: {
    connector: {
      type: "AND",
      not: [],
    },
    children: [
      {
        id: "1",
        rule: {
          type: RuleType.MODE,
          value: "osu!",
          operator: "=",
          field: "Mode",
        },
      },
      {
        id: "2",
        rule: {
          type: RuleType.SPECIAL,
          value: "Stream",
          operator: "=",
          field: "Special",
        },
      }
    ],
  },
}

export const ranked2015: Node = {
  id: "root",
  group: {
    connector: {
      type: "AND",
      not: [],
    },
    children: [
      {
        id: "1",
        rule: {
          type: RuleType.STATUS,
          value: "ranked",
          operator: "=",
          field: "Approved",
        },
      },
      {
        id: "2",
        group: {
          connector: {
            type: "AND",
            not: [],
          },
          children: [
            {
              id: "3",
              rule: {
                type: RuleType.DATE,
                value: "1420023600000",
                operator: ">",
                field: "ApprovedDate",
              },
            },
            {
              id: "4",
              rule: {
                type: RuleType.DATE,
                value: "1451559600000",
                operator: "<",
                field: "ApprovedDate",
              },
            },
          ],
        },
      },
    ],
  },
}

export const allSotarks: Node = {
  id: "root",
  group: {
    connector: {
      type: "AND",
      not: [],
    },
    children: [
      {
        id: "1",
        rule: {
          type: RuleType.STATUS,
          value: "ranked",
          operator: "=",
          field: "Approved",
        },
      },
      {
        id: "2",
        rule: {
          type: RuleType.TEXT,
          value: "Sotarks",
          operator: "=",
          field: "Creator",
        },
      },
    ],
  },
};

export const allRanked7Star: Node = {
  id: "root",
  group: {
    connector: {
      type: "AND",
      not: [],
    },
    children: [
      {
        id: "1",
        rule: {
          type: RuleType.STATUS,
          value: "ranked",
          operator: "=",
          field: "Approved",
        },
      },
      {
        id: "2",
        group: {
          connector: {
            type: "AND",
            not: [],
          },
          children: [
            {
              id: "3",
              rule: {
                type: RuleType.NUMBER,
                value: "7",
                operator: ">=",
                field: "Stars",
              },
            },
            {
              id: "4",
              rule: {
                type: RuleType.NUMBER,
                value: "8",
                operator: "<=",
                field: "Stars",
              },
            },
          ],
        },
      },
    ],
  },
};
