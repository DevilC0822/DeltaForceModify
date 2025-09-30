import { useState, useEffect, useRef } from 'react';
import { apiService, ApiError } from '../api';

interface UploadButtonProps {
  onUploadSuccess?: () => void;
}

export default function UploadButton({ onUploadSuccess }: UploadButtonProps) {
  const [lastImportTime, setLastImportTime] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [currentWeaponName, setCurrentWeaponName] = useState('');
  const [showUploadButton, setShowUploadButton] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const timeUpdateIntervalRef = useRef<number | null>(null);

  // 加载最后上传时间
  const loadLastImportTime = async () => {
    try {
      const result = await apiService.getLastImportTime();
      if (result.hasImport && result.lastImportTime) {
        const date = new Date(result.lastImportTime);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        if (diffHours < 1) {
          setLastImportTime(`${diffMinutes}分钟前更新`);
        } else if (diffHours < 24) {
          setLastImportTime(`${diffHours}小时前更新`);
        } else {
          const diffDays = Math.floor(diffHours / 24);
          setLastImportTime(`${diffDays}天前更新`);
        }
      } else {
        setLastImportTime('暂无数据');
      }
    } catch (error) {
      console.error('获取最后上传时间失败:', error);
      setLastImportTime('未知');
    }
  };

  // 检查localStorage是否允许上传
  const checkUploadPermission = () => {
    const canUpload = localStorage.getItem('canUpload') === 'true';
    setShowUploadButton(canUpload);
  };

  // 轮询检查导入进度
  const checkImportProgress = async () => {
    try {
      const progressData = await apiService.getImportProgress();

      if (progressData.isImporting) {
        setProgress(progressData.progress);
        setProgressMessage(progressData.currentStep);
        setCurrentWeaponName(progressData.currentWeaponName || '');
        return true; // 仍在导入中
      } else {
        // 导入完成
        setProgress(100);
        setProgressMessage('导入完成！');
        setCurrentWeaponName('');
        return false;
      }
    } catch (error) {
      console.error('获取导入进度失败:', error);
      return false;
    }
  };

  // 开始轮询进度
  const startProgressPolling = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    progressIntervalRef.current = window.setInterval(async () => {
      const isStillImporting = await checkImportProgress();

      if (!isStillImporting) {
        // 停止轮询
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }

        // 延迟一下，让用户看到完成消息
        setTimeout(() => {
          setUploading(false);
          setProgress(0);
          setProgressMessage('');
          setCurrentWeaponName('');
          loadLastImportTime(); // 重新加载最后上传时间

          if (onUploadSuccess) {
            onUploadSuccess();
          }
        }, 2000);
      }
    }, 500); // 每0.5秒查询一次进度，提高响应速度
  };

  // 停止轮询
  const stopProgressPolling = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  // 处理文件选择
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      alert('请选择 Excel 文件 (.xlsx 或 .xls)');
      return;
    }

    // 验证文件大小（10MB）
    if (file.size > 10 * 1024 * 1024) {
      alert('文件大小不能超过 10MB');
      return;
    }

    setUploading(true);
    setProgress(0);
    setProgressMessage('正在上传文件...');

    try {
      await apiService.uploadExcel(file);

      // 上传成功后，开始轮询进度
      setProgressMessage('上传成功，正在处理...');
      startProgressPolling();

    } catch (error) {
      if (error instanceof ApiError) {
        alert(error.message);
      } else {
        alert('上传失败，请重试');
      }
      setUploading(false);
      setProgress(0);
      setProgressMessage('');
      setCurrentWeaponName('');
    } finally {
      // 清空文件选择
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 组件挂载时加载最后上传时间
  useEffect(() => {
    loadLastImportTime();
    checkUploadPermission();

    // 监听storage变化（跨标签页同步）
    const handleStorageChange = () => {
      checkUploadPermission();
    };
    window.addEventListener('storage', handleStorageChange);

    // 每10秒更新一次时间显示
    timeUpdateIntervalRef.current = window.setInterval(() => {
      loadLastImportTime();
    }, 10000);

    // 组件卸载时清理
    return () => {
      stopProgressPolling();
      window.removeEventListener('storage', handleStorageChange);
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="flex items-center space-x-4">
      {/* 最后更新时间提示 */}
      <div className="text-sm text-gray-400">
        数据更新: <span className="font-medium text-gray-500">{lastImportTime}</span>
      </div>

      {/* 上传按钮 - 只在localStorage.canUpload为true时显示 */}
      {showUploadButton && (
      <div className="relative">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          disabled={uploading}
          className="hidden"
          id="excel-upload"
        />
        <label
          htmlFor="excel-upload"
          className={`
            inline-flex items-center space-x-2 px-4 py-2 rounded-xl font-medium
            transition-all duration-200 cursor-pointer
            ${uploading
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
            }
          `}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span>{uploading ? '上传中...' : '上传数据'}</span>
        </label>
      </div>
      )}

      {/* 上传进度弹窗 */}
      {uploading && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-4">正在导入数据</h3>

            {/* 进度条 */}
            <div className="mb-6">
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm text-gray-600">{progressMessage}</span>
                <span className="text-sm font-medium text-gray-900">{progress}%</span>
              </div>
            </div>

            {/* 当前处理的武器名称 */}
            {currentWeaponName && (
              <div className="mb-4 bg-purple-50 border border-purple-200 rounded-xl p-4">
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-purple-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-xs text-purple-600 font-medium mb-1">正在处理</p>
                    <p className="text-sm font-semibold text-purple-900">{currentWeaponName}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 提示信息 */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-blue-700">
                  请耐心等待，导入过程可能需要几分钟时间。请勿关闭此页面。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}