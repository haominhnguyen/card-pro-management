import { useState, useMemo } from 'react';
import { Table, Tag, Button, Select, Input, Segmented, Typography, Empty, DatePicker, Collapse, Tooltip, Modal, Space } from 'antd';
import { App as AntApp } from 'antd';
import {
  BankOutlined, SearchOutlined, FilterOutlined, CloseOutlined,
  PlusOutlined, EditOutlined, DeleteOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useDeleteTransaction } from '../hooks/useData';
import { useIsMobile } from '../hooks/useIsMobile';
import { fmtVnd, fmtDate, fmtDateShort } from '../lib/format';
import BankLogo from './BankLogo';
import type { Transaction, Bank } from '../types';

const { Text } = Typography;
const { RangePicker } = DatePicker;

interface Props {
  transactions: Transaction[];
  banks: Bank[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (tx: Transaction) => void;
}

export default function TransactionsView({ transactions, banks, loading, onAdd, onEdit }: Props) {
  const { message } = AntApp.useApp();
  const isMobile = useIsMobile();
  const deleteMut = useDeleteTransaction();

  const [search, setSearch] = useState('');
  const [filterBank, setFilterBank] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);

  const bankNames = useMemo(() => [...new Set(transactions.map(t => t.bank))].sort(), [transactions]);
  const categories = useMemo(() => [...new Set(transactions.map(t => t.category))].sort(), [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (filterBank !== 'all' && t.bank !== filterBank) return false;
      if (filterType !== 'all' && t.type !== filterType) return false;
      if (filterCategory !== 'all' && t.category !== filterCategory) return false;
      if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      if (dateRange) {
        const d = dayjs(t.date);
        if (d.isBefore(dateRange[0], 'day') || d.isAfter(dateRange[1], 'day')) return false;
      }
      return true;
    });
  }, [transactions, filterBank, filterType, filterCategory, search, dateRange]);

  const totalExpense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);

  const hasFilter =
    filterBank !== 'all' || filterType !== 'all' || filterCategory !== 'all' || !!search || !!dateRange;

  const clearFilters = () => {
    setSearch('');
    setFilterBank('all');
    setFilterType('all');
    setFilterCategory('all');
    setDateRange(null);
  };

  const handleDelete = (tx: Transaction) => {
    Modal.confirm({
      title: 'Xóa giao dịch',
      content: `Xóa giao dịch "${tx.description}" (${fmtVnd(tx.amount)})?`,
      okText: 'Xóa',
      okButtonProps: { danger: true },
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await deleteMut.mutateAsync(tx._id);
          message.success('Đã xóa giao dịch');
        } catch {
          message.error('Không thể xóa giao dịch');
        }
      },
    });
  };

  const columns = [
    {
      title: 'Ngày',
      dataIndex: 'date',
      key: 'date',
      width: 140,
      render: (d: string) => <Text className="text-gray-400 text-xs">{fmtDate(d, true)}</Text>,
      sorter: (a: Transaction, b: Transaction) => dayjs(b.date).unix() - dayjs(a.date).unix(),
      defaultSortOrder: 'ascend' as const,
    },
    {
      title: 'Ngân hàng',
      dataIndex: 'bank',
      key: 'bank',
      width: 130,
      render: (t: string) => <Tag icon={<BankOutlined />} color="blue">{t}</Tag>,
    },
    {
      title: 'Loại',
      dataIndex: 'type',
      key: 'type',
      width: 110,
      render: (t: string) => (
        <Tag color={t === 'expense' ? 'red' : 'green'}>{t === 'expense' ? 'Chi tiêu' : 'Thu/Hoàn'}</Tag>
      ),
    },
    {
      title: 'Danh mục',
      dataIndex: 'category',
      key: 'category',
      width: 130,
      render: (t: string) => <Tag color="geekblue">{t}</Tag>,
    },
    { title: 'Mô tả', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: 'Số tiền',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right' as const,
      width: 150,
      render: (n: number, r: Transaction) => (
        <Text type={r.type === 'expense' ? 'danger' : 'success'} strong>
          {r.type === 'expense' ? '−' : '+'}{fmtVnd(n)}
        </Text>
      ),
      sorter: (a: Transaction, b: Transaction) => a.amount - b.amount,
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      align: 'center' as const,
      render: (_: unknown, r: Transaction) => (
        <div className="flex items-center justify-center gap-1">
          <Tooltip title="Sửa">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => onEdit(r)} />
          </Tooltip>
          <Tooltip title="Xóa">
            <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r)} />
          </Tooltip>
        </div>
      ),
    },
  ];

  const filterControls = (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <Input
        placeholder="Tìm kiếm mô tả..."
        prefix={<SearchOutlined className="text-gray-300" />}
        value={search}
        onChange={e => setSearch(e.target.value)}
        allowClear
      />
      <Select
        value={filterBank}
        onChange={setFilterBank}
        style={{ width: '100%' }}
        options={[{ value: 'all', label: 'Tất cả ngân hàng' }, ...bankNames.map(b => ({ value: b, label: b }))]}
      />
      <Segmented
        value={filterType}
        onChange={v => setFilterType(v as string)}
        block
        options={[
          { value: 'all', label: 'Tất cả' },
          { value: 'expense', label: 'Chi tiêu' },
          { value: 'income', label: 'Thu/Hoàn' },
        ]}
      />
      <Select
        value={filterCategory}
        onChange={setFilterCategory}
        style={{ width: '100%' }}
        options={[{ value: 'all', label: 'Tất cả danh mục' }, ...categories.map(c => ({ value: c, label: c }))]}
      />
      <div className="sm:col-span-2 lg:col-span-4">
        <RangePicker
          value={dateRange}
          onChange={v => {
            if (v && v[0] && v[1]) setDateRange([v[0], v[1]]);
            else setDateRange(null);
          }}
          disabledDate={current =>
            !!current &&
            (current > dayjs().endOf('day') || current < dayjs().subtract(1, 'year').startOf('day'))
          }
          format="DD/MM/YYYY"
          placeholder={['Từ ngày', 'Đến ngày']}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex justify-between items-center gap-2">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 m-0">Giao dịch</h2>
          <p className="text-sm text-gray-400 mt-0.5 mb-0">
            {filtered.length !== transactions.length
              ? `${filtered.length} / ${transactions.length} giao dịch`
              : `${transactions.length} giao dịch`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasFilter && (
            <Button size="small" icon={<CloseOutlined />} onClick={clearFilters}>
              <span className="hidden sm:inline">Xóa bộ lọc</span>
            </Button>
          )}
          <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
            <span className="hidden sm:inline">Thêm giao dịch</span>
          </Button>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
          <div className="text-gray-400 text-xs mb-1">Giao dịch</div>
          <div className="font-bold text-gray-900 text-lg sm:text-xl">{filtered.length}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
          <div className="text-gray-400 text-xs mb-1">Tổng chi</div>
          <div className="font-bold text-red-500 text-sm sm:text-xl truncate">{fmtVnd(totalExpense)}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
          <div className="text-gray-400 text-xs mb-1">Tổng thu</div>
          <div className="font-bold text-green-600 text-sm sm:text-xl truncate">{fmtVnd(totalIncome)}</div>
        </div>
      </div>

      {/* Filters — gom vào Collapse trên mobile, mở sẵn trên desktop */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        {isMobile ? (
          <Collapse
            ghost
            items={[
              {
                key: 'filters',
                label: (
                  <span className="text-sm font-medium text-gray-600 flex items-center gap-2">
                    <FilterOutlined /> Bộ lọc{hasFilter ? ' · đang lọc' : ''}
                  </span>
                ),
                children: filterControls,
              },
            ]}
          />
        ) : (
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <FilterOutlined className="text-gray-400 text-sm" />
              <span className="text-sm font-medium text-gray-600">Bộ lọc</span>
            </div>
            {filterControls}
          </div>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-16">
          <Empty description={hasFilter ? 'Không có giao dịch nào khớp với bộ lọc' : 'Chưa có giao dịch nào'}>
            {!hasFilter && (
              <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
                Thêm giao dịch
              </Button>
            )}
          </Empty>
        </div>
      ) : isMobile ? (
        <MobileList items={filtered} banks={banks} onEdit={onEdit} onDelete={handleDelete} />
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <Table
            columns={columns}
            dataSource={filtered}
            rowKey="_id"
            loading={loading}
            pagination={{ pageSize: 20, showSizeChanger: true, showTotal: total => `${total} giao dịch`, position: ['bottomRight'] }}
            size="middle"
          />
        </div>
      )}
    </div>
  );
}

