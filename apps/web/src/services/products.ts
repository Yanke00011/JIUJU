import { get } from "./request";
import type { PageResult, Product } from "../types/api";

export const productsApi = {
  findByBarcode: (barcode: string) =>
    get<{ product: Product }>(`/products/barcode/${barcode}`).then(
      (r) => r.product,
    ),

  /** 分页搜索商品（按条码 / 名称 / 品牌） */
  search: (
    keyword: string,
    params?: { page?: number; pageSize?: number },
  ) =>
    get<PageResult<Product>>("/products", {
      params: { keyword, ...params },
    }),
};
