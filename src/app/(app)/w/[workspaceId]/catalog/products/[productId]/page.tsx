import { notFound } from "next/navigation";
import { EditProduct } from "@/features/catalog/product-editor";

export default async function Page({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(productId)) notFound();
  return <EditProduct productId={productId} />;
}
