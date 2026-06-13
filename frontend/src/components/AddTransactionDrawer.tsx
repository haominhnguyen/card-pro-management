import { useEffect } from 'react';
import { Drawer, Form, Input, InputNumber, Select, DatePicker, Segmented, Button, Typography, Divider, Space, Tag } from 'antd';
import { App as AntApp } from 'antd';
import dayjs from 'dayjs';
import { useCreateTransaction, useUpdateTransaction } from '../hooks/useData';
import { useIsMobile } from '../hooks/useIsMobile';
import { fmtVnd, vndFormatter, vndParser } from '../lib/format';
import { CATEGORIES, QUICK_AMOUNTS } from '../lib/constants';
import BankLogo from './BankLogo';
import type { CreditCard, Bank, Transaction } from '../types';

const { Text } = Typography;

interface Props {
  open: boolean;
  /** Khi != null → chế độ sửa. */
  editing?: Transaction | null;
  cards: CreditCard[];
  banks: Bank[];
  onClose: () => void;
  onSuccess: () => void;
}

interface FormValues {
  type: 'expense' | 'income';
  cardId: string;
  amount: number;
  category: string;
  date: dayjs.Dayjs;
  description: string;
}

export default function AddTransactionDrawer({ open, editing, cards, banks, onClose, onSuccess }: Props) {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm<FormValues>();
  const isMobile = useIsMobile();
  const createMut = useCreateTransaction();
  const updateMut = useUpdateTransaction();
  const isEdit = !!editing;
  const submitting = createMut.isPending || updateMut.isPending;

  const watchType = Form.useWatch('type', form);
  const watchCardId = Form.useWatch('cardId', form);
  const watchAmount = Form.useWatch('amount', form);
  const selectedCard = cards.find(c => c._id === watchCardId);
  const overLimit = watchType === 'expense' && !!selectedCard && (watchAmount || 0) > selectedCard.creditLimit;

  // Nạp giá trị khi mở: prefill nếu sửa, reset nếu thêm mới.
  useEffect(() => {
    if (!open) return;
    if (editing) {
      const card = cards.find(
        c => c.bank === editing.bank && (!editing.cardName || c.cardName === editing.cardName),
      );
      form.setFieldsValue({
        type: editing.type,
        cardId: card?._id,
        amount: editing.amount,
        category: editing.category,
        date: dayjs(editing.date),
        description: editing.description,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ type: 'expense', date: dayjs() });
    }
  }, [open, editing, cards, form]);

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  const handleSubmit = async (values: FormValues) => {
    const card = cards.find(c => c._id === values.cardId);
    if (!card) {
      message.error('Vui lòng chọn thẻ');
      return;
    }
    const amount = Math.round(values.amount);
    if (values.type === 'expense' && amount > card.creditLimit) {
      message.warning(`Số tiền vượt quá hạn mức thẻ (${fmtVnd(card.creditLimit)})`);
      return;
    }
    const payload = {
      bank: card.bank,
      cardName: card.cardName,
      amount,
      category: values.category,
      type: values.type,
      description: values.description,
      date: values.date ? values.date.toISOString() : new Date().toISOString(),
    };
    try {
      if (isEdit && editing) {
        await updateMut.mutateAsync({ id: editing._id, data: payload });
        message.success('Cập nhật giao dịch thành công');
      } else {
        await createMut.mutateAsync(payload);
        message.success('Thêm giao dịch thành công');
      }
      form.resetFields();
      onSuccess();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Lỗi khi lưu giao dịch');
    }
  };

  return (
    <Drawer
      title={isEdit ? 'Sửa giao dịch' : 'Thêm giao dịch'}
      placement="right"
      width={isMobile ? '100%' : 440}
      open={open}
      onClose={handleClose}
      styles={{ body: { paddingBottom: 80 } }}
      extra={
        <Button type="primary" loading={submitting} disabled={overLimit} onClick={() => form.submit()}>
          {isEdit ? 'Cập nhật' : 'Lưu'}
        </Button>
      }
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ type: 'expense', date: dayjs() }}>
        {/* Type toggle */}
        <Form.Item name="type" rules={[{ required: true }]}>
          <Segmented
            block
            options={[
              { value: 'expense', label: '💸  Chi tiêu' },
              { value: 'income', label: '💰  Thu / Hoàn' },
            ]}
          />
        </Form.Item>

        <Divider style={{ margin: '8px 0 16px' }} />

        {/* Card select */}
        <Form.Item name="cardId" label="Thẻ" rules={[{ required: true, message: 'Chọn thẻ thanh toán' }]}>
          <Select placeholder="Chọn thẻ" optionLabelProp="label" notFoundContent="Chưa có thẻ — hãy thêm thẻ trước">
            {cards.map(c => {
              const bank = banks.find(b => b.name === c.bank);
              return (
                <Select.Option key={c._id} value={c._id} label={`${c.bank} — ${c.cardName}`}>
                  <span className="inline-flex items-center gap-2">
                    <BankLogo name={c.bank} logo={bank?.logo} color={bank?.color} size={18} />
                    <span className="font-medium">{c.bank}</span>
                    <span className="text-gray-400 text-xs">— {c.cardName}</span>
                  </span>
                </Select.Option>
              );
            })}
          </Select>
        </Form.Item>

        {/* Selected card credit limit hint */}
        {selectedCard && (
          <div className="-mt-2 mb-4">
            <Text type="secondary" className="text-xs">
              Hạn mức thẻ: <span className="font-medium text-gray-600">{fmtVnd(selectedCard.creditLimit)}</span>
            </Text>
          </div>
        )}

        {/* Amount — nhập VND trực tiếp, có dấu phân cách nghìn */}
        <Form.Item
          name="amount"
          label="Số tiền (₫)"
          dependencies={['type', 'cardId']}
          rules={[
            { required: true, message: 'Nhập số tiền' },
            { type: 'number', min: 1, message: 'Phải lớn hơn 0' },
            {
              validator: (_, value) => {
                if (watchType === 'expense' && selectedCard && (value || 0) > selectedCard.creditLimit) {
                  return Promise.reject(new Error(`Chi tiêu vượt hạn mức thẻ (${fmtVnd(selectedCard.creditLimit)})`));
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            step={1000}
            precision={0}
            controls={false}
            formatter={vndFormatter}
            parser={vndParser}
            addonAfter="₫"
            placeholder="150.000"
            inputMode="numeric"
          />
        </Form.Item>

        {/* Chip nhập nhanh */}
        <div className="-mt-3 mb-4">
          <Space size={[6, 6]} wrap>
            {QUICK_AMOUNTS.map(q => (
              <Tag
                key={q.value}
                className="cursor-pointer select-none"
                color="blue"
                onClick={() => {
                  const cur = form.getFieldValue('amount') || 0;
                  form.setFieldValue('amount', cur + q.value);
                  form.validateFields(['amount']);
                }}
              >
                +{q.label}
              </Tag>
            ))}
            <Tag className="cursor-pointer select-none" onClick={() => form.setFieldValue('amount', undefined)}>
              Xóa
            </Tag>
          </Space>
        </div>

        {/* Category */}
        <Form.Item name="category" label="Danh mục" rules={[{ required: true, message: 'Chọn danh mục' }]}>
          <Select placeholder="Chọn danh mục" options={CATEGORIES.map(c => ({ label: c, value: c }))} />
        </Form.Item>

        {/* Date */}
        <Form.Item name="date" label="Ngày giao dịch" rules={[{ required: true, message: 'Chọn ngày' }]}>
          <DatePicker
            style={{ width: '100%' }}
            format="DD/MM/YYYY HH:mm"
            showTime={{ format: 'HH:mm' }}
            placeholder="Chọn ngày giờ"
            disabledDate={current =>
              !!current &&
              (current > dayjs().endOf('day') || current < dayjs().subtract(1, 'year').startOf('day'))
            }
          />
        </Form.Item>

        {/* Description */}
        <Form.Item name="description" label="Mô tả" rules={[{ required: true, message: 'Nhập mô tả' }]}>
          <Input.TextArea rows={2} placeholder="Mô tả giao dịch..." maxLength={200} showCount />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
