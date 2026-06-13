/** Danh mục giao dịch (dùng chung cho form thêm/sửa và bộ lọc). */
export const CATEGORIES = [
  'Ăn uống', 'Mua sắm', 'Giáo dục', 'Y tế',
  'Vận chuyển', 'Giải trí', 'Tiền điện nước', 'Thuê nhà', 'Khác',
] as const;

/** Các mốc tiền nhập nhanh (VND) hiển thị dưới ô nhập số tiền. */
export const QUICK_AMOUNTS: { label: string; value: number }[] = [
  { label: '50K', value: 50_000 },
  { label: '100K', value: 100_000 },
  { label: '200K', value: 200_000 },
  { label: '500K', value: 500_000 },
  { label: '1tr', value: 1_000_000 },
  { label: '2tr', value: 2_000_000 },
];
