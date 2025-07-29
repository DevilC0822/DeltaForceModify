import React, { useState } from 'react';
import { HeartIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import { addToast } from '@heroui/react';
import type { WeaponModify } from '../types';
import { apiService, ApiError } from '../api';

interface WeaponCardProps {
  weapon: WeaponModify;
}

const WeaponCard: React.FC<WeaponCardProps> = ({ weapon }) => {
  const [copied, setCopied] = useState(false);
  const [likeCount, setLikeCount] = useState(weapon.likeCount || 0);
  const [isLiking, setIsLiking] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(weapon.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
      // 降级方案
      const textArea = document.createElement('textarea');
      textArea.value = weapon.code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLike = async () => {
    if (isLiking || hasLiked) return;

    try {
      setIsLiking(true);
      const result = await apiService.likeWeapon(weapon._id);
      setLikeCount(result.likeCount);
      setHasLiked(true);

      // 显示成功提示
      addToast({
        title: '点赞成功！',
        description: `感谢您为 ${weapon.name} 点赞！`,
        color: 'success',
        timeout: 3000,
      });
    } catch (err: unknown) {
      console.error('点赞失败:', err);

      // 处理已经点赞过的情况
      if (err instanceof ApiError && err.status === 409) {
        setHasLiked(true);
        addToast({
          title: '已经点赞过了',
          description: '您已经为这个武器点过赞了！请为其他武器点赞吧～',
          color: 'secondary',
          timeout: 4000
        });
      } else {
        addToast({
          title: '点赞失败',
          description: '网络错误或服务暂时不可用，请稍后重试',
          color: 'danger',
          timeout: 4000
        });
      }
    } finally {
      setIsLiking(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case '烽火地带':
        return 'bg-gradient-to-r from-orange-500 to-red-500';
      case '全面战场':
        return 'bg-gradient-to-r from-blue-500 to-purple-500';
      default:
        return 'bg-gradient-to-r from-gray-500 to-gray-600';
    }
  };

  const formatPrice = (price: string) => {
    if (!price || price === '-') return '免费';
    return price.includes('元') ? price : `${price}元`;
  };

  const isFirezone = weapon.type === '烽火地带';

  return (
    <div className="group bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl border border-gray-100 hover:border-gray-200 transition-all duration-300 transform hover:-translate-y-1 flex flex-col min-h-[420px]">
      {/* 卡片头部 */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
            {weapon.name}
          </h3>
          {isFirezone && weapon.version && (
            <span className="inline-block px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
              {weapon.version}
            </span>
          )}
        </div>

        <div className={`px-3 py-1 rounded-full text-white text-xs font-medium ${getTypeColor(weapon.type)} flex-shrink-0`}>
          {weapon.type}
        </div>
      </div>

      {/* 武器描述 */}
      <div className="flex-1 mb-4">
        {weapon.description && (
          <p className="text-gray-600 text-sm leading-relaxed line-clamp-3">
            {weapon.description}
          </p>
        )}
      </div>

      {/* 烽火地带特有属性区域 */}
      <div className="mb-4">
        {/* 烽火地带特有属性 */}
        {isFirezone && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {weapon.price && (
              <div className="text-center p-3 bg-green-50 rounded-xl">
                <p className="text-xs text-green-600 mb-1">改装价格</p>
                <p className="text-sm font-semibold text-green-800">
                  {formatPrice(weapon.price)}
                </p>
              </div>
            )}

            {weapon.range && (
              <div className="text-center p-3 bg-blue-50 rounded-xl">
                <p className="text-xs text-blue-600 mb-1">有效射程</p>
                <p className="text-sm font-semibold text-blue-800">
                  {weapon.range}
                </p>
              </div>
            )}
          </div>
        )}

        {/* 烽火地带备注信息 */}
        {isFirezone && weapon.remark && (
          <div className="p-3 bg-yellow-50 rounded-xl border-l-4 border-yellow-400">
            <p className="text-xs text-yellow-600 mb-1">备注</p>
            <p className="text-sm text-yellow-800 line-clamp-2">
              {weapon.remark}
            </p>
          </div>
        )}

        {/* 全面战场填充空间 */}
        {!isFirezone && (
          <div className="h-20"></div>
        )}
      </div>

      {/* 卡片底部固定区域 */}
      <div className="mt-auto">
        {/* 武器代码区域 */}
        <div className="mb-4 p-4 bg-gray-50 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500 font-medium">武器代码</p>
            <button
              onClick={handleCopyCode}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200 ${copied
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200'
                }`}
            >
              {copied ? (
                <div className="flex items-center space-x-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>已复制</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>复制</span>
                </div>
              )}
            </button>
          </div>
          <p className="text-sm font-mono text-gray-800 break-all leading-relaxed select-all">
            {weapon.code}
          </p>
        </div>

        {/* 卡片底部信息 */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center space-x-4 text-xs text-gray-500">
            {isFirezone && weapon.updateTime && (
              <div className="flex items-center space-x-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{weapon.updateTime}</span>
              </div>
            )}

            <div className="flex items-center space-x-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>{weapon.source}</span>
            </div>
          </div>

          <button
            onClick={handleLike}
            disabled={isLiking || hasLiked}
            className={`flex items-center space-x-1 px-2 py-1 rounded-lg transition-all duration-200 ${hasLiked
              ? 'text-red-500 bg-red-50 cursor-not-allowed'
              : isLiking
                ? 'text-blue-500 bg-blue-50 cursor-not-allowed shadow-sm'
                : 'text-gray-400 hover:text-red-500 hover:bg-red-50 active:scale-95'
              }`}
            title={hasLiked ? '已点赞' : isLiking ? '点赞中...' : '点击点赞'}
          >
            {hasLiked ? (
              <HeartSolidIcon className="w-4 h-4" />
            ) : isLiking ? (
              <div className="relative w-4 h-4">
                <div className="absolute inset-0 w-4 h-4 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
              </div>
            ) : (
              <HeartIcon className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">
              {isLiking ? (
                <span className="flex items-center space-x-1">
                  <span className="animate-pulse">点赞中</span>
                </span>
              ) : (
                likeCount
              )}
            </span>
          </button>
        </div>
      </div>

      {/* 悬停效果 */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
    </div>
  );
};

export default WeaponCard; 