import { Spin, Empty, Button, Table, Tag, Typography, Progress } from 'antd';
import {
  PlusOutlined,
  ArrowRightOutlined,
  BankOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useIsMobile } from '../hooks/useIsMobile';
import { fmtM, fmtDateShort } from '../lib/format';
import { totals, cardUsage } from '../lib/stats';
import BankLogo from './BankLogo';
import type { CreditCard, Transaction, Stat, Bank } from '../types';

const { Text } = Typography;

interface Props {
  cards: CreditCard[];
  transactions: Transaction[];
  stats: Stat[];
  banks: Bank[];
  loading: boolean;
  onAddCard: () => void;
  onAddTransaction: () => void;
  onViewAll: () => void;
  onViewCards: () => void;
}

const TX_COLUMNS = [
  {
    title: 'Ngày',
    dataIndex: 'date',
    key: 'date',
    width: 110,
    render: (d: string) => (
      <Text className="text-gray-400 text-xs">{fmtDateShort(d)}</Text>
    ),
  },
  {
    title: 'Ngân hàng',
    dataIndex: 'bank',
    key: 'bank',
    width: 110,
    render: (t: string) => <Tag icon={<BankOutlined />} color="blue">{t}</Tag>,
  },
  {
    title: 'Danh mục',
    dataIndex: 'category',
    key: 'category',
    width: 120,
    render: (t: string) => <Tag color="geekblue">{t}</Tag>,
  },
  {
    title: 'Mô tả',
    dataIndex: 'description',
    key: 'description',
    ellipsis: true,
  },
  {
    title: 'Số tiền',
    dataIndex: 'amount',
    key: 'amount',
    align: 'right' as const,
    width: 130,
    render: (n: number, r: Transaction) => (
      <Text type={r.type === 'expense' ? 'danger' : 'success'} strong>
        {r.type === 'expense' ? '−' : '+'}{fmtM(n)}
      </Text>
    ),
  },
];

