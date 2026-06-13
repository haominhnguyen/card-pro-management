import { useState } from 'react';
import { Button, Dropdown, Avatar, Tag, type MenuProps } from 'antd';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  DashboardOutlined,
  CreditCardOutlined,
  UnorderedListOutlined,
  BarChartOutlined,
  PlusOutlined,
  UserOutlined,
  LogoutOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { App as AntApp } from 'antd';
import { useAuth } from '../auth/AuthContext';
import LinkTelegramModal from './LinkTelegramModal';

interface Props {
  onAddTransaction: () => void;
}

const NAV_ITEMS: { to: string; label: string; icon: React.ReactNode }[] = [
  { to: '/dashboard', label: 'Tổng quan', icon: <DashboardOutlined /> },
  { to: '/cards', label: 'Thẻ tín dụng', icon: <CreditCardOutlined /> },
  { to: '/transactions', label: 'Giao dịch', icon: <UnorderedListOutlined /> },
  { to: '/analytics', label: 'Phân tích', icon: <BarChartOutlined /> },
];

export default function AppHeader({ onAddTransaction }: Props) {
  const { user, demo, logout } = useAuth();
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const [tgOpen, setTgOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    message.success(demo ? 'Đã thoát chế độ dùng thử' : 'Đã đăng xuất');
    navigate('/login', { replace: true });
  };

  const userMenu: MenuProps['items'] = [
    {
      key: 'info',
      label: (
        <div className="px-1 py-0.5">
          <div className="font-medium text-gray-900">{user?.name}</div>
          <div className="text-xs text-gray-500">{user?.email}</div>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' },
    // Telegram linking needs a real account/backend — hidden in trial mode.
    ...(demo
      ? []
      : [
          { key: 'telegram', label: 'Liên kết Telegram', icon: <SendOutlined />, onClick: () => setTgOpen(true) },
          { type: 'divider' as const },
        ]),
    {
      key: 'logout',
      label: demo ? 'Thoát dùng thử' : 'Đăng xuất',
      icon: <LogoutOutlined />,
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <>
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <CreditCardOutlined style={{ color: 'white', fontSize: 15 }} />
            </div>
            <span className="font-bold text-gray-900 text-base hidden sm:block">CardPro</span>
            {demo && (
              <Tag color="orange" bordered={false} style={{ margin: 0, fontSize: 11 }}>
                Dùng thử
              </Tag>
            )}
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer border-0 no-underline ${
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Add transaction CTA + user menu */}
          <div className="flex items-center gap-2.5">
            <Button type="primary" icon={<PlusOutlined />} onClick={onAddTransaction}>
              <span className="hidden sm:inline">Thêm giao dịch</span>
            </Button>
            <Dropdown menu={{ items: userMenu }} trigger={['click']} placement="bottomRight">
              <Avatar
                className="cursor-pointer bg-blue-600 select-none"
                icon={<UserOutlined />}
              >
                {user?.name?.trim()?.charAt(0)?.toUpperCase()}
              </Avatar>
            </Dropdown>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="flex md:hidden gap-1 pb-2 overflow-x-auto scrollbar-hide">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 cursor-pointer border-0 no-underline ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'bg-transparent text-gray-500 hover:bg-gray-100'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>
    </header>
    <LinkTelegramModal open={tgOpen} onClose={() => setTgOpen(false)} />
    </>
  );
}
