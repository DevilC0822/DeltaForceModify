import { useState, useEffect, useCallback } from 'react';
import SearchBar from './components/SearchBar';
import WeaponCard from './components/WeaponCard';
import { apiService, ApiError } from './api';
import type { WeaponModify, SearchParams } from './types';

function App() {
  // 状态管理
  const [weapons, setWeapons] = useState<WeaponModify[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchParams, setSearchParams] = useState<SearchParams>({});

  const ITEMS_PER_PAGE = 9;

  // 加载武器数据
  const loadWeapons = useCallback(async (params: SearchParams, isLoadMore = false) => {
    try {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError('');
      }

      const response = await apiService.getWeaponList({
        ...params,
        page: isLoadMore ? currentPage + 1 : 1,
        limit: ITEMS_PER_PAGE
      });

      if (isLoadMore) {
        setWeapons(prev => [...prev, ...response.list]);
        setCurrentPage(prev => prev + 1);
      } else {
        setWeapons(response.list);
        setCurrentPage(1);
      }

      setHasMore(response.pagination.hasNextPage);
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : '加载数据失败，请重试';
      setError(errorMessage);
      if (!isLoadMore) {
        setWeapons([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [currentPage]);

  // 初始加载
  useEffect(() => {
    loadWeapons({});
  }, []);

  // 搜索处理
  const handleSearch = useCallback((name: string, type: string) => {
    const newParams: SearchParams = {};
    if (name) newParams.name = name;
    if (type) newParams.type = type;

    setSearchParams(newParams);
    setCurrentPage(1);
    loadWeapons(newParams);
  }, [loadWeapons]);

  // 加载更多
  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      loadWeapons(searchParams, true);
    }
  }, [loadWeapons, loadingMore, hasMore, searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* 顶部装饰 */}
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-blue-500/10 to-purple-500/10 blur-3xl"></div>

      <div className="relative">
        {/* 头部 */}
        <header className="text-center py-12 px-4">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
              三角洲行动
            </h1>
            <p className="text-xl text-gray-600 mb-2">武器改装配置</p>
            <p className="text-sm text-gray-500">专业的武器配置方案，点击复制武器代码到游戏中使用</p>
          </div>
        </header>

        {/* 主要内容 */}
        <main className="max-w-6xl mx-auto px-4 pb-12 isolate">
          {/* 搜索栏 */}
          <div className="mb-8">
            <SearchBar onSearch={handleSearch} loading={loading} />
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4">
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-700">{error}</p>
                <button
                  onClick={() => loadWeapons(searchParams)}
                  className="ml-auto text-red-600 hover:text-red-800 font-medium text-sm"
                >
                  重试
                </button>
              </div>
            </div>
          )}

          {/* 加载状态 */}
          {loading && (
            <div className="flex justify-center items-center py-20">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">正在加载武器数据...</p>
              </div>
            </div>
          )}

          {/* 武器卡片网格 */}
          {!loading && weapons.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {weapons.map((weapon) => (
                  <WeaponCard
                    key={weapon._id}
                    weapon={weapon}
                  />
                ))}
              </div>

              {/* 加载更多按钮 */}
              {hasMore && (
                <div className="text-center">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-medium py-4 px-8 rounded-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    {loadingMore ? (
                      <div className="flex items-center space-x-3">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>加载中...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span>加载更多</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                      </div>
                    )}
                  </button>
                </div>
              )}

              {/* 到底提示 */}
              {!hasMore && weapons.length > 0 && (
                <div className="text-center py-8">
                  <div className="inline-flex items-center space-x-2 text-gray-500">
                    <div className="w-12 h-px bg-gray-300"></div>
                    <span className="text-sm">已显示全部数据</span>
                    <div className="w-12 h-px bg-gray-300"></div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* 空状态 */}
          {!loading && weapons.length === 0 && !error && (
            <div className="text-center py-20">
              <div className="max-w-md mx-auto">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">暂无数据</h3>
                <p className="text-gray-500 mb-6">未找到符合条件的武器配置，请尝试调整搜索条件</p>
                <button
                  onClick={() => handleSearch('', '')}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-6 rounded-xl transition-colors duration-200"
                >
                  查看全部
                </button>
              </div>
            </div>
          )}
        </main>

        {/* 底部 */}
        <footer className="text-center py-8 px-4 border-t border-gray-100 bg-white/50 backdrop-blur-sm">
          <p className="text-gray-500 text-sm">
            © 2024 Delta Force Modify. 数据来源于社区贡献，点击卡片中的复制按钮即可复制武器代码。
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
