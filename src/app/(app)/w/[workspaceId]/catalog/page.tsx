import { PageContainer } from "@/components/ui/page";
import { CatalogHeader } from "@/features/catalog/header";
import { ProductsPage } from "@/features/catalog/products-page";

export default function Page() {
  return (
    <PageContainer>
      <CatalogHeader />
      <ProductsPage />
    </PageContainer>
  );
}
