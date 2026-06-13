import { Button } from 'antd';
import { ExperimentOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/**
 * Sticky strip shown only in trial mode: reminds the user data won't be saved
 * and offers a one-tap path to create a real account (or sign in).
 */
export default function DemoBanner() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  // logout() exits trial mode and clears the in-memory session.
  const go = async (to: string) => {
    await logout();
    navigate(to, { replace: true });
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-2 text-amber-700 text-sm font-medium">
          <ExperimentOutlined />
          Bạn đang ở chế độ dùng thử — dữ liệu là mẫu và sẽ không được lưu.
        </span>
        <div className="flex items-center gap-2 ml-auto">
          <Button size="small" type="primary" onClick={() => go('/register')}>
            Đăng ký miễn phí
          </Button>
          <Button size="small" onClick={() => go('/login')}>
            Đăng nhập
          </Button>
        </div>
      </div>
    </div>
  );
}
