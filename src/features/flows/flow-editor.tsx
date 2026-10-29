"use client";

import { AlertTriangle, Bell, Bot, Clock, Flag, GitFork, HelpCircle, LayoutGrid, MessageCircle, Pencil, Play, Plus, Rocket, Trash2, Zap, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/field";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { PageContainer } from "@/components/ui/page";
import { useFlow, usePublishFlow, useSaveFlow } from "@/features/automations/data";
import { renderSample } from "@/features/automations/model";
import { useWorkspace } from "@/features/workspace/context";
import { ApiError } from "@/lib/api/errors";
import type { Flow, FlowGraph, FlowNode, FlowNodeType } from "@/lib/api/types";
import { flowNodeTypes } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { toPersianDigits } from "@/lib/i18n/digits";
import { formatNumber } from "@/lib/i18n/format";
import { useCodeMessage, useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";
import { FlowStatus } from "./flows-page";
import { addNode, changeType, connect, edgeFrom, handlesFor, issuesByNode, readingOrder, removeNode, splitDelay, updateNode } from "./model";
import { NodeInspector } from "./node-inspector";

export const nodeIcons: Record<string, LucideIcon> = {
  message: MessageCircle,
  question: HelpCircle,
  condition: GitFork,
  delay: Clock,
  storefront: LayoutGrid,
  action: Zap,
  ai: Bot,
  end: Flag,
  follow_gate: Bell,
};

export function EditFlow({ flowId }: { flowId: string }) {
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const flow = useFlow(workspace.id, flowId);
  if (flow.isPending)
    return (
      <PageContainer className="space-y-3">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </PageContainer>
    );
  if (flow.isError) return <EmptyState title={errorMessage(flow.error)} />;
  return <FlowEditor key={flow.data.id} flow={flow.data} />;
}

/**
 * Flow builder, list form (plan 3.4: the mobile view is a vertical list with edit sheets). Steps read top to bottom from
 * the start; each exit picks the next step. Validation comes from the server on every save and is shown on the step.
 */
function FlowEditor({ flow }: { flow: Flow }) {
  const t = useTranslations("flows");
  const errorMessage = useErrorMessage();
  const codeMessage = useCodeMessage();
  const { workspace, can } = useWorkspace();
  const ws = workspace.id;
  const writable = can(P.automationWrite);
  const save = useSaveFlow(ws);
  const publish = usePublishFlow(ws);
  const [name, setName] = useState(flow.name);
  const [graph, setGraph] = useState<FlowGraph>(flow.graph);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ node: string; handle: string } | null>(null);

  const change = (next: FlowGraph) => {
    setGraph(next);
    setDirty(true);
  };
  const { ordered, unreachable } = readingOrder(graph);
  const errors = issuesByNode(flow.validation.errors);
  const warnings = issuesByNode(flow.validation.warnings);
  const variables = graph.nodes.filter((n) => n.type === "question" && n.variable).map((n) => n.variable!);
  const editingNode = graph.nodes.find((n) => n.id === editing) ?? null;
  const busy = save.isPending || publish.isPending;

  const saveDraft = async () => {
    const saved = await save.mutateAsync({ id: flow.id, name: name.trim() || flow.name, graph });
    setDirty(false);
    return saved;
  };

  const onSave = () =>
    saveDraft().then(
      (saved) => (saved.validation.errors.length ? toast.warning(t("savedWithErrors")) : toast.success(t("saved"))),
      (e: unknown) => toast.error(errorMessage(e)),
    );

  const onPublish = async () => {
    try {
      const saved = dirty || name !== flow.name ? await saveDraft() : flow;
      if (saved.validation.errors.length) {
        toast.error(t("fixBeforePublish"));
        return;
      }
      await publish.mutateAsync(saved.id);
      toast.success(t("publishedToast"));
    } catch (e) {
      toast.error(e instanceof ApiError && e.status === 422 ? t("fixBeforePublish") : errorMessage(e));
    }
  };

  const generalErrors = errors.get(null) ?? [];

  return (
    <PageContainer className="max-w-3xl">
      <div className="mb-4 space-y-3">
        <Link href={`/w/${ws}/automations/flows`} className="text-sm text-muted-foreground hover:text-foreground">
          {t("title")}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label={t("name")}
            className="h-10 min-w-0 flex-1 text-base font-semibold"
            dir="auto"
            maxLength={100}
            disabled={!writable}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setDirty(true);
            }}
          />
          {writable ? (
            <>
              <Button variant="outline" onClick={() => void onSave()} loading={save.isPending && !publish.isPending} disabled={busy || !dirty}>
                {t("save")}
              </Button>
              <Button onClick={() => void onPublish()} loading={publish.isPending} disabled={busy}>
                <Rocket aria-hidden />
                {t("publish")}
              </Button>
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <FlowStatus flow={flow} />
          {dirty ? <span className="text-[oklch(0.5_0.12_70)] dark:text-warning">{t("unsaved")}</span> : null}
          <span>· {t("steps", { n: formatNumber(graph.nodes.length) })}</span>
        </div>
        {generalErrors.length ? (
          <ul role="alert" className="space-y-1 rounded-xl bg-danger-soft p-3 text-sm text-danger">
            {generalErrors.map((c) => (
              <li key={c}>{codeMessage(c) ?? c}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <ol className="space-y-3">
        {ordered.map((node, i) => (
          <li key={node.id}>
            <NodeCard
              node={node}
              index={i}
              graph={graph}
              isStart={node.id === graph.start}
              errors={errors.get(node.id) ?? []}
              warnings={warnings.get(node.id) ?? []}
              writable={writable}
              onEdit={() => setEditing(node.id)}
              onRemove={() => change(removeNode(graph, node.id))}
              onConnect={(handle, to) => (to === "__new" ? setAdding({ node: node.id, handle }) : change(connect(graph, node.id, handle, to)))}
            />
          </li>
        ))}
      </ol>

      {unreachable.length ? (
        <section className="mt-6 space-y-3" aria-labelledby="unreachable">
          <h2 id="unreachable" className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <AlertTriangle className="size-4" aria-hidden />
            {t("unreachable")}
          </h2>
          {unreachable.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              graph={graph}
              isStart={false}
              errors={errors.get(node.id) ?? []}
              warnings={[]}
              writable={writable}
              onEdit={() => setEditing(node.id)}
              onRemove={() => change(removeNode(graph, node.id))}
              onMakeStart={() => change({ ...graph, start: node.id })}
              onConnect={(handle, to) => (to === "__new" ? setAdding({ node: node.id, handle }) : change(connect(graph, node.id, handle, to)))}
            />
          ))}
        </section>
      ) : null}

      {writable ? (
        <Button variant="outline" className="mt-4" onClick={() => setAdding({ node: "", handle: "" })}>
          <Plus aria-hidden />
          {t("addStep")}
        </Button>
      ) : null}

      <Dialog
        open={Boolean(editingNode)}
        onClose={() => setEditing(null)}
        variant="sheet"
        className="max-w-2xl"
        title={editingNode ? t(`types.${editingNode.type}` as "types.message") : ""}
        footer={
          <Button onClick={() => setEditing(null)} disabled={!editingNode}>
            {t("done")}
          </Button>
        }
      >
        {editingNode ? (
          <NodeInspector
            ws={ws}
            node={editingNode}
            variables={variables}
            disabled={!writable}
            onChange={(patch) => change(updateNode(graph, editingNode.id, patch))}
            onChangeType={(type) => change(changeType(graph, editingNode.id, type))}
          />
        ) : null}
      </Dialog>

      <Dialog open={Boolean(adding)} onClose={() => setAdding(null)} title={t("chooseStep")} variant="sheet">
        <div className="grid gap-2 sm:grid-cols-2">
          {flowNodeTypes.map((type) => {
            const Icon = nodeIcons[type]!;
            return (
              <button
                key={type}
                type="button"
                className="flex items-start gap-3 rounded-xl border p-3 text-start hover:border-primary/50 hover:bg-primary-soft/40"
                onClick={() => {
                  const result = addNode(graph, type as FlowNodeType, adding?.node ? adding : undefined);
                  change(result.graph);
                  setAdding(null);
                  if (type !== "end") setEditing(result.id);
                }}
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="block text-sm font-medium">{t(`types.${type}`)}</span>
                  <span className="block text-xs text-muted-foreground">{t(`typeHints.${type}`)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Dialog>
    </PageContainer>
  );
}

function summary(node: FlowNode, t: ReturnType<typeof useTranslations<"flows">>): string {
  switch (node.type) {
    case "message":
    case "question":
      return renderSample(node.message?.text ?? "") || t("emptyStep");
    case "delay": {
      const { amount, unit } = splitDelay(Number(node.delaySeconds ?? 0));
      return t("waitFor", { amount: formatNumber(amount), unit: t(`units.${unit}`) });
    }
    case "condition":
      return t("conditionSummary", { n: formatNumber(node.conditions?.length ?? 0) });
    case "action":
      return (node.actions ?? []).map((a) => a.tag || a.title || a.field || a.kind).join("، ");
    case "ai":
      return node.goal || t("typeHints.ai");
    case "storefront":
      return node.cardSetId ? t("cardsChosen") : t("emptyStep");
    default:
      return t(`typeHints.${node.type}` as "typeHints.end");
  }
}

function NodeCard({
  node,
  index,
  graph,
  isStart,
  errors,
  warnings,
  writable,
  onEdit,
  onRemove,
  onConnect,
  onMakeStart,
}: {
  node: FlowNode;
  index?: number;
  graph: FlowGraph;
  isStart: boolean;
  errors: string[];
  warnings: string[];
  writable: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onConnect: (handle: string, to: string | null) => void;
  onMakeStart?: () => void;
}) {
  const t = useTranslations("flows");
  const codeMessage = useCodeMessage();
  const Icon = nodeIcons[node.type] ?? MessageCircle;
  const exits = handlesFor(node.type);
  const label = (n: FlowNode) => `${t(`types.${n.type}` as "types.message")} · ${n.id}`;

  return (
    <Card className={cn("overflow-hidden", errors.length && "border-danger/60")}>
      <div className="flex items-start gap-3 p-3 sm:p-4">
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", errors.length ? "bg-danger-soft text-danger" : "bg-primary-soft text-primary")}>
          <Icon className="size-4" aria-hidden />
        </span>
        <button type="button" className="min-w-0 flex-1 text-start" onClick={onEdit}>
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
            {index !== undefined ? <span className="text-muted-foreground">{toPersianDigits(index + 1)}.</span> : null}
            {t(`types.${node.type}` as "types.message")}
            {isStart ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] text-success">
                <Play className="size-3" aria-hidden />
                {t("start")}
              </span>
            ) : null}
            <span className="font-mono text-[11px] font-normal text-muted-foreground" dir="ltr">
              {node.id}
            </span>
          </p>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground" dir="auto">
            {summary(node, t)}
          </p>
        </button>
        <div className="flex shrink-0 gap-0.5">
          <Button variant="ghost" size="icon-sm" aria-label={t("editStep", { id: node.id })} onClick={onEdit}>
            <Pencil />
          </Button>
          {writable && !isStart ? (
            <Button variant="ghost" size="icon-sm" className="text-danger" aria-label={t("removeStep", { id: node.id })} onClick={onRemove}>
              <Trash2 />
            </Button>
          ) : null}
        </div>
      </div>

      {errors.length || warnings.length ? (
        <ul className="space-y-0.5 px-4 pb-3 text-xs">
          {errors.map((c) => (
            <li key={c} className="text-danger">
              {codeMessage(c) ?? c}
            </li>
          ))}
          {warnings.map((c) => (
            <li key={c} className="text-[oklch(0.5_0.12_70)] dark:text-warning">
              {codeMessage(c) ?? c}
            </li>
          ))}
        </ul>
      ) : null}

      {exits.length || onMakeStart ? (
        <div className="space-y-2 border-t bg-surface-muted/40 px-3 py-2.5 sm:px-4">
          {exits.map((h) => {
            const to = edgeFrom(graph, node.id, h)?.to ?? "";
            return (
              <div key={h} className="flex items-center gap-2 text-sm">
                <span className="w-24 shrink-0 text-xs text-muted-foreground">{t(`handles.${h}` as "handles.next")}</span>
                <Select
                  aria-label={`${node.id}: ${t(`handles.${h}` as "handles.next")}`}
                  className="h-9 min-w-0 flex-1"
                  disabled={!writable}
                  value={to}
                  onChange={(e) => onConnect(h, e.target.value || null)}
                >
                  <option value="">{t("endsHere")}</option>
                  {graph.nodes
                    .filter((n) => n.id !== node.id)
                    .map((n) => (
                      <option key={n.id} value={n.id}>
                        {label(n)}
                      </option>
                    ))}
                  {writable ? <option value="__new">{t("newStepHere")}</option> : null}
                </Select>
              </div>
            );
          })}
          {onMakeStart && writable ? (
            <Button variant="link" size="sm" className="h-auto px-0" onClick={onMakeStart}>
              {t("makeStart")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
