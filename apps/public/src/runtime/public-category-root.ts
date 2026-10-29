type RootProduct = {
  is_featured:boolean
  brands:{name:string;slug:string}|null
}

type RootCategory<TProduct extends RootProduct> = {
  slug:string
  name:string
  listings:{slug:string;name:string;thumbnail_url?:string|null;totalCount:number}[]
  homeProducts:TProduct[]
  totalCount:number
  brands?:{slug:string;name:string}[]
  featuredProducts?:TProduct[]
  featuredProductsByBrand?:TProduct[]
}

const ROOT_EMOJI:Record<string,string>={
  'thiet-bi-ve-sinh':'🚿',
  'thiet-bi-bep':'🍳',
  'vat-lieu-nuoc':'💧',
  'gach-op-lat':'🏠',
}
const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function buildSnapshotCategoryRoot<TProduct extends RootProduct>(category:RootCategory<TProduct>,brandSlugs:readonly string[]=[]){
  const brandMap=new Map<string,{slug:string;name:string}>()
  for(const brand of category.brands??category.homeProducts.flatMap(p=>p.brands?[p.brands]:[])){
    if(SLUG.test(brand.slug)&&!brandMap.has(brand.slug))brandMap.set(brand.slug,brand)
  }
  if(brandSlugs.some(slug=>!brandMap.has(slug)))return null
  const defaultFeatured=(category.featuredProducts??category.homeProducts.filter(p=>p.is_featured)).slice(0,8)
  const filterable=category.featuredProductsByBrand??defaultFeatured
  const featuredProducts=brandSlugs.length
    ? filterable.filter(p=>p.brands?.slug&&brandSlugs.includes(p.brands.slug)).slice(0,8)
    : defaultFeatured
  return {
    categoryName:category.name,
    basePath:`/${category.slug}`,
    emojiFallback:ROOT_EMOJI[category.slug]??'🏠',
    bannerUrl:null,
    subcategories:category.listings.map(listing=>({
      id:null,
      name:listing.name,
      slug:listing.slug,
      thumbnail_url:listing.thumbnail_url??null,
      _count:{products:listing.totalCount},
    })),
    featuredProducts,
    filterableFeaturedProducts:filterable,
    brands:[...brandMap.values()].map(brand=>({id:brand.slug,name:brand.name,slug:brand.slug})),
    isFiltered:brandSlugs.length>0,
  }
}
