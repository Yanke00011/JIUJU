import type { Product } from '@prisma/client';

/**
 * 对外返回的 Product。
 * 将 Prisma Decimal 转换为 number（JSON 序列化时 Decimal 会变成字符串）。
 */
export interface ProductDto {
  id: string;
  barcode: string;
  name: string;
  brand: string | null;
  category: Product['category'];
  volumeMl: number;
  alcoholPercent: number | null;
}

export function toProductDto(product: Product): ProductDto {
  return {
    id: product.id,
    barcode: product.barcode,
    name: product.name,
    brand: product.brand,
    category: product.category,
    volumeMl: product.volumeMl,
    alcoholPercent: product.alcoholPercent === null ? null : Number(product.alcoholPercent),
  };
}
