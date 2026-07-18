import { useEffect, useState } from 'react';
import { Form, Input, Button, App as AntApp } from 'antd';
import { MailOutlined, LockOutlined, ArrowLeftOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api/authApi';
import { getErrorMessage } from '../auth/getErrorMessage';
import AuthLayout from './AuthLayout';

type Step = 'email' | 'reset';

const RESEND_COOLDOWN_SECONDS = 45;

export default function ForgotPasswordPage() {
  const { message } = AntApp.useApp();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Tick down the resend cooldown once a code has been sent.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = async (targetEmail: string) => {
    await authApi.forgotPassword(targetEmail);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  };

  const handleRequest = async (values: { email: string }) => {
    setSubmitting(true);
    try {
      await sendCode(values.email);
      setEmail(values.email);
      setStep('reset');
      message.success('Đã gửi mã xác thực đến email của bạn');
    } catch (err) {
      message.error(getErrorMessage(err, 'Không thể gửi mã, vui lòng thử lại'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    try {
      await sendCode(email);
      message.success('Đã gửi lại mã xác thực');
    } catch (err) {
      message.error(getErrorMessage(err, 'Không thể gửi lại mã'));
    }
  };

  const handleReset = async (values: { password: string }) => {
    if (otp.length !== 6) {
      message.error('Vui lòng nhập đủ 6 chữ số của mã xác thực');
      return;
    }
    setSubmitting(true);
    try {
      await authApi.resetPassword({ email, otp, password: values.password });
      message.success('Đặt lại mật khẩu thành công, hãy đăng nhập lại');
      navigate('/login', { replace: true });
    } catch (err) {
      message.error(getErrorMessage(err, 'Mã không đúng hoặc đã hết hạn'));
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'email') {
    return (
      <AuthLayout
        title="Quên mật khẩu"
        subtitle="Nhập email của bạn, chúng tôi sẽ gửi mã xác thực để đặt lại mật khẩu."
      >
        <Form layout="vertical" requiredMark={false} onFinish={handleRequest} disabled={submitting}>
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

          <Form.Item className="mb-3">
            <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
              Gửi mã xác thực
            </Button>
          </Form.Item>
        </Form>

        <p className="text-center text-sm text-gray-500 mb-0">
          <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">
            <ArrowLeftOutlined className="mr-1" />
            Quay lại đăng nhập
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Nhập mã & mật khẩu mới"
      subtitle={`Chúng tôi đã gửi mã 6 chữ số đến ${email}. Mã có hiệu lực trong 10 phút.`}
    >
      <Form layout="vertical" requiredMark={false} onFinish={handleReset} disabled={submitting}>
        <Form.Item label="Mã xác thực (OTP)" className="mb-2">
          <Input.OTP
            length={6}
            size="large"
            value={otp}
            onChange={setOtp}
            formatter={(str) => str.replace(/\D/g, '')}
          />
        </Form.Item>

        <div className="mb-4 -mt-1 text-sm">
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

        <Form.Item
          name="password"
          label="Mật khẩu mới"
          rules={[
            { required: true, message: 'Vui lòng nhập mật khẩu mới' },
            { min: 8, message: 'Mật khẩu tối thiểu 8 ký tự' },
          ]}
        >
          <Input.Password size="large" prefix={<LockOutlined className="text-gray-400" />} placeholder="Tối thiểu 8 ký tự" autoComplete="new-password" />
        </Form.Item>

        <Form.Item
          name="confirm"
          label="Xác nhận mật khẩu"
          dependencies={['password']}
          rules={[
            { required: true, message: 'Vui lòng xác nhận mật khẩu' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) return Promise.resolve();
                return Promise.reject(new Error('Mật khẩu xác nhận không khớp'));
              },
            }),
          ]}
        >
          <Input.Password size="large" prefix={<LockOutlined className="text-gray-400" />} placeholder="Nhập lại mật khẩu mới" autoComplete="new-password" />
        </Form.Item>

        <Form.Item className="mb-3">
          <Button type="primary" htmlType="submit" size="large" block loading={submitting} icon={<SafetyCertificateOutlined />}>
            Đặt lại mật khẩu
          </Button>
        </Form.Item>
      </Form>

      <p className="text-center text-sm text-gray-500 mb-0">
        <button
          type="button"
          onClick={() => setStep('email')}
          className="font-medium text-blue-600 hover:text-blue-700 bg-transparent border-0 p-0 cursor-pointer"
        >
          <ArrowLeftOutlined className="mr-1" />
          Dùng email khác
        </button>
      </p>
    </AuthLayout>
  );
}
