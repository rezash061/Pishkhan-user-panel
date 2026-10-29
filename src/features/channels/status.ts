export function channelTone(status: string): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "active":
      return "success";
    case "token_expiring":
    case "connecting":
      return "warning";
    case "reauth_required":
      return "danger";
    default:
      return "neutral";
  }
}
