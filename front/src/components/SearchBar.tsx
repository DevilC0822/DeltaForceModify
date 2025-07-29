import React, { useState, useEffect } from 'react';
import { Autocomplete, AutocompleteItem, Button } from '@heroui/react';
import { MagnifyingGlassIcon, ArrowPathIcon } from '@heroicons/react/20/solid';
import { apiService } from '../api';

interface SearchBarProps {
  onSearch: (name: string, type: string) => void;
  loading?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, loading }) => {
  const [weaponNames, setWeaponNames] = useState<string[]>([]);
  const [loadingNames, setLoadingNames] = useState(false);
  const [selectedWeapon, setSelectedWeapon] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [weaponInputValue, setWeaponInputValue] = useState<string>('');
  const [typeInputValue, setTypeInputValue] = useState<string>('');

  // 使用模式选项
  const typeOptions = [
    { key: '', label: '全部模式' },
    { key: '烽火地带', label: '烽火地带' },
    { key: '全面战场', label: '全面战场' }
  ];

  // 获取武器名称列表
  useEffect(() => {
    const fetchWeaponNames = async () => {
      try {
        setLoadingNames(true);
        const names = await apiService.getWeaponNames();
        setWeaponNames(names);
      } catch (error) {
        console.error('获取武器名称失败:', error);
      } finally {
        setLoadingNames(false);
      }
    };

    fetchWeaponNames();
  }, []);

  // 创建武器选项数据
  const weaponOptions = [
    { key: '', label: '全部武器' },
    ...weaponNames.map(name => ({ key: name, label: name }))
  ];

  // 处理搜索
  const handleSearch = () => {
    onSearch(selectedWeapon, selectedType);
  };

  // 重置搜索
  const handleReset = () => {
    setSelectedWeapon('');
    setSelectedType('');
    setWeaponInputValue('');
    setTypeInputValue('');
    onSearch('', '');
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100">
      <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4 md:items-end">
        {/* 武器名称选择 */}
        <div className="flex-1">
          <Autocomplete
            label="武器名称"
            labelPlacement="outside"
            placeholder={loadingNames ? "加载中..." : "搜索武器名称..."}
            variant="bordered"
            color="primary"
            size="lg"
            radius="lg"
            allowsCustomValue
            menuTrigger="focus"
            inputValue={weaponInputValue}
            selectedKey={selectedWeapon}
            onInputChange={setWeaponInputValue}
            onSelectionChange={(key) => {
              setSelectedWeapon(key as string);
              if (key) {
                const selectedOption = weaponOptions.find(option => option.key === key);
                setWeaponInputValue(selectedOption?.label || '');
              }
            }}
            startContent={<MagnifyingGlassIcon className="w-4 h-4 text-default-400" />}
            isDisabled={loadingNames}
            classNames={{
              base: "max-w-full",
              listboxWrapper: "max-h-[320px]",
            }}
          >
            {weaponOptions.map((option) => (
              <AutocompleteItem key={option.key}>
                {option.label}
              </AutocompleteItem>
            ))}
          </Autocomplete>
        </div>

        {/* 使用模式选择 */}
        <div className="flex-1">
          <Autocomplete
            label="使用模式"
            labelPlacement="outside"
            placeholder="选择使用模式..."
            variant="bordered"
            color="secondary"
            size="lg"
            radius="lg"
            allowsCustomValue
            menuTrigger="focus"
            inputValue={typeInputValue}
            selectedKey={selectedType}
            onInputChange={setTypeInputValue}
            onSelectionChange={(key) => {
              setSelectedType(key as string);
              if (key) {
                const selectedOption = typeOptions.find(option => option.key === key);
                setTypeInputValue(selectedOption?.label || '');
              }
            }}
            classNames={{
              base: "max-w-full",
              listboxWrapper: "max-h-[200px]",
            }}
          >
            {typeOptions.map((option) => (
              <AutocompleteItem key={option.key}>
                {option.label}
              </AutocompleteItem>
            ))}
          </Autocomplete>
        </div>

        {/* 操作按钮 */}
        <div className="flex space-x-3">
          <Button
            color="primary"
            size="lg"
            radius="lg"
            startContent={<MagnifyingGlassIcon className="w-4 h-4" />}
            onPress={handleSearch}
            isLoading={loading}
            className="bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300"
          >
            {loading ? '搜索中' : '搜索'}
          </Button>

          <Button
            variant="flat"
            color="default"
            size="lg"
            radius="lg"
            startContent={<ArrowPathIcon className="w-4 h-4" />}
            onPress={handleReset}
            isDisabled={loading}
            className="font-medium"
          >
            重置
          </Button>
        </div>
      </div>

      {/* 当前搜索状态提示 */}
      {(selectedWeapon || selectedType) && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center flex-wrap gap-2 text-sm text-gray-600">
            <span>当前筛选:</span>
            {selectedWeapon && (
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                武器: {weaponOptions.find(w => w.key === selectedWeapon)?.label || selectedWeapon}
              </span>
            )}
            {selectedType && (
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-medium">
                模式: {typeOptions.find(t => t.key === selectedType)?.label || selectedType}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchBar; 