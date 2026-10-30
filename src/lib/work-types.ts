export type OrderStatus = "PENDING" | "PAID" | "PACKED" | "SHIPPED" | "DELIVERED" | "CLOSED";
export const ORDER_STATUSES: OrderStatus[] = ["PENDING", "PAID", "PACKED", "SHIPPED", "DELIVERED", "CLOSED"];
export type OrderChannelFilter = "all" | "online" | "in_store";
