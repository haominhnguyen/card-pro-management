import { useMemo, useState } from 'react';
import { Spin, Empty, Segmented, Typography } from 'antd';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { useCategoryStats, useMonthlyStats, useStats } from '../hooks/useData';
import { fmtM, fmtVnd } from '../lib/format';

const { Text } = Typography;

const PALETTE = ['#1677ff', '#f43f5e', '#10b981', '#f97316', '#8b5cf6', '#06b6d4', '#eab308', '#ec4899', '#64748b'];

function Card({ title, children, empty }: { title: string; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5">
      <h3 className="font-semibold text-gray-800 text-sm mb-4">{title}</h3>
      {empty ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu" /> : children}
    </div>
  );
}

export default function AnalyticsView() {
  const [months, setMonths] = useState(6);
  const catQ = useCategoryStats();
  const monthlyQ = useMonthlyStats(months);
  const statsQ = useStats();

  const loading = catQ.isLoading || monthlyQ.isLoading || statsQ.isLoading;

  const categoryData = catQ.data ?? [];
  const monthlyData = useMemo(
    () => (monthlyQ.data ?? []).map(m => ({
      ...m,
      label: m.month.slice(5) + '/' + m.month.slice(2, 4), // MM/YY
    })),
    [monthlyQ.data],
  );
  const bankData = useMemo(
    () => (statsQ.data ?? [])
      .filter(s => s.type === 'expense' && s.total > 0)
      .map(s => ({ bank: s.bank, total: s.total }))
      .sort((a, b) => b.total - a.total),
    [statsQ.data],
  );

  const totalCat = categoryData.reduce((s, c) => s + c.total, 0);

  return (
    <Spin spinning={loading}>
      <div className="space-y-5">
        <div className="flex justify-between items-center gap-2 flex-wrap">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 m-0">Phân tích chi tiêu</h2>
            <p className="text-sm text-gray-400 mt-0.5 mb-0">Xu hướng & cơ cấu chi tiêu của bạn</p>
          </div>
          <Segmented
            value={months}
            onChange={v => setMonths(v as number)}
            options={[{ value: 6, label: '6 tháng' }, { value: 12, label: '12 tháng' }]}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Donut: chi tiêu theo danh mục */}
          <Card title="Chi tiêu theo danh mục" empty={categoryData.length === 0}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="total"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                >
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <RTooltip
                  formatter={(value, name) => {
                    const v = Number(value);
                    return [`${fmtVnd(v)} (${totalCat ? Math.round((v / totalCat) * 100) : 0}%)`, String(name)];
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          {/* Bar: chi tiêu theo ngân hàng */}
          <Card title="Chi tiêu theo ngân hàng" empty={bankData.length === 0}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={bankData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={fmtM} fontSize={11} />
                <YAxis type="category" dataKey="bank" width={80} fontSize={11} />
                <RTooltip formatter={value => fmtVnd(Number(value))} />
                <Bar dataKey="total" name="Chi tiêu" fill="#f43f5e" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Bar: xu hướng theo tháng (full width) */}
          <div className="lg:col-span-2">
            <Card title={`Xu hướng chi / thu theo tháng (${months} tháng)`} empty={monthlyData.every(m => m.expense === 0 && m.income === 0)}>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={monthlyData} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis tickFormatter={fmtM} fontSize={11} />
                  <RTooltip formatter={(value, name) => [fmtVnd(Number(value)), String(name)]} />
                  <Legend />
                  <Bar dataKey="expense" name="Chi tiêu" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="income" name="Thu / Hoàn" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </div>

        {!loading && totalCat > 0 && (
          <Text type="secondary" className="text-xs">
            Tổng chi tiêu (tất cả thời gian): <span className="font-medium">{fmtVnd(totalCat)}</span>
          </Text>
        )}
      </div>
    </Spin>
  );
}
