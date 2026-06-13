import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Button, Spin, QRCode, App as AntApp, Tag } from 'antd';
import { CheckCircleFilled, LinkOutlined, DisconnectOutlined } from '@ant-design/icons';
import { telegramApi, type TelegramStatus, type LinkCode } from '../api/telegramApi';
import { getErrorMessage } from '../auth/getErrorMessage';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function LinkTelegramModal({ open, onClose }: Props) {
  const { message } = AntApp.useApp();
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [link, setLink] = useState<LinkCode | null>(null);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await telegramApi.getStatus());
    } catch {
      /* ignore */
    }
  }, []);

  // Load status when opened; reset transient state when closed.
  useEffect(() => {
    if (open) {
      refresh();
    } else {
      setLink(null);
      setStatus(null);
      if (pollRef.current) clearInterval(pollRef.current);
    }
  }, [open, refresh]);

  // While a code is shown and not yet linked, poll until the bot confirms.
  useEffect(() => {
    const linked = status?.linked;
    if (!open || !link || linked) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(refresh, 2500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [open, link, status?.linked, refresh]);

  // Announce success once.
  useEffect(() => {
    if (link && status?.linked) {
      message.success('Đã liên kết Telegram thành công');
      setLink(null);
    }
  }, [link, status?.linked, message]);

  const handleCreate = async () => {
    setLoading(true);
    try {
      setLink(await telegramApi.createLinkCode());
    } catch (err) {
      message.error(getErrorMessage(err, 'Không tạo được liên kết'));
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async () => {
    setLoading(true);
    try {
      await telegramApi.unlink();
      await refresh();
      message.success('Đã hủy liên kết');
    } catch (err) {
      message.error(getErrorMessage(err, 'Không hủy được liên kết'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Liên kết Telegram" open={open} onCancel={onClose} footer={null} destroyOnClose>
      {status === null ? (
        <div className="flex justify-center py-10">
          <Spin />
        </div>
      ) : status.linked ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircleFilled />
            <span className="font-medium">Đã liên kết</span>
          </div>
          <div className="space-y-1">
            {status.chats.map((c) => (
              <Tag key={c.telegramId} color="blue">
                {c.telegramName ?? `Chat ${c.telegramId}`}
              </Tag>
            ))}
          </div>
          <p className="text-gray-500 text-sm mb-0">
            Giao dịch ghi qua bot Telegram sẽ đồng bộ realtime với tài khoản này.
          </p>
          <Button danger icon={<DisconnectOutlined />} loading={loading} onClick={handleUnlink} block>
            Hủy liên kết
          </Button>
        </div>
      ) : link ? (
        <div className="space-y-4 text-center">
          <p className="text-gray-600 text-sm mb-0">
            Mở liên kết dưới đây trên thiết bị có Telegram, hoặc quét mã QR. Bấm <b>Start</b> để hoàn tất.
          </p>
          <div className="flex justify-center">
            <QRCode value={link.deepLink} size={160} />
          </div>
          <Button type="primary" icon={<LinkOutlined />} href={link.deepLink} target="_blank" block>
            Mở Telegram
          </Button>
          <div className="flex items-center justify-center gap-2 text-gray-400 text-xs">
            <Spin size="small" /> Đang chờ xác nhận từ Telegram…
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-gray-600 text-sm mb-0">
            Liên kết tài khoản với bot Telegram để ghi giao dịch nhanh và đồng bộ realtime hai chiều.
          </p>
          <Button type="primary" icon={<LinkOutlined />} loading={loading} onClick={handleCreate} block>
            Tạo liên kết
          </Button>
        </div>
      )}
    </Modal>
  );
}
