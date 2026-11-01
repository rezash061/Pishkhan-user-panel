import { notFound } from "next/navigation";
import { SegmentEditorPage } from "@/features/contacts/segment-editor";

export default async function Page({ params }: { params: Promise<{ segmentId: string }> }) {
  const { segmentId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(segmentId)) notFound();
  return <SegmentEditorPage segmentId={segmentId} />;
}
