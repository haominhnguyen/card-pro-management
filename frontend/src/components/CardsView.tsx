import { Spin, Empty, Button, Tag, Tooltip, Modal } from 'antd';
import { App as AntApp } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, CalendarOutlined } from '@ant-design/icons';
import { useDeleteCard } from '../hooks/useData';
import { cardUsage } from '../lib/stats';
import BankLogo from './BankLogo';
import type { CreditCard, Stat, Bank } from '../types';

interface Props {
  cards: CreditCard[];
  stats: Stat[];
  banks: Bank[];
  loading: boolean;
  onAddCard: () => void;
  onEditCard: (card: CreditCard) => void;
}

const fmt = (n: number) => n.toLocaleString('vi-VN');

export default function CardsView({ cards, stats, banks, loading, onAddCard, onEditCard }: Props) {
  const { message } = AntApp.useApp();
  const deleteMut = useDeleteCard();

  const handleDelete = (card: CreditCard) => {
    Modal.confirm({
      title: 'Xóa thẻ',
      content: `Xóa thẻ "${card.cardName}" (${card.bank})?`,
      okText: 'Xóa',
      okButtonProps: { danger: true },
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await deleteMut.mutateAsync(card._id);
          message.success('Đã xóa thẻ');
        } catch {
          message.error('Không thể xóa thẻ');
        }
      },
    });
  };

  return (
    <Spin spinning={loading}>
      <div className="space-y-5">
        {/* Page header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 m-0">Thẻ tín dụng</h2>
            <p className="text-sm text-gray-400 mt-0.5 mb-0">
              {cards.length > 0 ? `${cards.length} thẻ đang quản lý` : 'Chưa có thẻ nào'}
            </p>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={onAddCard}>
            Thêm thẻ
          </Button>
        </div>

        {/* Empty state */}
        {!loading && cards.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-16 text-center">
            <Empty description="Chưa có thẻ tín dụng nào">
              <Button type="primary" icon={<PlusOutlined />} onClick={onAddCard}>
                Thêm thẻ đầu tiên
              </Button>
            </Empty>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Column headers — desktop */}
            <div className="hidden md:flex items-center gap-4 px-5 py-2.5 border-b border-gray-100">
              <div className="flex-1 text-xs font-medium text-gray-400 uppercase tracking-wide">Thẻ</div>
              <div className="w-44 text-right text-xs font-medium text-gray-400 uppercase tracking-wide">Khả dụng</div>
              <div className="w-52 text-xs font-medium text-gray-400 uppercase tracking-wide">Sử dụng</div>
              <div className="w-[72px]" />
            </div>

            {/* Card rows */}
            <div className="divide-y divide-gray-50">
              {cards.map(card => {
                const bank = banks.find(b => b.name === card.bank);
                const { balance: bal, pct, warn } = cardUsage(card, stats);

                return (
                  <div
                    key={card._id}
                    className="flex items-center gap-4 px-5 py-3.5 group hover:bg-gray-50/50 transition-colors"
                  >
                    <BankLogo name={card.bank} logo={bank?.logo} color={bank?.color} size={36} />

                    {/* Identity */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Tag
                          color={warn ? 'red' : 'blue'}
                          style={{ margin: 0, fontSize: 11, lineHeight: '18px', padding: '0 5px', flexShrink: 0 }}
                        >
                          {card.bank}
                        </Tag>
                        <span className="font-medium text-gray-900 text-sm truncate">{card.cardName}</span>
                      </div>
                      {/* Mobile: second info line */}
                      <div className="flex items-center gap-2 mt-2 md:hidden">
                        <span className={`text-sm font-semibold ${bal < 0 ? 'text-red-500' : 'text-gray-800'}`}>
                          {fmt(bal)} ₫
                        </span>
                        <div className="flex-1 bg-gray-100 rounded-full h-1">
                          <div
                            className={`h-1 rounded-full ${warn ? 'bg-red-400' : 'bg-blue-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={`text-xs ${warn ? 'text-red-500' : 'text-gray-400'}`}>
                          {Math.round(pct)}%
                        </span>
                        <span className="text-xs text-gray-400">· Ngày {card.statementDate}</span>
                      </div>
                    </div>

                    {/* Desktop: available balance */}
                    <div className="hidden md:block w-44 flex-shrink-0 text-right">
                      <Tooltip title={`Hạn mức: ${fmt(card.creditLimit)} ₫`}>
                        <div className={`font-bold text-sm ${bal < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                          {fmt(bal)} ₫
                        </div>
                      </Tooltip>
                      <div className="text-xs text-gray-400 mt-0.5">/ {fmt(card.creditLimit)} ₫</div>
                    </div>

                    {/* Desktop: usage bar + statement date */}
                    <div className="hidden md:block w-52 flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${warn ? 'bg-red-400' : 'bg-blue-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span
                          className={`text-xs font-medium w-8 text-right flex-shrink-0 ${warn ? 'text-red-500' : 'text-gray-500'}`}
                        >
                          {Math.round(pct)}%
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <Tag
                          icon={<CalendarOutlined />}
                          color={warn ? 'red' : 'default'}
                          style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}
                        >
                          Chốt ngày {card.statementDate}
                        </Tag>
                      </div>
                    </div>

                    {/* Actions — always visible (touch devices have no hover) */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Tooltip title="Sửa thẻ">
                        <button
                          aria-label={`Sửa thẻ ${card.cardName}`}
                          onClick={() => onEditCard(card)}
                          style={{ background: 'transparent' }}
                          className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors cursor-pointer border-0"
                        >
                          <EditOutlined style={{ fontSize: 14 }} />
                        </button>
                      </Tooltip>
                      <Tooltip title="Xóa thẻ">
                        <button
                          aria-label={`Xóa thẻ ${card.cardName}`}
                          onClick={() => handleDelete(card)}
                          style={{ background: 'transparent' }}
                          className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer border-0"
                        >
                          <DeleteOutlined style={{ fontSize: 14 }} />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Spin>
  );
}