// ── Mobile: danh sách thẻ dọc thay cho bảng cuộn ngang ──
function MobileList({
  items, banks, onEdit, onDelete,
}: {
  items: Transaction[];
  banks: Bank[];
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}) {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const slice = items.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-2">
      {slice.map(t => {
        const bank = banks.find(b => b.name === t.bank);
        return (
          <div key={t._id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3.5">
            <div className="flex items-center gap-3">
              <BankLogo name={t.bank} logo={bank?.logo} color={bank?.color} size={32} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 text-sm truncate">{t.description}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                  <span>{fmtDateShort(t.date)}</span>
                  <Tag color="geekblue" style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 5px' }}>
                    {t.category}
                  </Tag>
                </div>
              </div>
              <Text type={t.type === 'expense' ? 'danger' : 'success'} strong className="text-sm whitespace-nowrap">
                {t.type === 'expense' ? '−' : '+'}{fmtVnd(t.amount)}
              </Text>
            </div>
            <div className="flex justify-end gap-1 mt-2 pt-2 border-t border-gray-50">
              <Button type="text" size="small" icon={<EditOutlined />} onClick={() => onEdit(t)}>Sửa</Button>
              <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(t)}>Xóa</Button>
            </div>
          </div>
        );
      })}
      {items.length > pageSize && (
        <div className="flex justify-center pt-2">
          <Space.Compact>
            <Button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Trước</Button>
            <Button disabled={page * pageSize >= items.length} onClick={() => setPage(p => p + 1)}>Sau</Button>
          </Space.Compact>
        </div>
      )}
    </div>
  );
}
