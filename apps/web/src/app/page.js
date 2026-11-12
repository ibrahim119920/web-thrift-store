import { SiteHeader } from "@/features/landing/site-header";
import { Hero } from "@/features/landing/hero";
import {
  Highlights,
  LatestProducts,
  HowItWorks,
  ConditionGrades,
  SiteFooter,
} from "@/features/landing/sections";
import { getLatestProducts } from "@/services/products";

export default async function HomePage() {
  const products = await getLatestProducts(8);

  return (
    <>
      <SiteHeader />
      <main>
        <Hero products={products} />
        <Highlights />
        <LatestProducts products={products} />
        <HowItWorks />
        <ConditionGrades />
      </main>
      <SiteFooter />
    </>
  );
}
