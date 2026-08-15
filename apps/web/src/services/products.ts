import { get } from "./request";
import type { Product } from "../types/api";

export const productsApi = {
  findByBarcode: (barcode: string) =>
    get<{ product: Product }>(`/products/barcode/${barcode}`).then(
      (r) => r.product,
    ),
};
