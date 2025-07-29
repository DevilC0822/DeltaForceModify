// 武器修改数据类型
export interface WeaponModify {
  _id: string;
  name: string;
  version: string;
  price: string;
  description: string;
  code: string;
  range: string;
  remark: string;
  updateTime: string;
  source: string;
  type: '烽火地带' | '全面战场';
  likeCount: number;
  createdAt: string;
  updatedAt: string;
}

// 分页信息类型
export interface Pagination {
  current: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// API响应类型
export interface ApiResponse<T> {
  success: boolean;
  code: number;
  msg: string;
  data: T;
}

// 列表响应类型
export interface ListResponse {
  list: WeaponModify[];
  pagination: Pagination;
  filters: {
    name: string;
    type: string;
  };
}

// 搜索参数类型
export interface SearchParams {
  name?: string;
  type?: string;
  page?: number;
  limit?: number;
} 