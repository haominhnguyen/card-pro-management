import { useState } from 'react';
import { Form, Input, Button, Divider, App as AntApp } from 'antd';
import { MailOutlined, LockOutlined, ExperimentOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getErrorMessage } from '../auth/getErrorMessage';
import AuthLayout from './AuthLayout';

interface FormValues {
  email: string;
  password: string;
}

export default function LoginPage() {
  const { message } = AntApp.useApp();
  const { login, enterDemo } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const handleTryDemo = () => {
    enterDemo();
    message.info('Đang vào chế độ dùng thử với dữ liệu mẫu');
    navigate('/dashboard', { replace: true });
  };

  const handleSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await login(values);
      message.success('Đăng nhập thành công');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      message.error(getErrorMessage(err, 'Email hoặc mật khẩu không đúng'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Đăng nhập" subtitle="Chào mừng trở lại! Đăng nhập để tiếp tục.">
      <Form layout="vertical" requiredMark={false} onFinish={handleSubmit} disabled={submitting}>
        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: 'Vui lòng nhập email' },
            { type: 'email', message: 'Email không hợp lệ' },
          ]}
        >
          <Input size="large" prefix={<MailOutlined className="text-gray-400" />} placeholder="you@example.com" autoComplete="email" />
        </Form.Item>

        <Form.Item
          name="password"
          label="Mật khẩu"
          rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
        >
          <Input.Password size="large" prefix={<LockOutlined className="text-gray-400" />} placeholder="••••••••" autoComplete="current-password" />
        </Form.Item>

        <Form.Item className="mb-3">
          <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
            Đăng nhập
          </Button>
        </Form.Item>
      </Form>

      <Divider plain className="!my-4 text-gray-400 text-xs">hoặc</Divider>

      <Button
        size="large"
        block
        icon={<ExperimentOutlined />}
        onClick={handleTryDemo}
        disabled={submitting}
        className="mb-4"
      >
        Trải nghiệm thử — không cần đăng nhập
      </Button>

      <p className="text-center text-sm text-gray-500 mb-0">
        Chưa có tài khoản?{' '}
        <Link to="/register" className="font-medium text-blue-600 hover:text-blue-700">
          Đăng ký ngay
        </Link>
      </p>
    </AuthLayout>
  );
}
