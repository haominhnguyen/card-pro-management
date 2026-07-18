import { useEffect, useState } from 'react';
import { Form, Input, Button, Divider, App as AntApp } from 'antd';
import {
  MailOutlined,
  LockOutlined,
  UserOutlined,
  ExperimentOutlined,
  ArrowLeftOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { authApi } from '../api/authApi';
import { getErrorMessage } from '../auth/getErrorMessage';
import AuthLayout from './AuthLayout';

interface FormValues {
  name: string;
  email: string;
  password: string;
}

type Step = 'details' | 'verify';

const RESEND_COOLDOWN_SECONDS = 45;

export default function RegisterPage() {
  const { message } = AntApp.useApp();
  const { register, verifyRegistration, enterDemo } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('details');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleTryDemo = () => {
    enterDemo();
    message.info('Đang vào chế độ dùng thử với dữ liệu mẫu');
    navigate('/dashboard', { replace: true });
  };

  const handleDetails = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await register(values);
      setEmail(values.email);
      setOtp('');
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setStep('verify');
      message.success('Đã gửi mã xác minh đến email của bạn');
    } catch (err) {
      message.error(getErrorMessage(err, 'Không thể tạo tài khoản'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    try {
      await authApi.resendRegistrationOtp(email);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      message.success('Đã gửi lại mã xác minh');
    } catch (err) {
      message.error(getErrorMessage(err, 'Không thể gửi lại mã'));
    }
  };

  const handleVerify = async () => {
    if (otp.length !== 6) {
      message.error('Vui lòng nhập đủ 6 chữ số của mã xác minh');
      return;
    }
    setSubmitting(true);
    try {
      await verifyRegistration({ email, otp });
      message.success('Xác minh thành công, chào mừng bạn!');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      message.error(getErrorMessage(err, 'Mã không đúng hoặc đã hết hạn'));
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'verify') {
    return (
      <AuthLayout
        title="Xác minh email"
        subtitle={`Chúng tôi đã gửi mã 6 chữ số đến ${email}. Mã có hiệu lực trong 10 phút.`}
      >
        <Form layout="vertical" requiredMark={false} onFinish={handleVerify} disabled={submitting}>
          <Form.Item label="Mã xác minh (OTP)" className="mb-2">
            <Input.OTP
              length={6}
              size="large"
              value={otp}
              onChange={setOtp}
              formatter={(str) => str.replace(/\D/g, '')}
            />
          </Form.Item>

          <div className="mb-5 -mt-1 text-sm">
            {cooldown > 0 ? (
              <span className="text-gray-400">Gửi lại mã sau {cooldown}s</span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                className="font-medium text-blue-600 hover:text-blue-700 bg-transparent border-0 p-0 cursor-pointer"
              >
                Gửi lại mã
              </button>
            )}
          </div>

          <Form.Item className="mb-3">
            <Button type="primary" htmlType="submit" size="large" block loading={submitting} icon={<SafetyCertificateOutlined />}>
              Xác minh & tạo tài khoản
            </Button>
          </Form.Item>
        </Form>

        <p className="text-center text-sm text-gray-500 mb-0">
          <button
            type="button"
            onClick={() => setStep('details')}
            className="font-medium text-blue-600 hover:text-blue-700 bg-transparent border-0 p-0 cursor-pointer"
          >
            <ArrowLeftOutlined className="mr-1" />
            Sửa thông tin đăng ký
          </button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Tạo tài khoản" subtitle="Bắt đầu quản lý thẻ tín dụng của bạn.">
      <Form layout="vertical" requiredMark={false} onFinish={handleDetails} disabled={submitting}>
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
