import { Download, ListFilter, Search, SearchX, Settings2, SlidersHorizontal, Sparkles } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Group, hasRules, Node, prepareQuery, sampleTree } from "../../models/filter";
import { QueryOrder, SearchSummary } from "../../models/ipc";
import { convertTreeToSimpleMode, treeIsCompatibleWithSimpleMode, treeToText } from "../../models/simple";
import { DownloadSettings } from "../components/DownloadSettings";
import { AdvancedFilter } from "../components/query/AdvancedFilter";
import { QuerySettings } from "../components/query/QuerySettings";
import { ResultTable } from "../components/query/ResultTable";
import { ShareFilter } from "../components/query/ShareFilter";
import { SimpleFilter } from "../components/query/SimpleFilter";
import { Button } from "../components/ui/Button";
import { Card, PageHeader } from "../components/ui/Card";
import { EmptyState } from "../components/ui/Misc";
import { Modal } from "../components/ui/Modal";
import { Segmented } from "../components/ui/Segmented";
import { useLibrary } from "../context/LibraryProvider";
import { useStickyState } from "../hooks/useStickyState";
import { plural } from "../util/format";

const isValidTree = (tree: Node | null | undefined): tree is Node & { group: Group } =>
  Boolean(tree?.group && Array.isArray(tree.group.children));

const hasNestedGroups = (group: Group) => group.children.some((child) => child.group);

/** A short name for a download started from this search. */
const describe = (group: Group) => {
  if (!treeIsCompatibleWithSimpleMode(group)) return "Advanced search";
  const text = treeToText(convertTreeToSimpleMode(group));
  if (!text) return "All beatmaps";
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
};

type Mode = "simple" | "advanced";

export const Query = () => {
  const navigate = useNavigate();
  const { library } = useLibrary();
  const [storedTree, setTree] = useStickyState<Node>(sampleTree, "tree");
  const tree = isValidTree(storedTree) ? storedTree : sampleTree;
  const group = tree.group as Group;

  const [simple, setSimple] = useStickyState(true, "simple");
  const [limit, setLimit] = useState<number>();
  const [order, setOrder] = useState<QueryOrder>();
  const [summary, setSummary] = useState<SearchSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const results = useRef<HTMLDivElement>(null);

  const updateGroup = (next: Group) => setTree({ ...tree, group: next });

  // Simple mode works on a flat list of rules
  useEffect(() => {
    if (!simple) return;
    if (!treeIsCompatibleWithSimpleMode(group)) setSimple(false);
    else if (hasNestedGroups(group)) setTree({ ...tree, group: convertTreeToSimpleMode(group) });
  }, [simple, group, tree, setSimple, setTree]);

  const changeMode = (mode: Mode) => {
    if (mode === "advanced") setSimple(false);
    else if (treeIsCompatibleWithSimpleMode(group)) setSimple(true);
    else setConvertOpen(true);
  };

  const search = async () => {
    setLoading(true);
    try {
      const result = await window.electron.search(prepareQuery(tree), describe(group), limit, order);
      setSummary(result);
      if (result.beatmaps === 0) toast.info("No beatmaps match this filter");
      else setTimeout(() => results.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!library) return null;

  if (!library.valid) {
    return (
      <>
        <PageHeader title="Search" />
        <EmptyState
          icon={Settings2}
          title="Set up your game first"
          description="Tell us where osu! is, so we know which maps you already have and where new ones should go."
          action={
            <Button variant="primary" onClick={() => navigate("/")}>
              Set up
            </Button>
          }
        />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Search"
        description="Build a filter, then download every matching beatmap in one go"
        actions={
          <>
            <ShareFilter
              tree={tree}
              onLoad={(loaded) => {
                setTree(loaded);
                if (loaded.group && !treeIsCompatibleWithSimpleMode(loaded.group)) setSimple(false);
              }}
            />
            <Segmented<Mode>
              value={simple ? "simple" : "advanced"}
              onChange={changeMode}
              options={[
                { value: "simple", label: "Simple", icon: SlidersHorizontal },
                { value: "advanced", label: "Advanced", icon: ListFilter },
              ]}
            />
          </>
        }
      />

      <Card>
        {simple ? <SimpleFilter group={group} onChange={updateGroup} /> : <AdvancedFilter group={group} onChange={updateGroup} />}
      </Card>

      <div className="sticky bottom-4 z-20 flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface-raised/90 px-4 py-3 shadow-pop backdrop-blur">
        <QuerySettings
          limit={limit}
          order={order}
          onChange={(nextLimit, nextOrder) => {
            setLimit(nextLimit);
            setOrder(nextOrder);
          }}
        />
        <Button variant="primary" icon={Search} loading={loading} disabled={!hasRules(tree)} onClick={search}>
          Search
        </Button>
      </div>

      {summary && summary.beatmaps > 0 && (
        <div ref={results} className="flex scroll-mt-4 flex-col gap-5">
          <Card
            title="Download"
            description={`Found ${plural(summary.beatmaps, "beatmap")} in ${plural(summary.sets, "set")}`}
            icon={Download}
          >
            <DownloadSettings summary={summary} />
          </Card>
          <Card title="Results" icon={Sparkles} padding={false}>
            <ResultTable summary={summary} />
          </Card>
        </div>
      )}

      {summary && summary.beatmaps === 0 && (
        <EmptyState icon={SearchX} title="No results" description="Nothing matches this filter. Try loosening it a bit." />
      )}

      <Modal
        open={convertOpen}
        onClose={() => setConvertOpen(false)}
        title="Switch to simple mode?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConvertOpen(false)}>
              Stay in advanced
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                updateGroup(convertTreeToSimpleMode(group));
                setSimple(true);
                setConvertOpen(false);
              }}
            >
              Convert
            </Button>
          </>
        }
      >
        Simple mode only supports rules that all have to match. This filter uses OR, NOT or nested groups, so
        converting it will join everything with AND and drop the NOTs.
      </Modal>
    </div>
  );
};
