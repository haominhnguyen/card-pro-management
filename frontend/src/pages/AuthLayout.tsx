import type { ReactNode } from 'react';
import { CreditCardOutlined, SafetyOutlined, LineChartOutlined, BellOutlined } from '@ant-design/icons';
import { BRAND } from '../lib/theme';

const HIGHLIGHTS: { icon: ReactNode; title: string; desc: string }[] = [
  { icon: <CreditCardOutlined />, title: 'Quản lý mọi thẻ', desc: 'Theo dõi hạn mức, dư nợ và ngày sao kê tập trung.' },
  { icon: <LineChartOutlined />, title: 'Phân tích chi tiêu', desc: 'Biểu đồ theo danh mục và theo tháng trực quan.' },
  { icon: <BellOutlined />, title: 'Cập nhật realtime', desc: 'Đồng bộ tức thì qua web, bot Telegram và Sheets.' },
  { icon: <SafetyOutlined />, title: 'Bảo mật', desc: 'Đăng nhập JWT, dữ liệu của bạn được bảo vệ.' },
];

interface Props {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export default function AuthLayout({ title, subtitle, children }: Props) {
  return (
    // overflow-x-hidden is a safety net: no inner element can ever cause the
    // whole page to scroll sideways on small screens.
    <div className="min-h-screen w-full flex bg-gray-50 overflow-x-hidden">
      {/* Brand panel — hidden on mobile */}
      <div
        className="hidden md:flex md:w-1/2 lg:w-3/5 flex-col justify-between p-10 lg:p-12 text-white relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${BRAND.primary} 0%, #0b4bd4 60%, #06277a 100%)` }}
      >
        {/* subtle decorative glow */}
        <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-white/5 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center backdrop-blur">
            <CreditCardOutlined style={{ fontSize: 20 }} />
          </div>
          <span className="font-bold text-xl">CardPro</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl lg:text-4xl font-bold leading-tight mb-3">
            Quản lý thẻ tín dụng thông minh
          </h1>
          <p className="text-white/80 mb-8 lg:mb-10 text-base">
            Một nơi duy nhất để theo dõi chi tiêu, dư nợ và hạn mức của tất cả thẻ.
          </p>
          <div className="grid gap-5">
            {HIGHLIGHTS.map((h) => (
              <div key={h.title} className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center text-lg flex-shrink-0">
                  {h.icon}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold">{h.title}</div>
                  <div className="text-white/70 text-sm">{h.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-white/50 text-sm">© {new Date().getFullYear()} CardPro</div>
      </div>

      {/* Form panel — min-w-0 stops a wide child from forcing horizontal overflow */}
      <div className="flex-1 min-w-0 flex items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md min-w-0">
          {/* Mobile logo */}
          <div className="flex md:hidden items-center gap-2.5 mb-7 justify-center">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
              <CreditCardOutlined style={{ color: 'white', fontSize: 19 }} />
            </div>
            <span className="font-bold text-gray-900 text-xl">CardPro</span>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">{title}</h2>
            <p className="text-gray-500 text-sm mb-6">{subtitle}</p>
            {children}
          </div>

          <p className="md:hidden text-center text-gray-400 text-xs mt-6">
            © {new Date().getFullYear()} CardPro
          </p>
        </div>
      </div>
    </div>
  );
}
