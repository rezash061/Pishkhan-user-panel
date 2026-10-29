import { PageContainer } from "@/components/ui/page";
import { CatalogHeader } from "@/features/catalog/header";
import { CategoriesPage } from "@/features/catalog/categories-page";

export default function Page() {
  return (
    <PageContainer>
      <CatalogHeader />
      <CategoriesPage />
    </PageContainer>
  );
}
