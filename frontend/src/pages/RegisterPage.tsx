import { useState } from 'react';
import { Form, Input, Button, Divider, App as AntApp } from 'antd';
import { MailOutlined, LockOutlined, UserOutlined, ExperimentOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getErrorMessage } from '../auth/getErrorMessage';
import AuthLayout from './AuthLayout';

interface FormValues {
  name: string;
  email: string;
  password: string;
}

export default function RegisterPage() {
  const { message } = AntApp.useApp();
  const { register, enterDemo } = useAuth();
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
      await register(values);
      message.success('Tạo tài khoản thành công');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      message.error(getErrorMessage(err, 'Không thể tạo tài khoản'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Tạo tài khoản" subtitle="Bắt đầu quản lý thẻ tín dụng của bạn.">
      <Form layout="vertical" requiredMark={false} onFinish={handleSubmit} disabled={submitting}>
        <Form.Item
          name="name"
          label="Họ tên"
          rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}
        >
          <Input size="large" prefix={<UserOutlined className="text-gray-400" />} placeholder="Nguyễn Văn A" autoComplete="name" />
        </Form.Item>

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
          rules={[
            { required: true, message: 'Vui lòng nhập mật khẩu' },
            { min: 8, message: 'Mật khẩu tối thiểu 8 ký tự' },
          ]}
        >
          <Input.Password size="large" prefix={<LockOutlined className="text-gray-400" />} placeholder="Tối thiểu 8 ký tự" autoComplete="new-password" />
        </Form.Item>

        <Form.Item className="mb-3">
          <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
            Đăng ký
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
        Dùng thử với dữ liệu mẫu
      </Button>

      <p className="text-center text-sm text-gray-500 mb-0">
        Đã có tài khoản?{' '}
        <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">
          Đăng nhập
        </Link>
      </p>
    </AuthLayout>
  );
}
