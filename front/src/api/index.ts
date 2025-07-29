import type { ApiResponse, ListResponse, SearchParams, WeaponModify } from '../types';

const API_BASE_URL = 'http://localhost:6010/api/modify';

class ApiError extends Error {
  public status: number;
  public code: number;

  constructor(
    message: string,
    status: number,
    code: number
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

class ApiService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      const data: ApiResponse<T> = await response.json();

      if (!response.ok || !data.success) {
        throw new ApiError(
          data.msg || '请求失败',
          response.status,
          data.code || response.status
        );
      }

      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      // 网络错误或其他错误
      throw new ApiError(
        '网络连接失败，请检查网络设置',
        0,
        0
      );
    }
  }

  // 获取武器列表
  async getWeaponList(params: SearchParams = {}): Promise<ListResponse> {
    const searchParams = new URLSearchParams();

    if (params.name) searchParams.append('name', params.name);
    if (params.type) searchParams.append('type', params.type);
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());

    const queryString = searchParams.toString();
    const endpoint = `/list${queryString ? `?${queryString}` : ''}`;

    const response = await this.request<ListResponse>(endpoint);
    return response.data;
  }

  // 获取武器详情
  async getWeaponDetail(id: string): Promise<WeaponModify> {
    const response = await this.request<WeaponModify>(`/detail/${id}`);
    return response.data;
  }

  // 获取所有武器名称
  async getWeaponNames(): Promise<string[]> {
    const response = await this.request<string[]>('/weapon-names');
    return response.data;
  }

  // 武器点赞
  async likeWeapon(weaponId: string): Promise<{
    weaponId: string;
    weaponName: string;
    weaponType: string;
    likeCount: number;
    message: string;
  }> {
    const response = await this.request<{
      weaponId: string;
      weaponName: string;
      weaponType: string;
      likeCount: number;
      message: string;
    }>('/like', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ weaponId }),
    });
    return response.data;
  }
}

export const apiService = new ApiService();
export { ApiError }; 