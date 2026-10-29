"use client";

import { UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/field";
import { Avatar, EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { PageContainer } from "@/components/ui/page";
import { PhoneInput } from "@/components/ui/phone-input";
import { useWorkspace } from "@/features/workspace/context";
import { ApiError } from "@/lib/api/errors";
import { roles, type Member, type PendingInvitation, type WorkspaceRole } from "@/lib/api/types";
import { toPersianDigits } from "@/lib/i18n/digits";
import { formatDate } from "@/lib/i18n/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { P } from "@/lib/permissions";
import { groupMobile, normalizeIranMobile } from "@/lib/phone";
import { useChangeRole, useInvite, useMembers, usePendingInvitations, useRemoveMember, useRevokeInvitation } from "./data";

export function TeamPage() {
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const { workspace, me, can } = useWorkspace();
  const members = useMembers(workspace.id);
  const changeRole = useChangeRole(workspace.id);
  const remove = useRemoveMember(workspace.id);
  const manage = can(P.membersManage);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);
  const fail = (e: unknown) => toast.error(errorMessage(e));
  // Only owners can hand out or take away the owner role (backend: tenancy.owner_only).
  const assignable = roles.filter((r) => r !== "owner" || workspace.role === "owner");

  return (
    <PageContainer>
      <PageHeader
        title={t("team.title")}
        description={t("team.subtitle")}
        action={
          manage ? (
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus aria-hidden />
              {t("team.invite")}
            </Button>
          ) : null
        }
      />
      <Card className="divide-y overflow-hidden">
        {members.isPending ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : members.isError ? (
          <EmptyState title={errorMessage(members.error)} />
        ) : (
          members.data.map((m) => {
            const name = m.displayName || t("team.noName");
            const self = m.userId === me.id;
            return (
              <div key={m.userId} className="flex flex-wrap items-center gap-3 p-4">
                <Avatar name={name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {name} {self ? <span className="text-xs text-muted-foreground">({t("common.you")})</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {m.phone ? <span dir="ltr">{toPersianDigits(groupMobile(m.phone))}</span> : null}
                    {m.phone ? " · " : ""}
                    {t("team.joined", { date: formatDate(m.joinedAt) })}
                  </p>
                </div>
                {manage && !self && (m.role !== "owner" || workspace.role === "owner") ? (
                  <div className="flex items-center gap-2">
                    <label htmlFor={`role-${m.userId}`} className="sr-only">
                      {t("team.changeRole")}
                    </label>
                    <Select
                      id={`role-${m.userId}`}
                      className="h-9 w-40"
                      value={m.role}
                      onChange={(e) => changeRole.mutate({ userId: m.userId, role: e.target.value as WorkspaceRole }, { onError: fail })}
                    >
                      {assignable.map((r) => (
                        <option key={r} value={r}>
                          {t(`roles.${r}`)}
                        </option>
                      ))}
                    </Select>
                    <Button variant="ghost" size="sm" className="text-danger" onClick={() => setRemoving(m)}>
                      {t("team.remove")}
                    </Button>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">{t(`roles.${m.role}` as "roles.owner")}</span>
                )}
              </div>
            );
          })
        )}
      </Card>

      {manage ? <PendingInvitations /> : null}

      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} roles={assignable} />
      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        danger
        title={t("team.remove")}
        body={removing ? t("team.removeConfirm", { name: removing.displayName || t("team.noName") }) : null}
        confirmLabel={t("team.remove")}
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing.userId, { onSuccess: () => setRemoving(null), onError: fail })}
      />
    </PageContainer>
  );
}

function InviteDialog({ open, onClose, roles: options }: { open: boolean; onClose: () => void; roles: WorkspaceRole[] }) {
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const invite = useInvite(workspace.id);
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("agent");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const normalized = normalizeIranMobile(phone);
    if (!normalized) {
      setError(errorMessage(new ApiError(400, { code: "validation.phone.invalid" })));
      return;
    }
    setError(null);
    invite.mutate(
      { phone: normalized, role },
      {
        onSuccess: () => {
          toast.success(t("team.inviteSent"));
          setPhone("");
          onClose();
        },
        onError: (err) => setError(errorMessage(err)),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("team.invite")}
      variant="sheet"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="invite-form" loading={invite.isPending}>
            {t("team.invite")}
          </Button>
        </>
      }
    >
      <form id="invite-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label={t("team.invitePhone")} htmlFor="invite-phone" error={error}>
          <PhoneInput id="invite-phone" required placeholder="0912 000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={Boolean(error)} />
        </Field>
        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-sm font-medium">{t("team.inviteRole")}</legend>
          {options.map((r) => (
            <label key={r} className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
              <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="mt-1 accent-[var(--primary)]" />
              <span>
                <span className="block text-sm font-medium">{t(`roles.${r}`)}</span>
                <span className="block text-xs text-muted-foreground">{t(`roleHints.${r}`)}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </form>
    </Dialog>
  );
}

function PendingInvitations() {
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const { workspace } = useWorkspace();
  const invitations = usePendingInvitations(workspace.id, true);
  const revoke = useRevokeInvitation(workspace.id);
  const [revoking, setRevoking] = useState<PendingInvitation | null>(null);
  const items = invitations.data ?? [];
  if (!invitations.isError && items.length === 0) return null;

  return (
    <section className="mt-6 space-y-2" aria-labelledby="pending-invitations">
      <h2 id="pending-invitations" className="text-sm font-semibold text-muted-foreground">
        {t("team.pending")}
      </h2>
      <Card className="divide-y overflow-hidden">
        {invitations.isError ? (
          <EmptyState title={errorMessage(invitations.error)} />
        ) : (
          items.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium" dir="ltr">
                  <span className="inline-block">{toPersianDigits(i.phone)}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {t(`roles.${i.role}` as "roles.owner")} · {t("team.invitedAt", { date: formatDate(i.createdAt) })} · {t("team.expires", { date: formatDate(i.expiresAt) })}
                </p>
              </div>
              <Button variant="ghost" size="sm" className="text-danger" onClick={() => setRevoking(i)}>
                {t("team.revoke")}
              </Button>
            </div>
          ))
        )}
      </Card>
      <ConfirmDialog
        open={Boolean(revoking)}
        onClose={() => setRevoking(null)}
        danger
        title={t("team.revoke")}
        body={revoking ? t("team.revokeConfirm", { phone: toPersianDigits(revoking.phone) }) : null}
        confirmLabel={t("team.revoke")}
        loading={revoke.isPending}
        onConfirm={() =>
          revoking &&
          revoke.mutate(revoking.id, {
            onSuccess: () => {
              setRevoking(null);
              toast.success(t("team.revoked"));
            },
            onError: (e) => toast.error(errorMessage(e)),
          })
        }
      />
    </section>
  );
}
