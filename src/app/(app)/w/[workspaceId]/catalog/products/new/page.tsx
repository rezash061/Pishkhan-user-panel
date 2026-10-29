import { ProductEditor } from "@/features/catalog/product-editor";
import { RequirePermission } from "@/features/workspace/require-permission";
import { P } from "@/lib/permissions";

export default function Page() {
  return (
    <RequirePermission permission={P.catalogWrite}>
      <ProductEditor />
    </RequirePermission>
  );
}
