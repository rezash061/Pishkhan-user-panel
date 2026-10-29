import { PageContainer } from "@/components/ui/page";
import { CatalogHeader } from "@/features/catalog/header";
import { StorefrontCardsPage } from "@/features/catalog/storefront-cards-page";

export default function Page() {
  return (
    <PageContainer>
      <CatalogHeader />
      <StorefrontCardsPage />
    </PageContainer>
  );
}