export default function DashboardView({
  cards,
  transactions,
  stats,
  banks,
  loading,
  onAddCard,
  onAddTransaction,
  onViewAll,
  onViewCards,
}: Props) {
  const isMobile = useIsMobile();
  const { totalLimit, totalExpense, totalIncome, balance, usedPct } = totals(cards, stats);

  return (
    <Spin spinning={loading}>
      <div className="space-y-4">

        {/* ── Summary stat row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Tổng hạn mức', value: fmtM(totalLimit), color: 'bg-blue-600' },
            { label: 'Đã chi tiêu',  value: fmtM(totalExpense), color: 'bg-rose-500' },
            { label: 'Thu / Hoàn',   value: fmtM(totalIncome),  color: 'bg-emerald-500' },
            { label: 'Khả dụng',     value: fmtM(balance),      color: balance < 0 ? 'bg-rose-600' : 'bg-indigo-500' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`rounded-xl px-4 py-3.5 text-white ${color}`}>
              <div className="text-white/70 text-xs font-medium uppercase tracking-wide mb-1">{label}</div>
              <div className="text-xl font-bold truncate">{value}</div>
            </div>
          ))}
        </div>

        {/* ── Usage bar ── */}
        <div className="bg-white rounded-xl px-5 py-4 border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-2.5">
            <div>
              <span className="font-semibold text-gray-800 text-sm">Mức độ sử dụng hạn mức</span>
              {usedPct > 80 && (
                <span className={`ml-2 text-xs font-medium ${usedPct > 90 ? 'text-red-500' : 'text-orange-500'}`}>
                  <WarningOutlined className="mr-1" />
                  {usedPct > 90 ? 'Nguy hiểm — trên 90%' : 'Cảnh báo — trên 80%'}
                </span>
              )}
            </div>
            <span className={`text-lg font-bold ${usedPct > 90 ? 'text-red-500' : usedPct > 80 ? 'text-orange-500' : 'text-blue-600'}`}>
              {Math.round(usedPct)}%
            </span>
          </div>
          <Progress
            percent={Math.round(usedPct)}
            strokeColor={usedPct > 90 ? '#ef4444' : usedPct > 80 ? '#f97316' : '#1677ff'}
            showInfo={false}
            size={['100%', 6]}
          />
        </div>

        {/* ── Cards compact widget ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex justify-between items-center px-5 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-800 text-sm">
              {cards.length > 0 ? `${cards.length} thẻ tín dụng` : 'Thẻ tín dụng'}
            </span>
            {cards.length > 0 ? (
              <Button type="link" size="small" icon={<ArrowRightOutlined />} onClick={onViewCards} style={{ padding: 0 }}>
                Quản lý
              </Button>
            ) : null}
          </div>

          {cards.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <Empty description="Chưa có thẻ nào" image={Empty.PRESENTED_IMAGE_SIMPLE}>
                <Button type="primary" size="small" icon={<PlusOutlined />} onClick={onAddCard}>
                  Thêm thẻ đầu tiên
                </Button>
              </Empty>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {cards.map(card => {
                const bank = banks.find(b => b.name === card.bank);
                const { balance: bal, pct, warn } = cardUsage(card, stats);

                return (
                  <div key={card._id} className="flex items-center gap-3 px-5 py-2.5">
                    <BankLogo name={card.bank} logo={bank?.logo} color={bank?.color} size={24} />
                    <Tag
                      color={warn ? 'red' : 'blue'}
                      style={{ margin: 0, fontSize: 11, lineHeight: '18px', padding: '0 5px', flexShrink: 0 }}
                    >
                      {card.bank}
                    </Tag>
                    <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">{card.cardName}</span>
                    <div className="hidden sm:flex items-center gap-2 w-28 flex-shrink-0">
                      <div className="flex-1 bg-gray-100 rounded-full h-1">
                        <div
                          className={`h-1 rounded-full ${warn ? 'bg-red-400' : 'bg-blue-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={`text-xs w-7 text-right flex-shrink-0 ${warn ? 'text-red-500' : 'text-gray-400'}`}>
                        {Math.round(pct)}%
                      </span>
                    </div>
                    <span className={`text-sm font-semibold flex-shrink-0 ${bal < 0 ? 'text-red-500' : 'text-gray-800'}`}>
                      {fmtM(bal)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Recent transactions ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex justify-between items-center px-5 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-800 text-sm">Giao dịch gần đây</span>
            <div className="flex items-center gap-2">
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={onAddTransaction}
              >
                Thêm
              </Button>
              <Button
                type="link"
                size="small"
                icon={<ArrowRightOutlined />}
                onClick={onViewAll}
                style={{ padding: 0 }}
              >
                Tất cả
              </Button>
            </div>
          </div>

          {transactions.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <Empty description="Chưa có giao dịch nào" image={Empty.PRESENTED_IMAGE_SIMPLE}>
                <Button type="primary" size="small" icon={<PlusOutlined />} onClick={onAddTransaction}>
                  Thêm giao dịch
                </Button>
              </Empty>
            </div>
          ) : isMobile ? (
            <div className="divide-y divide-gray-50">
              {transactions.slice(0, 8).map(t => {
                const bank = banks.find(b => b.name === t.bank);
                return (
                  <div key={t._id} className="flex items-center gap-3 px-4 py-2.5">
                    <BankLogo name={t.bank} logo={bank?.logo} color={bank?.color} size={28} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-800 truncate">{t.description}</div>
                      <div className="text-xs text-gray-400">{fmtDateShort(t.date)} · {t.category}</div>
                    </div>
                    <Text type={t.type === 'expense' ? 'danger' : 'success'} strong className="text-sm whitespace-nowrap">
                      {t.type === 'expense' ? '−' : '+'}{fmtM(t.amount)}
                    </Text>
                  </div>
                );
              })}
            </div>
          ) : (
            <Table
              columns={TX_COLUMNS}
              dataSource={transactions.slice(0, 8)}
              rowKey="_id"
              pagination={false}
              size="small"
            />
          )}
        </div>

      </div>
    </Spin>
  );
}
