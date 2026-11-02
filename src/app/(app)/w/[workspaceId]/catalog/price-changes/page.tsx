import { PageContainer } from "@/components/ui/page";
import { CatalogHeader } from "@/features/catalog/header";
import { PriceChangesPage } from "@/features/catalog/price-changes-page";

export default function Page() {
  return (
    <PageContainer>
      <CatalogHeader />
      <PriceChangesPage />
    </PageContainer>
  );
}
