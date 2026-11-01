"use client";

import { Hand, RotateCcw, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ChipsInput } from "@/components/ui/chips-input";
import { Field, Textarea } from "@/components/ui/field";
import { useHandoffReason } from "@/features/inbox/handoff-reason";
import { SourceDialog } from "@/features/knowledge/source-dialog";
import { useWorkspace } from "@/features/workspace/context";
import type { SandboxResponse, SandboxTurn } from "@/lib/api/types";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";
import { useSandbox } from "./data";
import { outcomeTone, pct } from "./log-page";
import { TraceView } from "./trace-page";

export type Turn = { id: number; role: "customer"; text: string } | { id: number; role: "agent"; question: string; response: SandboxResponse };

const MAX_HISTORY = 20;

/** The turns sent as history: the customer's words and what the agent actually sent (handoffs send only their message). */
export function toHistory(turns: Turn[]): SandboxTurn[] {
  const out: SandboxTurn[] = [];
  for (const t of turns) {
    if (t.role === "customer") out.push({ role: "customer", text: t.text });
    else if (t.response.messages.length) out.push({ role: "agent", text: t.response.messages.join("\n") });
  }
  return out.slice(-MAX_HISTORY);
}

/**
 * «آزمایش دستیار»: write as a customer and see what the assistant would answer, with the reasoning behind it.
 * A wrong answer can be corrected on the spot by adding a FAQ.
 */
export function AgentTestPage() {
  const t = useTranslations("agent.test");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const sandbox = useSandbox(workspace.id);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const nextId = useRef(1);
  const end = useRef<HTMLDivElement>(null);

  // Braces matter: newer browsers return a promise from scrollIntoView, and React would call it as a cleanup.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [turns.length]);

  const send = (e?: FormEvent) => {
    e?.preventDefault();
    const message = text.trim();
    if (!message || sandbox.isPending) return;
    const history = toHistory(turns);
    const customer: Turn = { id: nextId.current++, role: "customer", text: message };
    setTurns((x) => [...x, customer]);
    setText("");
    sandbox.mutate(
      { text: message, history, tags },
      {
        onSuccess: (response) => setTurns((x) => [...x, { id: nextId.current++, role: "agent", question: message, response }]),
        onError: (err) => {
          // Put the message back so it can be sent again.
          setTurns((x) => x.filter((turn) => turn.id !== customer.id));
          setText(message);
          toast.error(errorMessage(err));
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("intro")}</p>
      <Card>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t("tags")} htmlFor="sandbox-tags" hint={t("tagsHint")} className="min-w-56 flex-1">
              <ChipsInput id="sandbox-tags" values={tags} onChange={setTags} max={20} maxLength={50} />
            </Field>
            <Button variant="outline" disabled={turns.length === 0 || sandbox.isPending} onClick={() => setTurns([])}>
              <RotateCcw aria-hidden />
              {t("reset")}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <div className="max-h-[60dvh] min-h-48 space-y-3 overflow-y-auto bg-surface-muted/40 p-3 sm:p-4" aria-live="polite" aria-label={t("chat")} role="log">
          {turns.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">{t("empty")}</p> : null}
          {turns.map((turn) => (turn.role === "customer" ? <CustomerBubble key={turn.id} text={turn.text} /> : <AgentTurn key={turn.id} question={turn.question} response={turn.response} />))}
          {sandbox.isPending ? <p className="text-sm text-muted-foreground">{t("thinking")}</p> : null}
          <div ref={end} />
        </div>
        <form onSubmit={send} className="flex items-end gap-2 border-t p-3">
          <label htmlFor="sandbox-text" className="sr-only">
            {t("message")}
          </label>
          <Textarea
            id="sandbox-text"
            dir="auto"
            maxLength={1000}
            className="min-h-11 flex-1"
            placeholder={t("placeholder")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
          />
          <Button type="submit" loading={sandbox.isPending} disabled={!text.trim()}>
            <Send aria-hidden />
            {t("send")}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function CustomerBubble({ text }: { text: string }) {
  const t = useTranslations("agent.test");
  return (
    <div className="flex justify-start">
      <p className="max-w-[85%] rounded-2xl rounded-ss-sm bg-surface px-3 py-2 text-sm whitespace-pre-wrap shadow-sm" dir="auto">
        <span className="sr-only">{t("customerSaid")} </span>
        {text}
      </p>
    </div>
  );
}

function AgentTurn({ question, response: r }: { question: string; response: SandboxResponse }) {
  const t = useTranslations("agent.test");
  const tl = useTranslations("agent.log");
  const reasonLabel = useHandoffReason();
  const { can } = useWorkspace();
  const [details, setDetails] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const answer = r.messages.join("\n") || r.suggestedReply || "";

  return (
    <div className="flex flex-col items-end gap-1.5">
      {r.messages.map((m, i) => (
        <p key={i} className="max-w-[85%] rounded-2xl rounded-se-sm bg-primary px-3 py-2 text-sm whitespace-pre-wrap text-primary-foreground" dir="auto">
          <span className="sr-only">{t("agentSaid")} </span>
          {m}
        </p>
      ))}
      {r.outcome !== "sent" ? (
        <div className="max-w-[85%] space-y-1.5 rounded-2xl border border-warning/40 bg-warning-soft/60 px-3 py-2 text-sm">
          <p className="flex items-center gap-1.5 font-medium">
            <Hand className="size-4 text-warning" aria-hidden />
            {r.outcome === "handed_off" ? t("handedOff") : t("failed")}
          </p>
          {r.handoffReason ? <p>{reasonLabel(`ai:${r.handoffReason}`)}</p> : null}
          {r.suggestedReply ? (
            <p className="rounded-xl bg-surface p-2 whitespace-pre-wrap" dir="auto">
              <span className="block text-xs text-muted-foreground">{t("draft")}</span>
              {r.suggestedReply}
            </p>
          ) : null}
          {r.unansweredQuestion ? <p className="text-xs text-muted-foreground">{t("wouldRecord", { question: r.unansweredQuestion })}</p> : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-muted-foreground">
        <Badge tone={outcomeTone[r.outcome as keyof typeof outcomeTone] ?? "neutral"}>{tl.has(`outcomes.${r.outcome}`) ? tl(`outcomes.${r.outcome}` as "outcomes.sent") : r.outcome}</Badge>
        <span>{tl("confidenceLine", { value: pct(r.trace.confidence), threshold: pct(r.trace.threshold) })}</span>
        <button type="button" className="text-primary underline underline-offset-2" aria-expanded={details} onClick={() => setDetails((v) => !v)}>
          {details ? t("hideWhy") : t("why")}
        </button>
        {can(P.knowledgeWrite) ? (
          <button type="button" className="text-primary underline underline-offset-2" onClick={() => setCorrecting(true)}>
            {t("correct")}
          </button>
        ) : null}
      </div>
      {details ? (
        <div className="w-full space-y-4">
          <TraceView trace={r.trace} sandbox />
        </div>
      ) : null}
      {correcting ? <SourceDialog kind="faq" source={null} prefill={{ first: question, second: answer }} onClose={() => setCorrecting(false)} /> : null}
    </div>
  );
}
