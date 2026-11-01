"use client";

import { ArrowRight, MessageCircle, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Avatar, EmptyState, Skeleton } from "@/components/ui/misc";
import { PageContainer } from "@/components/ui/page";
import { useChannels } from "@/features/channels/data";
import { useWorkspace } from "@/features/workspace/context";
import { ApiError } from "@/lib/api/errors";
import type { ContactDetail, FieldDefinition } from "@/lib/api/types";
import { formatDate, formatRelative } from "@/lib/i18n/format";
import { useCodeMessage, useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";
import { ConsentCard } from "./consent-card";
import { contactLabel } from "./contacts-page";
import { useContact, useFields, useTags, useUpdateContact } from "./data";
import { FieldInput } from "./field-input";
import { ContactSubmissionsCard } from "./forms";
import { TagChip, tagColorMap } from "./tag";

export function ContactPage({ contactId }: { contactId: string }) {
  const t = useTranslations("contacts");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const contact = useContact(workspace.id, contactId);
  const back = `/w/${workspace.id}/contacts`;

  return (
    <PageContainer className="max-w-3xl space-y-5">
      <Link href={back} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" aria-hidden />
        {t("backToList")}
      </Link>
      {contact.isPending ? (
        <Skeleton className="h-64" />
      ) : contact.isError ? (
        <EmptyState title={contact.error instanceof ApiError && contact.error.status === 404 ? t("notFound") : errorMessage(contact.error)} />
      ) : (
        <Loaded detail={contact.data} />
      )}
    </PageContainer>
  );
}

function Loaded({ detail }: { detail: ContactDetail }) {
  const tInbox = useTranslations("inbox");
  const { can } = useWorkspace();
  const c = detail.contact;
  const writable = can(P.crmWrite);
  const { title, handle } = contactLabel(c, (short) => tInbox("customer", { id: short }));
  return (
    <>
      <NameHeader key={c.displayName ?? ""} detail={detail} title={title} handle={handle} writable={writable} />
      <TagsCard key={c.tags.join("\u0000")} detail={detail} writable={writable} />
      <FieldsCard key={JSON.stringify(c.fields)} detail={detail} writable={writable} />
      <ConsentCard contactId={c.id} writable={writable} />
      <ContactSubmissionsCard contactId={c.id} />
      <ConversationsCard detail={detail} />
    </>
  );
}

function NameHeader({ detail, title, handle, writable }: { detail: ContactDetail; title: string; handle: string | null; writable: boolean }) {
  const t = useTranslations("contacts");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const c = detail.contact;
  const update = useUpdateContact(workspace.id, c.id);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(c.displayName ?? "");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    update.mutate(trimmed ? { displayName: trimmed } : { clearDisplayName: true }, {
      onSuccess: () => {
        setEditing(false);
        toast.success(t("saved"));
      },
      onError: (err) => toast.error(errorMessage(err)),
    });
  };

  return (
    <div className="flex items-start gap-3">
      <Avatar name={title.replace(/^@/, "")} className="size-12 text-base" />
      <div className="min-w-0 flex-1">
        {editing ? (
          <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
            <Field label={t("displayName")} htmlFor="contact-name" className="min-w-48 flex-1" hint={t("displayNameHint")}>
              <Input id="contact-name" dir="auto" maxLength={200} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </Field>
            <Button type="submit" loading={update.isPending}>
              {t("save")}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              {t("cancel")}
            </Button>
          </form>
        ) : (
          <>
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold sm:text-2xl">
              <span dir="auto">{title}</span>
              {writable ? (
                <Button variant="ghost" size="icon-sm" onClick={() => setEditing(true)} aria-label={t("editName")}>
                  <Pencil aria-hidden />
                </Button>
              ) : null}
            </h1>
            <p className="text-sm text-muted-foreground">
              {handle ? (
                <a href={`https://instagram.com/${encodeURIComponent(handle.slice(1))}`} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2" dir="ltr">
                  {handle}
                </a>
              ) : null}
              {handle ? " · " : null}
              {t("since", { date: formatDate(c.createdAt) })}
              {c.lastSeenAt ? ` · ${t("lastSeen", { when: formatRelative(c.lastSeenAt) })}` : null}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function TagsCard({ detail, writable }: { detail: ContactDetail; writable: boolean }) {
  const t = useTranslations("contacts");
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const c = detail.contact;
  const update = useUpdateContact(workspace.id, c.id);
  const tags = useTags(workspace.id);
  const colors = tagColorMap(tags.data);
  const [draft, setDraft] = useState("");
  const save = (next: string[]) => update.mutate({ tags: next }, { onError: (err) => toast.error(errorMessage(err)) });
  const add = (e: FormEvent) => {
    e.preventDefault();
    const name = draft.trim();
    if (!name || c.tags.includes(name)) return setDraft("");
    save([...c.tags, name]);
    setDraft("");
  };
  const suggestions = (tags.data ?? []).map((x) => x.name).filter((n) => !c.tags.includes(n));

  return (
    <Card>
      <CardHeader title={t("tagsTitle")} description={t("tagsHint")} />
      <CardBody className="space-y-3">
        {c.tags.length === 0 ? <p className="text-sm text-muted-foreground">{t("noTags")}</p> : null}
        <ul className="flex flex-wrap gap-1.5" aria-label={t("tagsTitle")}>
          {c.tags.map((name) => (
            <li key={name}>
              <TagChip name={name} color={colors.get(name)} onRemove={writable ? () => save(c.tags.filter((x) => x !== name)) : undefined} />
            </li>
          ))}
        </ul>
        {writable ? (
          <form onSubmit={add} className="flex max-w-sm gap-2">
            <Input aria-label={t("addTag")} placeholder={t("addTagPlaceholder")} list="crm-tag-suggestions" maxLength={50} dir="auto" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <datalist id="crm-tag-suggestions">
              {suggestions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <Button type="submit" variant="outline" loading={update.isPending} disabled={!draft.trim()}>
              <Plus aria-hidden />
              {t("add")}
            </Button>
          </form>
        ) : null}
      </CardBody>
    </Card>
  );
}

function FieldsCard({ detail, writable }: { detail: ContactDetail; writable: boolean }) {
  const t = useTranslations("contacts");
  const errorMessage = useErrorMessage();
  const codeMessage = useCodeMessage();
  const { workspace } = useWorkspace();
  const c = detail.contact;
  const fields = useFields(workspace.id);
  const update = useUpdateContact(workspace.id, c.id);
  const [values, setValues] = useState<Record<string, string>>(c.fields);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const defined = fields.data ?? [];
  const definedKeys = new Set(defined.map((f) => f.key));
  // Values for keys nobody defined (set by automation, or a deleted definition) are kept and shown as text.
  const extra: FieldDefinition[] = Object.keys(c.fields)
    .filter((k) => !definedKeys.has(k))
    .map((k) => ({ id: k, key: k, label: k, type: "text", options: [], sortOrder: 1_000 }));
  const all = [...defined, ...extra];
  const changed = Object.fromEntries(
    [...new Set([...Object.keys(values), ...Object.keys(c.fields)])]
      .filter((k) => (values[k] ?? "") !== (c.fields[k] ?? ""))
      .map((k) => [k, values[k]?.trim() ? values[k]!.trim() : null]),
  );
  const dirty = Object.keys(changed).length > 0;

  const save = (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    update.mutate(
      { fields: changed },
      {
        onSuccess: () => toast.success(t("saved")),
        onError: (err) => {
          if (err instanceof ApiError && err.status === 400) {
            const next: Record<string, string> = {};
            for (const k of Object.keys(changed)) {
              const code = err.field(`fields.${k}`);
              if (code) next[k] = codeMessage(code) ?? t("invalidValue");
            }
            if (Object.keys(next).length) return setErrors(next);
          }
          toast.error(errorMessage(err));
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader
        title={t("fieldsTitle")}
        description={
          <>
            {t("fieldsHint")}{" "}
            <Link href={`/w/${workspace.id}/contacts/fields`} className="text-primary underline underline-offset-2">
              {t("manageFields")}
            </Link>
          </>
        }
      />
      <CardBody>
        {fields.isPending ? (
          <Skeleton className="h-24" />
        ) : all.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noFields")}</p>
        ) : (
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {all.map((f) => (
                <Field key={f.key} label={f.label} htmlFor={`cf-${f.key}`} error={errors[f.key]}>
                  <FieldInput
                    id={`cf-${f.key}`}
                    field={f}
                    value={values[f.key] ?? ""}
                    onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
                    disabled={!writable}
                    invalid={Boolean(errors[f.key])}
                  />
                </Field>
              ))}
            </div>
            {writable ? (
              <Button type="submit" disabled={!dirty} loading={update.isPending}>
                {t("saveFields")}
              </Button>
            ) : null}
          </form>
        )}
      </CardBody>
    </Card>
  );
}

function ConversationsCard({ detail }: { detail: ContactDetail }) {
  const t = useTranslations("contacts");
  const tInbox = useTranslations("inbox");
  const { workspace, can } = useWorkspace();
  const channels = useChannels(workspace.id);
  const names = new Map((channels.data ?? []).map((c) => [c.id, c.username ? `@${c.username}` : (c.displayName ?? "")]));
  return (
    <Card>
      <CardHeader title={t("conversationsTitle")} />
      <CardBody className="p-0 sm:p-0">
        {detail.conversations.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground sm:px-5">{t("noConversations")}</p>
        ) : (
          <ul className="divide-y">
            {detail.conversations.map((v) => {
              const body = (
                <>
                  <MessageCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium" dir="ltr">
                        {names.get(v.channelAccountId) ?? t("instagram")}
                      </span>
                      <Badge>{tInbox(`status.${v.status}` as "status.open")}</Badge>
                    </p>
                    {v.lastMessagePreview ? (
                      <p className="truncate text-sm text-muted-foreground" dir="auto">
                        {v.lastMessagePreview}
                      </p>
                    ) : null}
                  </div>
                  {v.lastInboundAt ? <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(v.lastInboundAt)}</span> : null}
                </>
              );
              return (
                <li key={v.id}>
                  {can(P.inboxRead) ? (
                    <Link href={`/w/${workspace.id}/inbox/${v.id}`} className="flex items-start gap-3 p-4 hover:bg-surface-muted/50 sm:px-5">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex items-start gap-3 p-4 sm:px-5">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
